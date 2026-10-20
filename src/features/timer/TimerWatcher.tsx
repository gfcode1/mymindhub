import { useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { useI18n } from '@/hooks/useI18n'
import { elapsedMs, finishActiveTimer, useTimerStore } from '@/hooks/useTimer'
import { playChime } from '@/lib/timer'

export function TimerWatcher() {
  const active = useTimerStore((state) => state.active)
  const { t } = useI18n()
  const finishing = useRef(false)

  useEffect(() => {
    if (!active || active.pausedAt !== null || active.mode !== 'pomodoro' || active.durationSec <= 0) return

    const check = () => {
      if (finishing.current) return
      if (elapsedMs(active) < active.durationSec * 1000) return
      finishing.current = true
      void finishActiveTimer(t('time.session'))
        .then((entry) => {
          if (!entry) return
          playChime()
          toast.success(t('time.completed'), { description: entry.label })
        })
        .finally(() => {
          finishing.current = false
        })
    }

    check()
    const id = window.setInterval(check, 1000)
    document.addEventListener('visibilitychange', check)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', check)
    }
  }, [active, t])

  return null
}
