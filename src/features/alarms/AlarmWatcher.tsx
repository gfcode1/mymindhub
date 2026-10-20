import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { useI18n } from '@/hooks/useI18n'
import { useAlarms } from '@/hooks/useData'
import { markAlarmTriggered } from '@/db/seed'
import { isAlarmDue } from '@/lib/alarms'
import { playChime } from '@/lib/timer'
import { nowIso } from '@/lib/utils'

async function showNotification(title: string, body: string): Promise<void> {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
  const options: NotificationOptions = {
    body,
    tag: 'binhub-alarm',
    icon: `${import.meta.env.BASE_URL}icons/icon-192.png`,
    badge: `${import.meta.env.BASE_URL}icons/favicon-32.png`,
  }
  try {
    const registration = await navigator.serviceWorker?.getRegistration()
    if (registration) {
      await registration.showNotification(title, options)
      return
    }
  } catch {
    // fall back to a page notification
  }
  try {
    new Notification(title, options)
  } catch {
    // notifications may be unavailable
  }
}

export function AlarmWatcher() {
  const alarms = useAlarms()
  const { t } = useI18n()
  const navigate = useNavigate()
  const firing = useRef<Set<string>>(new Set())

  useEffect(() => {
    const check = () => {
      const now = new Date()
      for (const alarm of alarms) {
        if (firing.current.has(alarm.id)) continue
        if (!isAlarmDue(alarm, now)) continue
        firing.current.add(alarm.id)
        void markAlarmTriggered(alarm.id, nowIso()).finally(() => {
          window.setTimeout(() => firing.current.delete(alarm.id), 60_000)
        })
        playChime()
        const label = alarm.label || t('alarms.labelFallback')
        toast(t('alarms.ringing'), {
          id: `alarm-${alarm.id}`,
          description: `${alarm.time} · ${label}`,
          duration: 12_000,
          action: {
            label: t('alarms.open'),
            onClick: () => navigate('/alarms'),
          },
        })
        void showNotification(`${t('alarms.ringing')} · ${alarm.time}`, label)
      }
    }

    check()
    const id = window.setInterval(check, 15_000)
    document.addEventListener('visibilitychange', check)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', check)
    }
  }, [alarms, navigate, t])

  return null
}
