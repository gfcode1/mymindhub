import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Field, Input, Select, Textarea } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { EntityLinks } from '@/features/links/EntityLinks'
import { useI18n } from '@/hooks/useI18n'
import { createEvent, deleteEvent, restoreEvent, updateEvent } from '@/db/seed'
import { combineDateAndTime, formatTime, toDateInput } from '@/lib/dates'
import { normalizeRecurrence } from '@/lib/recurrence'
import {
  DEFAULT_RECURRENCE,
  type CalendarEvent,
  type EventKind,
  type RecurrenceFrequency,
  type RecurrenceRule,
} from '@/types/models'

const COLORS = ['#0d9488', '#4f46e5', '#7c3aed', '#b45309', '#be123c', '#4d7c0f', '#0891b2', '#c2410c']

const FREQUENCIES: RecurrenceFrequency[] = ['none', 'daily', 'weekly', 'monthly', 'yearly']

interface EventEditorProps {
  open: boolean
  event: CalendarEvent | null
  defaultDate: string
  onClose: () => void
}

export function EventEditorModal({ open, event, defaultDate, onClose }: EventEditorProps) {
  const { t } = useI18n()
  const [title, setTitle] = useState('')
  const [date, setDate] = useState(defaultDate)
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('10:00')
  const [allDay, setAllDay] = useState(false)
  const [description, setDescription] = useState('')
  const [location, setLocation] = useState('')
  const [color, setColor] = useState(COLORS[0]!)
  const [kind, setKind] = useState<EventKind>('event')
  const [frequency, setFrequency] = useState<RecurrenceFrequency>('none')
  const [repeatInterval, setRepeatInterval] = useState(1)
  const [until, setUntil] = useState('')
  const [birthYear, setBirthYear] = useState('')
  const [error, setError] = useState('')
  const [currentYear] = useState(() => new Date().getFullYear())

  useEffect(() => {
    if (!open) return
    setError('')
    if (event) {
      setTitle(event.title)
      setDate(toDateInput(event.start) || defaultDate)
      setStartTime(formatTime(event.start) || '09:00')
      setEndTime(formatTime(event.end) || '10:00')
      setAllDay(event.allDay)
      setDescription(event.description)
      setLocation(event.location)
      setColor(event.color || COLORS[0]!)
      setKind(event.kind)
      const recurrence = event.recurrence ?? DEFAULT_RECURRENCE
      setFrequency(recurrence.frequency)
      setRepeatInterval(recurrence.interval)
      setUntil(recurrence.until ? toDateInput(recurrence.until) : '')
      setBirthYear(event.birthYear !== null ? String(event.birthYear) : '')
    } else {
      setTitle('')
      setDate(defaultDate)
      setStartTime('09:00')
      setEndTime('10:00')
      setAllDay(false)
      setDescription('')
      setLocation('')
      setColor(COLORS[0]!)
      setKind('event')
      setFrequency('none')
      setRepeatInterval(1)
      setUntil('')
      setBirthYear('')
    }
  }, [open, event, defaultDate])

  const isBirthday = kind === 'birthday'
  const repeats = !isBirthday && frequency !== 'none'

  const unitLabel = t(
    frequency === 'daily'
      ? 'event.unitDay'
      : frequency === 'weekly'
        ? 'event.unitWeek'
        : frequency === 'monthly'
          ? 'event.unitMonth'
          : 'event.unitYear',
  )

  const frequencyLabel = (value: RecurrenceFrequency): string =>
    t(
      value === 'none'
        ? 'event.repeatNone'
        : value === 'daily'
          ? 'event.repeatDaily'
          : value === 'weekly'
            ? 'event.repeatWeekly'
            : value === 'monthly'
              ? 'event.repeatMonthly'
              : 'event.repeatYearly',
    )

  const toggleBirthday = (checked: boolean) => {
    setKind(checked ? 'birthday' : 'event')
    setError('')
    if (checked) {
      setAllDay(true)
      setFrequency('yearly')
      setRepeatInterval(1)
      setUntil('')
    } else {
      setAllDay(false)
      setFrequency('none')
      setBirthYear('')
    }
  }

  const save = () => {
    if (!title.trim()) {
      setError(t('event.titleRequired'))
      return
    }
    if (!date) {
      setError(t('event.dateRequired'))
      return
    }
    if (isBirthday && birthYear.trim()) {
      const value = Number(birthYear)
      if (!Number.isInteger(value) || value < 1900 || value > currentYear) {
        setError(t('event.invalidBirthYear'))
        return
      }
    }
    if (repeats && until && until < date) {
      setError(t('event.invalidUntil'))
      return
    }

    const finalAllDay = isBirthday ? true : allDay
    const start = finalAllDay ? `${date}T00:00` : combineDateAndTime(date, startTime || '00:00')
    const end = finalAllDay ? `${date}T23:59` : combineDateAndTime(date, endTime || startTime || '00:00')
    if (!finalAllDay && Date.parse(end) <= Date.parse(start)) {
      setError(t('event.endAfterStart'))
      return
    }

    const recurrence: RecurrenceRule = isBirthday
      ? { frequency: 'yearly', interval: 1, until: null }
      : normalizeRecurrence({
          frequency,
          interval: repeatInterval,
          until: until || null,
        })

    const payload = {
      title: title.trim(),
      description,
      start,
      end,
      allDay: finalAllDay,
      location,
      color,
      linkedNoteId: event?.linkedNoteId ?? null,
      recurrence,
      kind,
      birthYear: isBirthday && birthYear.trim() ? Number(birthYear) : null,
    }

    if (event) {
      void updateEvent(event.id, payload).then(() => {
        toast.success(t('event.updated'))
        onClose()
      })
    } else {
      void createEvent(payload).then(() => {
        toast.success(t('event.created'))
        onClose()
      })
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={event ? t('event.edit') : t('event.new')}
      description={event ? undefined : t('event.newDesc')}
      footer={
        <>
          {event ? (
            <Button
              variant="ghost"
              className="mr-auto text-danger"
              onClick={() => {
                void deleteEvent(event.id).then(() => {
                  toast(t('event.deleted'), {
                    action: { label: t('common.undo'), onClick: () => void restoreEvent(event.id) },
                  })
                  onClose()
                })
              }}
            >
              {t('common.delete')}
            </Button>
          ) : null}
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button onClick={save}>{event ? t('common.save') : t('common.create')}</Button>
        </>
      }
    >
      <div className="space-y-4 pb-1">
        <Field label={t('event.title')} htmlFor="event-title">
          <Input
            id="event-title"
            value={title}
            onChange={(event) => {
              setTitle(event.target.value)
              setError('')
            }}
            placeholder={isBirthday ? t('event.birthdayTitlePlaceholder') : t('event.titlePlaceholder')}
            autoFocus
          />
          {error ? <p className="mt-1.5 text-xs text-danger">{error}</p> : null}
        </Field>

        <label className="flex items-center gap-2.5 rounded-xl border border-line bg-canvas/50 px-3 py-2.5">
          <input
            type="checkbox"
            checked={isBirthday}
            onChange={(event) => toggleBirthday(event.target.checked)}
            className="h-4 w-4 accent-[var(--accent)]"
          />
          <span className="text-sm font-medium">{t('event.birthday')}</span>
        </label>

        <div className="grid grid-cols-2 gap-3">
          <Field label={t('event.date')} htmlFor="event-date">
            <Input
              id="event-date"
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />
          </Field>
          <Field label={t('event.color')}>
            <div className="flex h-11 items-center gap-1.5">
              {COLORS.map((swatch) => (
                <button
                  key={swatch}
                  type="button"
                  onClick={() => setColor(swatch)}
                  aria-label={swatch}
                  className={`h-6 w-6 rounded-full transition-transform ${
                    color === swatch ? 'scale-110 ring-2 ring-ink ring-offset-2 ring-offset-surface' : ''
                  }`}
                  style={{ background: swatch }}
                />
              ))}
            </div>
          </Field>
        </div>

        {isBirthday ? (
          <>
            <Field label={t('event.birthYear')} hint={t('event.birthYearHint')} htmlFor="event-birth-year">
              <Input
                id="event-birth-year"
                type="number"
                inputMode="numeric"
                min={1900}
                max={currentYear}
                value={birthYear}
                onChange={(event) => {
                  setBirthYear(event.target.value)
                  setError('')
                }}
                placeholder={t('event.birthYearPlaceholder')}
              />
            </Field>
            <p className="rounded-xl border border-line bg-canvas/40 px-3 py-2 text-[11px] leading-relaxed text-muted">
              {t('event.birthdayRecursYearly')}
            </p>
          </>
        ) : (
          <>
            <label className="flex items-center gap-2.5 rounded-xl border border-line bg-canvas/50 px-3 py-2.5">
              <input
                type="checkbox"
                checked={allDay}
                onChange={(event) => setAllDay(event.target.checked)}
                className="h-4 w-4 accent-[var(--accent)]"
              />
              <span className="text-sm font-medium">{t('event.allDay')}</span>
            </label>

            {!allDay ? (
              <div className="grid grid-cols-2 gap-3">
                <Field label={t('event.start')} htmlFor="event-start">
                  <Input
                    id="event-start"
                    type="time"
                    value={startTime}
                    onChange={(event) => setStartTime(event.target.value)}
                  />
                </Field>
                <Field label={t('event.end')} htmlFor="event-end">
                  <Input
                    id="event-end"
                    type="time"
                    value={endTime}
                    onChange={(event) => setEndTime(event.target.value)}
                  />
                </Field>
              </div>
            ) : null}

            <Field label={t('event.recurrence')} htmlFor="event-frequency">
              <Select
                id="event-frequency"
                value={frequency}
                onChange={(event) => setFrequency(event.target.value as RecurrenceFrequency)}
              >
                {FREQUENCIES.map((value) => (
                  <option key={value} value={value}>
                    {frequencyLabel(value)}
                  </option>
                ))}
              </Select>
            </Field>

            {repeats ? (
              <div className="grid grid-cols-2 gap-3">
                <Field label={t('event.every')} htmlFor="event-interval">
                  <div className="flex items-center gap-2">
                    <Input
                      id="event-interval"
                      type="number"
                      min={1}
                      max={99}
                      value={repeatInterval}
                      onChange={(event) =>
                        setRepeatInterval(Math.min(99, Math.max(1, Number(event.target.value) || 1)))
                      }
                      className="w-20"
                    />
                    <span className="text-sm text-muted">{unitLabel}</span>
                  </div>
                </Field>
                <Field label={t('event.until')} hint={t('event.untilHint')} htmlFor="event-until">
                  <Input
                    id="event-until"
                    type="date"
                    value={until}
                    min={date}
                    onChange={(event) => setUntil(event.target.value)}
                  />
                </Field>
              </div>
            ) : null}

            {repeats ? (
              <div className="space-y-1 text-[11px] leading-relaxed text-faint">
                <p>{t('event.recurrenceHint')}</p>
                <p>{t('event.seriesHint')}</p>
              </div>
            ) : null}
          </>
        )}

        <Field label={t('event.location')} htmlFor="event-location">
          <Input
            id="event-location"
            value={location}
            onChange={(event) => setLocation(event.target.value)}
            placeholder={t('event.locationPlaceholder')}
          />
        </Field>

        <Field label={t('event.description')} htmlFor="event-description">
          <Textarea
            id="event-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder={t('event.descriptionPlaceholder')}
            rows={3}
          />
        </Field>

        {event ? <EntityLinks type="event" id={event.id} /> : null}
      </div>
    </Modal>
  )
}
