import { useEffect } from 'react'
import { toast } from 'sonner'
import { registerSW } from 'virtual:pwa-register'
import { translate } from '@/lib/i18n'
import { DEFAULT_SETTINGS, type Language } from '@/types/models'

function currentLanguage(): Language {
  try {
    return (localStorage.getItem('binhub-language') as Language) || DEFAULT_SETTINGS.language
  } catch {
    return DEFAULT_SETTINGS.language
  }
}

export function PwaManager() {
  useEffect(() => {
    const t = (key: Parameters<typeof translate>[1]) => translate(currentLanguage(), key)
    const updateSW = registerSW({
      immediate: true,
      onNeedRefresh() {
        toast(t('pwa.updateTitle'), {
          id: 'pwa-update',
          description: t('pwa.updateDesc'),
          duration: Infinity,
          action: {
            label: t('pwa.update'),
            onClick: () => {
              void updateSW(true)
            },
          },
        })
      },
      onOfflineReady() {
        toast.success(t('pwa.offlineTitle'), {
          id: 'pwa-offline',
          description: t('pwa.offlineDesc'),
          duration: 3500,
        })
      },
    })
  }, [])

  return null
}
