import { useEffect, useId, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useI18n } from '@/hooks/useI18n'
import { Button } from './Button'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  children: ReactNode
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg'
}

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
}: ModalProps) {
  const { t } = useI18n()
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const descriptionId = useId()

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) {
      dialog.showModal()
      document.body.style.overflow = 'hidden'
    } else if (!open && dialog.open) {
      dialog.close()
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  useEffect(() => {
    if (!open) document.body.style.overflow = ''
  }, [open])

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onClose={onClose}
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      onClick={(event) => {
        if (event.target === ref.current) onClose()
      }}
      className={cn(
        'fixed inset-x-0 bottom-0 top-auto m-0 w-full max-w-none overflow-hidden rounded-t-3xl border border-line bg-surface p-0 text-ink shadow-2xl',
        'max-h-[92dvh] sm:inset-0 sm:m-auto sm:max-h-[86dvh] sm:rounded-3xl',
        size === 'sm' && 'sm:max-w-sm',
        size === 'md' && 'sm:max-w-lg',
        size === 'lg' && 'sm:max-w-2xl',
      )}
    >
      <div className="flex max-h-[92dvh] flex-col sm:max-h-[86dvh]">
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 pb-4 pt-5">
          <div>
            <h2 id={titleId} className="text-lg font-semibold tracking-tight">
              {title}
            </h2>
            {description ? (
              <p id={descriptionId} className="mt-1 text-sm text-muted">
                {description}
              </p>
            ) : null}
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label={t('modal.close')}>
            <X size={18} />
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer ? (
          <div className="safe-bottom flex items-center justify-end gap-2 border-t border-line px-5 pt-3">
            {footer}
          </div>
        ) : null}
      </div>
    </dialog>
  )
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel,
  destructive = false,
  onConfirm,
  onClose,
}: {
  open: boolean
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  destructive?: boolean
  onConfirm: () => void
  onClose: () => void
}) {
  const { t } = useI18n()
  const confirmText = confirmLabel ?? t('confirm.confirm')
  const cancelText = cancelLabel ?? t('confirm.cancel')
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {cancelText}
          </Button>
          <Button
            variant={destructive ? 'danger' : 'primary'}
            onClick={() => {
              onConfirm()
              onClose()
            }}
          >
            {confirmText}
          </Button>
        </>
      }
    >
      <div className="text-sm text-muted">{t('common.deviceOnly')}</div>
    </Modal>
  )
}
