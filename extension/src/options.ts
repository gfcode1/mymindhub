import {
  normalizeAppUrl,
  requestHostPermission,
  saveSettings,
} from './settings'

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

interface StatusResponse {
  ok: boolean
  settings?: { appUrl: string; openInBackground: boolean }
  queueCount?: number
  pending?: boolean
  permission?: boolean
}

async function refresh(): Promise<StatusResponse | null> {
  const status = await send<StatusResponse>({ type: 'getStatus' })
  if (!status?.ok) return null
  if (status.settings) {
    $<HTMLInputElement>('app-url').value = status.settings.appUrl
    $<HTMLInputElement>('open-background').checked = status.settings.openInBackground
  }
  const count = status.queueCount ?? 0
  $('queue-status').textContent =
    count > 0 ? t('queueLabel', [String(count)]) : t('queueEmpty')
  $('permission-status').textContent = status.permission
    ? t('permissionGranted')
    : t('permissionMissing')
  $<HTMLButtonElement>('retry').disabled = count === 0
  return status
}

async function init(): Promise<void> {
  document.documentElement.lang = chrome.i18n.getUILanguage().split('-')[0] ?? 'it'
  applyI18n()

  $('save').addEventListener('click', () => {
    void (async () => {
      const input = $<HTMLInputElement>('app-url')
      const normalized = normalizeAppUrl(input.value)
      if (!normalized) {
        showMessage(t('urlInvalid'), true)
        return
      }
      const granted = await requestHostPermission(normalized)
      if (!granted) {
        showMessage(t('permissionDenied'), true)
        return
      }
      await saveSettings({
        appUrl: normalized,
        openInBackground: $<HTMLInputElement>('open-background').checked,
      })
      input.value = normalized
      showMessage(t('settingsSaved'))
      await refresh()
    })()
  })

  $('open-app').addEventListener('click', () => {
    void (async () => {
      const response = await send<{ ok: boolean; error?: string }>({ type: 'openApp' })
      if (!response?.ok) {
        showMessage(t('permissionDenied'), true)
        return
      }
      showMessage(t('savedQueued'))
    })()
  })

  $('retry').addEventListener('click', () => {
    void (async () => {
      showMessage(t('pending'))
      const response = await send<{ ok: boolean; error?: string }>({ type: 'flush' })
      if (!response?.ok) showMessage(t('errorGeneric'), true)
      await refresh()
    })()
  })

  $('clear').addEventListener('click', () => {
    if (!confirm(t('clearConfirm'))) return
    void (async () => {
      await send({ type: 'clearQueue' })
      showMessage(t('cleared'))
      await refresh()
    })()
  })

  chrome.permissions.onAdded.addListener(() => void refresh())
  chrome.permissions.onRemoved.addListener(() => void refresh())
  await refresh()
}

void init()
