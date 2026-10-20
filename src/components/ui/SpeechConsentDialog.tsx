import { Cloud, Mic, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { useI18n } from '@/hooks/useI18n'

export function SpeechConsentDialog({
  open,
  onAccept,
  onClose,
}: {
  open: boolean
  onAccept: () => void
  onClose: () => void
}) {
  const { t } = useI18n()

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('speech.consentTitle')}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('speech.notNow')}
          </Button>
          <Button
            onClick={() => {
              onAccept()
              onClose()
            }}
          >
            <Mic size={15} /> {t('speech.enable')}
          </Button>
        </>
      }
    >
      <div className="space-y-3 text-sm leading-relaxed text-muted">
        <p className="flex items-start gap-2">
          <Cloud size={17} className="mt-0.5 shrink-0 text-accent" />
          <span>{t('speech.consentBody')}</span>
        </p>
        <p className="flex items-start gap-2 text-xs text-faint">
          <ShieldCheck size={15} className="mt-0.5 shrink-0" />
          <span>{t('speech.consentHint')}</span>
        </p>
      </div>
    </Modal>
  )
}
