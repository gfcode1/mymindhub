import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router'
import { Archive, ArchiveRestore, Bookmark, ExternalLink, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader, EmptyState } from '@/components/ui/PageHeader'
import { Button, IconButton } from '@/components/ui/Button'
import { Field, Input, Textarea } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { TagInput, TagList } from '@/components/ui/TagInput'
import { useBookmarks, useTags } from '@/hooks/useData'
import {
  createBookmark,
  deleteBookmark,
  restoreBookmark,
  updateBookmark,
} from '@/db/seed'
import { formatDate } from '@/lib/dates'
import { hostnameOf, initials, normalizeUrl } from '@/lib/utils'
import type { Bookmark as BookmarkModel } from '@/types/models'

export function BookmarksPage() {
  const [params, setParams] = useSearchParams()
  const active = useBookmarks({ archived: false })
  const archived = useBookmarks({ archived: true })
  const [tab, setTab] = useState<'active' | 'archived'>('active')
  const [query, setQuery] = useState('')
  const [editing, setEditing] = useState<BookmarkModel | null>(null)
  const [editorOpen, setEditorOpen] = useState(false)
  const handledNew = useRef(false)

  useEffect(() => {
    if (params.get('new') === '1' && !handledNew.current) {
      handledNew.current = true
      setEditing(null)
      setEditorOpen(true)
      setParams({}, { replace: true })
    }
  }, [params, setParams])

  const source = tab === 'active' ? active : archived
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return source
    return source.filter(
      (bookmark) =>
        bookmark.title.toLowerCase().includes(needle) ||
        bookmark.url.toLowerCase().includes(needle) ||
        bookmark.description.toLowerCase().includes(needle) ||
        bookmark.tags.some((tag) => tag.includes(needle)),
    )
  }, [source, query])

  const remove = (bookmark: BookmarkModel) => {
    void deleteBookmark(bookmark.id).then(() => {
      toast('Bookmark eliminato', {
        action: { label: 'Annulla', onClick: () => void restoreBookmark(bookmark.id) },
      })
    })
  }

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Link"
        subtitle={`${active.length} salvati${archived.length ? ` · ${archived.length} archiviati` : ''}`}
        action={
          <Button
            size="sm"
            onClick={() => {
              setEditing(null)
              setEditorOpen(true)
            }}
          >
            <Plus size={16} /> Nuovo
          </Button>
        }
      />

      <div className="mb-4 space-y-3">
        <div className="relative">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Cerca nei link…"
            className="pl-9"
            type="search"
          />
        </div>
        <SegmentedControl
          value={tab}
          onChange={setTab}
          options={[
            { value: 'active', label: 'Salvati', count: active.length },
            { value: 'archived', label: 'Archiviati', count: archived.length },
          ]}
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Bookmark size={20} />}
          title={query ? 'Nessun risultato' : 'Nessun link salvato'}
          description={
            query
              ? 'Prova un altro termine.'
              : 'Salva articoli, strumenti e pagine da ritrovare. Funziona anche offline come elenco.'
          }
          action={
            !query ? (
              <Button
                variant="soft"
                size="sm"
                onClick={() => {
                  setEditing(null)
                  setEditorOpen(true)
                }}
              >
                <Plus size={15} /> Salva link
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
                  label="Apri link"
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
                <span className="ml-auto shrink-0 text-[10px] text-faint">
                  {formatDate(bookmark.createdAt, 'd MMM')}
                </span>
              </div>

              <div className="mt-2 flex items-center justify-end gap-0.5 border-t border-line/70 pt-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    void updateBookmark(bookmark.id, { archived: !bookmark.archived }).then(() => {
                      toast(bookmark.archived ? 'Link ripristinato' : 'Link archiviato')
                    })
                  }}
                >
                  {bookmark.archived ? <ArchiveRestore size={13} /> : <Archive size={13} />}
                  {bookmark.archived ? 'Ripristina' : 'Archivia'}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setEditing(bookmark)
                    setEditorOpen(true)
                  }}
                >
                  <Pencil size={13} /> Modifica
                </Button>
                <Button variant="ghost" size="sm" className="text-danger" onClick={() => remove(bookmark)}>
                  <Trash2 size={13} /> Elimina
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'archived' && archived.length > 0 ? (
        <p className="mt-4 flex items-center gap-1.5 text-xs text-faint">
          <Archive size={13} /> I link archiviati non compaiono nei risultati attivi.
        </p>
      ) : null}

      <BookmarkEditor
        open={editorOpen}
        bookmark={editing}
        onClose={() => {
          setEditorOpen(false)
          setEditing(null)
        }}
      />
    </div>
  )
}

function BookmarkEditor({
  open,
  bookmark,
  onClose,
}: {
  open: boolean
  bookmark: BookmarkModel | null
  onClose: () => void
}) {
  const tags = useTags()
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
      setUrl('')
      setTitle('')
      setDescription('')
      setTagValues([])
    }
  }, [open, bookmark])

  const save = () => {
    const normalized = normalizeUrl(url)
    if (!normalized) {
      setError('Inserisci un URL http o https valido.')
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
        toast.success('Bookmark aggiornato')
        onClose()
      })
    } else {
      void createBookmark({
        url: normalized,
        title: finalTitle,
        description,
        tags: tagValues,
      }).then(() => {
        toast.success('Bookmark salvato')
        onClose()
      })
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={bookmark ? 'Modifica bookmark' : 'Nuovo bookmark'}
      description={bookmark ? undefined : 'Incolla un link e aggiungi contesto per ritrovarlo.'}
      footer={
        <>
          {bookmark ? (
            <Button
              variant="ghost"
              className="mr-auto text-danger"
              onClick={() => {
                void deleteBookmark(bookmark.id).then(() => {
                  toast('Bookmark eliminato', {
                    action: {
                      label: 'Annulla',
                      onClick: () => void restoreBookmark(bookmark.id),
                    },
                  })
                  onClose()
                })
              }}
            >
              <Trash2 size={15} /> Elimina
            </Button>
          ) : null}
          <Button variant="ghost" onClick={onClose}>
            Annulla
          </Button>
          <Button onClick={save}>{bookmark ? 'Salva' : 'Aggiungi'}</Button>
        </>
      }
    >
      <div className="space-y-4 pb-1">
        <Field label="URL" htmlFor="bookmark-url">
          <Input
            id="bookmark-url"
            value={url}
            onChange={(event) => {
              setUrl(event.target.value)
              setError('')
            }}
            placeholder="https://esempio.com/articolo"
            inputMode="url"
            autoCapitalize="none"
            autoCorrect="off"
            autoFocus
          />
          {error ? <p className="mt-1.5 text-xs text-danger">{error}</p> : null}
        </Field>
        <Field label="Titolo" htmlFor="bookmark-title" hint="Se vuoto usiamo il dominio.">
          <Input
            id="bookmark-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Titolo del link"
          />
        </Field>
        <Field label="Descrizione" htmlFor="bookmark-description">
          <Textarea
            id="bookmark-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Perché lo salvi? Cosa vuoi ricordare?"
            rows={3}
          />
        </Field>
        <Field label="Tag">
          <TagInput value={tagValues} onChange={setTagValues} suggestions={tags.map((tag) => tag.name)} />
        </Field>
      </div>
    </Modal>
  )
}
