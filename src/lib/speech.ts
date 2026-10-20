import type { Language } from '@/types/models'

export interface SpeechResultLike {
  readonly isFinal: boolean
  readonly length: number
  readonly 0: { transcript: string; confidence?: number }
}

export interface SpeechResultListLike {
  readonly length: number
  readonly [index: number]: SpeechResultLike
}

export interface SpeechResultEventLike extends Event {
  readonly resultIndex: number
  readonly results: SpeechResultListLike
}

export interface SpeechErrorEventLike extends Event {
  readonly error: string
  readonly message?: string
}

export interface SpeechRecognitionLike {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  start: () => void
  stop: () => void
  abort: () => void
  onstart: (() => void) | null
  onresult: ((event: SpeechResultEventLike) => void) | null
  onerror: ((event: SpeechErrorEventLike) => void) | null
  onend: (() => void) | null
}

export type SpeechRecognitionConstructor = new () => SpeechRecognitionLike

const CONSENT_KEY = 'binhub-speech-consent'

export function getSpeechRecognition(): SpeechRecognitionConstructor | null {
  if (typeof window === 'undefined') return null
  const candidate = window as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructor
    webkitSpeechRecognition?: SpeechRecognitionConstructor
  }
  return candidate.SpeechRecognition ?? candidate.webkitSpeechRecognition ?? null
}

export function isSpeechSupported(): boolean {
  return getSpeechRecognition() !== null
}

export function speechLocale(language: Language): string {
  return language === 'en' ? 'en-US' : 'it-IT'
}

export function mergeTranscript(parts: string[]): string {
  return parts
    .map((part) => part.trim())
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
}

export function hasSpeechConsent(): boolean {
  try {
    return localStorage.getItem(CONSENT_KEY) === '1'
  } catch {
    return false
  }
}

export function grantSpeechConsent(): void {
  try {
    localStorage.setItem(CONSENT_KEY, '1')
  } catch {
    // storage may be unavailable
  }
}

export function revokeSpeechConsent(): void {
  try {
    localStorage.removeItem(CONSENT_KEY)
  } catch {
    // storage may be unavailable
  }
}
