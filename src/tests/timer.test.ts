import { describe, expect, it } from 'vitest'
import { filterEntriesInRange, formatClock, summarizeByCategory, totalSeconds } from '@/lib/timer'
import type { TimeEntry } from '@/types/models'

function entry(overrides: Partial<TimeEntry> = {}): TimeEntry {
  return {
    id: 'entry-1',
    label: 'Focus',
    category: 'Lavoro',
    startedAt: '2026-10-20T09:00:00.000Z',
    endedAt: '2026-10-20T09:25:00.000Z',
    durationSec: 1500,
    mode: 'pomodoro',
    todoId: null,
    noteId: null,
    createdAt: '2026-10-20T09:25:00.000Z',
    updatedAt: '2026-10-20T09:25:00.000Z',
    deletedAt: null,
    ...overrides,
  }
}

describe('timer helpers', () => {
  it('formats a clock', () => {
    expect(formatClock(0)).toBe('00:00')
    expect(formatClock(65)).toBe('01:05')
    expect(formatClock(3661)).toBe('1:01:01')
  })

  it('sums and groups time by category', () => {
    const entries = [
      entry({ id: 'a', category: 'Lavoro', durationSec: 600 }),
      entry({ id: 'b', category: 'Studio', durationSec: 1200 }),
      entry({ id: 'c', category: 'Lavoro', durationSec: 300 }),
    ]
    expect(totalSeconds(entries)).toBe(2100)
    expect(summarizeByCategory(entries)).toEqual([
      { category: 'Studio', seconds: 1200, count: 1 },
      { category: 'Lavoro', seconds: 900, count: 2 },
    ])
  })

  it('filters entries by start date', () => {
    const entries = [
      entry({ id: 'in', startedAt: '2026-10-20T09:00:00.000Z' }),
      entry({ id: 'out', startedAt: '2026-09-01T09:00:00.000Z' }),
    ]
    const filtered = filterEntriesInRange(
      entries,
      new Date('2026-10-19T00:00:00.000Z'),
      new Date('2026-10-26T00:00:00.000Z'),
    )
    expect(filtered.map((item) => item.id)).toEqual(['in'])
  })
})
