import { useMemo, useRef, useState } from 'react'
import {
  Check,
  Download,
  ExternalLink,
  File as FileIcon,
  FileArchive,
  FileText,
  Image as ImageIcon,
  ListChecks,
  Pencil,
  Plus,
  Search,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader, EmptyState } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Field, Input, Textarea } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { useI18n } from '@/hooks/useI18n'
import { useVaultItems } from '@/hooks/useData'
import {
  createVaultChecklist,
  createVaultFile,
  deleteVaultItem,
  getVaultBlob,
  restoreVaultItem,
  updateVaultItem,
} from '@/db/seed'
import { formatBytes, formatDate } from '@/lib/dates'
import { filterVaultItems, vaultFileKind } from '@/lib/vault'
import { downloadBlob, tagColor, uid } from '@/lib/utils'
import type { VaultChecklistItem, VaultItem } from '@/types/models'

function iconFor(item: VaultItem): LucideIcon {
  if (item.type === 'checklist') return ListChecks
  const kind = vaultFileKind(item.mimeType)
  if (kind === 'image') return ImageIcon
  if (kind === 'pdf' || kind === 'text') return FileText
  if (kind === 'archive') return FileArchive
  return FileIcon
}

export function VaultPage() {
  const items = useVaultItems()
  const { t, locale } = useI18n()
  const fileRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('')
  const [checklistOpen, setChecklistOpen] = useState(false)
  const [editing, setEditing] = useState<VaultItem | null>(null)
  const [running, setRunning] = useState<VaultItem | null>(null)
  const [uploading, setUploading] = useState(false)

  const categories = useMemo(
    () =>
      [...new Set(items.map((item) => item.category).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b),
      ),
    [items],
  )
  const filtered = useMemo(
    () => filterVaultItems(items, query, category),
    [items, query, category],
  )

  const upload = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    setUploading(true)
    try {
      const list = [...files]
      for (const file of list) {
        await createVaultFile({ file, category: category || '' })
      }
      toast.success(
        list.length === 1
          ? t('vault.uploaded')
          : t('vault.uploadedMany', { count: list.length }),
      )
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const openFile = async (item: VaultItem) => {
    const blob = await getVaultBlob(item.id)
    if (!blob) {
      toast.error(t('vault.fileMissing'))
      return
    }
    const url = URL.createObjectURL(blob)
    const opened = window.open(url, '_blank', 'noopener,noreferrer')
    if (!opened) toast.error(t('vault.openError'))
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
  }

  const downloadFile = async (item: VaultItem) => {
    const blob = await getVaultBlob(item.id)
    if (!blob) {
      toast.error(t('vault.fileMissing'))
      return
    }
    downloadBlob(blob, item.fileName || item.title)
  }

  const remove = (item: VaultItem) => {
    void deleteVaultItem(item.id).then(() => {
      toast(t('vault.deleted'), {
        action: { label: t('common.undo'), onClick: () => void restoreVaultItem(item.id) },
      })
    })
  }

  return (
    <div className="animate-fade-in">
      <PageHeader
        title={t('vault.title')}
        subtitle={t('vault.subtitle')}
        action={
          <>
            <input
              ref={fileRef}
              type="file"
              multiple
              className="hidden"
              onChange={(event) => void upload(event.target.files)}
            />
            <Button
              variant="secondary"
              size="sm"
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
            >
              <Upload size={15} />
              <span className="hidden sm:inline">{t('vault.upload')}</span>
            </Button>
            <Button size="sm" onClick={() => setChecklistOpen(true)}>
              <Plus size={15} /> {t('vault.newChecklist')}
            </Button>
          </>
        }
      />

      <div className="mb-4 space-y-3">
        <div className="relative">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('vault.searchPlaceholder')}
            className="pl-9"
            type="search"
          />
        </div>
        {categories.length > 0 ? (
          <div className="scrollbar-none flex gap-1.5 overflow-x-auto">
            <button
              type="button"
              onClick={() => setCategory('')}
              className={`shrink-0 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                category === '' ? 'border-accent bg-accent-soft text-accent' : 'border-line text-muted'
              }`}
            >
              {t('vault.allCategories')}
            </button>
            {categories.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setCategory(value)}
                className={`shrink-0 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                  category === value ? 'border-accent bg-accent-soft text-accent' : 'border-line text-muted'
                }`}
              >
                {value}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<ListChecks size={20} />}
          title={query || category ? t('vault.noResults') : t('vault.empty')}
          description={query || category ? t('vault.noResultsDesc') : t('vault.emptyDesc')}
          action={
            !query && !category ? (
              <Button variant="soft" size="sm" onClick={() => setChecklistOpen(true)}>
                <Plus size={15} /> {t('vault.newChecklist')}
              </Button>
            ) : null
          }
        />
      ) : (
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((item) => {
            const Icon = iconFor(item)
            const label = item.category
            return (
              <article
                key={item.id}
                className="group flex flex-col rounded-2xl border border-line bg-surface p-3.5 transition-colors hover:border-accent/40"
              >
                <div className="flex items-start gap-2.5">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-raised text-accent">
                    <Icon size={18} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{item.title}</p>
                    <p className="text-[11px] text-muted">
                      {item.type === 'file'
                        ? `${t('vault.file')} · ${formatBytes(item.size)}`
                        : `${t('vault.checklist')} · ${t('vault.itemsCount', { count: item.items.length })}`}
                    </p>
                  </div>
                  {label ? (
                    <span
                      className="shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-medium"
                      style={{ background: `${tagColor(label)}22`, color: tagColor(label) }}
                    >
                      {label}
                    </span>
                  ) : null}
                </div>

                {item.description ? (
                  <p className="mt-2.5 line-clamp-2 text-[12.5px] leading-relaxed text-muted">
                    {item.description}
                  </p>
                ) : null}

                <p className="mt-2 text-[10px] text-faint">{formatDate(item.updatedAt, 'd MMM yyyy', locale)}</p>

                <div className="mt-2 flex items-center justify-end gap-0.5 border-t border-line/70 pt-1">
                  {item.type === 'file' ? (
                    <>
                      <Button variant="ghost" size="sm" onClick={() => void openFile(item)}>
                        <ExternalLink size={13} /> {t('vault.open')}
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => void downloadFile(item)}>
                        <Download size={13} /> {t('vault.download')}
                      </Button>
                    </>
                  ) : (
                    <Button variant="ghost" size="sm" onClick={() => setRunning(item)}>
                      <ListChecks size={13} /> {t('vault.open')}
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => setEditing(item)}>
                    <Pencil size={13} /> {t('vault.edit')}
                  </Button>
                  <Button variant="ghost" size="sm" className="text-danger" onClick={() => remove(item)}>
                    <Trash2 size={13} /> {t('vault.delete')}
                  </Button>
                </div>
              </article>
            )
          })}
        </div>
      )}

      {checklistOpen ? (
        <NewChecklistModal
          defaultCategory={category}
          onClose={() => setChecklistOpen(false)}
        />
      ) : null}

      {editing ? (
        <VaultEditModal key={editing.id} item={editing} onClose={() => setEditing(null)} />
      ) : null}

      {running ? (
        <ChecklistRunModal
          key={running.id}
          item={running}
          onClose={() => setRunning(null)}
          onEdit={() => {
            setEditing(running)
            setRunning(null)
          }}
        />
      ) : null}
    </div>
  )
}

function NewChecklistModal({
  defaultCategory,
  onClose,
}: {
  defaultCategory: string
  onClose: () => void
}) {
  const { t } = useI18n()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState(defaultCategory)
  const [items, setItems] = useState<string[]>([''])
  const [error, setError] = useState('')

  const save = async () => {
    if (!title.trim()) {
      setError(t('vault.titleRequired'))
      return
    }
    await createVaultChecklist({ title, description, category, items })
    toast.success(t('vault.checklistCreated'))
    onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={t('vault.newChecklistTitle')}
      description={t('vault.newChecklistDesc')}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button onClick={() => void save()}>{t('vault.create')}</Button>
        </>
      }
    >
      <div className="space-y-4 pb-1">
        <Field label={t('vault.titleLabel')} htmlFor="vault-title">
          <Input
            id="vault-title"
            value={title}
            onChange={(event) => {
              setTitle(event.target.value)
              setError('')
            }}
            placeholder={t('vault.titlePlaceholder')}
            autoFocus
          />
          {error ? <p className="mt-1.5 text-xs text-danger">{error}</p> : null}
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t('vault.category')} htmlFor="vault-category">
            <Input
              id="vault-category"
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              placeholder={t('vault.categoryPlaceholder')}
            />
          </Field>
          <Field label={t('vault.description')} htmlFor="vault-description">
            <Input
              id="vault-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder={t('vault.descriptionPlaceholder')}
            />
          </Field>
        </div>

        <div>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
            {t('vault.checks')}
          </p>
          <div className="space-y-2">
            {items.map((value, index) => (
              <div key={index} className="flex items-center gap-2">
                <Input
                  value={value}
                  onChange={(event) =>
                    setItems((current) =>
                      current.map((item, itemIndex) => (itemIndex === index ? event.target.value : item)),
                    )
                  }
                  placeholder={t('vault.itemPlaceholder')}
                />
                <button
                  type="button"
                  onClick={() => setItems((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                  aria-label={t('vault.removeItem')}
                  className="rounded-lg p-2 text-faint hover:bg-danger/10 hover:text-danger"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
          <Button variant="soft" size="sm" className="mt-2" onClick={() => setItems((current) => [...current, ''])}>
            <Plus size={14} /> {t('vault.addItem')}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

function VaultEditModal({ item, onClose }: { item: VaultItem; onClose: () => void }) {
  const { t } = useI18n()
  const [title, setTitle] = useState(item.title)
  const [description, setDescription] = useState(item.description)
  const [category, setCategory] = useState(item.category)
  const [items, setItems] = useState<VaultChecklistItem[]>(item.items)
  const [error, setError] = useState('')

  const save = async () => {
    if (!title.trim()) {
      setError(t('vault.titleRequired'))
      return
    }
    await updateVaultItem(item.id, {
      title,
      description,
      category,
      items: item.type === 'checklist' ? items : undefined,
    })
    toast.success(t('vault.updated'))
    onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={item.type === 'file' ? t('vault.editFileTitle') : t('vault.editTitle')}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button onClick={() => void save()}>{t('common.save')}</Button>
        </>
      }
    >
      <div className="space-y-4 pb-1">
        <Field label={t('vault.titleLabel')} htmlFor="vault-edit-title">
          <Input
            id="vault-edit-title"
            value={title}
            onChange={(event) => {
              setTitle(event.target.value)
              setError('')
            }}
            autoFocus
          />
          {error ? <p className="mt-1.5 text-xs text-danger">{error}</p> : null}
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t('vault.category')} htmlFor="vault-edit-category">
            <Input
              id="vault-edit-category"
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              placeholder={t('vault.categoryPlaceholder')}
            />
          </Field>
          {item.type === 'file' ? (
            <Field label={t('vault.size')}>
              <p className="flex h-11 items-center text-sm text-muted">{formatBytes(item.size)}</p>
            </Field>
          ) : null}
        </div>
        <Field label={t('vault.description')}>
          <Textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder={t('vault.descriptionPlaceholder')}
            rows={3}
          />
        </Field>

        {item.type === 'file' ? (
          <p className="rounded-xl border border-line bg-canvas/40 px-3 py-2 text-xs text-muted">
            {t('vault.fileName')}: {item.fileName ?? '—'}
          </p>
        ) : (
          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
              {t('vault.checks')}
            </p>
            <div className="space-y-2">
              {items.map((entry, index) => (
                <div key={entry.id || index} className="flex items-center gap-2">
                  <Input
                    value={entry.text}
                    onChange={(event) =>
                      setItems((current) =>
                        current.map((value, itemIndex) =>
                          itemIndex === index ? { ...value, text: event.target.value } : value,
                        ),
                      )
                    }
                    placeholder={t('vault.itemPlaceholder')}
                  />
                  <button
                    type="button"
                    onClick={() => setItems((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                    aria-label={t('vault.removeItem')}
                    className="rounded-lg p-2 text-faint hover:bg-danger/10 hover:text-danger"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
            <Button
              variant="soft"
              size="sm"
              className="mt-2"
              onClick={() => setItems((current) => [...current, { id: uid(), text: '' }])}
            >
              <Plus size={14} /> {t('vault.addItem')}
            </Button>
          </div>
        )}
      </div>
    </Modal>
  )
}

function ChecklistRunModal({
  item,
  onClose,
  onEdit,
}: {
  item: VaultItem
  onClose: () => void
  onEdit: () => void
}) {
  const { t } = useI18n()
  const [checked, setChecked] = useState<Set<string>>(() => new Set())

  const toggle = (id: string) => {
    setChecked((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={item.title}
      description={item.description || undefined}
      footer={
        <>
          <Button variant="ghost" onClick={() => setChecked(new Set())}>
            {t('vault.resetChecks')}
          </Button>
          <Button variant="secondary" onClick={onEdit}>
            <Pencil size={15} /> {t('vault.edit')}
          </Button>
          <Button onClick={onClose}>{t('common.close')}</Button>
        </>
      }
    >
      <div className="space-y-2 pb-1">
        <p className="text-[11px] text-faint">
          {t('vault.checkedCount', { done: checked.size, total: item.items.length })}
        </p>
        {item.items.length === 0 ? (
          <p className="text-sm text-muted">{t('vault.emptyDesc')}</p>
        ) : (
          item.items.map((entry) => {
            const done = checked.has(entry.id)
            return (
              <button
                key={entry.id}
                type="button"
                onClick={() => toggle(entry.id)}
                className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors ${
                  done ? 'border-accent/40 bg-accent-soft/50' : 'border-line bg-canvas/40'
                }`}
              >
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
                    done ? 'border-accent bg-accent text-accent-ink' : 'border-line text-transparent'
                  }`}
                >
                  <Check size={13} />
                </span>
                <span className={`text-sm ${done ? 'text-faint line-through' : ''}`}>{entry.text}</span>
              </button>
            )
          })
        )}
      </div>
    </Modal>
  )
}
