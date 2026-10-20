import { normalizeUrl, truncate } from '@/lib/utils'

export type SharedKind = 'note' | 'todo' | 'bookmark'

export interface SharedDraft {
  kind: SharedKind
  title?: string
  text: string
  url?: string
  source: 'clipboard' | 'share'
}

function cleanLine(value: string): string {
  return value.replace(/^[#>*_\-\s]+/, '').trim()
}

export function draftFromText(text: string, title?: string, source: SharedDraft['source'] = 'clipboard'): SharedDraft | null {
  const content = text.trim()
  if (!content) return null

  const singleLine = !content.includes('\n')
  const normalized = singleLine ? normalizeUrl(content) : null
  if (normalized) {
    return {
      kind: 'bookmark',
      title: title?.trim() || undefined,
      text: content,
      url: normalized,
      source,
    }
  }

  const firstLine = cleanLine(content.split('\n')[0] ?? '') || title?.trim() || ''
  const heading = truncate(firstLine, 80)

  if (singleLine && content.length <= 80) {
    return { kind: 'todo', title: heading || content, text: content, source }
  }

  return {
    kind: 'note',
    title: heading,
    text: content,
    source,
  }
}

export function draftFromShare(params: URLSearchParams): SharedDraft | null {
  const url = params.get('url')?.trim() ?? ''
  const text = params.get('text')?.trim() ?? ''
  const title = params.get('title')?.trim() ?? ''
  const combined = [url, text].filter(Boolean).join('\n').trim()
  if (!combined) return null
  if (url) {
    return {
      kind: 'bookmark',
      title: title || undefined,
      text: combined,
      url,
      source: 'share',
    }
  }
  return draftFromText(combined, title, 'share')
}
