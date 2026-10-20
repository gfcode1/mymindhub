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
  Timer,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button, IconButton } from '@/components/ui/Button'
import { TagInput } from '@/components/ui/TagInput'
import { DictationButton } from '@/components/ui/DictationButton'
import { EntityLinks } from '@/features/links/EntityLinks'
import { useNote, useTags } from '@/hooks/useData'
import { useI18n } from '@/hooks/useI18n'
import { deleteNote, restoreNote, updateNote } from '@/db/seed'
import { cn } from '@/lib/utils'

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

export function NoteEditorPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const note = useNote(id)
  const tags = useTags()
  const { t } = useI18n()

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
        <p className="text-sm font-medium">{t('note.notFound')}</p>
        <p className="mt-1 text-sm text-muted">{t('note.notFoundDesc')}</p>
        <Button variant="secondary" className="mt-4" onClick={() => navigate('/notes')}>
          {t('note.backToList')}
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

  const appendSpeech = (text: string) => {
    const clean = text.trim()
    if (!clean) return
    const element = textareaRef.current
    if (!element || preview) {
      const base = content.trimEnd()
      setContent(base ? `${base} ${clean}` : clean)
      markDirty()
      return
    }
    const start = element.selectionStart
    const end = element.selectionEnd
    const before = content.slice(0, start)
    const after = content.slice(end)
    const prefix = before && !/\s$/.test(before) ? ' ' : ''
    const suffix = after && !/^\s/.test(after) ? ' ' : ''
    const inserted = `${prefix}${clean}${suffix}`
    setContent(`${before}${inserted}${after}`)
    markDirty()
    const caret = start + inserted.length
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
      toast(nextArchived ? t('note.archived') : t('note.restored'), {
        action: {
          label: t('common.undo'),
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
      toast(t('note.deleted'), {
        action: {
          label: t('common.undo'),
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
        <IconButton label={t('note.back')} onClick={() => navigate('/notes')}>
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
              ? t('note.saving')
              : saveState === 'error'
                ? t('note.saveError')
                : t('note.saved')}
          </span>
          <IconButton label={note.pinned ? t('note.unpin') : t('note.pin')} onClick={() => {
            void updateNote(note.id, { pinned: !note.pinned })
          }}>
            {note.pinned ? <Pin size={18} className="fill-accent text-accent" /> : <Pin size={18} />}
          </IconButton>
          <IconButton label={preview ? t('note.write') : t('note.preview')} onClick={() => setPreview((value) => !value)}>
            {preview ? <EyeOff size={18} /> : <Eye size={18} />}
          </IconButton>
          <IconButton
            label={t('time.startForNote')}
            onClick={() => navigate(`/timer?note=${note.id}&label=${encodeURIComponent(note.title)}`)}
          >
            <Timer size={18} />
          </IconButton>
          <IconButton label={note.archived ? t('note.unarchive') : t('common.archive')} onClick={handleArchive}>
            <Archive size={18} />
          </IconButton>
          <IconButton label={t('note.delete')} onClick={handleDelete} className="hover:text-danger">
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
        placeholder={t('note.titlePlaceholder')}
        aria-label={t('note.titleAria')}
        className="mb-2 w-full bg-transparent text-[1.65rem] font-semibold leading-tight tracking-[-0.03em] outline-none placeholder:text-faint/70"
      />

      <div className="mb-3 flex flex-wrap items-center gap-2 text-[11px] text-faint">
        <span>{t('common.words', { count: words })}</span>
        <span>·</span>
        <span>{t('common.characters', { count: content.length })}</span>
        <span>·</span>
        <span>{t('common.markdown')}</span>
        {saveState === 'saving' ? <span className="text-accent sm:hidden">· {t('note.saving')}</span> : null}
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

      <EntityLinks type="note" id={note.id} className="mb-4" />

      {!preview ? (
        <>
          <div className="scrollbar-none mb-2 flex items-center gap-0.5 overflow-x-auto rounded-xl border border-line bg-surface p-1">
            <ToolbarButton label={t('note.bold')} onClick={() => insert('**', '**')}>
              <Bold size={15} />
            </ToolbarButton>
            <ToolbarButton label={t('note.italic')} onClick={() => insert('_', '_')}>
              <Italic size={15} />
            </ToolbarButton>
            <ToolbarButton label={t('note.heading')} onClick={() => insert('## ', '', true)}>
              <span className="text-[13px] font-semibold">H2</span>
            </ToolbarButton>
            <ToolbarButton label={t('note.list')} onClick={() => insert('- ', '', true)}>
              <List size={15} />
            </ToolbarButton>
            <ToolbarButton label={t('note.checklist')} onClick={() => insert('- [ ] ', '', true)}>
              <CheckSquare size={15} />
            </ToolbarButton>
            <ToolbarButton label={t('note.link')} onClick={() => insert('[', '](https://)')}>
              <Link2 size={15} />
            </ToolbarButton>
            <DictationButton onText={appendSpeech} disabled={preview} className="ml-1" />
            <span className="ml-auto hidden pr-1 text-[10px] text-faint sm:block">
              {t('note.autosave')}
            </span>
          </div>
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(event) => {
              setContent(event.target.value)
              markDirty()
            }}
            placeholder={t('note.contentPlaceholder')}
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
            <p className="text-sm italic text-faint">{t('note.previewEmpty')}</p>
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
