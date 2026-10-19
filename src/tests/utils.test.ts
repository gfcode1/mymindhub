import { describe, expect, it } from 'vitest'
import {
  hostnameOf,
  initials,
  isHttpUrl,
  normalizeTags,
  normalizeUrl,
  parseTagInput,
  tagColor,
  truncate,
} from '@/lib/utils'

describe('utils', () => {
  it('normalizes tags', () => {
    expect(normalizeTags(['  Lavoro ', 'lavoro', 'Casa', ''])).toEqual(['lavoro', 'casa'])
    expect(parseTagInput('uno, due, uno')).toEqual(['uno', 'due'])
  })

  it('validates and normalizes urls', () => {
    expect(isHttpUrl('https://example.com')).toBe(true)
    expect(isHttpUrl('javascript:alert(1)')).toBe(false)
    expect(normalizeUrl('example.com')).toBe('https://example.com/')
    expect(normalizeUrl('ftp://example.com')).toBeNull()
  })

  it('extracts hostnames and initials', () => {
    expect(hostnameOf('https://www.example.com/path')).toBe('example.com')
    expect(initials('Example Site')).toBe('ES')
  })

  it('returns deterministic tag colors', () => {
    expect(tagColor('lavoro')).toBe(tagColor('lavoro'))
    expect(tagColor('lavoro')).toMatch(/^#[0-9a-f]{6}$/i)
  })

  it('truncates long text', () => {
    expect(truncate('abcdefghij', 5)).toBe('abcd…')
  })
})
