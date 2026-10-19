import { useEffect, useState } from 'react'
import { ACCENTS, type AppSettings } from '@/types/models'

export function useApplyTheme(settings: AppSettings, loaded = true): 'light' | 'dark' {
  const [systemDark, setSystemDark] = useState(() =>
    typeof window === 'undefined'
      ? true
      : window.matchMedia('(prefers-color-scheme: dark)').matches,
  )

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = (event: MediaQueryListEvent) => setSystemDark(event.matches)
    media.addEventListener('change', handler)
    return () => media.removeEventListener('change', handler)
  }, [])

  const resolved: 'light' | 'dark' =
    settings.theme === 'system' ? (systemDark ? 'dark' : 'light') : settings.theme

  useEffect(() => {
    if (!loaded) return
    const root = document.documentElement
    const dark = resolved === 'dark'
    root.classList.toggle('dark', dark)
    const accent = ACCENTS[settings.accent]
    root.style.setProperty('--accent', dark ? accent.dark : accent.light)
    root.style.setProperty('--accent-ink', dark ? accent.inkDark : accent.inkLight)
    const meta = document.querySelector('meta[name="theme-color"]')
    if (meta) meta.setAttribute('content', dark ? '#0a0d0c' : '#f6f6f2')
    try {
      localStorage.setItem('binhub-theme', settings.theme)
      localStorage.setItem('binhub-accent', settings.accent)
    } catch {
      // storage may be unavailable
    }
  }, [resolved, settings.accent, settings.theme, loaded])

  return resolved
}
