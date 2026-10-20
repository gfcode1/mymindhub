import type { TimeEntry } from '@/types/models'

export interface CategoryTotal {
  category: string
  seconds: number
  count: number
}

export function formatClock(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const secs = total % 60
  const pad = (value: number) => value.toString().padStart(2, '0')
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(secs)}` : `${pad(minutes)}:${pad(secs)}`
}

export function totalSeconds(entries: TimeEntry[]): number {
  return entries.reduce((sum, entry) => sum + Math.max(0, entry.durationSec), 0)
}

export function summarizeByCategory(entries: TimeEntry[]): CategoryTotal[] {
  const map = new Map<string, CategoryTotal>()
  for (const entry of entries) {
    const key = entry.category.trim()
    const current = map.get(key) ?? { category: key, seconds: 0, count: 0 }
    current.seconds += Math.max(0, entry.durationSec)
    current.count += 1
    map.set(key, current)
  }
  return [...map.values()].sort((a, b) => b.seconds - a.seconds)
}

export function filterEntriesInRange(entries: TimeEntry[], start: Date, end: Date): TimeEntry[] {
  const from = start.getTime()
  const to = end.getTime()
  return entries.filter((entry) => {
    const started = Date.parse(entry.startedAt)
    return Number.isFinite(started) && started >= from && started <= to
  })
}

export function playChime(): void {
  try {
    const context = new AudioContext()
    const now = context.currentTime
    ;[880, 660].forEach((frequency, index) => {
      const oscillator = context.createOscillator()
      const gain = context.createGain()
      const offset = index * 0.18
      oscillator.type = 'sine'
      oscillator.frequency.value = frequency
      gain.gain.setValueAtTime(0.0001, now + offset)
      gain.gain.exponentialRampToValueAtTime(0.18, now + offset + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.16)
      oscillator.connect(gain)
      gain.connect(context.destination)
      oscillator.start(now + offset)
      oscillator.stop(now + offset + 0.18)
    })
    window.setTimeout(() => {
      void context.close().catch(() => undefined)
    }, 700)
  } catch {
    // audio may be unavailable or blocked
  }
}
