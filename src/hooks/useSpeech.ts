import { useCallback, useEffect, useRef, useState } from 'react'
import {
  getSpeechRecognition,
  isSpeechSupported,
  speechLocale,
  type SpeechRecognitionLike,
} from '@/lib/speech'
import type { Language } from '@/types/models'

export type SpeechErrorCode =
  | 'unsupported'
  | 'not-allowed'
  | 'no-speech'
  | 'network'
  | 'aborted'
  | 'unknown'

interface UseSpeechOptions {
  language: Language
  onFinal?: (text: string) => void
}

const MAX_RESTARTS = 30

function mapError(code: string): SpeechErrorCode {
  if (code === 'not-allowed' || code === 'service-not-allowed') return 'not-allowed'
  if (code === 'no-speech') return 'no-speech'
  if (code === 'network') return 'network'
  if (code === 'aborted') return 'aborted'
  return 'unknown'
}

export function useSpeech({ language, onFinal }: UseSpeechOptions) {
  const [supported] = useState(() => isSpeechSupported())
  const [listening, setListening] = useState(false)
  const [interim, setInterim] = useState('')
  const [error, setError] = useState<SpeechErrorCode | null>(null)

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const activeRef = useRef(false)
  const manualStopRef = useRef(false)
  const restartsRef = useRef(0)
  const languageRef = useRef(language)
  const onFinalRef = useRef(onFinal)

  useEffect(() => {
    onFinalRef.current = onFinal
  }, [onFinal])

  useEffect(() => {
    languageRef.current = language
  }, [language])

  const createRecognition = useCallback((): SpeechRecognitionLike | null => {
    const Recognition = getSpeechRecognition()
    if (!Recognition) return null
    const recognition = new Recognition()
    recognition.lang = speechLocale(languageRef.current)
    recognition.continuous = true
    recognition.interimResults = true
    recognition.maxAlternatives = 1

    recognition.onstart = () => {
      setError(null)
      setListening(true)
    }

    recognition.onresult = (event) => {
      let pending = ''
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index]
        const text = result?.[0]?.transcript ?? ''
        if (result?.isFinal) {
          const trimmed = text.trim()
          if (trimmed) onFinalRef.current?.(trimmed)
        } else {
          pending += text
        }
      }
      setInterim(pending.trim())
    }

    recognition.onerror = (event) => {
      if (event.error === 'aborted') return
      const mapped = mapError(event.error)
      setError(mapped)
      if (mapped === 'not-allowed' || mapped === 'network') {
        activeRef.current = false
        manualStopRef.current = true
        setListening(false)
      }
    }

    recognition.onend = () => {
      setInterim('')
      if (manualStopRef.current || !activeRef.current) {
        setListening(false)
        return
      }
      if (restartsRef.current >= MAX_RESTARTS) {
        activeRef.current = false
        setListening(false)
        setError('unknown')
        return
      }
      restartsRef.current += 1
      try {
        recognition.start()
      } catch {
        activeRef.current = false
        setListening(false)
      }
    }

    return recognition
  }, [])

  const start = useCallback(() => {
    if (!supported) {
      setError('unsupported')
      return
    }
    if (activeRef.current) return
    activeRef.current = true
    manualStopRef.current = false
    restartsRef.current = 0
    setError(null)
    const recognition = recognitionRef.current ?? createRecognition()
    recognitionRef.current = recognition
    if (!recognition) {
      activeRef.current = false
      setError('unsupported')
      return
    }
    try {
      recognition.start()
      setListening(true)
    } catch {
      // start() may throw if the engine is already running; onstart will sync the state.
    }
  }, [supported, createRecognition])

  const stop = useCallback(() => {
    activeRef.current = false
    manualStopRef.current = true
    setListening(false)
    setInterim('')
    try {
      recognitionRef.current?.stop()
    } catch {
      // ignore
    }
  }, [])

  const clearError = useCallback(() => setError(null), [])

  useEffect(() => {
    stop()
  }, [language, stop])

  useEffect(() => {
    return () => {
      activeRef.current = false
      manualStopRef.current = true
      try {
        recognitionRef.current?.abort()
      } catch {
        // ignore
      }
      recognitionRef.current = null
    }
  }, [])

  return { supported, listening, interim, error, start, stop, clearError }
}
