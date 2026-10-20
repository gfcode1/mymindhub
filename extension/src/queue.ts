import { MAX_CAPTURE_ITEMS, type CaptureItem } from '../../src/lib/captureProtocol'

const QUEUE_KEY = 'binhubCaptureQueue'
const PENDING_KEY = 'binhubPendingFlush'

export interface QueuedCapture {
  item: CaptureItem
  enqueuedAt: string
  attempts: number
  lastError?: string
}

export interface PendingFlush {
  requestId: string
  items: CaptureItem[]
  createdAt: string
  tabId?: number
}

export async function getQueue(): Promise<QueuedCapture[]> {
  const stored = await chrome.storage.local.get(QUEUE_KEY)
  const value = stored[QUEUE_KEY]
  return Array.isArray(value) ? (value as QueuedCapture[]) : []
}

export async function saveQueue(queue: QueuedCapture[]): Promise<void> {
  await chrome.storage.local.set({ [QUEUE_KEY]: queue })
  await updateBadge(queue.length)
}

export async function enqueueCaptures(
  items: CaptureItem[],
): Promise<{ accepted: number; rejected: number }> {
  const queue = await getQueue()
  const space = Math.max(0, MAX_CAPTURE_ITEMS - queue.length)
  const accepted = items.slice(0, space)
  const now = new Date().toISOString()
  for (const item of accepted) {
    queue.push({ item, enqueuedAt: now, attempts: 0 })
  }
  if (accepted.length > 0) await saveQueue(queue)
  return { accepted: accepted.length, rejected: items.length - accepted.length }
}

export async function removeQueueItems(ids: string[]): Promise<void> {
  if (ids.length === 0) return
  const set = new Set(ids)
  const queue = (await getQueue()).filter((entry) => !set.has(entry.item.id))
  await saveQueue(queue)
}

export async function markQueueErrors(ids: string[], message: string): Promise<void> {
  if (ids.length === 0) return
  const set = new Set(ids)
  const queue = await getQueue()
  for (const entry of queue) {
    if (!set.has(entry.item.id)) continue
    entry.attempts += 1
    entry.lastError = message
  }
  await saveQueue(queue)
}

export async function clearQueue(): Promise<void> {
  await chrome.storage.local.remove([QUEUE_KEY, PENDING_KEY])
  await updateBadge(0)
}

export async function getPendingFlush(): Promise<PendingFlush | null> {
  const stored = await chrome.storage.local.get(PENDING_KEY)
  const value = stored[PENDING_KEY]
  return value && typeof value === 'object' ? (value as PendingFlush) : null
}

export async function setPendingFlush(pending: PendingFlush): Promise<void> {
  await chrome.storage.local.set({ [PENDING_KEY]: pending })
}

export async function clearPendingFlush(): Promise<void> {
  await chrome.storage.local.remove(PENDING_KEY)
}

export async function updateBadge(count?: number): Promise<void> {
  const value = count ?? (await getQueue()).length
  try {
    await chrome.action.setBadgeText({ text: value > 0 ? String(value) : '' })
    await chrome.action.setBadgeBackgroundColor({ color: '#be123c' })
  } catch {
    // badge may be unavailable during early startup
  }
}
