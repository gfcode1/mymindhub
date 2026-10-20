import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { createTimeEntry } from '@/db/seed'
import { nowIso } from '@/lib/utils'
import type { TimeEntry, TimerMode } from '@/types/models'

export interface ActiveTimer {
  mode: TimerMode
  startedAt: number
  durationSec: number
  pausedAt: number | null
  pausedMs: number
  label: string
  category: string
  todoId: string | null
  noteId: string | null
}

interface TimerState {
  active: ActiveTimer | null
  start: (input: {
    mode: TimerMode
    durationSec: number
    label: string
    category: string
    todoId: string | null
    noteId: string | null
  }) => void
  pause: () => void
  resume: () => void
  clear: () => void
}

export const useTimerStore = create<TimerState>()(
  persist(
    (set) => ({
      active: null,
      start: (input) =>
        set({
          active: {
            mode: input.mode,
            startedAt: Date.now(),
            durationSec: input.durationSec,
            pausedAt: null,
            pausedMs: 0,
            label: input.label,
            category: input.category,
            todoId: input.todoId,
            noteId: input.noteId,
          },
        }),
      pause: () =>
        set((state) =>
          state.active && state.active.pausedAt === null
            ? { active: { ...state.active, pausedAt: Date.now() } }
            : state,
        ),
      resume: () =>
        set((state) => {
          if (!state.active || state.active.pausedAt === null) return state
          return {
            active: {
              ...state.active,
              pausedMs: state.active.pausedMs + (Date.now() - state.active.pausedAt),
              pausedAt: null,
            },
          }
        }),
      clear: () => set({ active: null }),
    }),
    { name: 'binhub-timer', partialize: (state) => ({ active: state.active }) },
  ),
)

export function elapsedMs(timer: ActiveTimer, now = Date.now()): number {
  const end = timer.pausedAt ?? now
  return Math.max(0, end - timer.startedAt - timer.pausedMs)
}

let finishing: Promise<TimeEntry | null> | null = null

export function finishActiveTimer(labelFallback = 'Focus'): Promise<TimeEntry | null> {
  if (finishing) return finishing
  finishing = (async () => {
    const active = useTimerStore.getState().active
    if (!active) return null
    const raw = Math.max(0, Math.floor(elapsedMs(active) / 1000))
    const elapsed =
      active.mode === 'pomodoro' && active.durationSec > 0
        ? Math.min(raw, active.durationSec)
        : raw
    if (elapsed < 1) {
      useTimerStore.getState().clear()
      return null
    }
    const entry = await createTimeEntry({
      label: active.label.trim() || labelFallback,
      category: active.category.trim(),
      startedAt: new Date(active.startedAt).toISOString(),
      endedAt: nowIso(),
      durationSec: elapsed,
      mode: active.mode,
      todoId: active.todoId,
      noteId: active.noteId,
    })
    useTimerStore.getState().clear()
    return entry
  })().finally(() => {
    finishing = null
  })
  return finishing
}
