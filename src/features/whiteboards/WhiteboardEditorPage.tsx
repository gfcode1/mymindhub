import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import {
  ArrowLeft,
  Download,
  Eraser,
  Pencil,
  Redo2,
  Trash2,
  Undo2,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button, IconButton } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/Modal'
import { useI18n } from '@/hooks/useI18n'
import { useWhiteboard } from '@/hooks/useData'
import {
  getWhiteboardData,
  saveWhiteboardStrokes,
  updateWhiteboardMeta,
} from '@/db/seed'
import { downloadBlob } from '@/lib/utils'
import { drawWhiteboardStroke } from '@/lib/whiteboard'
import type { WhiteboardMeta, WhiteboardStroke, WhiteboardTool } from '@/types/models'
import { WhiteboardCanvas } from './WhiteboardCanvas'

const COLORS = ['#111827', '#0d9488', '#4f46e5', '#be123c', '#b45309', '#4d7c0f', '#0891b2', '#7c3aed']
const WIDTHS = [2, 4, 8, 14]

export function WhiteboardEditorPage() {
  const { id } = useParams()
  const { t } = useI18n()
  const navigate = useNavigate()
  const meta = useWhiteboard(id)
  const [initialStrokes, setInitialStrokes] = useState<WhiteboardStroke[] | null>(null)

  useEffect(() => {
    if (!id) return
    let alive = true
    setInitialStrokes(null)
    void getWhiteboardData(id).then((data) => {
      if (alive) setInitialStrokes(data?.strokes ?? [])
    })
    return () => {
      alive = false
    }
  }, [id])

  if (meta === undefined || initialStrokes === null) {
    return (
      <div className="flex min-h-[60dvh] items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-line border-t-accent" />
      </div>
    )
  }

  if (meta === null || !id) {
    return (
      <div className="py-16 text-center">
        <p className="text-sm font-medium">{t('whiteboard.notFound')}</p>
        <p className="mt-1 text-sm text-muted">{t('whiteboard.notFoundDesc')}</p>
        <Button variant="secondary" className="mt-4" onClick={() => navigate('/whiteboards')}>
          {t('whiteboard.back')}
        </Button>
      </div>
    )
  }

  return <WhiteboardEditor key={meta.id} meta={meta} initialStrokes={initialStrokes} />
}

function WhiteboardEditor({
  meta,
  initialStrokes,
}: {
  meta: WhiteboardMeta
  initialStrokes: WhiteboardStroke[]
}) {
  const { t } = useI18n()
  const navigate = useNavigate()
  const [strokes, setStrokes] = useState<WhiteboardStroke[]>(initialStrokes)
  const [redoStack, setRedoStack] = useState<WhiteboardStroke[]>([])
  const [tool, setTool] = useState<WhiteboardTool>('pen')
  const [color, setColor] = useState(COLORS[0]!)
  const [strokeWidth, setStrokeWidth] = useState(WIDTHS[1]!)
  const [title, setTitle] = useState(meta.title)
  const [status, setStatus] = useState<'saved' | 'saving'>('saved')
  const [confirmClear, setConfirmClear] = useState(false)
  const saveToken = useRef(0)

  const persist = (next: WhiteboardStroke[]) => {
    setStatus('saving')
    const token = saveToken.current + 1
    saveToken.current = token
    void saveWhiteboardStrokes(meta.id, next)
      .then(() => {
        if (saveToken.current === token) setStatus('saved')
      })
      .catch(() => {
        if (saveToken.current === token) setStatus('saved')
      })
  }

  const commit = (next: WhiteboardStroke[]) => {
    setStrokes(next)
    setRedoStack([])
    persist(next)
  }

  const undo = () => {
    if (strokes.length === 0) return
    const last = strokes[strokes.length - 1]!
    const next = strokes.slice(0, -1)
    setStrokes(next)
    setRedoStack((current) => [...current, last])
    persist(next)
  }

  const redo = () => {
    const last = redoStack[redoStack.length - 1]
    if (!last) return
    const next = [...strokes, last]
    setStrokes(next)
    setRedoStack((current) => current.slice(0, -1))
    persist(next)
  }

  const clear = () => {
    setStrokes([])
    setRedoStack([])
    persist([])
  }

  const saveTitle = () => {
    const value = title.trim() || t('whiteboard.defaultTitle')
    setTitle(value)
    if (value !== meta.title) void updateWhiteboardMeta(meta.id, { title: value })
  }

  const exportPng = () => {
    const canvas = document.createElement('canvas')
    canvas.width = meta.width
    canvas.height = meta.height
    const context = canvas.getContext('2d')
    if (!context) {
      toast.error(t('whiteboard.exportError'))
      return
    }
    const layer = document.createElement('canvas')
    layer.width = meta.width
    layer.height = meta.height
    const layerContext = layer.getContext('2d')
    if (!layerContext) {
      toast.error(t('whiteboard.exportError'))
      return
    }
    for (const stroke of strokes) drawWhiteboardStroke(layerContext, stroke)
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, meta.width, meta.height)
    context.drawImage(layer, 0, 0)
    canvas.toBlob((blob) => {
      if (!blob) {
        toast.error(t('whiteboard.exportError'))
        return
      }
      const safeTitle = (title.trim() || t('whiteboard.defaultTitle')).replace(/[^\w-]+/g, '-')
      downloadBlob(blob, `${safeTitle}.png`)
      toast.success(t('whiteboard.exported'))
    }, 'image/png')
  }

  return (
    <div className="animate-fade-in">
      <div className="mb-3 flex items-center gap-2">
        <IconButton label={t('whiteboard.back')} onClick={() => navigate('/whiteboards')}>
          <ArrowLeft size={19} />
        </IconButton>
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          onBlur={saveTitle}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              event.currentTarget.blur()
            }
          }}
          aria-label={t('whiteboard.titlePlaceholder')}
          className="min-w-0 flex-1 bg-transparent text-[1.35rem] font-semibold leading-tight tracking-[-0.03em] outline-none placeholder:text-faint/70"
          placeholder={t('whiteboard.titlePlaceholder')}
        />
        <span className="shrink-0 text-[11px] text-faint" role="status">
          {status === 'saving' ? t('whiteboard.saving') : t('whiteboard.saved')}
        </span>
      </div>

      <div className="mb-2 flex flex-wrap items-center gap-1.5 rounded-xl border border-line bg-surface p-1.5">
        <Button
          variant={tool === 'pen' ? 'soft' : 'ghost'}
          size="sm"
          onClick={() => setTool('pen')}
        >
          <Pencil size={15} /> {t('whiteboard.pen')}
        </Button>
        <Button
          variant={tool === 'eraser' ? 'soft' : 'ghost'}
          size="sm"
          onClick={() => setTool('eraser')}
        >
          <Eraser size={15} /> {t('whiteboard.eraser')}
        </Button>

        <span className="mx-1 h-6 w-px bg-line" />

        {COLORS.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => {
              setColor(value)
              setTool('pen')
            }}
            aria-label={value}
            aria-pressed={color === value && tool === 'pen'}
            className={`h-6 w-6 rounded-full border-2 transition-transform ${
              color === value && tool === 'pen' ? 'scale-110 border-ink' : 'border-transparent'
            }`}
            style={{ background: value }}
          />
        ))}

        <span className="mx-1 h-6 w-px bg-line" />

        {WIDTHS.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setStrokeWidth(value)}
            aria-label={`${t('whiteboard.size')} ${value}`}
            aria-pressed={strokeWidth === value}
            className={`flex h-7 w-7 items-center justify-center rounded-lg transition-colors ${
              strokeWidth === value ? 'bg-accent-soft' : 'hover:bg-raised'
            }`}
          >
            <span
              className="rounded-full bg-ink"
              style={{ width: Math.min(14, value + 2), height: Math.min(14, value + 2) }}
            />
          </button>
        ))}

        <span className="mx-1 h-6 w-px bg-line" />

        <IconButton label={t('whiteboard.undo')} onClick={undo} disabled={strokes.length === 0}>
          <Undo2 size={17} />
        </IconButton>
        <IconButton label={t('whiteboard.redo')} onClick={redo} disabled={redoStack.length === 0}>
          <Redo2 size={17} />
        </IconButton>
        <IconButton label={t('whiteboard.clear')} onClick={() => setConfirmClear(true)} disabled={strokes.length === 0}>
          <Trash2 size={17} />
        </IconButton>
        <IconButton label={t('whiteboard.export')} onClick={exportPng} disabled={strokes.length === 0}>
          <Download size={17} />
        </IconButton>
      </div>

      <WhiteboardCanvas
        width={meta.width}
        height={meta.height}
        strokes={strokes}
        tool={tool}
        color={color}
        strokeWidth={strokeWidth}
        onCommit={commit}
      />

      <p className="mt-2 text-[11px] text-faint">
        {t('whiteboard.strokesCount', { count: strokes.length })}
      </p>

      <ConfirmDialog
        open={confirmClear}
        title={t('whiteboard.clearTitle')}
        description={t('whiteboard.clearDesc')}
        confirmLabel={t('whiteboard.confirmClear')}
        cancelLabel={t('common.cancel')}
        destructive
        onClose={() => setConfirmClear(false)}
        onConfirm={clear}
      />
    </div>
  )
}
