import { Readability } from '@mozilla/readability'

const MAX_CHARS = 300_000
const MIN_CHARS = 80

function normalize(value: string): string {
  return value
    .replace(/\r/g, '')
    .replace(/[\t ]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function fallbackText(): string {
  const clone = document.cloneNode(true) as Document
  clone
    .querySelectorAll('script,style,noscript,template,svg,canvas,iframe,form,nav,header,footer,aside')
    .forEach((element) => element.remove())
  const blocks = clone.querySelectorAll('h1,h2,h3,h4,h5,h6,p,li,blockquote,pre')
  const lines: string[] = []
  const seen = new Set<string>()
  for (const block of blocks) {
    const text = normalize(block.textContent ?? '')
    if (!text || seen.has(text)) continue
    seen.add(text)
    lines.push(text)
  }
  return normalize(lines.join('\n\n') || clone.body?.textContent || '')
}

function extract(): { content: string; title: string; byline: string } {
  const clone = document.cloneNode(true) as Document
  let content = ''
  let title = document.title
  let byline = ''
  try {
    const article = new Readability(clone, { charThreshold: MIN_CHARS }).parse()
    content = normalize(article?.textContent ?? '')
    title = article?.title?.trim() || title
    byline = article?.byline?.trim() ?? ''
  } catch {
    // fall through to the simple extractor
  }
  if (content.length < MIN_CHARS) content = fallbackText()
  return {
    content: content.slice(0, MAX_CHARS),
    title: title.slice(0, 500),
    byline: byline.slice(0, 500),
  }
}

const requestId = document.documentElement.getAttribute('data-binhub-reader-request') ?? ''
if (requestId) {
  document.documentElement.removeAttribute('data-binhub-reader-request')
  try {
    const result = extract()
    if (result.content.length < MIN_CHARS) {
      throw new Error('contenuto insufficiente')
    }
    void chrome.runtime
      .sendMessage({ type: 'readerResult', requestId, ok: true, result })
      .catch(() => undefined)
  } catch (error) {
    void chrome.runtime
      .sendMessage({
        type: 'readerResult',
        requestId,
        ok: false,
        error: error instanceof Error ? error.message : 'reader failed',
      })
      .catch(() => undefined)
  }
}
