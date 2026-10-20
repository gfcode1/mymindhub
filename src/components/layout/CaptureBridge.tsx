import { useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { useI18n } from '@/hooks/useI18n'
import { applyCaptures } from '@/lib/capture'
import {
  CAPTURE_PROTOCOL_VERSION,
  CAPTURE_SOURCE,
  parseCaptureMessage,
} from '@/lib/captureProtocol'

function post(payload: Record<string, unknown>): void {
  window.postMessage(
    { source: CAPTURE_SOURCE, protocol: CAPTURE_PROTOCOL_VERSION, ...payload },
    window.location.origin,
  )
}

export function CaptureBridge() {
  const { t, tCount } = useI18n()
  const busy = useRef(false)

  useEffect(() => {
    const handle = (event: MessageEvent) => {
      if (event.source !== window) return
      if (event.origin !== window.location.origin) return
      const message = parseCaptureMessage(event.data)
      if (!message) return

      if (message.kind === 'hello') {
        post({ kind: 'ready', appVersion: '1.0' })
        return
      }

      if (message.kind !== 'capture') return

      if (busy.current) {
        post({
          kind: 'ack',
          requestId: message.requestId,
          results: message.items.map((item) => ({
            id: item.id,
            status: 'error',
            message: 'busy',
          })),
        })
        return
      }

      busy.current = true
      void applyCaptures(message.items)
        .then((results) => {
          post({ kind: 'ack', requestId: message.requestId, results })
          const saved = results.filter(
            (result) => result.status === 'created' || result.status === 'updated',
          ).length
          const skipped = results.filter((result) => result.status === 'skipped').length
          const failed = results.filter((result) => result.status === 'error').length
          if (saved > 0) {
            const parts = [tCount('capture.saved', saved)]
            if (skipped > 0) parts.push(t('capture.skipped', { count: skipped }))
            if (failed > 0) parts.push(t('capture.failed', { count: failed }))
            toast.success(t('capture.received'), { description: parts.join(' · ') })
          } else if (failed > 0) {
            toast.error(t('capture.failed', { count: failed }))
          }
        })
        .catch(() => {
          post({
            kind: 'ack',
            requestId: message.requestId,
            results: message.items.map((item) => ({
              id: item.id,
              status: 'error',
              message: 'capture failed',
            })),
          })
        })
        .finally(() => {
          busy.current = false
        })
    }

    window.addEventListener('message', handle)
    post({ kind: 'ready', appVersion: '1.0' })
    return () => window.removeEventListener('message', handle)
  }, [t, tCount])

  return null
}
