import { z } from 'zod'

export type Priority = 'low' | 'normal' | 'high'
export type Theme = 'light' | 'dark' | 'system'
export type Accent = 'teal' | 'indigo' | 'violet' | 'amber' | 'rose' | 'lime'
export type CalendarView = 'month' | 'week' | 'day'

export interface Subtask {
  id: string
  title: string
  done: boolean
}

export interface Note {
  id: string
  title: string
  content: string
  tags: string[]
  pinned: boolean
  archived: boolean
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

export interface Todo {
  id: string
  title: string
  notes: string
  done: boolean
  dueDate: string | null
  priority: Priority
  tags: string[]
  subtasks: Subtask[]
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

export interface Bookmark {
  id: string
  url: string
  title: string
  description: string
  tags: string[]
  archived: boolean
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

export interface CalendarEvent {
  id: string
  title: string
  description: string
  start: string
  end: string
  allDay: boolean
  location: string
  color: string
  linkedNoteId: string | null
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

export interface VoiceNote {
  id: string
  title: string
  mimeType: string
  durationSec: number
  waveform: number[]
  transcript: string | null
  tags: string[]
  blob: Blob
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

export type VoiceNoteMeta = Omit<VoiceNote, 'blob'>

export interface TagRecord {
  id: string
  name: string
  color: string
  createdAt: string
}

export interface AppSettings {
  key: 'app'
  theme: Theme
  accent: Accent
  lastBackupAt: string | null
  seeded: boolean
  calendarView: CalendarView
}

export const DEFAULT_SETTINGS: AppSettings = {
  key: 'app',
  theme: 'system',
  accent: 'teal',
  lastBackupAt: null,
  seeded: false,
  calendarView: 'month',
}

export const ACCENTS: Record<Accent, { label: string; light: string; dark: string; inkLight: string; inkDark: string }> = {
  teal: { label: 'Teal', light: '#0d9488', dark: '#2dd4bf', inkLight: '#ffffff', inkDark: '#04211c' },
  indigo: { label: 'Indaco', light: '#4f46e5', dark: '#818cf8', inkLight: '#ffffff', inkDark: '#0b1029' },
  violet: { label: 'Viola', light: '#7c3aed', dark: '#a78bfa', inkLight: '#ffffff', inkDark: '#160b2e' },
  amber: { label: 'Ambra', light: '#b45309', dark: '#fbbf24', inkLight: '#ffffff', inkDark: '#241503' },
  rose: { label: 'Rosa', light: '#be123c', dark: '#fb7185', inkLight: '#ffffff', inkDark: '#2b0710' },
  lime: { label: 'Lime', light: '#4d7c0f', dark: '#bef264', inkLight: '#ffffff', inkDark: '#141f04' },
}

const isoString = z.string().min(1)

export const subtaskSchema = z.object({
  id: z.string(),
  title: z.string(),
  done: z.boolean(),
})

export const noteSchema = z.object({
  id: z.string(),
  title: z.string(),
  content: z.string(),
  tags: z.array(z.string()),
  pinned: z.boolean(),
  archived: z.boolean(),
  createdAt: isoString,
  updatedAt: isoString,
  deletedAt: isoString.nullable(),
})

export const todoSchema = z.object({
  id: z.string(),
  title: z.string(),
  notes: z.string(),
  done: z.boolean(),
  dueDate: isoString.nullable(),
  priority: z.enum(['low', 'normal', 'high']),
  tags: z.array(z.string()),
  subtasks: z.array(subtaskSchema),
  createdAt: isoString,
  updatedAt: isoString,
  deletedAt: isoString.nullable(),
})

export const bookmarkSchema = z.object({
  id: z.string(),
  url: z.string(),
  title: z.string(),
  description: z.string(),
  tags: z.array(z.string()),
  archived: z.boolean(),
  createdAt: isoString,
  updatedAt: isoString,
  deletedAt: isoString.nullable(),
})

export const eventSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  start: isoString,
  end: isoString,
  allDay: z.boolean(),
  location: z.string(),
  color: z.string(),
  linkedNoteId: z.string().nullable(),
  createdAt: isoString,
  updatedAt: isoString,
  deletedAt: isoString.nullable(),
})

export const voiceNoteMetaSchema = z.object({
  id: z.string(),
  title: z.string(),
  mimeType: z.string(),
  durationSec: z.number(),
  waveform: z.array(z.number()),
  transcript: z.string().nullable(),
  tags: z.array(z.string()),
  createdAt: isoString,
  updatedAt: isoString,
  deletedAt: isoString.nullable(),
})

export const tagSchema = z.object({
  id: z.string(),
  name: z.string(),
  color: z.string(),
  createdAt: isoString,
})

export const settingsSchema = z.object({
  key: z.literal('app'),
  theme: z.enum(['light', 'dark', 'system']),
  accent: z.enum(['teal', 'indigo', 'violet', 'amber', 'rose', 'lime']),
  lastBackupAt: isoString.nullable(),
  seeded: z.boolean(),
  calendarView: z.enum(['month', 'week', 'day']),
})

export const backupManifestSchema = z.object({
  app: z.literal('binhub'),
  schemaVersion: z.literal(1),
  exportedAt: z.string(),
  counts: z.record(z.string(), z.number()),
})

export const backupPayloadSchema = z.object({
  notes: z.array(noteSchema),
  todos: z.array(todoSchema),
  bookmarks: z.array(bookmarkSchema),
  events: z.array(eventSchema),
  voiceNotes: z.array(voiceNoteMetaSchema),
  tags: z.array(tagSchema),
  settings: settingsSchema.nullable(),
})

export type BackupPayload = z.infer<typeof backupPayloadSchema>
