import { useCallback, useEffect } from 'react'
import { useSettings } from '@/hooks/useData'
import {
  getDateLocale,
  translate,
  type MessageKey,
} from '@/lib/i18n'
import type { Language } from '@/types/models'

type Params = Record<string, string | number>

export function useI18n() {
  const { settings } = useSettings()
  const language: Language = settings.language ?? 'it'
  const locale = getDateLocale(language)

  const t = useCallback(
    (key: MessageKey, params?: Params) => translate(language, key, params),
    [language],
  )

  const tCount = useCallback(
    (base: string, count: number, params?: Params) =>
      translate(
        language,
        `${base}${count === 1 ? 'One' : 'Other'}` as MessageKey,
        { count, ...params },
      ),
    [language],
  )

  useEffect(() => {
    document.documentElement.lang = language
    try {
      localStorage.setItem('binhub-language', language)
    } catch {
      // storage may be unavailable
    }
  }, [language])

  return { t, tCount, language, locale }
}
