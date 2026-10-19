import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router'
import {
  Download,
  Mic,
  Pause,
  Pencil,
  Play,
  RotateCcw,
  Square,
  Trash2,
  Volume2,
} from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader, EmptyState } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { TagInput, TagList } from '@/components/ui/TagInput'
import { useTags, useVoiceNotes } from '@/hooks/useData'
import { useStorageEstimate } from '@/hooks/usePwa'
import {
  createVoiceNote,
  deleteVoiceNote,
  restoreVoiceNote,
  updateVoiceNote,
} from '@/db/seed'
import { formatBytes, formatDate, formatDuration } from '@/lib/dates'
import { downloadBlob, truncate } from '@/lib/utils'
import type { VoiceNote } from '@/types/models'

const MIME_CANDIDATES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/mp4',
  'audio/ogg;codecs=opus',
]

function pickMimeType(): string {
  if (typeof MediaRecorder === 'undefined') return ''
  return MIME_CANDIDATES.find((type) => MediaRecorder.isTypeSupported(type)) ?? ''
}

function extensionFor(mimeType: string): string {
  if (mimeType.includes('mp4')) return 'm4a'
  if (mimeType.includes('ogg')) return 'ogg'
  if (mimeType.includes('wav')) return 'wav'
  return 'webm'
}

async function extractWaveform(blob: Blob, bars = 56): Promise<number[]> {
  try {
    const buffer = await blob.arrayBuffer()
    const context = new AudioContext()
    const audio = await context.decodeAudioData(buffer.slice(0))
    const channel = audio.getChannelData(0)
    const step = Math.max(1, Math.floor(channel.length / bars))
    const peaks: number[] = []
    for (let i = 0; i < bars; i += 1) {
      let sum = 0
      const start = i * step
      const end = Math.min(start + step, channel.length)
      for (let j = start; j < end; j += 1) {
        sum += Math.abs(channel[j] ?? 0)
      }
      peaks.push(Math.min(1, (sum / Math.max(1, end - start)) * 5))
    }
    await context.close()
    return peaks
  } catch {
    return Array.from({ length: bars }, (_, index) => 0.25 + ((index * 7) % 10) / 20)
  }
}

function defaultTitle(): string {
  return `Nota vocale · ${formatDate(new Date(), 'd MMM, HH:mm')}`
}

export function VoicePage() {
  const voices = useVoiceNotes()
  const tags = useTags()
  const { refresh } = useStorageEstimate()
  const [params, setParams] = useSearchParams()
  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const rafRef = useRef<number | null>(null)
  const timerRef = useRef<number | null>(null)
  const startedAtRef = useRef(0)
  const pausedAtRef = useRef(0)
  const pausedTotalRef = useRef(0)
  const levelsRef = useRef<number[]>([])
  const elapsedRef = useRef(0)
  const previewUrlRef = useRef<string | null>(null)
  const autoStarted = useRef(false)
  const stoppingRef = useRef(false)

  const [state, setState] = useState<'idle' | 'recording' | 'paused' | 'preview'>('idle')
  const [elapsed, setElapsed] = useState(0)
  const [levels, setLevels] = useState<number[]>([])
  const [error, setError] = useState('')
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewDuration, setPreviewDuration] = useState(0)
  const [previewWaveform, setPreviewWaveform] = useState<number[]>([])
  const [previewTitle, setPreviewTitle] = useState(defaultTitle)
  const [previewTags, setPreviewTags] = useState<string[]>([])
  const [editing, setEditing] = useState<VoiceNote | null>(null)

  const cleanupRecorder = () => {
    if (timerRef.current) window.clearInterval(timerRef.current)
    timerRef.current = null
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = null
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      void audioContextRef.current.close()
    }
    audioContextRef.current = null
    analyserRef.current = null
  }

  useEffect(() => {
    return () => {
      cleanupRecorder()
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current)
      if (currentAudio) {
        currentAudio.pause()
        currentAudio = null
      }
    }
  }, [])

  const startLevelLoop = () => {
    const analyser = analyserRef.current
    if (!analyser) return
    const data = new Uint8Array(analyser.fftSize)
    const tick = () => {
      if (!analyserRef.current) return
      analyserRef.current.getByteTimeDomainData(data)
      let sum = 0
      for (const value of data) {
        const normalized = (value - 128) / 128
        sum += normalized * normalized
      }
      const level = Math.min(1, Math.sqrt(sum / data.length) * 5)
      levelsRef.current = [...levelsRef.current.slice(-23), level]
      setLevels(levelsRef.current)
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
  }

  const start = async () => {
    if (state === 'recording' || state === 'paused') return
    setError('')
    if (typeof MediaRecorder === 'undefined') {
      setError('La registrazione audio non è supportata da questo browser.')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const mimeType = pickMimeType()
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
      recorderRef.current = recorder
      chunksRef.current = []
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data)
      }
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' })
        void finalize(blob)
      }

      const context = new AudioContext()
      const source = context.createMediaStreamSource(stream)
      const analyser = context.createAnalyser()
      analyser.fftSize = 512
      source.connect(analyser)
      audioContextRef.current = context
      analyserRef.current = analyser

      stoppingRef.current = false
      startedAtRef.current = Date.now()
      elapsedRef.current = 0
      pausedTotalRef.current = 0
      pausedAtRef.current = 0
      levelsRef.current = []
      setElapsed(0)
      setLevels([])
      setState('recording')
      recorder.start(250)
      timerRef.current = window.setInterval(() => {
        const paused = pausedAtRef.current ? Date.now() - pausedAtRef.current : 0
        const nextElapsed = (Date.now() - startedAtRef.current - pausedTotalRef.current - paused) / 1000
        elapsedRef.current = nextElapsed
        setElapsed(nextElapsed)
      }, 200)
      startLevelLoop()
    } catch {
      setError('Permesso microfono negato o microfono non disponibile.')
      cleanupRecorder()
    }
  }

  const finalize = async (blob: Blob) => {
    cleanupRecorder()
    stoppingRef.current = false
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current)
    const url = URL.createObjectURL(blob)
    previewUrlRef.current = url
    setPreviewBlob(blob)
    setPreviewUrl(url)
    setPreviewTitle(defaultTitle())
    setPreviewTags([])
    setPreviewWaveform(await extractWaveform(blob))
    setPreviewDuration(elapsedRef.current)
    setState('preview')
  }

  const pause = () => {
    if (state !== 'recording') return
    recorderRef.current?.pause()
    pausedAtRef.current = Date.now()
    setState('paused')
  }

  const resume = () => {
    if (state !== 'paused') return
    if (pausedAtRef.current) {
      pausedTotalRef.current += Date.now() - pausedAtRef.current
      pausedAtRef.current = 0
    }
    recorderRef.current?.resume()
    setState('recording')
  }

  const stop = () => {
    if (state !== 'recording' && state !== 'paused') return
    if (stoppingRef.current) return
    stoppingRef.current = true
    if (state === 'paused' && pausedAtRef.current) {
      pausedTotalRef.current += Date.now() - pausedAtRef.current
      pausedAtRef.current = 0
    }
    const finalElapsed = (Date.now() - startedAtRef.current - pausedTotalRef.current) / 1000
    elapsedRef.current = finalElapsed
    setElapsed(finalElapsed)
    recorderRef.current?.stop()
  }

  const discard = () => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current)
    previewUrlRef.current = null
    setPreviewUrl(null)
    setPreviewBlob(null)
    setPreviewWaveform([])
    setPreviewDuration(0)
    setElapsed(0)
    setState('idle')
  }

  const save = () => {
    if (!previewBlob) return
    const blob = previewBlob
    const title = previewTitle.trim() || defaultTitle()
    const duration = previewDuration
    const waveform = previewWaveform
    const mimeType = blob.type
    const voiceTags = previewTags
    discard()
    void createVoiceNote({ title, blob, mimeType, durationSec: duration, waveform, tags: voiceTags }).then(
      () => {
        void refresh()
        toast.success('Nota vocale salvata')
      },
    )
  }

  useEffect(() => {
    if (params.get('record') === '1' && !autoStarted.current) {
      autoStarted.current = true
      setParams({}, { replace: true })
      void start()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params])

  const totalSize = voices.reduce((sum, voice) => sum + voice.blob.size, 0)
  const recording = state === 'recording' || state === 'paused'

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Vocali"
        subtitle={`${voices.length} ${voices.length === 1 ? 'registrazione' : 'registrazioni'}${
          totalSize > 0 ? ` · ${formatBytes(totalSize)}` : ''
        }`}
      />

      <div className="mb-7 rounded-3xl border border-line bg-surface p-5">
        {state === 'preview' && previewUrl ? (
          <div className="animate-pop-in">
            <p className="text-xs font-semibold uppercase tracking-wide text-faint">Anteprima</p>
            <audio src={previewUrl} controls className="mt-3 w-full" />
            <Waveform peaks={previewWaveform} className="mt-3" />
            <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]">
              <Input
                value={previewTitle}
                onChange={(event) => setPreviewTitle(event.target.value)}
                aria-label="Titolo della nota vocale"
              />
              <div className="flex gap-2">
                <Button variant="ghost" onClick={discard}>
                  <RotateCcw size={16} /> Scarta
                </Button>
                <Button onClick={save}>
                  <Mic size={16} /> Salva
                </Button>
              </div>
            </div>
            <div className="mt-3">
              <TagInput value={previewTags} onChange={setPreviewTags} suggestions={tags.map((tag) => tag.name)} />
            </div>
            <p className="mt-2 text-[11px] text-faint">
              {formatDuration(previewDuration)} · {formatBytes(previewBlob?.size ?? 0)}
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center py-2">
            <div className="relative flex h-24 w-24 items-center justify-center">
              {recording ? (
                <span className="absolute inset-0 animate-ping rounded-full bg-danger/15" />
              ) : null}
              <button
                type="button"
                onClick={() => {
                  if (recording) stop()
                  else void start()
                }}
                aria-label={recording ? 'Ferma registrazione' : 'Inizia registrazione'}
                className={`relative flex h-20 w-20 items-center justify-center rounded-full transition-all active:scale-95 ${
                  recording
                    ? 'bg-danger text-white shadow-[0_10px_30px_-10px_var(--danger)]'
                    : 'bg-accent text-accent-ink shadow-[0_10px_30px_-10px_var(--accent)]'
                }`}
              >
                {recording ? <Square size={26} className="fill-current" /> : <Mic size={30} />}
              </button>
            </div>

            <p className="mt-3 text-2xl font-semibold tabular-nums tracking-tight">
              {formatDuration(elapsed)}
            </p>
            <p className="mt-1 text-xs text-muted">
              {state === 'recording'
                ? 'Registrazione in corso…'
                : state === 'paused'
                  ? 'In pausa'
                  : 'Tocca il microfono per iniziare'}
            </p>

            {recording ? (
              <div className="mt-4 flex items-center gap-2">
                <Button variant="secondary" size="sm" onClick={state === 'paused' ? resume : pause}>
                  {state === 'paused' ? <Play size={15} /> : <Pause size={15} />}
                  {state === 'paused' ? 'Riprendi' : 'Pausa'}
                </Button>
                <Button variant="danger" size="sm" onClick={stop}>
                  <Square size={14} /> Ferma
                </Button>
              </div>
            ) : null}

            {recording ? (
              <div className="mt-4 flex h-10 items-end gap-1">
                {levels.map((level, index) => (
                  <span
                    key={index}
                    className="w-1.5 rounded-full bg-accent/70 transition-[height] duration-100"
                    style={{ height: `${Math.max(4, level * 40)}px` }}
                  />
                ))}
              </div>
            ) : null}

            {error ? <p className="mt-3 text-center text-xs text-danger">{error}</p> : null}
          </div>
        )}
      </div>

      {voices.length === 0 ? (
        <EmptyState
          icon={<Volume2 size={20} />}
          title="Nessuna nota vocale"
          description="Registra un’idea mentre sei in movimento. L’audio resta salvato solo sul dispositivo."
        />
      ) : (
        <div className="space-y-2">
          {voices.map((voice) => (
            <VoiceCard
              key={voice.id}
              voice={voice}
              onEdit={() => setEditing(voice)}
              onDelete={() => {
                void deleteVoiceNote(voice.id).then(() => {
                  toast('Nota vocale eliminata', {
                    action: {
                      label: 'Annulla',
                      onClick: () => void restoreVoiceNote(voice.id),
                    },
                  })
                })
              }}
            />
          ))}
        </div>
      )}

      <EditVoiceModal
        voice={editing}
        onClose={() => setEditing(null)}
        onSave={(title, voiceTags) => {
          if (!editing) return
          void updateVoiceNote(editing.id, { title, tags: voiceTags }).then(() => {
            toast.success('Nota aggiornata')
            setEditing(null)
          })
        }}
      />
    </div>
  )
}

let currentAudio: HTMLAudioElement | null = null

function Waveform({
  peaks,
  progress = 0,
  onSeek,
  className,
}: {
  peaks: number[]
  progress?: number
  onSeek?: (ratio: number) => void
  className?: string
}) {
  return (
    <div
      className={`flex h-10 items-end gap-[2px] ${className ?? ''} ${onSeek ? 'cursor-pointer' : ''}`}
      onClick={(event) => {
        if (!onSeek) return
        const rect = event.currentTarget.getBoundingClientRect()
        onSeek(Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)))
      }}
    >
      {peaks.map((peak, index) => {
        const active = index / peaks.length <= progress
        return (
          <span
            key={index}
            className={`min-w-[2px] flex-1 rounded-full transition-colors ${
              active ? 'bg-accent' : 'bg-line'
            }`}
            style={{ height: `${Math.max(8, peak * 100)}%` }}
          />
        )
      })}
    </div>
  )
}

function VoiceCard({
  voice,
  onEdit,
  onDelete,
}: {
  voice: VoiceNote
  onEdit: () => void
  onDelete: () => void
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [url, setUrl] = useState<string | null>(null)
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    const next = URL.createObjectURL(voice.blob)
    setUrl(next)
    return () => {
      URL.revokeObjectURL(next)
    }
  }, [voice.blob])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    const onTime = () => {
      if (audio.duration > 0) setProgress(audio.currentTime / audio.duration)
    }
    const onEnd = () => {
      setPlaying(false)
      setProgress(0)
    }
    const onPause = () => setPlaying(false)
    audio.addEventListener('timeupdate', onTime)
    audio.addEventListener('ended', onEnd)
    audio.addEventListener('pause', onPause)
    return () => {
      audio.removeEventListener('timeupdate', onTime)
      audio.removeEventListener('ended', onEnd)
      audio.removeEventListener('pause', onPause)
    }
  }, [url])

  const toggle = async () => {
    const audio = audioRef.current
    if (!audio) return
    if (playing) {
      audio.pause()
      setPlaying(false)
      return
    }
    if (currentAudio && currentAudio !== audio) currentAudio.pause()
    currentAudio = audio
    try {
      await audio.play()
      setPlaying(true)
    } catch {
      toast.error('Impossibile riprodurre l’audio')
    }
  }

  const seek = (ratio: number) => {
    const audio = audioRef.current
    if (!audio || !Number.isFinite(audio.duration)) return
    audio.currentTime = ratio * audio.duration
    setProgress(ratio)
  }

  return (
    <div className="rounded-2xl border border-line bg-surface p-3.5">
      <audio ref={audioRef} src={url ?? undefined} preload="metadata" />
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => void toggle()}
          aria-label={playing ? 'Pausa' : 'Riproduci'}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent transition-transform active:scale-95"
        >
          {playing ? <Pause size={18} className="fill-current" /> : <Play size={18} className="ml-0.5 fill-current" />}
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{voice.title}</p>
          <p className="text-[11px] text-muted">
            {formatDate(voice.createdAt, 'd MMM yyyy, HH:mm')} · {formatDuration(voice.durationSec)} ·{' '}
            {formatBytes(voice.blob.size)}
          </p>
        </div>
        <Button variant="ghost" size="icon" onClick={onEdit} aria-label="Rinomina">
          <Pencil size={15} />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Scarica audio"
          onClick={() => downloadBlob(voice.blob, `${voice.title}.${extensionFor(voice.mimeType)}`)}
        >
          <Download size={15} />
        </Button>
        <Button variant="ghost" size="icon" className="text-danger" onClick={onDelete} aria-label="Elimina">
          <Trash2 size={15} />
        </Button>
      </div>
      <Waveform peaks={voice.waveform} progress={progress} onSeek={seek} className="mt-2.5" />
      {voice.tags.length > 0 ? <TagList tags={voice.tags} className="mt-2" /> : null}
      {voice.transcript ? (
        <p className="mt-2 text-xs leading-relaxed text-muted">{truncate(voice.transcript, 200)}</p>
      ) : null}
    </div>
  )
}

function EditVoiceModal({
  voice,
  onClose,
  onSave,
}: {
  voice: VoiceNote | null
  onClose: () => void
  onSave: (title: string, tags: string[]) => void
}) {
  const tags = useTags()
  const [title, setTitle] = useState('')
  const [values, setValues] = useState<string[]>([])

  useEffect(() => {
    if (!voice) return
    setTitle(voice.title)
    setValues(voice.tags)
  }, [voice])

  return (
    <Modal
      open={voice !== null}
      onClose={onClose}
      title="Modifica nota vocale"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Annulla
          </Button>
          <Button onClick={() => onSave(title.trim() || defaultTitle(), values)}>Salva</Button>
        </>
      }
    >
      <div className="space-y-4 pb-1">
        <Input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          aria-label="Titolo della nota vocale"
          autoFocus
        />
        <TagInput value={values} onChange={setValues} suggestions={tags.map((tag) => tag.name)} />
      </div>
    </Modal>
  )
}
