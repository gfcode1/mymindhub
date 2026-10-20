import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { ArrowLeft, ExternalLink, FileText, Pencil, Save, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { Button, IconButton } from '@/components/ui/Button'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { Textarea } from '@/components/ui/Field'
import { EmptyState } from '@/components/ui/PageHeader'
import { useBookmark } from '@/hooks/useData'
import { useI18n } from '@/hooks/useI18n'
import { updateBookmark } from '@/db/seed'
import { formatDateTime } from '@/lib/dates'
import { fetchReadableContent, readingTimeMinutes } from '@/lib/reader'
import { hostnameOf, nowIso } from '@/lib/utils'
import type { Bookmark, BookmarkReadingStatus } from '@/types/models'

export function ReaderPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const bookmark = useBookmark(id)
  const { t } = useI18n()

  if (bookmark === undefined) {
    return (
      <div className="flex min-h-[60dvh] items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-line border-t-accent" />
      </div>
    )
  }

  if (!bookmark || !id) {
    return (
      <div className="py-16 text-center">
        <p className="text-sm font-medium">{t('reader.notFound')}</p>
        <p className="mt-1 text-sm text-muted">{t('reader.notFoundDesc')}</p>
        <Button variant="secondary" className="mt-4" onClick={() => navigate('/bookmarks')}>
          {t('reader.back')}
        </Button>
      </div>
    )
  }

  return <ReaderView key={bookmark.id} bookmark={bookmark} />
}

function ReaderView({ bookmark }: { bookmark: Bookmark }) {
  const { t, locale } = useI18n()
  const navigate = useNavigate()
  const [content, setContent] = useState(bookmark.readerContent)
  const [status, setStatus] = useState<BookmarkReadingStatus>(bookmark.readingStatus)
  const [editing, setEditing] = useState(bookmark.readerContent.length === 0)
  const [extracting, setExtracting] = useState(false)
  const [saving, setSaving] = useState(false)

  const changeStatus = (value: BookmarkReadingStatus) => {
    setStatus(value)
    void updateBookmark(bookmark.id, { readingStatus: value })
  }

  const save = async (value: string) => {
    setSaving(true)
    try {
      const text = value.trim()
      const nextStatus = text && status === 'to-read' ? 'reading' : status
      await updateBookmark(bookmark.id, {
        readerContent: text,
        readerUpdatedAt: nowIso(),
        readingStatus: nextStatus,
      })
      setContent(text)
      setStatus(nextStatus)
      setEditing(false)
      toast.success(t('reader.saved'))
    } finally {
      setSaving(false)
    }
  }

  const extract = async () => {
    setExtracting(true)
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), 15_000)
    try {
      const text = await fetchReadableContent(bookmark.url, controller.signal)
      setContent(text)
      setStatus('reading')
      setEditing(false)
      await updateBookmark(bookmark.id, {
        readerContent: text,
        readerUpdatedAt: nowIso(),
        readingStatus: 'reading',
      })
      toast.success(t('reader.saved'))
    } catch {
      toast.error(t('reader.extractError'), {
        description: t('reader.extractErrorDesc'),
      })
      setEditing(true)
    } finally {
      window.clearTimeout(timeout)
      setExtracting(false)
    }
  }

  const minutes = readingTimeMinutes(content)

  return (
    <div className="animate-fade-in">
      <div className="mb-3 flex items-center gap-1.5">
        <IconButton label={t('reader.back')} onClick={() => navigate('/bookmarks')}>
          <ArrowLeft size={19} />
        </IconButton>
        <a
          href={bookmark.url}
          target="_blank"
          rel="noreferrer noopener"
          className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline"
        >
          <ExternalLink size={13} /> {t('reader.original')}
        </a>
      </div>

      <header className="mb-4">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-faint">
          {hostnameOf(bookmark.url)}
        </p>
        <h1 className="mt-1 text-[1.65rem] font-semibold leading-tight tracking-[-0.03em]">
          {bookmark.title}
        </h1>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-faint">
          {minutes > 0 ? <span>{t('reader.minutes', { count: minutes })}</span> : null}
          {bookmark.readerUpdatedAt ? (
            <span>{t('reader.updated', { date: formatDateTime(bookmark.readerUpdatedAt, locale) })}</span>
          ) : null}
        </div>
      </header>

      <div className="mb-4">
        <SegmentedControl
          value={status}
          onChange={changeStatus}
          options={[
            { value: 'to-read', label: t('bookmark.statusToRead') },
            { value: 'reading', label: t('bookmark.statusReading') },
            { value: 'done', label: t('bookmark.statusDone') },
          ]}
        />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Button size="sm" variant="secondary" disabled={extracting} onClick={() => void extract()}>
          <Sparkles size={15} /> {extracting ? t('reader.extracting') : t('reader.extract')}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            if (editing) {
              setContent(bookmark.readerContent)
              setEditing(false)
            } else {
              setEditing(true)
            }
          }}
        >
          <Pencil size={15} /> {editing ? t('common.cancel') : t('reader.edit')}
        </Button>
        {editing ? (
          <Button size="sm" disabled={saving} onClick={() => void save(content)}>
            <Save size={15} /> {t('reader.save')}
          </Button>
        ) : null}
      </div>

      {editing ? (
        <div>
          <Textarea
            value={content}
            onChange={(event) => setContent(event.target.value)}
            placeholder={t('reader.pastePlaceholder')}
            className="min-h-[50dvh] text-[15px] leading-relaxed"
            autoFocus={content.length === 0}
          />
          <p className="mt-2 text-[11px] leading-relaxed text-faint">{t('reader.corsHint')}</p>
        </div>
      ) : content ? (
        <article className="prose-note rounded-2xl border border-line bg-surface p-5 text-[15px] leading-relaxed whitespace-pre-wrap">
          {content}
        </article>
      ) : (
        <EmptyState
          icon={<FileText size={20} />}
          title={t('reader.empty')}
          description={t('reader.emptyDesc')}
          action={
            <Button variant="soft" size="sm" onClick={() => setEditing(true)}>
              <Pencil size={15} /> {t('reader.paste')}
            </Button>
          }
        />
      )}

      <p className="mt-4 text-[11px] leading-relaxed text-faint">
        <Link to="/bookmarks" className="text-accent hover:underline">
          {t('reader.back')}
        </Link>
      </p>
    </div>
  )
}
