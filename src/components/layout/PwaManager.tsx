import { useEffect } from 'react'
import { toast } from 'sonner'
import { registerSW } from 'virtual:pwa-register'

export function PwaManager() {
  useEffect(() => {
    const updateSW = registerSW({
      immediate: true,
      onNeedRefresh() {
        toast('Nuova versione disponibile', {
          id: 'pwa-update',
          description: 'Aggiorna per usare l’ultima versione di BinHub.',
          duration: Infinity,
          action: {
            label: 'Aggiorna',
            onClick: () => {
              void updateSW(true)
            },
          },
        })
      },
      onOfflineReady() {
        toast.success('BinHub è pronto offline', {
          id: 'pwa-offline',
          description: 'Puoi chiudere e riaprire l’app senza connessione.',
          duration: 3500,
        })
      },
    })
  }, [])

  return null
}
