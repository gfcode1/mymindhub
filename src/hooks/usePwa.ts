import { useCallback, useEffect, useState } from 'react'

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

export function useInstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const [installed, setInstalled] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.matchMedia('(display-mode: standalone)').matches
  })

  useEffect(() => {
    const onPrompt = (event: Event) => {
      event.preventDefault()
      setDeferred(event as BeforeInstallPromptEvent)
    }
    const onInstalled = () => {
      setInstalled(true)
      setDeferred(null)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  const install = useCallback(async () => {
    if (!deferred) return false
    await deferred.prompt()
    const choice = await deferred.userChoice
    if (choice.outcome === 'accepted') {
      setInstalled(true)
      setDeferred(null)
      return true
    }
    return false
  }, [deferred])

  return { canInstall: deferred !== null, installed, install }
}

export function useStorageEstimate() {
  const [usage, setUsage] = useState<number | null>(null)
  const [quota, setQuota] = useState<number | null>(null)
  const [persisted, setPersisted] = useState<boolean | null>(null)

  const refresh = useCallback(async () => {
    if (typeof navigator === 'undefined' || !navigator.storage) return
    try {
      const estimate = await navigator.storage.estimate()
      setUsage(estimate.usage ?? null)
      setQuota(estimate.quota ?? null)
      if (navigator.storage.persisted) {
        setPersisted(await navigator.storage.persisted())
      }
    } catch {
      setUsage(null)
      setQuota(null)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const requestPersist = useCallback(async () => {
    if (navigator.storage?.persist) {
      try {
        const granted = await navigator.storage.persist()
        setPersisted(granted)
        return granted
      } catch {
        return false
      }
    }
    return false
  }, [])

  return { usage, quota, persisted, refresh, requestPersist }
}
