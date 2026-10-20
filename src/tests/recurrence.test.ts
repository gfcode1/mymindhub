import { describe, expect, it } from 'vitest'
import { eventOccursOn, nextOccurrence, normalizeRecurrence, upcomingBirthdays } from '@/lib/recurrence'
import type { CalendarEvent, RecurrenceRule } from '@/types/models'

function makeEvent(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: 'event-1',
    title: 'Test',
    description: '',
    start: '2026-01-01T09:00',
    end: '2026-01-01T10:00',
    allDay: false,
    location: '',
    color: '#0d9488',
    linkedNoteId: null,
    recurrence: { frequency: 'none', interval: 1, until: null },
    kind: 'event',
    birthYear: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    deletedAt: null,
    ...overrides,
  }
}

function occurs(event: CalendarEvent, date: string): boolean {
  return eventOccursOn(event, new Date(`${date}T12:00:00`)) !== null
}

function repeat(frequency: RecurrenceRule['frequency'], interval = 1, until: string | null = null): RecurrenceRule {
  return { frequency, interval, until }
}

describe('recurrence', () => {
  it('normalizes invalid rules', () => {
    expect(normalizeRecurrence({ frequency: 'daily', interval: 0, until: '2026-02-01' })).toEqual({
      frequency: 'daily',
      interval: 1,
      until: '2026-02-01',
    })
    expect(normalizeRecurrence({ frequency: 'none', interval: 3, until: '2026-02-01' })).toEqual({
      frequency: 'none',
      interval: 3,
      until: null,
    })
  })

  it('handles non-recurring and multi-day events', () => {
    const single = makeEvent()
    expect(occurs(single, '2026-01-01')).toBe(true)
    expect(occurs(single, '2026-01-02')).toBe(false)

    const multi = makeEvent({ start: '2026-01-01T22:00', end: '2026-01-02T02:00' })
    expect(occurs(multi, '2026-01-01')).toBe(true)
    expect(occurs(multi, '2026-01-02')).toBe(true)
    expect(occurs(multi, '2026-01-03')).toBe(false)
  })

  it('repeats daily with an interval', () => {
    const event = makeEvent({ recurrence: repeat('daily', 2) })
    expect(occurs(event, '2026-01-01')).toBe(true)
    expect(occurs(event, '2026-01-02')).toBe(false)
    expect(occurs(event, '2026-01-03')).toBe(true)
    expect(occurs(event, '2026-01-05')).toBe(true)
  })

  it('repeats weekly on the same weekday', () => {
    const event = makeEvent({ start: '2026-01-05T09:00', end: '2026-01-05T10:00', recurrence: repeat('weekly') })
    expect(occurs(event, '2026-01-05')).toBe(true)
    expect(occurs(event, '2026-01-12')).toBe(true)
    expect(occurs(event, '2026-01-13')).toBe(false)
  })

  it('repeats monthly and skips the 31st when missing', () => {
    const fifteenth = makeEvent({
      start: '2026-01-15T09:00',
      end: '2026-01-15T10:00',
      recurrence: repeat('monthly'),
    })
    expect(occurs(fifteenth, '2026-02-15')).toBe(true)
    expect(occurs(fifteenth, '2026-03-16')).toBe(false)

    const thirtyFirst = makeEvent({
      start: '2026-01-31T09:00',
      end: '2026-01-31T10:00',
      recurrence: repeat('monthly'),
    })
    expect(occurs(thirtyFirst, '2026-01-31')).toBe(true)
    expect(occurs(thirtyFirst, '2026-02-28')).toBe(false)
    expect(occurs(thirtyFirst, '2026-03-31')).toBe(true)
  })

  it('repeats yearly and skips February 29 in non-leap years', () => {
    const leap = makeEvent({
      start: '2024-02-29T09:00',
      end: '2024-02-29T10:00',
      recurrence: repeat('yearly'),
    })
    expect(occurs(leap, '2024-02-29')).toBe(true)
    expect(occurs(leap, '2025-02-28')).toBe(false)
    expect(occurs(leap, '2028-02-29')).toBe(true)
  })

  it('respects an inclusive end date', () => {
    const event = makeEvent({ recurrence: repeat('daily', 1, '2026-01-03') })
    expect(occurs(event, '2026-01-03')).toBe(true)
    expect(occurs(event, '2026-01-04')).toBe(false)
  })

  it('keeps the duration across occurrences', () => {
    const event = makeEvent({
      start: '2026-01-01T22:00',
      end: '2026-01-02T02:00',
      recurrence: repeat('daily'),
    })
    expect(occurs(event, '2026-01-02')).toBe(true)
    expect(occurs(event, '2026-01-03')).toBe(true)
    expect(occurs(event, '2026-01-04')).toBe(true)
  })

  it('computes birthday age', () => {
    const birthday = makeEvent({
      kind: 'birthday',
      birthYear: 1990,
      allDay: true,
      start: '2020-05-10T00:00',
      end: '2020-05-10T23:59',
      recurrence: repeat('yearly'),
    })
    const occurrence = eventOccursOn(birthday, new Date('2026-05-10T12:00:00'))
    expect(occurrence?.age).toBe(36)
    expect(eventOccursOn(birthday, new Date('2026-05-11T12:00:00'))).toBeNull()
  })

  it('finds the next occurrence and upcoming birthdays', () => {
    const daily = makeEvent({ recurrence: repeat('daily') })
    expect(nextOccurrence(daily, new Date('2026-01-04T12:00:00'))?.start.getDate()).toBe(4)

    const birthday = makeEvent({
      id: 'birthday-1',
      title: 'Ada',
      kind: 'birthday',
      birthYear: 1990,
      allDay: true,
      start: '1990-01-08T00:00',
      end: '1990-01-08T23:59',
      recurrence: repeat('yearly'),
    })
    const upcoming = upcomingBirthdays([birthday], new Date('2026-01-01T12:00:00'), 30)
    expect(upcoming).toHaveLength(1)
    expect(upcoming[0]?.age).toBe(36)
    expect(upcoming[0]?.start.getDate()).toBe(8)
  })
})
