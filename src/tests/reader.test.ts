import { describe, expect, it } from 'vitest'
import { extractReadableText, normalizeReaderText, readingTimeMinutes } from '@/lib/reader'

describe('reader', () => {
  it('extracts article text and removes chrome', () => {
    const html = `
      <html>
        <body>
          <header><nav>Menu principale</nav></header>
          <script>console.log('nope')</script>
          <article>
            <h1>Titolo articolo</h1>
            <p>Primo paragrafo con <strong>enfasi</strong>.</p>
            <p>Secondo paragrafo.</p>
            <ul><li>Punto uno</li><li>Punto due</li></ul>
          </article>
          <footer>Copyright</footer>
        </body>
      </html>
    `
    const text = extractReadableText(html)
    expect(text).toContain('Titolo articolo')
    expect(text).toContain('Primo paragrafo con enfasi.')
    expect(text).toContain('Punto uno')
    expect(text).not.toContain('Menu principale')
    expect(text).not.toContain('console.log')
    expect(text).not.toContain('Copyright')
  })

  it('normalizes spacing and blank lines', () => {
    expect(normalizeReaderText('  a  \r\n\r\n\r\n b\tc  ')).toBe('a\n\nb c')
  })

  it('computes reading time', () => {
    expect(readingTimeMinutes('')).toBe(0)
    expect(readingTimeMinutes('una parola')).toBe(1)
    expect(readingTimeMinutes(Array.from({ length: 450 }, () => 'parola').join(' '))).toBe(3)
  })
})
