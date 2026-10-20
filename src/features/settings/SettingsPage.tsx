import { useRef, useState } from 'react'
import {
  CalendarDays,
  Check,
  Database,
  Download,
  HardDrive,
  Info,
  Languages,
  Lock,
  Monitor,
  Moon,
  Palette,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Sun,
  Trash2,
  Upload,
} from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Field'
import { Modal, ConfirmDialog } from '@/components/ui/Modal'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { useSettings, useTags } from '@/hooks/useData'
import { useI18n } from '@/hooks/useI18n'
import { useInstallPrompt, useStorageEstimate } from '@/hooks/usePwa'
import { clearAllData, saveSettings } from '@/db/seed'
import { buildBackup, importBackup, type ImportMode } from '@/db/backup'
import { formatBytes, formatDateTime } from '@/lib/dates'
import { LANGUAGES } from '@/lib/i18n'
import {
  BackupCryptoError,
  MIN_BACKUP_PASSWORD_LENGTH,
  isEncryptedBackupFile,
} from '@/lib/crypto'
import { hasSpeechConsent, revokeSpeechConsent } from '@/lib/speech'
import { ACCENTS, type Accent, type CalendarView, type Theme } from '@/types/models'
import { downloadBlob, isIos, nowIso } from '@/lib/utils'

export function SettingsPage() {
  const { settings } = useSettings()
  const tags = useTags()
  const { t, locale } = useI18n()
  const { canInstall, installed, install } = useInstallPrompt()
  const storage = useStorageEstimate()
  const [exporting, setExporting] = useState(false)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [importing, setImporting] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)
  const [speechConsent, setSpeechConsent] = useState(() => hasSpeechConsent())
  const [encryptedExportOpen, setEncryptedExportOpen] = useState(false)
  const [exportPassword, setExportPassword] = useState('')
  const [exportConfirm, setExportConfirm] = useState('')
  const [exportPasswordError, setExportPasswordError] = useState('')
  const [pendingEncrypted, setPendingEncrypted] = useState(false)
  const [checkingFile, setCheckingFile] = useState(false)
  const [importPassword, setImportPassword] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const themes: { value: Theme; label: string; icon: typeof Sun }[] = [
    { value: 'light', label: t('settings.themeLight'), icon: Sun },
    { value: 'dark', label: t('settings.themeDark'), icon: Moon },
    { value: 'system', label: t('settings.themeSystem'), icon: Monitor },
  ]

  const cryptoErrorMessage = (error: unknown): string | null => {
    if (!(error instanceof BackupCryptoError)) return null
    if (error.code === 'wrong-password') return t('settings.wrongPassword')
    if (error.code === 'crypto-unavailable') return t('settings.cryptoUnavailable')
    if (error.code === 'password-required') return t('settings.passwordRequired')
    return t('settings.invalidEncryptedFile')
  }

  const exportData = async (password?: string) => {
    setExporting(true)
    try {
      const backup = await buildBackup(password ? { password } : {})
      downloadBlob(backup.blob, backup.filename)
      await saveSettings({ lastBackupAt: nowIso() })
      toast.success(
        backup.encrypted ? t('settings.encryptedExported') : t('settings.exported'),
        {
          description: `${backup.counts.notes} · ${backup.counts.todos} · ${backup.counts.voiceNotes}`,
        },
      )
      if (backup.encrypted) {
        setEncryptedExportOpen(false)
        setExportPassword('')
        setExportConfirm('')
        setExportPasswordError('')
      }
    } catch (error) {
      toast.error(cryptoErrorMessage(error) ?? t('settings.exportError'))
    } finally {
      setExporting(false)
    }
  }

  const confirmEncryptedExport = () => {
    if (!exportPassword) {
      setExportPasswordError(t('settings.passwordRequired'))
      return
    }
    if (exportPassword.length < MIN_BACKUP_PASSWORD_LENGTH) {
      setExportPasswordError(
        t('settings.passwordTooShort', { count: MIN_BACKUP_PASSWORD_LENGTH }),
      )
      return
    }
    if (exportPassword !== exportConfirm) {
      setExportPasswordError(t('settings.passwordMismatch'))
      return
    }
    setExportPasswordError('')
    void exportData(exportPassword)
  }

  const runImport = async (mode: ImportMode) => {
    if (!pendingFile) return
    setImporting(true)
    try {
      const result = await importBackup(
        pendingFile,
        mode,
        pendingEncrypted ? importPassword : undefined,
      )
      const total = Object.values(result.imported).reduce((sum, value) => sum + value, 0)
      toast.success(mode === 'replace' ? t('settings.imported') : t('settings.merged'), {
        description: t('settings.importSummary', {
          count: total,
          skipped: result.skipped ? t('settings.importSkipped', { count: result.skipped }) : '',
        }),
      })
      setPendingFile(null)
      setPendingEncrypted(false)
      setImportPassword('')
      await storage.refresh()
    } catch (error) {
      toast.error(
        cryptoErrorMessage(error) ??
          (error instanceof Error ? error.message : t('settings.imported')),
      )
    } finally {
      setImporting(false)
    }
  }

  const usageRatio =
    storage.usage !== null && storage.quota ? Math.min(1, storage.usage / storage.quota) : null

  return (
    <div className="animate-fade-in">
      <PageHeader title={t('settings.title')} subtitle={t('settings.subtitle')} />

      <section className="mb-6">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-faint">
          {t('settings.appearance')}
        </h2>
        <div className="rounded-2xl border border-line bg-surface p-4">
          <div className="mb-1.5 flex items-center gap-2 text-sm font-medium">
            <Languages size={16} className="text-muted" /> {t('settings.language')}
          </div>
          <SegmentedControl
            value={settings.language}
            onChange={(language) => void saveSettings({ language })}
            options={LANGUAGES.map((item) => ({ value: item.value, label: item.label }))}
          />

          <div className="mb-1.5 mt-5 flex items-center gap-2 text-sm font-medium">
            <Sun size={16} className="text-muted" /> {t('settings.theme')}
          </div>
          <SegmentedControl
            value={settings.theme}
            onChange={(theme) => void saveSettings({ theme })}
            options={themes.map((theme) => ({ value: theme.value, label: theme.label }))}
          />

          {speechConsent ? (
            <div className="mt-4 flex items-center justify-between gap-2 rounded-xl border border-line bg-canvas/40 px-3 py-2">
              <span className="text-xs text-muted">{t('speech.consentActive')}</span>
              <button
                type="button"
                onClick={() => {
                  revokeSpeechConsent()
                  setSpeechConsent(false)
                  toast.success(t('speech.revoked'))
                }}
                className="text-xs font-medium text-accent hover:underline"
              >
                {t('speech.revoke')}
              </button>
            </div>
          ) : null}

          <div className="mb-2 mt-5 flex items-center gap-2 text-sm font-medium">
            <Palette size={16} className="text-muted" /> {t('settings.accent')}
          </div>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(ACCENTS) as Accent[]).map((key) => {
              const accent = ACCENTS[key]
              const active = settings.accent === key
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => void saveSettings({ accent: key })}
                  aria-label={t('settings.accentAria', { name: accent.label })}
                  aria-pressed={active}
                  className={`flex h-10 items-center gap-2 rounded-xl border px-2.5 text-xs font-medium transition-colors ${
                    active ? 'border-accent bg-accent-soft text-accent' : 'border-line text-muted'
                  }`}
                >
                  <span className="h-5 w-5 rounded-full" style={{ background: accent.light }} />
                  {accent.label}
                  {active ? <Check size={13} /> : null}
                </button>
              )
            })}
          </div>

          <div className="mb-2 mt-5 flex items-center gap-2 text-sm font-medium">
            <CalendarDays size={16} className="text-muted" /> {t('settings.calendarView')}
          </div>
          <SegmentedControl
            value={settings.calendarView}
            onChange={(calendarView: CalendarView) => void saveSettings({ calendarView })}
            options={[
              { value: 'month', label: t('calendar.month') },
              { value: 'week', label: t('calendar.week') },
              { value: 'day', label: t('calendar.day') },
            ]}
          />
        </div>
      </section>

      <section className="mb-6">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-faint">
          {t('settings.install')}
        </h2>
        <div className="rounded-2xl border border-line bg-surface p-4">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
              <Smartphone size={18} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">
                {installed ? t('settings.installedTitle') : t('settings.installTitle')}
              </p>
              <p className="mt-0.5 text-xs leading-relaxed text-muted">
                {installed
                  ? t('settings.installedDesc')
                  : canInstall
                    ? t('settings.installDesc')
                    : isIos()
                      ? t('settings.installIos')
                      : t('settings.installHint')}
              </p>
              {canInstall ? (
                <Button size="sm" className="mt-3" onClick={() => void install()}>
                  <Download size={15} /> {t('common.install')}
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <section className="mb-6">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-faint">
          {t('settings.data')}
        </h2>
        <div className="space-y-2">
          <div className="rounded-2xl border border-line bg-surface p-4">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-raised text-muted">
                <HardDrive size={18} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{t('settings.localSpace')}</p>
                <p className="text-xs text-muted">
                  {t('settings.used', { used: storage.usage !== null ? formatBytes(storage.usage) : '—' })}
                  {storage.quota ? ` ${t('settings.of', { quota: formatBytes(storage.quota) })}` : ''}
                </p>
                {usageRatio !== null ? (
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-raised">
                    <div
                      className="h-full rounded-full bg-accent transition-[width]"
                      style={{ width: `${Math.max(2, usageRatio * 100)}%` }}
                    />
                  </div>
                ) : null}
                <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
                  <span
                    className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 ${
                      storage.persisted ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'
                    }`}
                  >
                    <ShieldCheck size={11} />
                    {storage.persisted ? t('settings.protected') : t('settings.notProtected')}
                  </span>
                  {!storage.persisted ? (
                    <button
                      type="button"
                      onClick={() => void storage.requestPersist()}
                      className="font-medium text-accent hover:underline"
                    >
                      {t('settings.requestProtection')}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => void storage.refresh()}
                    className="ml-auto inline-flex items-center gap-1 text-faint hover:text-ink"
                  >
                    <RefreshCw size={11} /> {t('common.refresh')}
                  </button>
                </div>
                <p className="mt-2 text-[11px] leading-relaxed text-faint">{t('settings.iosWarning')}</p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-line bg-surface p-4">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-raised text-muted">
                <Database size={18} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{t('settings.backup')}</p>
                <p className="text-xs text-muted">
                  {settings.lastBackupAt
                    ? t('settings.lastBackup', { date: formatDateTime(settings.lastBackupAt, locale) })
                    : t('settings.neverBackup')}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => void exportData()} disabled={exporting}>
                    <Download size={15} /> {exporting ? t('settings.exporting') : t('settings.export')}
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={exporting}
                    onClick={() => {
                      setExportPassword('')
                      setExportConfirm('')
                      setExportPasswordError('')
                      setEncryptedExportOpen(true)
                    }}
                  >
                    <Lock size={15} /> {t('settings.exportEncrypted')}
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => fileRef.current?.click()}>
                    <Upload size={15} /> {t('settings.import')}
                  </Button>
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".zip,.binhub,application/zip,application/octet-stream"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0]
                      event.target.value = ''
                      if (!file) return
                      setPendingFile(file)
                      setImportPassword('')
                      setPendingEncrypted(false)
                      setCheckingFile(true)
                      void isEncryptedBackupFile(file)
                        .then(setPendingEncrypted)
                        .finally(() => setCheckingFile(false))
                    }}
                  />
                </div>
                <p className="mt-2 text-[11px] leading-relaxed text-faint">{t('settings.backupHint')}</p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-danger/30 bg-danger/5 p-4">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-danger/10 text-danger">
                <Trash2 size={18} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{t('settings.deleteAll')}</p>
                <p className="text-xs leading-relaxed text-muted">{t('settings.deleteDesc')}</p>
                <Button variant="danger" size="sm" className="mt-3" onClick={() => setConfirmReset(true)}>
                  {t('settings.deleteButton')}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mb-6">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-faint">
          {t('settings.tags')}
        </h2>
        <div className="rounded-2xl border border-line bg-surface p-4">
          {tags.length === 0 ? (
            <p className="text-xs text-faint">{t('settings.noTags')}</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {tags.map((tag) => (
                <span
                  key={tag.id}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-line px-2 py-1 text-[11px] text-muted"
                >
                  <span className="h-2 w-2 rounded-full" style={{ background: tag.color }} />
                  #{tag.name}
                </span>
              ))}
            </div>
          )}
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-faint">
          {t('settings.info')}
        </h2>
        <div className="rounded-2xl border border-line bg-surface p-4">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-raised text-muted">
              <Info size={18} />
            </span>
            <div className="text-xs leading-relaxed text-muted">
              <p className="text-sm font-semibold text-ink">BinHub 1.0</p>
              <p className="mt-1">{t('settings.aboutDesc')}</p>
              <p className="mt-1 text-faint">{t('settings.tagsSaved', { count: tags.length })}</p>
              <p className="mt-1 text-faint">{t('settings.openmoji')}</p>
            </div>
          </div>
        </div>
      </section>

      <Modal
        open={pendingFile !== null}
        onClose={() => {
          if (!importing) {
            setPendingFile(null)
            setPendingEncrypted(false)
            setImportPassword('')
          }
        }}
        title={t('settings.importTitle')}
        description={pendingFile ? `${pendingFile.name} · ${formatBytes(pendingFile.size)}` : undefined}
        size="sm"
        footer={
          <>
            <Button
              variant="ghost"
              disabled={importing}
              onClick={() => {
                setPendingFile(null)
                setPendingEncrypted(false)
                setImportPassword('')
              }}
            >
              {t('common.cancel')}
            </Button>
            <Button
              variant="secondary"
              disabled={importing || checkingFile || (pendingEncrypted && !importPassword)}
              onClick={() => void runImport('merge')}
            >
              {t('settings.merge')}
            </Button>
            <Button
              variant="danger"
              disabled={importing || checkingFile || (pendingEncrypted && !importPassword)}
              onClick={() => void runImport('replace')}
            >
              {importing ? t('settings.importing') : t('settings.replace')}
            </Button>
          </>
        }
      >
        <div className="space-y-3 text-sm text-muted">
          {pendingEncrypted ? (
            <div className="rounded-xl border border-accent/30 bg-accent-soft/50 p-3">
              <p className="flex items-start gap-2 text-xs leading-relaxed">
                <Lock size={15} className="mt-0.5 shrink-0 text-accent" />
                <span>{t('settings.importEncryptedHint')}</span>
              </p>
              <div className="mt-2">
                <Field label={t('settings.importPassword')} htmlFor="backup-import-password">
                  <Input
                    id="backup-import-password"
                    type="password"
                    autoComplete="current-password"
                    value={importPassword}
                    onChange={(event) => setImportPassword(event.target.value)}
                  />
                </Field>
              </div>
            </div>
          ) : null}
          <p>
            <strong className="text-ink">{t('settings.mergeStrong')}</strong> {t('settings.mergeDesc')}
          </p>
          <p>
            <strong className="text-ink">{t('settings.replaceStrong')}</strong> {t('settings.replaceDesc')}
          </p>
        </div>
      </Modal>

      <Modal
        open={encryptedExportOpen}
        onClose={() => {
          if (!exporting) setEncryptedExportOpen(false)
        }}
        title={t('settings.encryptedExportTitle')}
        description={t('settings.encryptedExportDesc')}
        size="sm"
        footer={
          <>
            <Button
              variant="ghost"
              disabled={exporting}
              onClick={() => setEncryptedExportOpen(false)}
            >
              {t('common.cancel')}
            </Button>
            <Button disabled={exporting} onClick={confirmEncryptedExport}>
              <Lock size={15} /> {exporting ? t('settings.exporting') : t('settings.exportEncrypted')}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Field label={t('settings.password')} hint={t('settings.passwordHint')} htmlFor="backup-password">
            <Input
              id="backup-password"
              type="password"
              autoComplete="new-password"
              value={exportPassword}
              onChange={(event) => {
                setExportPassword(event.target.value)
                setExportPasswordError('')
              }}
            />
          </Field>
          <Field label={t('settings.passwordConfirm')} htmlFor="backup-password-confirm">
            <Input
              id="backup-password-confirm"
              type="password"
              autoComplete="new-password"
              value={exportConfirm}
              onChange={(event) => {
                setExportConfirm(event.target.value)
                setExportPasswordError('')
              }}
            />
          </Field>
          {exportPasswordError ? (
            <p className="text-xs text-danger">{exportPasswordError}</p>
          ) : null}
        </div>
      </Modal>

      <ConfirmDialog
        open={confirmReset}
        title={t('settings.resetTitle')}
        description={t('settings.resetDesc')}
        confirmLabel={t('settings.resetConfirm')}
        cancelLabel={t('common.cancel')}
        destructive
        onClose={() => setConfirmReset(false)}
        onConfirm={() => {
          void clearAllData().then(async () => {
            await saveSettings({ seeded: true, lastBackupAt: null })
            await storage.refresh()
            toast.success(t('settings.resetDone'))
          })
        }}
      />
    </div>
  )
}
