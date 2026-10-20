import { useEffect, useRef, useState } from 'react'
import { Mic } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useI18n } from '@/hooks/useI18n'
import { useSpeech, type SpeechErrorCode } from '@/hooks/useSpeech'
import { grantSpeechConsent, hasSpeechConsent } from '@/lib/speech'
import { SpeechConsentDialog } from './SpeechConsentDialog'

export function DictationButton({
  onText,
  className,
  disabled = false,
}: {
  onText: (text: string) => void
  className?: string
  disabled?: boolean
}) {
  const { t, language } = useI18n()
  const { supported, listening, error, start, stop, clearError } = useSpeech({ language, onFinal: onText })
  const [consentOpen, setConsentOpen] = useState(false)
  const lastError = useRef<SpeechErrorCode | null>(null)

  useEffect(() => {
    if (!error) {
      lastError.current = null
      return
    }
    if (lastError.current === error) return
    lastError.current = error
    if (error === 'no-speech') {
      toast.info(t('speech.noSpeech'))
      return
    }
    if (error === 'aborted' || error === 'unsupported') return
    toast.error(
      error === 'not-allowed'
        ? t('speech.notAllowed')
        : error === 'network'
          ? t('speech.network')
          : t('speech.unknown'),
    )
    clearError()
  }, [error, clearError, t])

  if (!supported) return null

  const handleClick = () => {
    if (listening) {
      stop()
      return
    }
    if (!hasSpeechConsent()) {
      setConsentOpen(true)
      return
    }
    start()
  }

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled}
        aria-label={listening ? t('speech.stop') : t('speech.start')}
        aria-pressed={listening}
        title={listening ? t('speech.stop') : t('speech.start')}
        className={cn(
          'relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:bg-raised hover:text-ink disabled:pointer-events-none disabled:opacity-40',
          listening && 'bg-accent-soft text-accent',
          className,
        )}
      >
        {listening ? (
          <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 animate-ping rounded-full bg-danger" />
        ) : null}
        <Mic size={15} className={listening ? 'animate-pulse' : undefined} />
      </button>

      <SpeechConsentDialog
        open={consentOpen}
        onAccept={() => {
          grantSpeechConsent()
          start()
        }}
        onClose={() => setConsentOpen(false)}
      />
    </>
  )
}
