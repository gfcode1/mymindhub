import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeSanitize from 'rehype-sanitize'
import {
  Archive,
  ArrowLeft,
  Bold,
  CheckSquare,
  Eye,
  EyeOff,
  Italic,
  Link2,
  List,
  Pin,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button, IconButton } from '@/components/ui/Button'
import { TagInput } from '@/components/ui/TagInput'
import { useNote, useTags } from '@/hooks/useData'
import { deleteNote, restoreNote, updateNote } from '@/db/seed'
import { cn } from '@/lib/utils'

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

export function NoteEditorPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const note = useNote(id)
  const tags = useTags()

  const [hydratedId, setHydratedId] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [noteTags, setNoteTags] = useState<string[]>([])
  const [dirty, setDirty] = useState(false)
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [preview, setPreview] = useState(false)

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const valuesRef = useRef({ title, content, tags: noteTags })
  const dirtyRef = useRef(false)
  const noteId = note?.id

  useEffect(() => {
    valuesRef.current = { title, content, tags: noteTags }
  }, [title, content, noteTags])

  useEffect(() => {
    dirtyRef.current = dirty
  }, [dirty])

  useEffect(() => {
    if (note && note.id !== hydratedId) {
      setTitle(note.title)
      setContent(note.content)
      setNoteTags(note.tags)
      setHydratedId(note.id)
      setDirty(false)
      setSaveState('saved')
    }
  }, [note, hydratedId])

  useEffect(() => {
    if (!noteId || hydratedId !== noteId || !dirty) return
    setSaveState('saving')
    const timer = setTimeout(() => {
      void updateNote(noteId, { title, content, tags: noteTags })
        .then(() => {
          setDirty(false)
          setSaveState('saved')
        })
        .catch(() => setSaveState('error'))
    }, 650)
    return () => clearTimeout(timer)
  }, [title, content, noteTags, dirty, hydratedId, noteId])

  useEffect(() => {
    return () => {
      if (dirtyRef.current && noteId) {
        void updateNote(noteId, valuesRef.current)
      }
    }
  }, [noteId])

  if (note === undefined) {
    return (
      <div className="flex min-h-[60dvh] items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-line border-t-accent" />
      </div>
    )
  }

  if (note === null || !note) {
    return (
      <div className="py-16 text-center">
        <p className="text-sm font-medium">Nota non trovata</p>
        <p className="mt-1 text-sm text-muted">Potrebbe essere stata eliminata.</p>
        <Button variant="secondary" className="mt-4" onClick={() => navigate('/notes')}>
          Torna alle note
        </Button>
      </div>
    )
  }

  const markDirty = () => {
    setDirty(true)
    setSaveState('saving')
  }

  const insert = (before: string, after = '', linePrefix = false) => {
    const element = textareaRef.current
    if (!element) return
    const start = element.selectionStart
    const end = element.selectionEnd
    const selected = content.slice(start, end)
    let next = content
    let caret = end
    if (linePrefix) {
      const lineStart = content.lastIndexOf('\n', start - 1) + 1
      next = `${content.slice(0, lineStart)}${before}${content.slice(lineStart)}`
      caret = end + before.length
    } else {
      next = `${content.slice(0, start)}${before}${selected}${after}${content.slice(end)}`
      caret = start + before.length + selected.length + after.length
    }
    setContent(next)
    markDirty()
    requestAnimationFrame(() => {
      element.focus()
      element.setSelectionRange(caret, caret)
    })
  }

  const handleArchive = () => {
    if (!noteId) return
    const nextArchived = !note.archived
    setDirty(false)
    void updateNote(noteId, { title, content, tags: noteTags, archived: nextArchived }).then(() => {
      toast(nextArchived ? 'Nota archiviata' : 'Nota ripristinata', {
        action: {
          label: 'Annulla',
          onClick: () => void updateNote(noteId, { archived: !nextArchived }),
        },
      })
      if (nextArchived) navigate('/notes')
    })
  }

  const handleDelete = () => {
    if (!noteId) return
    setDirty(false)
    void deleteNote(noteId).then(() => {
      toast('Nota eliminata', {
        action: {
          label: 'Annulla',
          onClick: () => void restoreNote(noteId),
        },
      })
      navigate('/notes')
    })
  }

  const words = content.trim() ? content.trim().split(/\s+/).length : 0

  return (
    <div className="animate-fade-in">
      <div className="mb-3 flex items-center justify-between gap-2">
        <IconButton label="Torna alle note" onClick={() => navigate('/notes')}>
          <ArrowLeft size={19} />
        </IconButton>
        <div className="flex items-center gap-0.5">
          <span
            className={cn(
              'mr-1 hidden text-[11px] transition-opacity sm:block',
              saveState === 'error' ? 'text-danger' : 'text-faint',
            )}
            role="status"
          >
            {saveState === 'saving'
              ? 'Salvataggio…'
              : saveState === 'error'
                ? 'Errore di salvataggio'
                : 'Salvato'}
          </span>
          <IconButton label={note.pinned ? 'Rimuovi pin' : 'Fissa in alto'} onClick={() => {
            void updateNote(note.id, { pinned: !note.pinned })
          }}>
            {note.pinned ? <Pin size={18} className="fill-accent text-accent" /> : <Pin size={18} />}
          </IconButton>
          <IconButton label={preview ? 'Scrivi' : 'Anteprima'} onClick={() => setPreview((value) => !value)}>
            {preview ? <EyeOff size={18} /> : <Eye size={18} />}
          </IconButton>
          <IconButton label={note.archived ? 'Ripristina' : 'Archivia'} onClick={handleArchive}>
            <Archive size={18} />
          </IconButton>
          <IconButton label="Elimina nota" onClick={handleDelete} className="hover:text-danger">
            <Trash2 size={18} />
          </IconButton>
        </div>
      </div>

      <input
        value={title}
        onChange={(event) => {
          setTitle(event.target.value)
          markDirty()
        }}
        placeholder="Titolo della nota"
        aria-label="Titolo della nota"
        className="mb-2 w-full bg-transparent text-[1.65rem] font-semibold leading-tight tracking-[-0.03em] outline-none placeholder:text-faint/70"
      />

      <div className="mb-3 flex flex-wrap items-center gap-2 text-[11px] text-faint">
        <span>{words} parole</span>
        <span>·</span>
        <span>{content.length} caratteri</span>
        <span>·</span>
        <span>Markdown</span>
        {saveState === 'saving' ? <span className="text-accent sm:hidden">· Salvataggio…</span> : null}
      </div>

      <div className="mb-4">
        <TagInput
          value={noteTags}
          onChange={(next) => {
            setNoteTags(next)
            markDirty()
          }}
          suggestions={tags.map((tag) => tag.name)}
        />
      </div>

      {!preview ? (
        <>
          <div className="scrollbar-none mb-2 flex items-center gap-0.5 overflow-x-auto rounded-xl border border-line bg-surface p-1">
            <ToolbarButton label="Grassetto" onClick={() => insert('**', '**')}>
              <Bold size={15} />
            </ToolbarButton>
            <ToolbarButton label="Corsivo" onClick={() => insert('_', '_')}>
              <Italic size={15} />
            </ToolbarButton>
            <ToolbarButton label="Titolo" onClick={() => insert('## ', '', true)}>
              <span className="text-[13px] font-semibold">H2</span>
            </ToolbarButton>
            <ToolbarButton label="Elenco" onClick={() => insert('- ', '', true)}>
              <List size={15} />
            </ToolbarButton>
            <ToolbarButton label="Checklist" onClick={() => insert('- [ ] ', '', true)}>
              <CheckSquare size={15} />
            </ToolbarButton>
            <ToolbarButton label="Link" onClick={() => insert('[', '](https://)')}>
              <Link2 size={15} />
            </ToolbarButton>
            <span className="ml-auto hidden pr-1 text-[10px] text-faint sm:block">
              Salvataggio automatico
            </span>
          </div>
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(event) => {
              setContent(event.target.value)
              markDirty()
            }}
            placeholder="Scrivi qualcosa… Puoi usare # titoli, **grassetto**, - elenchi e checklist."
            className="min-h-[48dvh] w-full resize-y rounded-2xl border border-line bg-surface p-4 text-[15px] leading-relaxed text-ink outline-none placeholder:text-faint/70 focus:border-accent/50 focus:ring-2 focus:ring-accent/15"
          />
        </>
      ) : (
        <div className="min-h-[48dvh] rounded-2xl border border-line bg-surface p-5">
          {content.trim() ? (
            <div className="prose-note max-w-none text-[15px]">
              <Markdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeSanitize]}
                components={{
                  a: ({ children, href }) => (
                    <a href={href} target="_blank" rel="noreferrer noopener">
                      {children}
                    </a>
                  ),
                }}
              >
                {content}
              </Markdown>
            </div>
          ) : (
            <p className="text-sm italic text-faint">Niente da mostrare. Scrivi qualcosa nella nota.</p>
          )}
        </div>
      )}
    </div>
  )
}

function ToolbarButton({
  label,
  onClick,
  children,
}: {
  label: string
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:bg-raised hover:text-ink"
    >
      {children}
    </button>
  )
}
