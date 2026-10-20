import {
  addDays,
  differenceInCalendarDays,
  differenceInCalendarMonths,
  differenceInCalendarYears,
  endOfDay,
  startOfDay,
  subDays,
} from 'date-fns'
import { eventCoversDay, parseDateSafe } from '@/lib/dates'
import { DEFAULT_RECURRENCE, type CalendarEvent, type RecurrenceRule } from '@/types/models'

export interface EventOccurrence {
  event: CalendarEvent
  start: Date
  end: Date
  occurrenceDate: Date
  age: number | null
  recurring: boolean
}

export function normalizeRecurrence(rule: Partial<RecurrenceRule> | null | undefined): RecurrenceRule {
  const frequency = rule?.frequency ?? 'none'
  const interval = Math.max(1, Math.floor(rule?.interval ?? 1))
  return {
    frequency,
    interval,
    until: frequency === 'none' ? null : rule?.until ?? null,
  }
}

function matchesPattern(event: CalendarEvent, candidate: Date): boolean {
  const anchor = parseDateSafe(event.start)
  if (!anchor) return false
  const rule = normalizeRecurrence(event.recurrence ?? DEFAULT_RECURRENCE)
  const current = startOfDay(candidate)
  const first = startOfDay(anchor)
  if (current.getTime() < first.getTime()) return false

  if (rule.until) {
    const until = parseDateSafe(rule.until)
    if (until && current.getTime() > endOfDay(until).getTime()) return false
  }

  const interval = Math.max(1, rule.interval)
  switch (rule.frequency) {
    case 'none':
      return current.getTime() === first.getTime()
    case 'daily':
      return differenceInCalendarDays(current, first) % interval === 0
    case 'weekly':
      return differenceInCalendarDays(current, first) % (7 * interval) === 0
    case 'monthly':
      return (
        differenceInCalendarMonths(current, first) % interval === 0 &&
        current.getDate() === first.getDate()
      )
    case 'yearly':
      return (
        differenceInCalendarYears(current, first) % interval === 0 &&
        current.getMonth() === first.getMonth() &&
        current.getDate() === first.getDate()
      )
    default:
      return false
  }
}

function durationMs(event: CalendarEvent): number {
  const start = parseDateSafe(event.start)
  const end = parseDateSafe(event.end)
  if (!start || !end) return 0
  return Math.max(0, end.getTime() - start.getTime())
}

function ageFor(event: CalendarEvent, year: number): number | null {
  if (event.kind !== 'birthday' || event.birthYear === null || event.birthYear === undefined) return null
  const age = year - event.birthYear
  return age >= 0 ? age : null
}

function occurrenceFromDate(event: CalendarEvent, candidate: Date): EventOccurrence {
  const anchor = parseDateSafe(event.start) ?? candidate
  const start = new Date(
    candidate.getFullYear(),
    candidate.getMonth(),
    candidate.getDate(),
    anchor.getHours(),
    anchor.getMinutes(),
    anchor.getSeconds(),
    anchor.getMilliseconds(),
  )
  const end = new Date(start.getTime() + durationMs(event))
  return {
    event,
    start,
    end,
    occurrenceDate: startOfDay(candidate),
    age: ageFor(event, candidate.getFullYear()),
    recurring: normalizeRecurrence(event.recurrence).frequency !== 'none',
  }
}

export function eventOccursOn(event: CalendarEvent, day: Date): EventOccurrence | null {
  const anchor = parseDateSafe(event.start)
  if (!anchor) return null
  const rule = normalizeRecurrence(event.recurrence ?? DEFAULT_RECURRENCE)

  if (rule.frequency === 'none') {
    return eventCoversDay(event.start, event.end, day) ? occurrenceFromDate(event, anchor) : null
  }

  const dayStart = startOfDay(day)
  const dayEnd = addDays(dayStart, 1)
  const durationDays = Math.max(
    0,
    differenceInCalendarDays(startOfDay(parseDateSafe(event.end) ?? anchor), startOfDay(anchor)),
  )

  for (let offset = 0; offset <= durationDays; offset += 1) {
    const candidate = subDays(dayStart, offset)
    if (!matchesPattern(event, candidate)) continue
    const occurrence = occurrenceFromDate(event, candidate)
    if (occurrence.start.getTime() < dayEnd.getTime() && occurrence.end.getTime() >= dayStart.getTime()) {
      return occurrence
    }
  }
  return null
}

export function nextOccurrence(event: CalendarEvent, from: Date, limitDays = 366): EventOccurrence | null {
  const start = startOfDay(from)
  for (let offset = 0; offset <= limitDays; offset += 1) {
    const occurrence = eventOccursOn(event, addDays(start, offset))
    if (occurrence) return occurrence
  }
  return null
}

export function upcomingBirthdays(events: CalendarEvent[], from: Date, days = 30): EventOccurrence[] {
  const start = startOfDay(from)
  const results: EventOccurrence[] = []
  for (const event of events) {
    if (event.kind !== 'birthday' || event.deletedAt) continue
    for (let offset = 0; offset <= days; offset += 1) {
      const occurrence = eventOccursOn(event, addDays(start, offset))
      if (occurrence) {
        results.push(occurrence)
        break
      }
    }
  }
  return results.sort((a, b) => a.start.getTime() - b.start.getTime())
}
