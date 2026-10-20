import { describe, expect, it } from 'vitest'
import { formatAlarmDays, isAlarmDue, nextAlarm, nextAlarmOccurrence } from '@/lib/alarms'
import type { Alarm } from '@/types/models'

function makeAlarm(overrides: Partial<Alarm> = {}): Alarm {
  return {
    id: 'alarm-1',
    label: 'Medicina',
    time: '08:00',
    days: [0, 1, 2, 3, 4, 5, 6],
    enabled: true,
    lastTriggeredAt: null,
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
    deletedAt: null,
    ...overrides,
  }
}

const tuesday = (hours: number, minutes = 0) => new Date(2026, 9, 20, hours, minutes, 0, 0)

describe('alarms', () => {
  it('detects a due alarm only on matching days and minutes', () => {
    const alarm = makeAlarm({ days: [2] })
    expect(isAlarmDue(alarm, tuesday(8))).toBe(true)
    expect(isAlarmDue(alarm, tuesday(8, 1))).toBe(false)
    expect(isAlarmDue(alarm, tuesday(9))).toBe(false)
    expect(isAlarmDue(makeAlarm({ days: [2], enabled: false }), tuesday(8))).toBe(false)
    expect(isAlarmDue(makeAlarm({ days: [3] }), tuesday(8))).toBe(false)
  })

  it('does not fire twice in the same minute', () => {
    const alarm = makeAlarm({
      days: [2],
      lastTriggeredAt: '2026-10-20T08:00:30',
    })
    expect(isAlarmDue(alarm, tuesday(8))).toBe(false)
  })

  it('finds the next occurrence across the week', () => {
    const weekdays = makeAlarm({ days: [1, 2, 3, 4, 5] })
    expect(nextAlarmOccurrence(weekdays, tuesday(9))?.getDay()).toBe(3)
    expect(nextAlarmOccurrence(weekdays, tuesday(7))?.getDay()).toBe(2)
    expect(nextAlarmOccurrence(weekdays, tuesday(7))?.getHours()).toBe(8)

    const sunday = makeAlarm({ days: [0] })
    expect(nextAlarmOccurrence(sunday, tuesday(9))?.getDay()).toBe(0)
    expect(nextAlarmOccurrence(makeAlarm({ enabled: false }), tuesday(9))).toBeNull()
  })

  it('picks the earliest alarm', () => {
    const morning = makeAlarm({ id: 'morning', time: '08:00' })
    const evening = makeAlarm({ id: 'evening', time: '20:00' })
    expect(nextAlarm([evening, morning], tuesday(7))?.alarm.id).toBe('morning')
  })

  it('formats day labels', () => {
    const labels = ['L', 'M', 'M', 'G', 'V', 'S', 'D']
    expect(formatAlarmDays([0, 1, 2, 3, 4, 5, 6], labels, 'Ogni giorno')).toBe('Ogni giorno')
    expect(formatAlarmDays([1, 3, 5], labels, 'Ogni giorno')).toBe('L M V')
  })
})
