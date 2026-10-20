import {
  createBookmark,
  createNote,
  createTodo,
  createVaultFile,
  findBookmarkByUrl,
  updateBookmark,
} from '@/db/seed'
import { normalizeUrl, nowIso, truncate } from '@/lib/utils'
import type { CaptureItem, CaptureResult } from '@/lib/captureProtocol'

function firstLine(text: string): string {
  return (
    text
      .split('\n')
      .map((line) => line.trim())
      .find(Boolean) ?? ''
  )
}

function dataUrlToFile(dataUrl: string, title: string): File {
  const match = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(dataUrl)
  if (!match) throw new Error('Screenshot non valido')
  const mimeType = match[1] || 'image/png'
  const isBase64 = Boolean(match[2])
  const raw = match[3] ?? ''
  const bytes = isBase64
    ? Uint8Array.from(atob(raw), (char) => char.charCodeAt(0))
    : new TextEncoder().encode(decodeURIComponent(raw))
  const extension = mimeType.includes('jpeg') ? 'jpg' : 'png'
  const safeTitle = title.replace(/[^\w-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60)
  return new File([bytes], `${safeTitle || 'screenshot'}.${extension}`, { type: mimeType })
}

export async function applyCapture(item: CaptureItem): Promise<CaptureResult> {
  try {
    if (item.kind === 'bookmark') {
      const normalized = normalizeUrl(item.url)
      if (!normalized) return { id: item.id, status: 'error', message: 'URL non valido' }
      const existing = await findBookmarkByUrl(normalized)
      if (existing) {
        const patch: { title?: string; description?: string } = {}
        const title = item.title.trim()
        if (title && (!existing.title.trim() || existing.title === existing.url)) patch.title = title
        const description = item.description?.trim() ?? ''
        if (description && !existing.description.trim()) patch.description = description
        if (Object.keys(patch).length === 0) return { id: item.id, status: 'skipped' }
        await updateBookmark(existing.id, patch)
        return { id: item.id, status: 'updated' }
      }
      await createBookmark({
        url: normalized,
        title: item.title,
        description: item.description ?? '',
      })
      return { id: item.id, status: 'created' }
    }

    if (item.kind === 'reader') {
      const normalized = normalizeUrl(item.url)
      if (!normalized) return { id: item.id, status: 'error', message: 'URL non valido' }
      const existing = await findBookmarkByUrl(normalized)
      if (existing) {
        if (existing.readerContent.trim()) return { id: item.id, status: 'skipped' }
        await updateBookmark(existing.id, {
          readerContent: item.content,
          readerUpdatedAt: nowIso(),
          readingStatus: 'reading',
        })
        return { id: item.id, status: 'updated' }
      }
      const created = await createBookmark({
        url: normalized,
        title: item.title,
        readingStatus: 'reading',
      })
      await updateBookmark(created.id, {
        readerContent: item.content,
        readerUpdatedAt: nowIso(),
        readingStatus: 'reading',
      })
      return { id: item.id, status: 'created' }
    }

    if (item.kind === 'note') {
      const text = item.text.trim()
      const title = item.title.trim() || firstLine(text) || 'Nota dal web'
      const content = [text, `Fonte: ${item.sourceUrl}`].filter(Boolean).join('\n\n')
      await createNote({ title: truncate(title, 120), content })
      return { id: item.id, status: 'created' }
    }

    if (item.kind === 'todo') {
      const text = item.notes.trim()
      const title = item.title.trim() || firstLine(text) || 'Todo dal web'
      const notes = [text, `Fonte: ${item.sourceUrl}`].filter(Boolean).join('\n\n')
      await createTodo({ title: truncate(title, 160), notes })
      return { id: item.id, status: 'created' }
    }

    if (item.kind === 'screenshot') {
      const file = dataUrlToFile(item.dataUrl, item.title)
      await createVaultFile({
        file,
        title: item.title,
        category: 'Screenshot',
        description: item.sourceUrl,
      })
      return { id: item.id, status: 'created' }
    }

    return { id: (item as CaptureItem).id, status: 'error', message: 'Tipo non supportato' }
  } catch (error) {
    return {
      id: item.id,
      status: 'error',
      message: error instanceof Error ? error.message : 'Errore sconosciuto',
    }
  }
}

export async function applyCaptures(items: CaptureItem[]): Promise<CaptureResult[]> {
  const results: CaptureResult[] = []
  for (const item of items) {
    results.push(await applyCapture(item))
  }
  return results
}
