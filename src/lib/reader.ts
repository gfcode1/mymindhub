export function normalizeReaderText(value: string): string {
  return value
    .replace(/\r\n?/g, '\n')
    .replace(/\u00a0/g, ' ')
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function extractReadableText(html: string): string {
  const document = new DOMParser().parseFromString(html, 'text/html')
  document
    .querySelectorAll(
      'script,style,noscript,template,svg,canvas,iframe,form,nav,header,footer,aside,[role="navigation"],[role="banner"],[role="complementary"],[aria-hidden="true"]',
    )
    .forEach((element) => element.remove())

  const root =
    document.querySelector('article') ??
    document.querySelector('main') ??
    document.querySelector('[role="main"]') ??
    document.body
  if (!root) return ''

  const blocks = root.querySelectorAll('h1,h2,h3,h4,h5,h6,p,li,blockquote,pre,td,th')
  const lines: string[] = []
  const seen = new Set<string>()

  if (blocks.length > 0) {
    for (const block of blocks) {
      const text = normalizeReaderText(block.textContent ?? '')
      if (!text || seen.has(text)) continue
      seen.add(text)
      lines.push(text)
    }
  }

  if (lines.length === 0) {
    return normalizeReaderText(root.textContent ?? '')
  }
  return normalizeReaderText(lines.join('\n\n'))
}

export function readingTimeMinutes(text: string): number {
  const words = text.trim() ? text.trim().split(/\s+/).length : 0
  if (words === 0) return 0
  return Math.max(1, Math.ceil(words / 200))
}

export async function fetchReadableContent(url: string, signal?: AbortSignal): Promise<string> {
  const response = await fetch(url, {
    signal,
    credentials: 'omit',
    headers: {
      Accept: 'text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.8',
    },
  })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  const contentType = response.headers.get('content-type') ?? ''
  if (
    contentType &&
    !contentType.includes('text/html') &&
    !contentType.includes('application/xhtml+xml') &&
    !contentType.includes('text/plain')
  ) {
    throw new Error('unsupported content type')
  }
  const raw = await response.text()
  const text = contentType.includes('text/plain')
    ? normalizeReaderText(raw)
    : extractReadableText(raw)
  if (!text || text.length < 80) throw new Error('empty content')
  return text.slice(0, 300_000)
}
