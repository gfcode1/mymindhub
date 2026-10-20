import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { Check, Pencil, Plus, Repeat2, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader, EmptyState } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { useHabitLogs, useHabits } from '@/hooks/useData'
import { useI18n } from '@/hooks/useI18n'
import { createHabit, deleteHabit, restoreHabit, toggleHabitLog, updateHabit } from '@/db/seed'
import { dateKey } from '@/lib/dates'
import { habitStreak, isHabitDone, isHabitScheduled, lastDays } from '@/lib/habits'
import { openMoji } from '@/assets/openmoji'
import { cn } from '@/lib/utils'
import type { Habit, HabitSchedule } from '@/types/models'

const EMOJI_OPTIONS = [
  '1F331', '1F3C3', '1F4DA', '1F9D8', '1F4A7', '1F34E', '1F6B6',
  '1F3B5', '1F4DD', '1F4AA', '1F634', '1F9F9', '1F4B8', '1F31E',
  '2B50', '1F3AF', '1F9E0', '1F4A4', '1F525',
]

const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0]

export function HabitsPage() {
  const habits = useHabits()
  const logs = useHabitLogs()
  const { t, locale } = useI18n()
  const [editing, setEditing] = useState<Habit | null>(null)
  const [editorOpen, setEditorOpen] = useState(false)
  const [now] = useState(() => new Date())
  const today = dateKey(now)
  const days = lastDays(7, now)

  const openNew = () => {
    setEditing(null)
    setEditorOpen(true)
  }

  const visible = habits.filter((habit) => !habit.archived)

  return (
    <div className="animate-fade-in">
      <PageHeader
        title={t('habits.title')}
        subtitle={t('habits.subtitle')}
        action={
          <Button size="sm" onClick={openNew}>
            <Plus size={16} /> {t('habits.new')}
          </Button>
        }
      />

      {visible.length === 0 ? (
        <EmptyState
          icon={<Repeat2 size={20} />}
          title={t('habits.empty')}
          description={t('habits.emptyDesc')}
          action={
            <Button variant="soft" size="sm" onClick={openNew}>
              <Plus size={15} /> {t('habits.createFirst')}
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {visible.map((habit) => {
            const streak = habitStreak(habit, logs, now)
            const emoji = openMoji(habit.emoji)
            return (
              <article key={habit.id} className="rounded-2xl border border-line bg-surface p-4">
                <div className="flex items-start gap-3">
                  {emoji ? <img src={emoji} alt="" aria-hidden className="h-8 w-8 select-none" /> : null}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{habit.name}</p>
                    <p className="text-[11px] text-muted">
                      {streak > 0 ? t('habits.streak', { count: streak }) : t('habits.noStreak')}
                      {' · '}
                      {habit.schedule === 'daily' ? t('habits.daily') : t('habits.weekdays')}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={t('common.edit')}
                    onClick={() => {
                      setEditing(habit)
                      setEditorOpen(true)
                    }}
                  >
                    <Pencil size={15} />
                  </Button>
                </div>

                <div className="mt-3 grid grid-cols-7 gap-1.5">
                  {days.map((day) => {
                    const scheduled = isHabitScheduled(habit, day)
                    const done = isHabitDone(logs, habit.id, dateKey(day))
                    const isToday = dateKey(day) === today
                    return (
                      <button
                        key={dateKey(day)}
                        type="button"
                        disabled={!scheduled && !done}
                        onClick={() => void toggleHabitLog(habit.id, dateKey(day))}
                        aria-label={dateKey(day)}
                        className={cn(
                          'flex flex-col items-center gap-1 rounded-lg border py-1.5 text-[10px] transition-colors',
                          done
                            ? 'border-accent bg-accent-soft text-accent'
                            : scheduled
                              ? 'border-line text-muted hover:border-accent/50'
                              : 'border-line/50 text-faint/40',
                          isToday && !done && 'border-accent/60',
                        )}
                      >
                        <span className="uppercase">{format(day, 'EEEEE', { locale })}</span>
                        <span className="text-xs font-semibold">{format(day, 'd')}</span>
                        {done ? <Check size={11} /> : <span className="h-[11px]" />}
                      </button>
                    )
                  })}
                </div>
              </article>
            )
          })}
        </div>
      )}

      <HabitEditor
        open={editorOpen}
        habit={editing}
        onClose={() => {
          setEditorOpen(false)
          setEditing(null)
        }}
      />
    </div>
  )
}

function HabitEditor({
  open,
  habit,
  onClose,
}: {
  open: boolean
  habit: Habit | null
  onClose: () => void
}) {
  const { t, locale } = useI18n()
  const [name, setName] = useState('')
  const [emoji, setEmoji] = useState(EMOJI_OPTIONS[0]!)
  const [schedule, setSchedule] = useState<HabitSchedule>('daily')
  const [weekdays, setWeekdays] = useState<number[]>([1, 2, 3, 4, 5, 6, 0])
  const [targetPerWeek, setTargetPerWeek] = useState(7)
  const [archived, setArchived] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setError('')
    if (habit) {
      setName(habit.name)
      setEmoji(habit.emoji)
      setSchedule(habit.schedule)
      setWeekdays(habit.weekdays)
      setTargetPerWeek(habit.targetPerWeek)
      setArchived(habit.archived)
    } else {
      setName('')
      setEmoji(EMOJI_OPTIONS[0]!)
      setSchedule('daily')
      setWeekdays([1, 2, 3, 4, 5, 6, 0])
      setTargetPerWeek(7)
      setArchived(false)
    }
  }, [open, habit])

  const toggleWeekday = (day: number) => {
    setWeekdays((current) =>
      current.includes(day) ? current.filter((value) => value !== day) : [...current, day],
    )
  }

  const save = () => {
    if (!name.trim()) {
      setError(t('habits.nameRequired'))
      return
    }
    const payload = {
      name: name.trim(),
      emoji,
      schedule,
      weekdays,
      targetPerWeek,
      archived,
    }
    if (habit) {
      void updateHabit(habit.id, payload).then(() => {
        toast.success(t('habits.updated'))
        onClose()
      })
    } else {
      void createHabit(payload).then(() => {
        toast.success(t('habits.created'))
        onClose()
      })
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={habit ? t('habits.editTitle') : t('habits.newTitle')}
      footer={
        <>
          {habit ? (
            <Button
              variant="ghost"
              className="mr-auto text-danger"
              onClick={() => {
                void deleteHabit(habit.id).then(() => {
                  toast(t('habits.deleted'), {
                    action: { label: t('common.undo'), onClick: () => void restoreHabit(habit.id) },
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
          <Button onClick={save}>{habit ? t('common.save') : t('common.create')}</Button>
        </>
      }
    >
      <div className="space-y-4 pb-1">
        <Field label={t('habits.name')} htmlFor="habit-name">
          <Input
            id="habit-name"
            value={name}
            onChange={(event) => {
              setName(event.target.value)
              setError('')
            }}
            placeholder={t('habits.namePlaceholder')}
            autoFocus
          />
          {error ? <p className="mt-1.5 text-xs text-danger">{error}</p> : null}
        </Field>

        <Field label={t('habits.emoji')}>
          <div className="flex flex-wrap gap-1.5">
            {EMOJI_OPTIONS.map((code) => {
              const url = openMoji(code)
              if (!url) return null
              return (
                <button
                  key={code}
                  type="button"
                  onClick={() => setEmoji(code)}
                  aria-label={code}
                  aria-pressed={emoji === code}
                  className={cn(
                    'flex h-10 w-10 items-center justify-center rounded-xl border transition-colors',
                    emoji === code ? 'border-accent bg-accent-soft' : 'border-line hover:border-accent/40',
                  )}
                >
                  <img src={url} alt="" aria-hidden className="h-6 w-6" />
                </button>
              )
            })}
          </div>
        </Field>

        <Field label={t('habits.schedule')}>
          <SegmentedControl
            value={schedule}
            onChange={setSchedule}
            options={[
              { value: 'daily', label: t('habits.daily') },
              { value: 'weekdays', label: t('habits.weekdays') },
            ]}
          />
        </Field>

        {schedule === 'weekdays' ? (
          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">{t('habits.weekday')}</p>
            <div className="flex gap-1.5">
              {WEEKDAY_ORDER.map((day) => (
                <button
                  key={day}
                  type="button"
                  onClick={() => toggleWeekday(day)}
                  aria-pressed={weekdays.includes(day)}
                  className={cn(
                    'flex h-9 flex-1 items-center justify-center rounded-lg border text-xs font-medium uppercase transition-colors',
                    weekdays.includes(day)
                      ? 'border-accent bg-accent-soft text-accent'
                      : 'border-line text-muted',
                  )}
                >
                  {format(new Date(2024, 0, 1 + WEEKDAY_ORDER.indexOf(day)), 'EEEEE', { locale })}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <Field label={t('habits.target')} hint={t('habits.targetHint')} htmlFor="habit-target">
          <Input
            id="habit-target"
            type="number"
            min={1}
            max={7}
            value={targetPerWeek}
            onChange={(event) => setTargetPerWeek(Math.min(7, Math.max(1, Number(event.target.value) || 1)))}
          />
        </Field>

        {habit ? (
          <label className="flex items-center gap-2.5 rounded-xl border border-line bg-canvas/50 px-3 py-2.5">
            <input
              type="checkbox"
              checked={archived}
              onChange={(event) => setArchived(event.target.checked)}
              className="h-4 w-4 accent-[var(--accent)]"
            />
            <span className="text-sm font-medium">{t('habits.archived')}</span>
          </label>
        ) : null}
      </div>
    </Modal>
  )
}
