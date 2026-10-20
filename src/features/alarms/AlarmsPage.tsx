import { useMemo, useState } from 'react'
import { format } from 'date-fns'
import { AlarmClock, Bell, BellRing, Pencil, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader, EmptyState } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { useAlarms } from '@/hooks/useData'
import { useI18n } from '@/hooks/useI18n'
import { useNow } from '@/hooks/useNow'
import { createAlarm, deleteAlarm, restoreAlarm, updateAlarm } from '@/db/seed'
import { formatDate } from '@/lib/dates'
import { formatAlarmDays, nextAlarmOccurrence } from '@/lib/alarms'
import type { Alarm } from '@/types/models'

const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0]
const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6]
const WORKDAYS = [1, 2, 3, 4, 5]
const WEEKEND = [0, 6]

type PermissionState = NotificationPermission | 'unsupported'

export function AlarmsPage() {
  const alarms = useAlarms()
  const { t, locale } = useI18n()
  const [editing, setEditing] = useState<Alarm | null>(null)
  const [editorOpen, setEditorOpen] = useState(false)
  const [permission, setPermission] = useState<PermissionState>(() =>
    typeof Notification === 'undefined' ? 'unsupported' : Notification.permission,
  )
  const now = useNow(60_000)

  const dayLabels = useMemo(
    () =>
      Array.from({ length: 7 }, (_, index) =>
        format(new Date(2024, 0, 1 + index), 'EEEEE', { locale }),
      ),
    [locale],
  )

  const requestPermission = async () => {
    try {
      const result = await Notification.requestPermission()
      setPermission(result)
    } catch {
      setPermission('denied')
    }
  }

  const openNew = () => {
    setEditing(null)
    setEditorOpen(true)
  }

  const remove = (alarm: Alarm) => {
    void deleteAlarm(alarm.id).then(() => {
      toast(t('alarms.deleted'), {
        action: { label: t('common.undo'), onClick: () => void restoreAlarm(alarm.id) },
      })
    })
  }

  return (
    <div className="animate-fade-in">
      <PageHeader
        title={t('alarms.title')}
        subtitle={t('alarms.subtitle')}
        action={
          <Button size="sm" onClick={openNew}>
            <Plus size={16} /> {t('alarms.new')}
          </Button>
        }
      />

      <div className="mb-4 rounded-2xl border border-line bg-surface p-3.5">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-raised text-accent">
            {permission === 'granted' ? <BellRing size={17} /> : <Bell size={17} />}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">{t('alarms.notifications')}</p>
            <p className="mt-0.5 text-xs leading-relaxed text-muted">
              {permission === 'granted'
                ? t('alarms.notificationsGranted')
                : permission === 'denied'
                  ? t('alarms.notificationsDenied')
                  : permission === 'unsupported'
                    ? t('alarms.notificationsUnsupported')
                    : t('alarms.notificationsDesc')}
            </p>
          </div>
          {permission === 'default' ? (
            <Button variant="secondary" size="sm" onClick={() => void requestPermission()}>
              {t('alarms.enableNotifications')}
            </Button>
          ) : null}
        </div>
        <p className="mt-2 border-t border-line/70 pt-2 text-[10px] leading-relaxed text-faint">
          {t('alarms.backgroundHint')}
        </p>
      </div>

      {alarms.length === 0 ? (
        <EmptyState
          icon={<AlarmClock size={20} />}
          title={t('alarms.empty')}
          description={t('alarms.emptyDesc')}
          action={
            <Button variant="soft" size="sm" onClick={openNew}>
              <Plus size={15} /> {t('alarms.new')}
            </Button>
          }
        />
      ) : (
        <div className="space-y-2">
          {alarms.map((alarm) => {
            const next = alarm.enabled ? nextAlarmOccurrence(alarm, new Date(now)) : null
            return (
              <article
                key={alarm.id}
                className="flex items-start gap-3 rounded-2xl border border-line bg-surface p-3.5"
              >
                <p className="w-16 shrink-0 text-xl font-semibold tabular-nums tracking-tight">
                  {alarm.time}
                </p>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">
                    {alarm.label || t('alarms.labelFallback')}
                  </p>
                  <p className="text-[11px] text-muted">
                    {formatAlarmDays(alarm.days, dayLabels, t('alarms.everyDay'))}
                  </p>
                  <p className="mt-0.5 text-[10px] text-faint">
                    {alarm.enabled && next
                      ? t('alarms.next', {
                          date: `${formatDate(next, 'EEE d MMM', locale)} · ${format(next, 'HH:mm')}`,
                        })
                      : t('alarms.off')}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => void updateAlarm(alarm.id, { enabled: !alarm.enabled })}
                  aria-label={t('alarms.toggle')}
                  aria-pressed={alarm.enabled}
                  className={`mt-1 flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors ${
                    alarm.enabled ? 'bg-accent' : 'bg-line'
                  }`}
                >
                  <span
                    className={`h-4 w-4 rounded-full bg-white shadow transition-transform ${
                      alarm.enabled ? 'translate-x-4' : ''
                    }`}
                  />
                </button>

                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={t('common.edit')}
                  onClick={() => {
                    setEditing(alarm)
                    setEditorOpen(true)
                  }}
                >
                  <Pencil size={15} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-danger"
                  aria-label={t('alarms.delete')}
                  onClick={() => remove(alarm)}
                >
                  <Trash2 size={15} />
                </Button>
              </article>
            )
          })}
        </div>
      )}

      {editorOpen ? (
        <AlarmEditor
          key={editing?.id ?? 'new'}
          alarm={editing}
          dayLabels={dayLabels}
          onClose={() => {
            setEditorOpen(false)
            setEditing(null)
          }}
        />
      ) : null}
    </div>
  )
}

function AlarmEditor({
  alarm,
  dayLabels,
  onClose,
}: {
  alarm: Alarm | null
  dayLabels: string[]
  onClose: () => void
}) {
  const { t } = useI18n()
  const [time, setTime] = useState(alarm?.time ?? '08:00')
  const [label, setLabel] = useState(alarm?.label ?? '')
  const [days, setDays] = useState<number[]>(alarm?.days ?? ALL_DAYS)
  const [enabled, setEnabled] = useState(alarm?.enabled ?? true)
  const [error, setError] = useState('')

  const toggleDay = (day: number) => {
    setDays((current) =>
      current.includes(day) ? current.filter((value) => value !== day) : [...current, day],
    )
    setError('')
  }

  const setPreset = (values: number[]) => {
    setDays(values)
    setError('')
  }

  const save = () => {
    if (!time) {
      setError(t('alarms.timeRequired'))
      return
    }
    if (days.length === 0) {
      setError(t('alarms.daysRequired'))
      return
    }
    if (alarm) {
      void updateAlarm(alarm.id, { time, label, days, enabled }).then(() => {
        toast.success(t('alarms.updated'))
        onClose()
      })
    } else {
      void createAlarm({ time, label, days, enabled }).then(() => {
        toast.success(t('alarms.created'))
        onClose()
      })
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={alarm ? t('alarms.editTitle') : t('alarms.newTitle')}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button onClick={save}>{alarm ? t('common.save') : t('common.create')}</Button>
        </>
      }
    >
      <div className="space-y-4 pb-1">
        <div className="grid grid-cols-[9rem_1fr] gap-3">
          <Field label={t('alarms.time')} htmlFor="alarm-time">
            <Input
              id="alarm-time"
              type="time"
              value={time}
              onChange={(event) => {
                setTime(event.target.value)
                setError('')
              }}
            />
          </Field>
          <Field label={t('alarms.label')} htmlFor="alarm-label">
            <Input
              id="alarm-label"
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              placeholder={t('alarms.labelPlaceholder')}
            />
          </Field>
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted">
              {t('alarms.days')}
            </span>
            <div className="flex flex-wrap justify-end gap-1">
              <Button variant="ghost" size="sm" onClick={() => setPreset(ALL_DAYS)}>
                {t('alarms.everyDay')}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setPreset(WORKDAYS)}>
                {t('alarms.workdays')}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setPreset(WEEKEND)}>
                {t('alarms.weekend')}
              </Button>
            </div>
          </div>
          <div className="flex gap-1.5">
            {DAY_ORDER.map((day, index) => (
              <button
                key={day}
                type="button"
                onClick={() => toggleDay(day)}
                aria-pressed={days.includes(day)}
                className={`flex h-9 flex-1 items-center justify-center rounded-lg border text-xs font-medium uppercase transition-colors ${
                  days.includes(day)
                    ? 'border-accent bg-accent-soft text-accent'
                    : 'border-line text-muted'
                }`}
              >
                {dayLabels[index]}
              </button>
            ))}
          </div>
          {error ? <p className="mt-1.5 text-xs text-danger">{error}</p> : null}
        </div>

        <label className="flex items-center gap-2.5 rounded-xl border border-line bg-canvas/50 px-3 py-2.5">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(event) => setEnabled(event.target.checked)}
            className="h-4 w-4 accent-[var(--accent)]"
          />
          <span className="text-sm font-medium">{t('alarms.enabled')}</span>
        </label>
      </div>
    </Modal>
  )
}
