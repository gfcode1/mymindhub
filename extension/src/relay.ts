import {
  CAPTURE_PROTOCOL_VERSION,
  CAPTURE_SOURCE,
  type CaptureItem,
  type CaptureResult,
} from '../../src/lib/captureProtocol'

interface PendingFlush {
  requestId: string
  items: CaptureItem[]
}

interface RelayWindow extends Window {
  __binhubRelayStarted?: boolean
}

async function run(): Promise<void> {
  const relayWindow = window as RelayWindow
  if (relayWindow.__binhubRelayStarted) return
  relayWindow.__binhubRelayStarted = true

  let pending: PendingFlush | null = null
  try {
    pending = (await chrome.runtime.sendMessage({ type: 'relayGetPending' })) as PendingFlush | null
  } catch {
    relayWindow.__binhubRelayStarted = false
    return
  }
  if (!pending) {
    relayWindow.__binhubRelayStarted = false
    return
  }

  const origin = window.location.origin
  let sent = false
  let finished = false
  let timer: number | undefined

  const finish = () => {
    if (finished) return
    finished = true
    if (timer !== undefined) clearTimeout(timer)
    window.removeEventListener('message', onMessage)
    relayWindow.__binhubRelayStarted = false
  }

  const sendCapture = () => {
    if (sent || finished || !pending) return
    sent = true
    window.postMessage(
      {
        source: CAPTURE_SOURCE,
        protocol: CAPTURE_PROTOCOL_VERSION,
        kind: 'capture',
        requestId: pending.requestId,
        items: pending.items,
      },
      origin,
    )
  }

  const fail = () => {
    if (finished || !pending) return
    finish()
    void chrome.runtime
      .sendMessage({ type: 'relayFailed', requestId: pending.requestId })
      .catch(() => undefined)
  }

  const onMessage = (event: MessageEvent) => {
    if (event.source !== window || event.origin !== origin) return
    const data = event.data as Record<string, unknown> | null
    if (!data || data.source !== CAPTURE_SOURCE || data.protocol !== CAPTURE_PROTOCOL_VERSION) {
      return
    }
    if (data.kind === 'ready') {
      sendCapture()
      return
    }
    if (data.kind === 'ack' && data.requestId === pending?.requestId) {
      const results = Array.isArray(data.results) ? (data.results as CaptureResult[]) : []
      finish()
      void chrome.runtime
        .sendMessage({ type: 'relayAck', requestId: pending.requestId, results })
        .catch(() => undefined)
      return
    }
    if (data.kind === 'error' && data.requestId === pending?.requestId) {
      fail()
    }
  }

  window.addEventListener('message', onMessage)
  timer = window.setTimeout(fail, 15_000)

  window.postMessage(
    { source: CAPTURE_SOURCE, protocol: CAPTURE_PROTOCOL_VERSION, kind: 'hello' },
    origin,
  )
}

void run()
