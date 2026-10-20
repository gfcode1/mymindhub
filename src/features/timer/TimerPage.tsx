import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { format } from 'date-fns'
import { BarChart3, Link2, Pause, Play, Square } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader, SectionTitle, EmptyState } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Field'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { useTimeEntries } from '@/hooks/useData'
import { useI18n } from '@/hooks/useI18n'
import { useNow } from '@/hooks/useNow'
import { elapsedMs, finishActiveTimer, useTimerStore } from '@/hooks/useTimer'
import { dateKey, formatHumanDuration, todayKey } from '@/lib/dates'
import { formatClock } from '@/lib/timer'
import type { TimerMode } from '@/types/models'

const DURATIONS = [15, 25, 50]

export function TimerPage() {
  const entries = useTimeEntries()
  const { t, locale } = useI18n()
  const navigate = useNavigate()
  const active = useTimerStore((state) => state.active)
  const startTimer = useTimerStore((state) => state.start)
  const pause = useTimerStore((state) => state.pause)
  const resume = useTimerStore((state) => state.resume)
  const [params, setParams] = useSearchParams()
  const now = useNow(250, active !== null)

  const [label, setLabel] = useState('')
  const [category, setCategory] = useState('')
  const [mode, setMode] = useState<TimerMode>('pomodoro')
  const [minutes, setMinutes] = useState(25)
  const [todoId, setTodoId] = useState<string | null>(null)
  const [noteId, setNoteId] = useState<string | null>(null)

  useEffect(() => {
    const incomingLabel = params.get('label')
    if (incomingLabel) setLabel(incomingLabel)
    setTodoId(params.get('todo'))
    setNoteId(params.get('note'))
  }, [params])

  const categories = [...new Set(entries.map((entry) => entry.category).filter(Boolean))].slice(0, 8)
  const elapsed = active ? Math.floor(elapsedMs(active, now) / 1000) : 0
  const remaining = active && active.mode === 'pomodoro' ? Math.max(0, active.durationSec - elapsed) : elapsed
  const progress =
    active && active.mode === 'pomodoro' && active.durationSec > 0
      ? Math.min(1, elapsed / active.durationSec)
      : 0

  const start = () => {
    startTimer({
      mode,
      durationSec: mode === 'pomodoro' ? minutes * 60 : 0,
      label,
      category,
      todoId,
      noteId,
    })
    if (params.toString()) setParams({}, { replace: true })
  }

  const stop = async () => {
    const entry = await finishActiveTimer(t('time.session'))
    if (entry) toast.success(t('time.saved'), { description: entry.label })
  }

  const todayEntries = entries.filter((entry) => dateKey(new Date(entry.startedAt)) === todayKey())

  return (
    <div className="animate-fade-in">
      <PageHeader
        title={t('time.title')}
        subtitle={t('time.subtitle')}
        action={
          <Button variant="secondary" size="sm" onClick={() => navigate('/time')}>
            <BarChart3 size={15} /> {t('time.openAudit')}
          </Button>
        }
      />

      <section className="mb-7 rounded-3xl border border-line bg-surface p-5">
        {active ? (
          <div className="flex flex-col items-center">
            <p className="text-xs font-semibold uppercase tracking-wide text-faint">
              {active.mode === 'pomodoro' ? t('time.pomodoro') : t('time.stopwatch')}
            </p>
            <p className="mt-2 text-5xl font-semibold tabular-nums tracking-tight">
              {formatClock(active.mode === 'pomodoro' ? remaining : elapsed)}
            </p>
            <p className="mt-1 text-xs text-muted">
              {active.pausedAt !== null ? t('time.paused') : t('time.running')}
            </p>

            {active.mode === 'pomodoro' ? (
              <div className="mt-4 h-1.5 w-full max-w-sm overflow-hidden rounded-full bg-raised">
                <div
                  className="h-full rounded-full bg-accent transition-[width] duration-300"
                  style={{ width: `${Math.max(1, progress * 100)}%` }}
                />
              </div>
            ) : null}

            <div className="mt-4 max-w-md text-center">
              <p className="text-sm font-semibold">{active.label || t('time.session')}</p>
              <p className="mt-0.5 text-xs text-muted">
                {active.category || t('time.noCategory')}
              </p>
              {active.todoId ? (
                <Link to="/todos" className="mt-1 inline-flex items-center gap-1 text-[11px] text-accent hover:underline">
                  <Link2 size={11} /> {t('time.linkedTodo')}
                </Link>
              ) : null}
              {active.noteId ? (
                <Link
                  to={`/notes/${active.noteId}`}
                  className="mt-1 inline-flex items-center gap-1 text-[11px] text-accent hover:underline"
                >
                  <Link2 size={11} /> {t('time.linkedNote')}
                </Link>
              ) : null}
            </div>

            <div className="mt-5 flex items-center gap-2">
              <Button variant="secondary" size="sm" onClick={active.pausedAt !== null ? resume : pause}>
                {active.pausedAt !== null ? <Play size={15} /> : <Pause size={15} />}
                {active.pausedAt !== null ? t('time.resume') : t('time.pause')}
              </Button>
              <Button variant="danger" size="sm" onClick={() => void stop()}>
                <Square size={14} /> {t('time.stop')}
              </Button>
            </div>
          </div>
        ) : (
          <div>
            <SegmentedControl
              value={mode}
              onChange={(value) => setMode(value)}
              options={[
                { value: 'pomodoro', label: t('time.pomodoro') },
                { value: 'stopwatch', label: t('time.stopwatch') },
              ]}
            />

            {mode === 'pomodoro' ? (
              <div className="mt-3">
                <SegmentedControl
                  value={String(minutes)}
                  onChange={(value) => setMinutes(Number(value))}
                  options={DURATIONS.map((value) => ({
                    value: String(value),
                    label: t('time.minutes', { count: value }),
                  }))}
                />
              </div>
            ) : null}

            <div className="mt-4 space-y-3">
              <Input
                value={label}
                onChange={(event) => setLabel(event.target.value)}
                placeholder={t('time.labelPlaceholder')}
                aria-label={t('time.label')}
              />
              <Input
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                placeholder={t('time.categoryPlaceholder')}
                aria-label={t('time.category')}
              />
              {categories.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {categories.map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setCategory(value)}
                      className="rounded-lg border border-line px-2 py-1 text-[11px] text-muted transition-colors hover:border-accent/40 hover:text-accent"
                    >
                      {value}
                    </button>
                  ))}
                </div>
              ) : null}
              {todoId ? (
                <p className="flex items-center gap-1 text-[11px] text-accent">
                  <Link2 size={11} /> {t('time.linkedTodo')}
                </p>
              ) : null}
              {noteId ? (
                <p className="flex items-center gap-1 text-[11px] text-accent">
                  <Link2 size={11} /> {t('time.linkedNote')}
                </p>
              ) : null}
            </div>

            <Button full size="lg" className="mt-5" onClick={start}>
              <Play size={17} /> {t('time.start')}
            </Button>
          </div>
        )}
      </section>

      <section>
        <SectionTitle
          title={t('time.todaySessions')}
          action={
            <span className="text-[11px] text-faint">
              {todayEntries.length > 0
                ? formatHumanDuration(todayEntries.reduce((sum, entry) => sum + entry.durationSec, 0))
                : '0 min'}
            </span>
          }
        />
        {todayEntries.length === 0 ? (
          <EmptyState title={t('time.noSessions')} description={t('time.noSessionsDesc')} />
        ) : (
          <div className="space-y-1.5">
            {todayEntries.map((entry) => (
              <div
                key={entry.id}
                className="flex items-center gap-3 rounded-xl border border-line bg-surface px-3 py-2.5"
              >
                <span className="shrink-0 text-sm font-semibold tabular-nums">
                  {formatClock(entry.durationSec)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{entry.label}</p>
                  <p className="truncate text-[11px] text-muted">
                    {entry.category || t('time.noCategory')} ·{' '}
                    {format(new Date(entry.startedAt), 'HH:mm', { locale })}
                  </p>
                </div>
                {entry.noteId ? (
                  <Link to={`/notes/${entry.noteId}`} className="text-faint hover:text-accent" aria-label={t('time.linkedNote')}>
                    <Link2 size={14} />
                  </Link>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
