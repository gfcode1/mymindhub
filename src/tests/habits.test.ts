import { describe, expect, it } from 'vitest'
import { habitStreak, habitWeekCount, isHabitDone, isHabitScheduled } from '@/lib/habits'
import type { Habit, HabitLog } from '@/types/models'

function makeHabit(overrides: Partial<Habit> = {}): Habit {
  return {
    id: 'h1',
    name: 'Test',
    emoji: '1F331',
    color: '#0d9488',
    schedule: 'daily',
    weekdays: [1, 2, 3, 4, 5, 6, 0],
    targetPerWeek: 7,
    archived: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    deletedAt: null,
    ...overrides,
  }
}

function log(habitId: string, date: string): HabitLog {
  return {
    id: `${habitId}-${date}`,
    habitId,
    date,
    value: 1,
    createdAt: `${date}T08:00:00.000Z`,
    updatedAt: `${date}T08:00:00.000Z`,
    deletedAt: null,
  }
}

describe('habits', () => {
  const tuesday = new Date('2026-10-20T12:00:00')

  it('checks schedule', () => {
    const daily = makeHabit()
    const weekdays = makeHabit({ schedule: 'weekdays', weekdays: [1, 2, 3, 4, 5] })
    expect(isHabitScheduled(daily, tuesday)).toBe(true)
    expect(isHabitScheduled(weekdays, tuesday)).toBe(true)
    expect(isHabitScheduled(weekdays, new Date('2026-10-18T12:00:00'))).toBe(false)
  })

  it('counts a streak including today', () => {
    const habit = makeHabit()
    const logs = [log(habit.id, '2026-10-20'), log(habit.id, '2026-10-19')]
    expect(habitStreak(habit, logs, tuesday)).toBe(2)
  })

  it('counts a streak ending yesterday when today is missing', () => {
    const habit = makeHabit()
    const logs = [log(habit.id, '2026-10-19'), log(habit.id, '2026-10-18')]
    expect(habitStreak(habit, logs, tuesday)).toBe(2)
  })

  it('skips unscheduled days for weekday habits', () => {
    const habit = makeHabit({ schedule: 'weekdays', weekdays: [1, 2, 3, 4, 5] })
    const logs = [log(habit.id, '2026-10-20'), log(habit.id, '2026-10-19')]
    expect(habitStreak(habit, logs, tuesday)).toBe(2)
  })

  it('counts the last seven days', () => {
    const habit = makeHabit()
    const logs = [log(habit.id, '2026-10-20'), log(habit.id, '2026-10-15')]
    expect(habitWeekCount(habit, logs, tuesday)).toBe(2)
    expect(isHabitDone(logs, habit.id, '2026-10-20')).toBe(true)
    expect(isHabitDone(logs, habit.id, '2026-10-14')).toBe(false)
  })
})
