import type { HabitLog } from '@/types/models'

function logKey(log: HabitLog): string {
  return `${log.habitId}\u0000${log.date}`
}

function isPreferred(candidate: HabitLog, current: HabitLog): boolean {
  const candidateAlive = candidate.deletedAt === null
  const currentAlive = current.deletedAt === null
  if (candidateAlive !== currentAlive) return candidateAlive

  const candidateUpdated = Date.parse(candidate.updatedAt)
  const currentUpdated = Date.parse(current.updatedAt)
  const candidateValid = !Number.isNaN(candidateUpdated)
  const currentValid = !Number.isNaN(currentUpdated)
  if (candidateValid !== currentValid) return candidateValid
  if (candidateValid && currentValid && candidateUpdated !== currentUpdated) {
    return candidateUpdated > currentUpdated
  }

  if (candidate.value !== current.value) return candidate.value > current.value
  return candidate.id > current.id
}

/**
 * Keeps one habit log per (habitId, date) pair. Prefers active rows, then the
 * most recently updated one, then the highest value and finally the largest id
 * so the result stays deterministic across devices.
 */
export function dedupeHabitLogs(logs: HabitLog[]): HabitLog[] {
  const byKey = new Map<string, HabitLog>()
  for (const log of logs) {
    const key = logKey(log)
    const current = byKey.get(key)
    if (!current || isPreferred(log, current)) byKey.set(key, log)
  }
  return [...byKey.values()]
}
