import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { Archive, NotebookPen, Pin, Plus, Search } from 'lucide-react'
import { PageHeader, EmptyState } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Field'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { TagList } from '@/components/ui/TagInput'
import { useNotes } from '@/hooks/useData'
import { useI18n } from '@/hooks/useI18n'
import { useUIStore } from '@/hooks/useUI'
import { createNote } from '@/db/seed'
import { formatDate, relativeDate } from '@/lib/dates'
import { truncate } from '@/lib/utils'

export function NotesPage() {
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const { t, tCount, locale, language } = useI18n()
  const consumeDraft = useUIStore((state) => state.consumeDraft)
  const draft = useUIStore((state) => state.draft)
  const [query, setQuery] = useState('')
  const [tab, setTab] = useState<'active' | 'archived'>('active')
  const active = useNotes({ archived: false })
  const archived = useNotes({ archived: true })
  const creating = useRef(false)

  useEffect(() => {
    if (params.get('new') !== '1' || creating.current) return
    creating.current = true
    void createNote().then((note) => {
      setParams({}, { replace: true })
      navigate(`/notes/${note.id}`, { replace: true })
    })
  }, [params, navigate, setParams])

  useEffect(() => {
    if (!draft || creating.current) return
    creating.current = true
    const content = [draft.text, draft.url && !draft.text.includes(draft.url) ? draft.url : '']
      .filter(Boolean)
      .join('\n\n')
    consumeDraft()
    void createNote({ title: draft.title, content }).then((note) => {
      navigate(`/notes/${note.id}`, { replace: true })
    })
  }, [draft, consumeDraft, navigate])

  const source = tab === 'active' ? active : archived
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return source
    return source.filter(
      (note) =>
        note.title.toLowerCase().includes(needle) ||
        note.content.toLowerCase().includes(needle) ||
        note.tags.some((tag) => tag.includes(needle)),
    )
  }, [source, query])

  return (
    <div className="animate-fade-in">
      <PageHeader
        title={t('notes.title')}
        subtitle={`${tCount('notes.count', active.length)}${
          archived.length > 0 ? ` · ${t('notes.archivedCount', { count: archived.length })}` : ''
        }`}
        action={
          <Button size="sm" onClick={() => navigate('/notes?new=1')}>
            <Plus size={16} /> {t('notes.new')}
          </Button>
        }
      />

      <div className="mb-4 space-y-3">
        <div className="relative">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('notes.searchPlaceholder')}
            className="pl-9"
            type="search"
          />
        </div>
        <SegmentedControl
          value={tab}
          onChange={setTab}
          options={[
            { value: 'active', label: t('notes.tabActive'), count: active.length },
            { value: 'archived', label: t('notes.tabArchived'), count: archived.length },
          ]}
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<NotebookPen size={20} />}
          title={
            query
              ? t('notes.noResults')
              : tab === 'archived'
                ? t('notes.emptyArchived')
                : t('notes.empty')
          }
          description={query ? t('notes.noResultsDesc') : t('notes.emptyDesc')}
          action={
            !query && tab === 'active' ? (
              <Button variant="soft" size="sm" onClick={() => navigate('/notes?new=1')}>
                <Plus size={15} /> {t('notes.create')}
              </Button>
            ) : null
          }
        />
      ) : (
        <div className="space-y-2">
          {filtered.map((note) => (
            <Link
              key={note.id}
              to={`/notes/${note.id}`}
              className="block rounded-2xl border border-line bg-surface p-4 transition-colors hover:border-accent/40"
            >
              <div className="flex items-start gap-2">
                {note.pinned ? <Pin size={14} className="mt-0.5 shrink-0 fill-accent text-accent" /> : null}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-semibold tracking-tight">
                    {note.title || t('notes.untitled')}
                  </p>
                  {note.content ? (
                    <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-muted">
                      {truncate(note.content.replace(/[#>*_`-]/g, ''), 180)}
                    </p>
                  ) : (
                    <p className="mt-1 text-[13px] italic text-faint">{t('notes.emptyNote')}</p>
                  )}
                  <div className="mt-2.5 flex flex-wrap items-center gap-2">
                    <TagList tags={note.tags} />
                    <span className="ml-auto shrink-0 text-[11px] text-faint">
                      {relativeDate(note.updatedAt, locale, language)} · {formatDate(note.updatedAt, 'HH:mm', locale)}
                    </span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {tab === 'archived' && archived.length > 0 ? (
        <p className="mt-4 flex items-center gap-1.5 text-xs text-faint">
          <Archive size={13} /> {t('notes.archivedHint')}
        </p>
      ) : null}
    </div>
  )
}
