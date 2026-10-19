import { describe, expect, it } from 'vitest'
import {
  combineDateAndTime,
  eventCoversDay,
  formatDuration,
  formatBytes,
  monthMatrix,
  relativeDate,
  shiftView,
  toDateInput,
  todayKey,
} from '@/lib/dates'

describe('dates', () => {
  it('formats today as yyyy-MM-dd', () => {
    expect(todayKey()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('combines date and time', () => {
    expect(combineDateAndTime('2026-10-19', '09:30')).toBe('2026-10-19T09:30')
  })

  it('converts to date input', () => {
    expect(toDateInput('2026-10-19T09:30')).toBe('2026-10-19')
  })

  it('detects an event covering a day', () => {
    const day = new Date('2026-10-19T12:00:00')
    expect(eventCoversDay('2026-10-19T09:00', '2026-10-19T10:00', day)).toBe(true)
    expect(eventCoversDay('2026-10-18T09:00', '2026-10-18T10:00', day)).toBe(false)
  })

  it('handles multi-day events', () => {
    const day = new Date('2026-10-20T12:00:00')
    expect(eventCoversDay('2026-10-18T09:00', '2026-10-22T10:00', day)).toBe(true)
  })

  it('builds a month matrix starting on Monday', () => {
    const cells = monthMatrix(new Date('2026-10-15T12:00:00'), new Date('2026-10-19T12:00:00'))
    expect(cells.length % 7).toBe(0)
    expect(cells[0]?.date.getDay()).toBe(1)
    expect(cells.some((cell) => cell.isSelected)).toBe(true)
  })

  it('shifts views', () => {
    const date = new Date('2026-10-19T12:00:00')
    expect(shiftView(date, 'day', 1).getDate()).toBe(20)
    expect(shiftView(date, 'week', 1).getDate()).toBe(26)
    expect(shiftView(date, 'month', 1).getMonth()).toBe(10)
  })

  it('labels relative dates', () => {
    expect(relativeDate(new Date())).toBe('Oggi')
  })

  it('formats durations and sizes', () => {
    expect(formatDuration(75)).toBe('1:15')
    expect(formatBytes(1024)).toBe('1.0 KB')
  })
})
