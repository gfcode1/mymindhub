import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { PenTool, Plus, Search, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader, EmptyState } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { useI18n } from '@/hooks/useI18n'
import { useWhiteboards } from '@/hooks/useData'
import { createWhiteboard, deleteWhiteboard, restoreWhiteboard } from '@/db/seed'
import { formatDate } from '@/lib/dates'
import type { WhiteboardMeta } from '@/types/models'

export function WhiteboardsPage() {
  const boards = useWhiteboards()
  const { t, locale } = useI18n()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [creating, setCreating] = useState(false)

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return boards
    return boards.filter((board) => board.title.toLowerCase().includes(needle))
  }, [boards, query])

  const remove = (board: WhiteboardMeta) => {
    void deleteWhiteboard(board.id).then(() => {
      toast(t('whiteboards.deleted'), {
        action: { label: t('common.undo'), onClick: () => void restoreWhiteboard(board.id) },
      })
    })
  }

  return (
    <div className="animate-fade-in">
      <PageHeader
        title={t('whiteboards.title')}
        subtitle={t('whiteboards.subtitle')}
        action={
          <Button size="sm" onClick={() => setCreating(true)}>
            <Plus size={16} /> {t('whiteboards.new')}
          </Button>
        }
      />

      <div className="relative mb-4">
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t('common.search')}
          className="pl-9"
          type="search"
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<PenTool size={20} />}
          title={t('whiteboards.empty')}
          description={t('whiteboards.emptyDesc')}
          action={
            <Button variant="soft" size="sm" onClick={() => setCreating(true)}>
              <Plus size={15} /> {t('whiteboards.new')}
            </Button>
          }
        />
      ) : (
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((board) => (
            <article
              key={board.id}
              className="group flex flex-col rounded-2xl border border-line bg-surface p-3.5 transition-colors hover:border-accent/40"
            >
              <Link to={`/whiteboards/${board.id}`} className="flex items-start gap-2.5">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-raised text-accent">
                  <PenTool size={18} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{board.title}</span>
                  <span className="block text-[11px] text-muted">
                    {t('whiteboard.strokesCount', { count: board.strokeCount })} ·{' '}
                    {formatDate(board.updatedAt, 'd MMM yyyy', locale)}
                  </span>
                </span>
              </Link>
              <div className="mt-2 flex items-center justify-between border-t border-line/70 pt-1">
                <Link
                  to={`/whiteboards/${board.id}`}
                  className="text-xs font-medium text-accent hover:underline"
                >
                  {t('whiteboards.open')}
                </Link>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-danger"
                  onClick={() => remove(board)}
                >
                  <Trash2 size={13} /> {t('whiteboards.delete')}
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}

      {creating ? (
        <NewWhiteboardModal
          onClose={() => setCreating(false)}
          onCreated={(id) => navigate(`/whiteboards/${id}`)}
        />
      ) : null}
    </div>
  )
}

function NewWhiteboardModal({
  onClose,
  onCreated,
}: {
  onClose: () => void
  onCreated: (id: string) => void
}) {
  const { t } = useI18n()
  const [title, setTitle] = useState('')
  const [saving, setSaving] = useState(false)

  const create = async () => {
    if (saving) return
    setSaving(true)
    try {
      const board = await createWhiteboard(title.trim() || t('whiteboard.defaultTitle'))
      toast.success(t('whiteboards.created'))
      onCreated(board.id)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={t('whiteboards.newTitle')}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button disabled={saving} onClick={() => void create()}>
            {t('whiteboards.create')}
          </Button>
        </>
      }
    >
      <Field label={t('whiteboards.name')} htmlFor="whiteboard-name">
        <Input
          id="whiteboard-name"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder={t('whiteboards.namePlaceholder')}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              void create()
            }
          }}
          autoFocus
        />
      </Field>
    </Modal>
  )
}
