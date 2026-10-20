import { addDays, format, startOfDay } from 'date-fns'
import { parseDateSafe } from '@/lib/dates'
import type { Alarm } from '@/types/models'

export function alarmMinuteKey(date: Date): string {
  return format(date, 'yyyy-MM-dd HH:mm')
}

export function alarmTimeParts(time: string): { hours: number; minutes: number } | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(time.trim())
  if (!match) return null
  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null
  return { hours, minutes }
}

export function isAlarmDue(alarm: Alarm, now: Date): boolean {
  if (!alarm.enabled || alarm.deletedAt) return false
  if (!alarm.days.includes(now.getDay())) return false
  const parts = alarmTimeParts(alarm.time)
  if (!parts) return false
  if (now.getHours() !== parts.hours || now.getMinutes() !== parts.minutes) return false
  if (alarm.lastTriggeredAt) {
    const last = parseDateSafe(alarm.lastTriggeredAt)
    if (last && alarmMinuteKey(last) === alarmMinuteKey(now)) return false
  }
  return true
}

export function nextAlarmOccurrence(alarm: Alarm, from: Date): Date | null {
  if (!alarm.enabled) return null
  const parts = alarmTimeParts(alarm.time)
  if (!parts) return null
  const start = startOfDay(from)
  for (let offset = 0; offset <= 8; offset += 1) {
    const day = addDays(start, offset)
    if (!alarm.days.includes(day.getDay())) continue
    const candidate = new Date(
      day.getFullYear(),
      day.getMonth(),
      day.getDate(),
      parts.hours,
      parts.minutes,
      0,
      0,
    )
    if (candidate.getTime() > from.getTime()) return candidate
  }
  return null
}

export function nextAlarm(
  alarms: Alarm[],
  from: Date,
): { alarm: Alarm; date: Date } | null {
  let best: { alarm: Alarm; date: Date } | null = null
  for (const alarm of alarms) {
    const date = nextAlarmOccurrence(alarm, from)
    if (!date) continue
    if (!best || date.getTime() < best.date.getTime()) best = { alarm, date }
  }
  return best
}

export function formatAlarmDays(days: number[], labels: string[], allLabel: string): string {
  const order = [1, 2, 3, 4, 5, 6, 0]
  const selected = order.filter((day) => days.includes(day))
  if (selected.length === 7) return allLabel
  return selected.map((day) => labels[order.indexOf(day)] ?? '').join(' ')
}
