import {
  addDays,
  addMonths,
  addWeeks,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subMonths,
  subWeeks,
} from 'date-fns'
import { it } from 'date-fns/locale'

export const WEEK_OPTS = { weekStartsOn: 1 as const, locale: it }

export function todayKey(): string {
  return format(new Date(), 'yyyy-MM-dd')
}

export function dateKey(date: Date): string {
  return format(date, 'yyyy-MM-dd')
}

export function parseDate(value: string | Date): Date {
  return value instanceof Date ? value : parseISO(value)
}

export function parseDateSafe(value: string | Date | null | undefined): Date | null {
  if (!value) return null
  const date = parseDate(value)
  return Number.isNaN(date.getTime()) ? null : date
}

export function formatDate(value: string | Date, pattern = 'd MMM yyyy'): string {
  const date = parseDateSafe(value)
  if (!date) return ''
  return format(date, pattern, { locale: it })
}

export function formatTime(value: string | Date): string {
  const date = parseDateSafe(value)
  if (!date) return ''
  return format(date, 'HH:mm')
}

export function formatDateTime(value: string | Date): string {
  const date = parseDateSafe(value)
  if (!date) return ''
  return format(date, "d MMM yyyy '·' HH:mm", { locale: it })
}

export function relativeDate(value: string | Date): string {
  const date = parseDateSafe(value)
  if (!date) return ''
  const today = startOfDay(new Date())
  const target = startOfDay(date)
  const diff = Math.round((target.getTime() - today.getTime()) / 86_400_000)
  if (diff === 0) return 'Oggi'
  if (diff === 1) return 'Domani'
  if (diff === -1) return 'Ieri'
  if (diff > 1 && diff < 7) return format(date, 'EEEE', { locale: it })
  return format(date, 'd MMM', { locale: it })
}

export function isOverdue(dateValue: string | null): boolean {
  const date = parseDateSafe(dateValue)
  if (!date) return false
  return startOfDay(date).getTime() < startOfDay(new Date()).getTime()
}

export function toDateTimeInput(value: string | Date): string {
  const date = parseDateSafe(value)
  if (!date) return ''
  return format(date, "yyyy-MM-dd'T'HH:mm")
}

export function toDateInput(value: string | Date | null | undefined): string {
  const date = parseDateSafe(value)
  if (!date) return ''
  return format(date, 'yyyy-MM-dd')
}

export function combineDateAndTime(dateKeyValue: string, time: string): string {
  if (!time) return `${dateKeyValue}T00:00`
  return `${dateKeyValue}T${time}`
}

export function eventCoversDay(start: string, end: string, day: Date): boolean {
  const startDate = parseDateSafe(start)
  const endDate = parseDateSafe(end)
  if (!startDate) return false
  const dayStart = startOfDay(day)
  const dayEnd = addDays(dayStart, 1)
  if (!endDate) return isSameDay(startDate, day)
  return startDate < dayEnd && endDate >= dayStart
}

export interface MonthCell {
  key: string
  date: Date
  inMonth: boolean
  isToday: boolean
  isSelected: boolean
}

export function monthMatrix(viewDate: Date, selected: Date): MonthCell[] {
  const start = startOfWeek(startOfMonth(viewDate), WEEK_OPTS)
  const end = endOfWeek(endOfMonth(viewDate), WEEK_OPTS)
  return eachDayOfInterval({ start, end }).map((date) => ({
    key: dateKey(date),
    date,
    inMonth: isSameMonth(date, viewDate),
    isToday: isToday(date),
    isSelected: isSameDay(date, selected),
  }))
}

export function weekDays(viewDate: Date): Date[] {
  const start = startOfWeek(viewDate, WEEK_OPTS)
  return eachDayOfInterval({ start, end: endOfWeek(viewDate, WEEK_OPTS) })
}

export function shiftView(date: Date, view: 'month' | 'week' | 'day', direction: 1 | -1): Date {
  if (view === 'month') return direction === 1 ? addMonths(date, 1) : subMonths(date, 1)
  if (view === 'week') return direction === 1 ? addWeeks(date, 1) : subWeeks(date, 1)
  return addDays(date, direction)
}

export function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.round(seconds))
  const mins = Math.floor(total / 60)
  const secs = total % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

export function formatHumanDuration(seconds: number): string {
  const totalMinutes = Math.max(1, Math.round(seconds / 60))
  if (totalMinutes < 60) return `${totalMinutes} min`
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return minutes > 0 ? `${hours} h ${minutes} min` : `${hours} h`
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const value = bytes / 1024 ** index
  return `${value.toFixed(value >= 10 || index === 0 ? 0 : 1)} ${units[index]}`
}

export function daysSince(value: string | null): number | null {
  const date = parseDateSafe(value)
  if (!date) return null
  return Math.floor((Date.now() - date.getTime()) / 86_400_000)
}
