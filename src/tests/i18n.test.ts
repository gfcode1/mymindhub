import { describe, expect, it } from 'vitest'
import { getDateLocale, translate, translations } from '@/lib/i18n'

describe('i18n', () => {
  it('keeps both languages in sync', () => {
    expect(Object.keys(translations.en).sort()).toEqual(Object.keys(translations.it).sort())
  })

  it('translates and interpolates', () => {
    expect(translate('it', 'common.today')).toBe('Oggi')
    expect(translate('en', 'common.today')).toBe('Today')
    expect(translate('it', 'common.words', { count: 3 })).toBe('3 parole')
    expect(translate('en', 'settings.used', { used: '1 KB' })).toBe('1 KB used')
  })

  it('returns the key when missing at runtime', () => {
    // @ts-expect-error intentionally invalid key
    expect(translate('en', 'does.not.exist')).toBe('does.not.exist')
  })

  it('resolves a date-fns locale', () => {
    expect(getDateLocale('it').code).toBe('it')
    expect(getDateLocale('en').code).toBe('en-US')
  })
})
