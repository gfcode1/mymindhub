export const CAPTURE_SOURCE = 'binhub-capture'
export const CAPTURE_PROTOCOL_VERSION = 1
export const MAX_CAPTURE_ITEMS = 20
export const MAX_SELECTION_CHARS = 100_000
export const MAX_READER_CHARS = 300_000
export const MAX_SCREENSHOT_CHARS = 8_000_000
export const MAX_BATCH_CHARS = 10_000_000

export type CaptureKind = 'bookmark' | 'note' | 'todo' | 'reader' | 'screenshot'

interface CaptureBase {
  id: string
  kind: CaptureKind
}

export interface BookmarkCapture extends CaptureBase {
  kind: 'bookmark'
  url: string
  title: string
  description?: string
}

export interface NoteCapture extends CaptureBase {
  kind: 'note'
  title: string
  text: string
  sourceUrl: string
}

export interface TodoCapture extends CaptureBase {
  kind: 'todo'
  title: string
  notes: string
  sourceUrl: string
}

export interface ReaderCapture extends CaptureBase {
  kind: 'reader'
  url: string
  title: string
  content: string
  byline?: string
}

export interface ScreenshotCapture extends CaptureBase {
  kind: 'screenshot'
  dataUrl: string
  title: string
  sourceUrl: string
}

export type CaptureItem =
  | BookmarkCapture
  | NoteCapture
  | TodoCapture
  | ReaderCapture
  | ScreenshotCapture

export function captureItemSize(item: CaptureItem): number {
  if (item.kind === 'screenshot') return item.dataUrl.length
  if (item.kind === 'reader') return item.content.length
  if (item.kind === 'note') return item.text.length
  if (item.kind === 'todo') return item.notes.length
  return item.title.length + (item.description?.length ?? 0)
}

export type CaptureStatus = 'created' | 'updated' | 'skipped' | 'error'

export interface CaptureResult {
  id: string
  status: CaptureStatus
  message?: string
}

export type CaptureMessage =
  | { source: typeof CAPTURE_SOURCE; protocol: number; kind: 'hello' }
  | { source: typeof CAPTURE_SOURCE; protocol: number; kind: 'ready'; appVersion?: string }
  | {
      source: typeof CAPTURE_SOURCE
      protocol: number
      kind: 'capture'
      requestId: string
      items: CaptureItem[]
    }
  | {
      source: typeof CAPTURE_SOURCE
      protocol: number
      kind: 'ack'
      requestId: string
      results: CaptureResult[]
    }
  | {
      source: typeof CAPTURE_SOURCE
      protocol: number
      kind: 'error'
      requestId?: string
      message: string
    }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

function hasBase(value: Record<string, unknown>): boolean {
  return typeof value.id === 'string' && value.id.length > 0 && typeof value.kind === 'string'
}

export function isCaptureItem(value: unknown): value is CaptureItem {
  if (!isRecord(value) || !hasBase(value)) return false
  const kind = value.kind

  if (kind === 'bookmark') {
    return (
      typeof value.url === 'string' &&
      isHttpUrl(value.url) &&
      typeof value.title === 'string' &&
      (value.description === undefined || typeof value.description === 'string') &&
      value.title.length <= 500 &&
      (value.description?.length ?? 0) <= 10_000
    )
  }

  if (kind === 'note') {
    return (
      typeof value.title === 'string' &&
      typeof value.text === 'string' &&
      typeof value.sourceUrl === 'string' &&
      isHttpUrl(value.sourceUrl) &&
      value.text.length <= MAX_SELECTION_CHARS &&
      value.title.length <= 500
    )
  }

  if (kind === 'todo') {
    return (
      typeof value.title === 'string' &&
      typeof value.notes === 'string' &&
      typeof value.sourceUrl === 'string' &&
      isHttpUrl(value.sourceUrl) &&
      value.notes.length <= MAX_SELECTION_CHARS &&
      value.title.length <= 500
    )
  }

  if (kind === 'reader') {
    return (
      typeof value.url === 'string' &&
      isHttpUrl(value.url) &&
      typeof value.title === 'string' &&
      typeof value.content === 'string' &&
      value.content.length > 0 &&
      value.content.length <= MAX_READER_CHARS &&
      (value.byline === undefined || typeof value.byline === 'string')
    )
  }

  if (kind === 'screenshot') {
    return (
      typeof value.dataUrl === 'string' &&
      value.dataUrl.startsWith('data:image/') &&
      value.dataUrl.length <= MAX_SCREENSHOT_CHARS &&
      typeof value.title === 'string' &&
      typeof value.sourceUrl === 'string' &&
      isHttpUrl(value.sourceUrl)
    )
  }

  return false
}

export function parseCaptureMessage(data: unknown): CaptureMessage | null {
  if (!isRecord(data)) return null
  if (data.source !== CAPTURE_SOURCE) return null
  if (data.protocol !== CAPTURE_PROTOCOL_VERSION) return null

  if (data.kind === 'hello') {
    return { source: CAPTURE_SOURCE, protocol: CAPTURE_PROTOCOL_VERSION, kind: 'hello' }
  }

  if (data.kind === 'ready') {
    return {
      source: CAPTURE_SOURCE,
      protocol: CAPTURE_PROTOCOL_VERSION,
      kind: 'ready',
      appVersion: typeof data.appVersion === 'string' ? data.appVersion : undefined,
    }
  }

  if (data.kind === 'capture') {
    if (typeof data.requestId !== 'string' || !data.requestId) return null
    if (!Array.isArray(data.items) || data.items.length === 0) return null
    if (data.items.length > MAX_CAPTURE_ITEMS) return null
    if (!data.items.every(isCaptureItem)) return null
    const total = data.items.reduce((sum, item) => sum + captureItemSize(item), 0)
    if (total > MAX_BATCH_CHARS) return null
    return {
      source: CAPTURE_SOURCE,
      protocol: CAPTURE_PROTOCOL_VERSION,
      kind: 'capture',
      requestId: data.requestId,
      items: data.items,
    }
  }

  if (data.kind === 'ack') {
    if (typeof data.requestId !== 'string' || !Array.isArray(data.results)) return null
    const results = data.results.filter(
      (result): result is CaptureResult =>
        isRecord(result) &&
        typeof result.id === 'string' &&
        ['created', 'updated', 'skipped', 'error'].includes(String(result.status)) &&
        (result.message === undefined || typeof result.message === 'string'),
    )
    return {
      source: CAPTURE_SOURCE,
      protocol: CAPTURE_PROTOCOL_VERSION,
      kind: 'ack',
      requestId: data.requestId,
      results,
    }
  }

  if (data.kind === 'error') {
    if (typeof data.message !== 'string') return null
    return {
      source: CAPTURE_SOURCE,
      protocol: CAPTURE_PROTOCOL_VERSION,
      kind: 'error',
      requestId: typeof data.requestId === 'string' ? data.requestId : undefined,
      message: data.message,
    }
  }

  return null
}
