import { beforeEach, describe, expect, it } from 'vitest'
import {
  getSpeechRecognition,
  grantSpeechConsent,
  hasSpeechConsent,
  mergeTranscript,
  revokeSpeechConsent,
  speechLocale,
} from '@/lib/speech'

class MockRecognition {}

function setWindowSpeech(name: string, value: unknown) {
  Object.defineProperty(window, name, { configurable: true, value })
}

beforeEach(() => {
  localStorage.clear()
  delete (window as unknown as Record<string, unknown>).SpeechRecognition
  delete (window as unknown as Record<string, unknown>).webkitSpeechRecognition
})

describe('speech', () => {
  it('detects browser support and the webkit fallback', () => {
    expect(getSpeechRecognition()).toBeNull()
    setWindowSpeech('webkitSpeechRecognition', MockRecognition)
    expect(getSpeechRecognition()).toBe(MockRecognition)
    setWindowSpeech('SpeechRecognition', MockRecognition)
    expect(getSpeechRecognition()).toBe(MockRecognition)
  })

  it('maps app languages to speech locales', () => {
    expect(speechLocale('it')).toBe('it-IT')
    expect(speechLocale('en')).toBe('en-US')
  })

  it('merges final chunks without double spaces', () => {
    expect(mergeTranscript(['  ciao ', '', ' come', 'stai?  '])).toBe('ciao come stai?')
  })

  it('persists the opt-in consent', () => {
    expect(hasSpeechConsent()).toBe(false)
    grantSpeechConsent()
    expect(hasSpeechConsent()).toBe(true)
    revokeSpeechConsent()
    expect(hasSpeechConsent()).toBe(false)
  })
})
