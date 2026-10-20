import { subDays } from 'date-fns'
import { dateKey } from '@/lib/dates'
import type { Habit, HabitLog } from '@/types/models'

export function isHabitScheduled(habit: Habit, date: Date): boolean {
  if (habit.schedule === 'daily') return true
  return habit.weekdays.includes(date.getDay())
}

export function isHabitDone(logs: HabitLog[], habitId: string, date: string): boolean {
  return logs.some((log) => log.habitId === habitId && log.date === date && !log.deletedAt)
}

export function lastDays(count: number, end: Date): Date[] {
  return Array.from({ length: count }, (_, index) => subDays(end, count - 1 - index))
}

export function habitStreak(habit: Habit, logs: HabitLog[], today: Date): number {
  let streak = 0
  let cursor = today
  if (!isHabitDone(logs, habit.id, dateKey(today))) {
    cursor = subDays(today, 1)
  }
  if (!isHabitScheduled(habit, cursor) && !isHabitDone(logs, habit.id, dateKey(cursor))) {
    cursor = subDays(cursor, 1)
  }
  for (let guard = 0; guard < 3660; guard += 1) {
    if (!isHabitScheduled(habit, cursor)) {
      cursor = subDays(cursor, 1)
      continue
    }
    if (!isHabitDone(logs, habit.id, dateKey(cursor))) return streak
    streak += 1
    cursor = subDays(cursor, 1)
  }
  return streak
}

export function habitWeekCount(habit: Habit, logs: HabitLog[], today: Date): number {
  return lastDays(7, today).filter((day) => isHabitDone(logs, habit.id, dateKey(day))).length
}
