import { useRef, useState } from 'react'
import {
  CalendarDays,
  Check,
  Database,
  Download,
  HardDrive,
  Info,
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
import { Modal, ConfirmDialog } from '@/components/ui/Modal'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { useSettings, useTags } from '@/hooks/useData'
import { useInstallPrompt, useStorageEstimate } from '@/hooks/usePwa'
import { clearAllData, saveSettings } from '@/db/seed'
import { buildBackup, importBackup, type ImportMode } from '@/db/backup'
import { formatBytes, formatDateTime } from '@/lib/dates'
import { ACCENTS, type Accent, type CalendarView, type Theme } from '@/types/models'
import { downloadBlob, isIos, nowIso } from '@/lib/utils'

const THEMES: { value: Theme; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Chiaro', icon: Sun },
  { value: 'dark', label: 'Scuro', icon: Moon },
  { value: 'system', label: 'Sistema', icon: Monitor },
]

export function SettingsPage() {
  const { settings } = useSettings()
  const tags = useTags()
  const { canInstall, installed, install } = useInstallPrompt()
  const storage = useStorageEstimate()
  const [exporting, setExporting] = useState(false)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [importing, setImporting] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const exportData = async () => {
    setExporting(true)
    try {
      const backup = await buildBackup()
      downloadBlob(backup.blob, backup.filename)
      await saveSettings({ lastBackupAt: nowIso() })
      toast.success('Backup esportato', {
        description: `${backup.counts.notes} note · ${backup.counts.todos} todo · ${backup.counts.voiceNotes} vocali`,
      })
    } catch {
      toast.error('Esportazione non riuscita')
    } finally {
      setExporting(false)
    }
  }

  const runImport = async (mode: ImportMode) => {
    if (!pendingFile) return
    setImporting(true)
    try {
      const result = await importBackup(pendingFile, mode)
      const total = Object.values(result.imported).reduce((sum, value) => sum + value, 0)
      toast.success(mode === 'replace' ? 'Backup ripristinato' : 'Backup unito', {
        description: `${total} elementi importati${result.skipped ? `, ${result.skipped} saltati` : ''}.`,
      })
      setPendingFile(null)
      await storage.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Importazione non riuscita')
    } finally {
      setImporting(false)
    }
  }

  const usageRatio =
    storage.usage !== null && storage.quota ? Math.min(1, storage.usage / storage.quota) : null

  return (
    <div className="animate-fade-in">
      <PageHeader title="Impostazioni" subtitle="Aspetto, dati e installazione" />

      <section className="mb-6">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-faint">Aspetto</h2>
        <div className="rounded-2xl border border-line bg-surface p-4">
          <div className="mb-1.5 flex items-center gap-2 text-sm font-medium">
            <Sun size={16} className="text-muted" /> Tema
          </div>
          <SegmentedControl
            value={settings.theme}
            onChange={(theme) => void saveSettings({ theme })}
            options={THEMES.map((theme) => ({
              value: theme.value,
              label: theme.label,
            }))}
          />

          <div className="mb-2 mt-5 flex items-center gap-2 text-sm font-medium">
            <Palette size={16} className="text-muted" /> Colore accento
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
                  aria-label={`Accento ${accent.label}`}
                  aria-pressed={active}
                  className={`flex h-10 items-center gap-2 rounded-xl border px-2.5 text-xs font-medium transition-colors ${
                    active ? 'border-accent bg-accent-soft text-accent' : 'border-line text-muted'
                  }`}
                >
                  <span
                    className="h-5 w-5 rounded-full"
                    style={{ background: accent.light }}
                  />
                  {accent.label}
                  {active ? <Check size={13} /> : null}
                </button>
              )
            })}
          </div>

          <div className="mb-2 mt-5 flex items-center gap-2 text-sm font-medium">
            <CalendarDays size={16} className="text-muted" /> Vista calendario predefinita
          </div>
          <SegmentedControl
            value={settings.calendarView}
            onChange={(calendarView: CalendarView) => void saveSettings({ calendarView })}
            options={[
              { value: 'month', label: 'Mese' },
              { value: 'week', label: 'Settimana' },
              { value: 'day', label: 'Giorno' },
            ]}
          />
        </div>
      </section>

      <section className="mb-6">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-faint">Installazione</h2>
        <div className="rounded-2xl border border-line bg-surface p-4">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
              <Smartphone size={18} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">
                {installed ? 'BinHub è installata' : 'Installa BinHub sul dispositivo'}
              </p>
              <p className="mt-0.5 text-xs leading-relaxed text-muted">
                {installed
                  ? 'Stai usando la modalità standalone. Funziona anche senza connessione.'
                  : canInstall
                    ? 'Aggiungila alla schermata home per un accesso immediato.'
                    : isIos()
                      ? 'Su iOS: tocca Condividi nel browser, poi “Aggiungi a Home”.'
                      : 'Dal menu del browser scegli “Installa app” o “Aggiungi a schermata Home”.'}
              </p>
              {canInstall ? (
                <Button size="sm" className="mt-3" onClick={() => void install()}>
                  <Download size={15} /> Installa
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <section className="mb-6">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-faint">Dati</h2>
        <div className="space-y-2">
          <div className="rounded-2xl border border-line bg-surface p-4">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-raised text-muted">
                <HardDrive size={18} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">Spazio locale</p>
                <p className="text-xs text-muted">
                  {storage.usage !== null ? formatBytes(storage.usage) : '—'} usati
                  {storage.quota ? ` su ${formatBytes(storage.quota)}` : ''}
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
                    {storage.persisted ? 'Storage protetto' : 'Storage non protetto'}
                  </span>
                  {!storage.persisted ? (
                    <button
                      type="button"
                      onClick={() => void storage.requestPersist()}
                      className="font-medium text-accent hover:underline"
                    >
                      Richiedi protezione
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => void storage.refresh()}
                    className="ml-auto inline-flex items-center gap-1 text-faint hover:text-ink"
                  >
                    <RefreshCw size={11} /> Aggiorna
                  </button>
                </div>
                <p className="mt-2 text-[11px] leading-relaxed text-faint">
                  Il browser può liberare spazio su iOS. Esporta un backup con regolarità.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-line bg-surface p-4">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-raised text-muted">
                <Database size={18} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">Backup e ripristino</p>
                <p className="text-xs text-muted">
                  {settings.lastBackupAt
                    ? `Ultimo backup: ${formatDateTime(settings.lastBackupAt)}`
                    : 'Nessun backup ancora effettuato.'}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => void exportData()} disabled={exporting}>
                    <Download size={15} /> {exporting ? 'Esportazione…' : 'Esporta backup'}
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => fileRef.current?.click()}>
                    <Upload size={15} /> Importa
                  </Button>
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".zip,application/zip"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0]
                      if (file) setPendingFile(file)
                      event.target.value = ''
                    }}
                  />
                </div>
                <p className="mt-2 text-[11px] leading-relaxed text-faint">
                  Il backup è un archivio ZIP con dati e audio. Contiene tutto: conservalo in un posto
                  sicuro.
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-danger/30 bg-danger/5 p-4">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-danger/10 text-danger">
                <Trash2 size={18} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">Elimina tutti i dati</p>
                <p className="text-xs leading-relaxed text-muted">
                  Cancella note, todo, bookmark, eventi e vocali da questo dispositivo. L’azione è
                  irreversibile senza backup.
                </p>
                <Button
                  variant="danger"
                  size="sm"
                  className="mt-3"
                  onClick={() => setConfirmReset(true)}
                >
                  Elimina dati
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mb-6">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-faint">Tag</h2>
        <div className="rounded-2xl border border-line bg-surface p-4">
          {tags.length === 0 ? (
            <p className="text-xs text-faint">Nessun tag ancora. Aggiungili dalle note o dai todo.</p>
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
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-faint">Informazioni</h2>
        <div className="rounded-2xl border border-line bg-surface p-4">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-raised text-muted">
              <Info size={18} />
            </span>
            <div className="text-xs leading-relaxed text-muted">
              <p className="text-sm font-semibold text-ink">BinHub 1.0</p>
              <p className="mt-1">
                PWA offline-first. I dati restano su questo dispositivo e non vengono inviati a server.
              </p>
              <p className="mt-1 text-faint">{tags.length} tag salvati localmente.</p>
            </div>
          </div>
        </div>
      </section>

      <Modal
        open={pendingFile !== null}
        onClose={() => {
          if (!importing) setPendingFile(null)
        }}
        title="Importa backup"
        description={pendingFile ? `${pendingFile.name} · ${formatBytes(pendingFile.size)}` : undefined}
        size="sm"
        footer={
          <>
            <Button variant="ghost" disabled={importing} onClick={() => setPendingFile(null)}>
              Annulla
            </Button>
            <Button variant="secondary" disabled={importing} onClick={() => void runImport('merge')}>
              Unisci
            </Button>
            <Button variant="danger" disabled={importing} onClick={() => void runImport('replace')}>
              {importing ? 'Importazione…' : 'Sostituisci'}
            </Button>
          </>
        }
      >
        <div className="space-y-2 text-sm text-muted">
          <p>
            <strong className="text-ink">Unisci</strong> mantiene i dati attuali e aggiunge o aggiorna
            gli elementi del backup.
          </p>
          <p>
            <strong className="text-ink">Sostituisci</strong> cancella tutto e ripristina solamente il
            contenuto del backup.
          </p>
        </div>
      </Modal>

      <ConfirmDialog
        open={confirmReset}
        title="Eliminare tutti i dati?"
        description="Note, todo, link, eventi e vocali verranno rimossi da questo dispositivo."
        confirmLabel="Elimina tutto"
        destructive
        onClose={() => setConfirmReset(false)}
        onConfirm={() => {
          void clearAllData().then(async () => {
            await saveSettings({ seeded: true, lastBackupAt: null })
            await storage.refresh()
            toast.success('Dati eliminati')
          })
        }}
      />
    </div>
  )
}
