import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { Archive, ArchiveRestore, BookOpen, Bookmark, ExternalLink, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader, EmptyState } from '@/components/ui/PageHeader'
import { Button, IconButton } from '@/components/ui/Button'
import { Field, Input, Textarea } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { TagInput, TagList } from '@/components/ui/TagInput'
import { EntityLinks } from '@/features/links/EntityLinks'
import { useBookmarks, useTags } from '@/hooks/useData'
import { useI18n } from '@/hooks/useI18n'
import { useUIStore } from '@/hooks/useUI'
import {
  createBookmark,
  deleteBookmark,
  restoreBookmark,
  updateBookmark,
} from '@/db/seed'
import { formatDate } from '@/lib/dates'
import { hostnameOf, initials, normalizeUrl } from '@/lib/utils'
import type { Bookmark as BookmarkModel, BookmarkReadingStatus } from '@/types/models'

export function BookmarksPage() {
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const { t, tCount, locale } = useI18n()
  const consumeDraft = useUIStore((state) => state.consumeDraft)
  const draft = useUIStore((state) => state.draft)
  const active = useBookmarks({ archived: false })
  const archived = useBookmarks({ archived: true })
  const [tab, setTab] = useState<'active' | 'archived'>('active')
  const [reading, setReading] = useState<'all' | BookmarkReadingStatus>('all')
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<BookmarkModel | null>(null)
  const [editorOpen, setEditorOpen] = useState(false)
  const [initialUrl, setInitialUrl] = useState('')
  const handledNew = useRef(false)

  useEffect(() => {
    if (params.get('new') === '1' && !handledNew.current) {
      handledNew.current = true
      setInitialUrl('')
      setEditing(null)
      setEditorOpen(true)
      setParams({}, { replace: true })
    }
  }, [params, setParams])

  useEffect(() => {
    if (!draft) return
    setInitialUrl(draft.url ?? normalizeUrl(draft.text) ?? '')
    setEditing(null)
    setEditorOpen(true)
    consumeDraft()
  }, [draft, consumeDraft])

  const source = tab === 'active' ? active : archived
  const statusCounts = useMemo(
    () => ({
      all: source.length,
      'to-read': source.filter((bookmark) => bookmark.readingStatus === 'to-read').length,
      reading: source.filter((bookmark) => bookmark.readingStatus === 'reading').length,
      done: source.filter((bookmark) => bookmark.readingStatus === 'done').length,
    }),
    [source],
  )
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return source.filter((bookmark) => {
      if (reading !== 'all' && bookmark.readingStatus !== reading) return false
      if (!needle) return true
      return (
        bookmark.title.toLowerCase().includes(needle) ||
        bookmark.url.toLowerCase().includes(needle) ||
        bookmark.description.toLowerCase().includes(needle) ||
        bookmark.readerContent.toLowerCase().includes(needle) ||
        bookmark.tags.some((tag) => tag.includes(needle))
      )
    })
  }, [source, query, reading])

  const remove = (bookmark: BookmarkModel) => {
    void deleteBookmark(bookmark.id).then(() => {
      toast(t('bookmarks.deletedToast'), {
        action: { label: t('common.undo'), onClick: () => void restoreBookmark(bookmark.id) },
      })
    })
  }

  const openNew = () => {
    setInitialUrl('')
    setEditing(null)
    setEditorOpen(true)
  }

  return (
    <div className="animate-fade-in">
      <PageHeader
        title={t('bookmarks.title')}
        subtitle={`${tCount('bookmarks.count', active.length)}${
          archived.length ? ` · ${t('bookmarks.archivedCount', { count: archived.length })}` : ''
        }`}
        action={
          <Button size="sm" onClick={openNew}>
            <Plus size={16} /> {t('bookmarks.new')}
          </Button>
        }
      />

      <div className="mb-4 space-y-3">
        <div className="relative">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('bookmarks.searchPlaceholder')}
            className="pl-9"
            type="search"
          />
        </div>
        <SegmentedControl
          value={tab}
          onChange={setTab}
          options={[
            { value: 'active', label: t('bookmarks.tabActive'), count: active.length },
            { value: 'archived', label: t('bookmarks.tabArchived'), count: archived.length },
          ]}
        />
        <SegmentedControl
          value={reading}
          onChange={setReading}
          options={[
            { value: 'all', label: t('bookmarks.readingAll'), count: statusCounts.all },
            { value: 'to-read', label: t('bookmark.statusToRead'), count: statusCounts['to-read'] },
            { value: 'reading', label: t('bookmark.statusReading'), count: statusCounts.reading },
            { value: 'done', label: t('bookmark.statusDone'), count: statusCounts.done },
          ]}
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Bookmark size={20} />}
          title={query ? t('bookmarks.noResults') : t('bookmarks.empty')}
          description={query ? t('bookmarks.noResultsDesc') : t('bookmarks.emptyDesc')}
          action={
            !query ? (
              <Button variant="soft" size="sm" onClick={openNew}>
                <Plus size={15} /> {t('bookmarks.saveLink')}
              </Button>
            ) : null
          }
        />
      ) : (
        <div className="grid gap-2.5 sm:grid-cols-2">
          {filtered.map((bookmark) => (
            <div
              key={bookmark.id}
              className="group flex flex-col rounded-2xl border border-line bg-surface p-3.5 transition-colors hover:border-accent/40"
            >
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-raised text-[12px] font-semibold text-muted">
                  {initials(bookmark.title || bookmark.url)}
                </div>
                <div className="min-w-0 flex-1">
                  <a
                    href={bookmark.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="line-clamp-2 text-sm font-semibold leading-snug hover:text-accent"
                  >
                    {bookmark.title || hostnameOf(bookmark.url)}
                  </a>
                  <p className="mt-0.5 truncate text-[11px] text-faint">{hostnameOf(bookmark.url)}</p>
                </div>
                <IconButton
                  label={t('bookmarks.open')}
                  onClick={() => window.open(bookmark.url, '_blank', 'noopener,noreferrer')}
                  className="h-8 w-8"
                >
                  <ExternalLink size={15} />
                </IconButton>
              </div>

              {bookmark.description ? (
                <p className="mt-2.5 line-clamp-2 text-[12.5px] leading-relaxed text-muted">
                  {bookmark.description}
                </p>
              ) : null}

              <div className="mt-2.5 flex items-center gap-2">
                <TagList tags={bookmark.tags} />
                <span
                  className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-medium ${
                    bookmark.readingStatus === 'reading'
                      ? 'bg-accent-soft text-accent'
                      : bookmark.readingStatus === 'done'
                        ? 'bg-success/10 text-success'
                        : 'bg-raised text-muted'
                  }`}
                >
                  {bookmark.readingStatus === 'reading'
                    ? t('bookmark.statusReading')
                    : bookmark.readingStatus === 'done'
                      ? t('bookmark.statusDone')
                      : t('bookmark.statusToRead')}
                </span>
                <span className="ml-auto shrink-0 text-[10px] text-faint">
                  {formatDate(bookmark.createdAt, 'd MMM', locale)}
                </span>
              </div>

              <div className="mt-2 flex items-center justify-end gap-0.5 border-t border-line/70 pt-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate(`/reader/${bookmark.id}`)}
                >
                  <BookOpen size={13} /> {t('bookmark.read')}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    void updateBookmark(bookmark.id, { archived: !bookmark.archived }).then(() => {
                      toast(bookmark.archived ? t('bookmarks.restoredToast') : t('bookmarks.archivedToast'))
                    })
                  }}
                >
                  {bookmark.archived ? <ArchiveRestore size={13} /> : <Archive size={13} />}
                  {bookmark.archived ? t('common.restore') : t('common.archive')}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setInitialUrl('')
                    setEditing(bookmark)
                    setEditorOpen(true)
                  }}
                >
                  <Pencil size={13} /> {t('common.edit')}
                </Button>
                <Button variant="ghost" size="sm" className="text-danger" onClick={() => remove(bookmark)}>
                  <Trash2 size={13} /> {t('common.delete')}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'archived' && archived.length > 0 ? (
        <p className="mt-4 flex items-center gap-1.5 text-xs text-faint">
          <Archive size={13} /> {t('bookmarks.archivedHint')}
        </p>
      ) : null}

      <BookmarkEditor
        open={editorOpen}
        bookmark={editing}
        initialUrl={initialUrl}
        onClose={() => {
          setEditorOpen(false)
          setEditing(null)
          setInitialUrl('')
        }}
      />
    </div>
  )
}

function BookmarkEditor({
  open,
  bookmark,
  initialUrl,
  onClose,
}: {
  open: boolean
  bookmark: BookmarkModel | null
  initialUrl: string
  onClose: () => void
}) {
  const tags = useTags()
  const { t } = useI18n()
  const [url, setUrl] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [tagValues, setTagValues] = useState<string[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setError('')
    if (bookmark) {
      setUrl(bookmark.url)
      setTitle(bookmark.title)
      setDescription(bookmark.description)
      setTagValues(bookmark.tags)
    } else {
      setUrl(initialUrl)
      setTitle('')
      setDescription('')
      setTagValues([])
    }
  }, [open, bookmark, initialUrl])

  const save = () => {
    const normalized = normalizeUrl(url)
    if (!normalized) {
      setError(t('bookmark.urlError'))
      return
    }
    const finalTitle = title.trim() || hostnameOf(normalized)
    if (bookmark) {
      void updateBookmark(bookmark.id, {
        url: normalized,
        title: finalTitle,
        description,
        tags: tagValues,
      }).then(() => {
        toast.success(t('bookmark.updated'))
        onClose()
      })
    } else {
      void createBookmark({
        url: normalized,
        title: finalTitle,
        description,
        tags: tagValues,
      }).then(() => {
        toast.success(t('bookmark.saved'))
        onClose()
      })
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={bookmark ? t('bookmark.edit') : t('bookmark.new')}
      description={bookmark ? undefined : t('bookmark.newDesc')}
      footer={
        <>
          {bookmark ? (
            <Button
              variant="ghost"
              className="mr-auto text-danger"
              onClick={() => {
                void deleteBookmark(bookmark.id).then(() => {
                  toast(t('bookmarks.deletedToast'), {
                    action: {
                      label: t('common.undo'),
                      onClick: () => void restoreBookmark(bookmark.id),
                    },
                  })
                  onClose()
                })
              }}
            >
              <Trash2 size={15} /> {t('common.delete')}
            </Button>
          ) : null}
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button onClick={save}>{bookmark ? t('common.save') : t('common.add')}</Button>
        </>
      }
    >
      <div className="space-y-4 pb-1">
        <Field label={t('bookmark.url')} htmlFor="bookmark-url">
          <Input
            id="bookmark-url"
            value={url}
            onChange={(event) => {
              setUrl(event.target.value)
              setError('')
            }}
            placeholder={t('bookmark.urlPlaceholder')}
            inputMode="url"
            autoCapitalize="none"
            autoCorrect="off"
            autoFocus
          />
          {error ? <p className="mt-1.5 text-xs text-danger">{error}</p> : null}
        </Field>
        <Field label={t('bookmark.title')} htmlFor="bookmark-title" hint={t('bookmark.titleHint')}>
          <Input
            id="bookmark-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder={t('bookmark.titlePlaceholder')}
          />
        </Field>
        <Field label={t('bookmark.description')} htmlFor="bookmark-description">
          <Textarea
            id="bookmark-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder={t('bookmark.descriptionPlaceholder')}
            rows={3}
          />
        </Field>
        <Field label={t('todo.tags')}>
          <TagInput value={tagValues} onChange={setTagValues} suggestions={tags.map((tag) => tag.name)} />
        </Field>
        {bookmark ? <EntityLinks type="bookmark" id={bookmark.id} /> : null}
      </div>
    </Modal>
  )
}
