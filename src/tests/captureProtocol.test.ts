import { describe, expect, it } from 'vitest'
import {
  CAPTURE_PROTOCOL_VERSION,
  CAPTURE_SOURCE,
  isCaptureItem,
  parseCaptureMessage,
} from '@/lib/captureProtocol'

const base = { source: CAPTURE_SOURCE, protocol: CAPTURE_PROTOCOL_VERSION }

describe('capture protocol', () => {
  it('validates items', () => {
    expect(
      isCaptureItem({
        id: '1',
        kind: 'bookmark',
        url: 'https://example.com',
        title: 'Example',
      }),
    ).toBe(true)
    expect(
      isCaptureItem({ id: '2', kind: 'bookmark', url: 'javascript:alert(1)', title: 'Bad' }),
    ).toBe(false)
    expect(isCaptureItem({ id: '3', kind: 'note', title: 'x', text: 'y', sourceUrl: 'nope' })).toBe(
      false,
    )
  })

  it('parses hello, ready and capture messages', () => {
    expect(parseCaptureMessage({ ...base, kind: 'hello' })?.kind).toBe('hello')
    expect(parseCaptureMessage({ ...base, kind: 'ready', appVersion: '1.0' })?.kind).toBe('ready')
    const message = parseCaptureMessage({
      ...base,
      kind: 'capture',
      requestId: 'req-1',
      items: [
        { id: '1', kind: 'note', title: 'Titolo', text: 'Testo', sourceUrl: 'https://example.com' },
      ],
    })
    expect(message?.kind).toBe('capture')
  })

  it('rejects wrong protocol, empty batches and invalid items', () => {
    expect(parseCaptureMessage({ ...base, protocol: 2, kind: 'hello' })).toBeNull()
    expect(parseCaptureMessage({ ...base, kind: 'capture', requestId: 'x', items: [] })).toBeNull()
    expect(
      parseCaptureMessage({
        ...base,
        kind: 'capture',
        requestId: 'x',
        items: [{ id: '1', kind: 'bookmark', url: 'https://example.com', title: 'ok' }],
      })?.kind,
    ).toBe('capture')
    expect(
      parseCaptureMessage({
        ...base,
        kind: 'capture',
        requestId: 'x',
        items: [
          { id: '1', kind: 'screenshot', dataUrl: 'data:image/png;base64,AA==', title: 'a', sourceUrl: 'https://a.com' },
          { id: '2', kind: 'screenshot', dataUrl: 'data:image/png;base64,AA==', title: 'b', sourceUrl: 'https://b.com' },
        ],
      })?.kind,
    ).toBe('capture')
  })

  it('parses acks', () => {
    const ack = parseCaptureMessage({
      ...base,
      kind: 'ack',
      requestId: 'r',
      results: [{ id: '1', status: 'created' }, { id: '2', status: 'skipped' }],
    })
    expect(ack?.kind).toBe('ack')
  })
})
