import {
  MAX_BATCH_CHARS,
  MAX_CAPTURE_ITEMS,
  MAX_READER_CHARS,
  captureItemSize,
  isCaptureItem,
  type CaptureItem,
  type CaptureResult,
} from '../../src/lib/captureProtocol'
import {
  clearPendingFlush,
  clearQueue,
  enqueueCaptures,
  getPendingFlush,
  getQueue,
  markQueueErrors,
  removeQueueItems,
  setPendingFlush,
  updateBadge,
} from './queue'
import { getSettings, hasHostPermission } from './settings'
import { openAppTab, waitForTabComplete } from './tabs'

interface ReaderResult {
  content: string
  title: string
  byline?: string
}

interface ReaderWaiter {
  resolve: (value: ReaderResult) => void
  reject: (error: Error) => void
  timer: number
}

const readerWaiters = new Map<string, ReaderWaiter>()
let flushing = false

function waitForReaderResult(requestId: string): Promise<ReaderResult> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      readerWaiters.delete(requestId)
      reject(new Error('reader timeout'))
    }, 15_000)
    readerWaiters.set(requestId, { resolve, reject, timer })
  })
}

function handleReaderResult(message: Record<string, unknown>): void {
  const requestId = typeof message.requestId === 'string' ? message.requestId : ''
  const waiter = readerWaiters.get(requestId)
  if (!waiter) return
  clearTimeout(waiter.timer)
  readerWaiters.delete(requestId)
  if (message.ok === true && message.result && typeof message.result === 'object') {
    const result = message.result as Partial<ReaderResult>
    if (typeof result.content === 'string' && typeof result.title === 'string') {
      waiter.resolve({
        content: result.content,
        title: result.title,
        byline: typeof result.byline === 'string' ? result.byline : undefined,
      })
      return
    }
  }
  waiter.reject(new Error(typeof message.error === 'string' ? message.error : 'reader failed'))
}

async function extractReader(tabId: number, url: string, title: string): Promise<ReaderResult> {
  const requestId = crypto.randomUUID()
  const resultPromise = waitForReaderResult(requestId)
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      func: (id: string) => {
        document.documentElement.setAttribute('data-binhub-reader-request', id)
      },
      args: [requestId],
    })
    await chrome.scripting.executeScript({ target: { tabId }, files: ['reader-extract.js'] })
    const result = await resultPromise
    return {
      content: result.content.slice(0, MAX_READER_CHARS),
      title: result.title || title || url,
      byline: result.byline,
    }
  } catch (error) {
    const waiter = readerWaiters.get(requestId)
    if (waiter) {
      clearTimeout(waiter.timer)
      readerWaiters.delete(requestId)
    }
    throw error
  }
}

async function flushQueue(): Promise<{ ok: boolean; pending?: boolean; error?: string }> {
  if (flushing) return { ok: true }
  flushing = true
  try {
    const pending = await getPendingFlush()
    if (pending) return { ok: true, pending: true }

    const queue = await getQueue()
    if (queue.length === 0) {
      await updateBadge(0)
      return { ok: true }
    }

    const settings = await getSettings()
    if (!settings.appUrl) return { ok: false, error: 'setup' }
    if (!(await hasHostPermission(settings.appUrl))) return { ok: false, error: 'permission' }

    const items: CaptureItem[] = []
    let totalSize = 0
    for (const entry of queue) {
      const size = captureItemSize(entry.item)
      if (items.length > 0 && totalSize + size > MAX_BATCH_CHARS) break
      items.push(entry.item)
      totalSize += size
      if (items.length >= MAX_CAPTURE_ITEMS) break
    }
    const requestId = crypto.randomUUID()
    const createdAt = new Date().toISOString()
    await setPendingFlush({ requestId, items, createdAt })

    const tab = await openAppTab(settings.appUrl, !settings.openInBackground)
    if (tab.id === undefined) throw new Error('tab not available')
    await waitForTabComplete(tab.id)
    await setPendingFlush({ requestId, items, createdAt, tabId: tab.id })
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['relay.js'],
    })
    return { ok: true, pending: true }
  } catch (error) {
    await clearPendingFlush()
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'flush failed',
    }
  } finally {
    flushing = false
    await updateBadge()
  }
}

async function handleRelayAck(requestId: string, results: CaptureResult[]): Promise<void> {
  const pending = await getPendingFlush()
  if (!pending || pending.requestId !== requestId) return
  const successful = results.filter((result) => result.status !== 'error').map((result) => result.id)
  await removeQueueItems(successful)
  for (const result of results) {
    if (result.status !== 'error') continue
    await markQueueErrors([result.id], result.message ?? 'error')
  }
  await clearPendingFlush()
  await updateBadge()
}

async function handleMessage(
  message: Record<string, unknown>,
  sender: chrome.runtime.MessageSender,
): Promise<unknown> {
  const type = typeof message.type === 'string' ? message.type : ''

  if (type === 'getStatus') {
    const settings = await getSettings()
    const queue = await getQueue()
    const pending = await getPendingFlush()
    const permission = await hasHostPermission(settings.appUrl)
    return {
      ok: true,
      settings,
      queueCount: queue.length,
      pending: pending !== null,
      permission,
    }
  }

  if (type === 'capture') {
    const rawItems = Array.isArray(message.items) ? message.items : []
    const items = rawItems.filter(isCaptureItem) as CaptureItem[]
    if (items.length === 0) return { ok: false, error: 'invalid items' }
    const result = await enqueueCaptures(items.slice(0, MAX_CAPTURE_ITEMS))
    void flushQueue()
    const queue = await getQueue()
    return { ok: true, ...result, queueCount: queue.length }
  }

  if (type === 'extractReader') {
    const tabId = typeof message.tabId === 'number' ? message.tabId : undefined
    const url = typeof message.url === 'string' ? message.url : ''
    const title = typeof message.title === 'string' ? message.title : ''
    if (tabId === undefined || !url) return { ok: false, error: 'invalid tab' }
    try {
      const result = await extractReader(tabId, url, title)
      if (result.content.trim().length < 80) {
        return { ok: false, error: 'empty reader content' }
      }
      const item: CaptureItem = {
        id: crypto.randomUUID(),
        kind: 'reader',
        url,
        title: result.title,
        content: result.content,
        byline: result.byline,
      }
      const queued = await enqueueCaptures([item])
      void flushQueue()
      const queue = await getQueue()
      return { ok: true, ...queued, queueCount: queue.length }
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : 'reader failed',
      }
    }
  }

  if (type === 'flush') {
    const result = await flushQueue()
    return { ok: result.ok, error: result.error, pending: result.pending }
  }

  if (type === 'clearQueue') {
    await clearQueue()
    return { ok: true }
  }

  if (type === 'openApp') {
    const settings = await getSettings()
    if (!(await hasHostPermission(settings.appUrl))) {
      return { ok: false, error: 'permission' }
    }
    await openAppTab(settings.appUrl, true)
    return { ok: true }
  }

  if (type === 'relayGetPending') {
    return await getPendingFlush()
  }

  if (type === 'relayAck') {
    const requestId = typeof message.requestId === 'string' ? message.requestId : ''
    const results = Array.isArray(message.results) ? (message.results as CaptureResult[]) : []
    if (!requestId) return { ok: false }
    await handleRelayAck(requestId, results)
    return { ok: true }
  }

  if (type === 'relayFailed') {
    const pending = await getPendingFlush()
    if (pending && pending.requestId === message.requestId) {
      await clearPendingFlush()
    }
    await updateBadge()
    return { ok: true }
  }

  if (sender.tab && type === 'readerResult') {
    handleReaderResult(message)
    return { ok: true }
  }

  return { ok: false, error: 'unknown message' }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || typeof message !== 'object') return false
  const record = message as Record<string, unknown>
  if (record.type === 'readerResult') {
    handleReaderResult(record)
    sendResponse({ ok: true })
    return false
  }
  void handleMessage(record, sender)
    .then(sendResponse)
    .catch((error: unknown) => {
      sendResponse({ ok: false, error: error instanceof Error ? error.message : 'error' })
    })
  return true
})

chrome.runtime.onInstalled.addListener(() => {
  void updateBadge()
})

chrome.runtime.onStartup.addListener(() => {
  void updateBadge()
  void flushQueue()
})

chrome.permissions.onAdded.addListener(() => {
  void flushQueue()
})

chrome.tabs.onUpdated.addListener((_tabId, info, tab) => {
  if (info.status !== 'complete' || !tab.url) return
  void getSettings().then((settings) => {
    if (!tab.url?.startsWith(settings.appUrl)) return
    void getQueue().then((queue) => {
      if (queue.length > 0) void flushQueue()
    })
  })
})
