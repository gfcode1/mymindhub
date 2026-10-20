import {
  MAX_SCREENSHOT_CHARS,
  MAX_SELECTION_CHARS,
  type CaptureItem,
} from '../../src/lib/captureProtocol'

interface StatusResponse {
  ok: boolean
  settings?: { appUrl: string; openInBackground: boolean }
  queueCount?: number
  pending?: boolean
  permission?: boolean
}

function t(key: string, substitutions?: string | string[]): string {
  return chrome.i18n.getMessage(key, substitutions) || key
}

function $<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id)
  if (!element) throw new Error(`missing element #${id}`)
  return element as T
}

function applyI18n(): void {
  document.querySelectorAll<HTMLElement>('[data-i18n]').forEach((element) => {
    const key = element.dataset.i18n
    if (!key) return
    const message = t(key)
    if (message) element.textContent = message
  })
}

function send<T>(message: Record<string, unknown>): Promise<T> {
  return chrome.runtime.sendMessage(message) as Promise<T>
}

function showMessage(message: string, error = false): void {
  const element = $('message')
  element.textContent = message
  element.classList.toggle('error', error)
}

function setBusy(busy: boolean): void {
  document.querySelectorAll<HTMLButtonElement>('button').forEach((button) => {
    if (button.id === 'options' || button.id === 'setup-action') return
    button.disabled = busy || button.dataset.blocked === 'true'
  })
}

let currentTab: chrome.tabs.Tab | null = null
let pageInfo = { selection: '', description: '' }
let status: StatusResponse | null = null

function isSupportedPage(): boolean {
  return Boolean(currentTab?.url && /^https?:/i.test(currentTab.url))
}

function updateControls(): void {
  const permission = status?.permission === true
  const supported = isSupportedPage()
  const enabled = permission && supported
  const noteEnabled = enabled && pageInfo.selection.trim().length > 0

  for (const id of ['bookmark', 'reader', 'clipboard', 'screenshot']) {
    const button = $<HTMLButtonElement>(id)
    button.dataset.blocked = enabled ? 'false' : 'true'
    button.disabled = !enabled
  }
  for (const id of ['note', 'todo']) {
    const button = $<HTMLButtonElement>(id)
    button.dataset.blocked = noteEnabled ? 'false' : 'true'
    button.disabled = !noteEnabled
  }
  $<HTMLButtonElement>('open-app').disabled = !permission
  $<HTMLButtonElement>('retry').disabled = !status || (status.queueCount ?? 0) === 0

  const banner = $('setup')
  banner.classList.toggle('hidden', permission && Boolean(status?.settings?.appUrl))
}

function renderStatus(): void {
  const queueCount = status?.queueCount ?? 0
  const badge = $('queue-badge')
  badge.textContent = queueCount > 0 ? String(queueCount) : ''
  badge.classList.toggle('hidden', queueCount === 0)

  const statusElement = $('status')
  if (!status?.permission) {
    statusElement.textContent = t('statusPermission')
  } else if (status.pending) {
    statusElement.textContent = t('pending')
  } else if (queueCount > 0) {
    statusElement.textContent = t('statusQueue', [String(queueCount)])
  } else {
    statusElement.textContent = t('statusReady')
  }

  const selectionBox = $('selection-box')
  if (pageInfo.selection.trim()) {
    selectionBox.classList.remove('hidden')
    $('selection-preview').textContent = pageInfo.selection.trim().slice(0, 280)
  } else {
    selectionBox.classList.add('hidden')
  }
  updateControls()
}

async function refreshStatus(): Promise<void> {
  status = await send<StatusResponse>({ type: 'getStatus' })
  renderStatus()
}

function newId(): string {
  return crypto.randomUUID()
}

async function getActiveTab(): Promise<chrome.tabs.Tab | null> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  return tab ?? null
}

async function readPageInfo(tabId: number): Promise<void> {
  try {
    const [result] = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => ({
        selection: window.getSelection()?.toString() ?? '',
        description:
          document.querySelector('meta[name="description"]')?.getAttribute('content') ??
          document.querySelector('meta[property="og:description"]')?.getAttribute('content') ??
          '',
      }),
    })
    const value = result?.result as { selection?: string; description?: string } | undefined
    pageInfo = {
      selection: value?.selection ?? '',
      description: value?.description ?? '',
    }
  } catch {
    pageInfo = { selection: '', description: '' }
  }
}

async function capture(items: CaptureItem[]): Promise<void> {
  try {
    const response = await send<{
      ok: boolean
      accepted?: number
      rejected?: number
      queueCount?: number
      error?: string
    }>({ type: 'capture', items })
    if (!response?.ok) {
      showMessage(t('errorGeneric'), true)
      return
    }
    if ((response.rejected ?? 0) > 0) {
      showMessage(t('queueFull'), true)
    } else {
      showMessage(t('savedQueued'))
    }
    await refreshStatus()
  } catch {
    showMessage(t('errorGeneric'), true)
  }
}

function bind(id: string, handler: () => void | Promise<void>): void {
  $(id).addEventListener('click', () => {
    void Promise.resolve(handler()).catch(() => showMessage(t('errorGeneric'), true))
  })
}

async function init(): Promise<void> {
  document.documentElement.lang = chrome.i18n.getUILanguage().split('-')[0] ?? 'it'
  applyI18n()
  bind('options', () => chrome.runtime.openOptionsPage())
  bind('setup-action', () => chrome.runtime.openOptionsPage())

  await refreshStatus()
  currentTab = await getActiveTab()

  if (!currentTab?.id || !isSupportedPage()) {
    showMessage(t('unsupportedPage'), true)
    updateControls()
    return
  }

  await readPageInfo(currentTab.id)
  renderStatus()

  bind('bookmark', async () => {
    if (!currentTab?.id || !currentTab.url) return
    await capture([
      {
        id: newId(),
        kind: 'bookmark',
        url: currentTab.url,
        title: currentTab.title || currentTab.url,
        description: pageInfo.description.slice(0, 10_000),
      },
    ])
  })

  bind('note', async () => {
    if (!currentTab?.id || !currentTab.url) return
    const text = pageInfo.selection.trim()
    if (!text) {
      showMessage(t('selectionEmpty'), true)
      return
    }
    if (text.length > MAX_SELECTION_CHARS) showMessage(t('selectionTooLong'), true)
    await capture([
      {
        id: newId(),
        kind: 'note',
        title: currentTab.title || 'Nota dal web',
        text: text.slice(0, MAX_SELECTION_CHARS),
        sourceUrl: currentTab.url,
      },
    ])
  })

  bind('todo', async () => {
    if (!currentTab?.id || !currentTab.url) return
    const text = pageInfo.selection.trim()
    if (!text) {
      showMessage(t('selectionEmpty'), true)
      return
    }
    if (text.length > MAX_SELECTION_CHARS) showMessage(t('selectionTooLong'), true)
    const firstLine = text.split('\n').map((line) => line.trim()).find(Boolean) ?? 'Todo dal web'
    await capture([
      {
        id: newId(),
        kind: 'todo',
        title: firstLine.slice(0, 160),
        notes: text.slice(0, MAX_SELECTION_CHARS),
        sourceUrl: currentTab.url,
      },
    ])
  })

  bind('reader', async () => {
    if (!currentTab?.id || !currentTab.url) return
    setBusy(true)
    showMessage(t('extracting'))
    try {
      const response = await send<{ ok: boolean; queueCount?: number }>({
        type: 'extractReader',
        tabId: currentTab.id,
        url: currentTab.url,
        title: currentTab.title || currentTab.url,
      })
      if (!response?.ok) {
        showMessage(t('extractFailed'), true)
      } else {
        showMessage(t('savedQueued'))
      }
      await refreshStatus()
    } finally {
      setBusy(false)
    }
  })

  bind('clipboard', async () => {
    try {
      const text = await navigator.clipboard.readText()
      if (!text.trim()) {
        showMessage(t('clipboardEmpty'), true)
        return
      }
      $('clipboard-panel').classList.remove('hidden')
      $<HTMLTextAreaElement>('clipboard-text').value = text.slice(0, MAX_SELECTION_CHARS)
    } catch {
      showMessage(t('errorGeneric'), true)
    }
  })

  bind('clipboard-note', async () => {
    if (!currentTab?.url) return
    const text = $<HTMLTextAreaElement>('clipboard-text').value.trim()
    if (!text) {
      showMessage(t('clipboardEmpty'), true)
      return
    }
    await capture([
      {
        id: newId(),
        kind: 'note',
        title: t('clipboardNoteTitle'),
        text: text.slice(0, MAX_SELECTION_CHARS),
        sourceUrl: currentTab.url,
      },
    ])
  })

  bind('clipboard-todo', async () => {
    if (!currentTab?.url) return
    const text = $<HTMLTextAreaElement>('clipboard-text').value.trim()
    if (!text) {
      showMessage(t('clipboardEmpty'), true)
      return
    }
    await capture([
      {
        id: newId(),
        kind: 'todo',
        title: t('clipboardTodoTitle'),
        notes: text.slice(0, MAX_SELECTION_CHARS),
        sourceUrl: currentTab.url,
      },
    ])
  })

  bind('screenshot', async () => {
    if (!currentTab?.windowId || !currentTab.url) return
    try {
      const dataUrl = await chrome.tabs.captureVisibleTab(currentTab.windowId, { format: 'png' })
      if (dataUrl.length > MAX_SCREENSHOT_CHARS) {
        showMessage(t('screenshotTooLarge'), true)
        return
      }
      const host = new URL(currentTab.url).hostname
      await capture([
        {
          id: newId(),
          kind: 'screenshot',
          dataUrl,
          title: `${t('screenshotTitle', [host])} — ${new Date().toLocaleDateString()}`,
          sourceUrl: currentTab.url,
        },
      ])
    } catch {
      showMessage(t('errorGeneric'), true)
    }
  })

  bind('open-app', async () => {
    const response = await send<{ ok: boolean; error?: string }>({ type: 'openApp' })
    if (!response?.ok) showMessage(t('permissionDenied'), true)
  })

  chrome.storage.onChanged.addListener((_changes, area) => {
    if (area === 'local') void refreshStatus()
  })

  bind('retry', async () => {
    showMessage(t('pending'))
    const response = await send<{ ok: boolean; error?: string }>({ type: 'flush' })
    if (!response?.ok) showMessage(t('errorGeneric'), true)
    await refreshStatus()
  })
}

void init()
