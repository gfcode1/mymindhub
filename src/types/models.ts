import { z } from 'zod'

export type Priority = 'low' | 'normal' | 'high'
export type Theme = 'light' | 'dark' | 'system'
export type Accent = 'teal' | 'indigo' | 'violet' | 'amber' | 'rose' | 'lime'
export type CalendarView = 'month' | 'week' | 'day'
export type Language = 'it' | 'en'
export type HabitSchedule = 'daily' | 'weekdays'
export type RecurrenceFrequency = 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly'
export type EventKind = 'event' | 'birthday'
export type TimerMode = 'pomodoro' | 'stopwatch'
export type LinkableType = 'note' | 'todo' | 'bookmark' | 'event' | 'voice'
export type BookmarkReadingStatus = 'to-read' | 'reading' | 'done'
export type ExpenseType = 'expense' | 'income'
export type VaultItemType = 'file' | 'checklist'
export type WhiteboardTool = 'pen' | 'eraser'

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
  readingStatus: BookmarkReadingStatus
  readerContent: string
  readerUpdatedAt: string | null
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

export interface RecurrenceRule {
  frequency: RecurrenceFrequency
  interval: number
  until: string | null
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
  recurrence: RecurrenceRule
  kind: EventKind
  birthYear: number | null
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

export const DEFAULT_RECURRENCE: RecurrenceRule = { frequency: 'none', interval: 1, until: null }

export function isRecurringEvent(event: CalendarEvent): boolean {
  return (event.recurrence?.frequency ?? 'none') !== 'none'
}

export interface VoiceNote {
  id: string
  title: string
  mimeType: string
  durationSec: number
  waveform: number[]
  transcript: string | null
  tags: string[]
  size: number
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

export interface VoiceBlobRecord {
  id: string
  blob: Blob
}

export type VoiceNoteMeta = VoiceNote

export interface Alarm {
  id: string
  label: string
  time: string
  days: number[]
  enabled: boolean
  lastTriggeredAt: string | null
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

export interface WhiteboardPoint {
  x: number
  y: number
}

export interface WhiteboardStroke {
  id: string
  color: string
  width: number
  tool: WhiteboardTool
  points: WhiteboardPoint[]
}

export interface WhiteboardMeta {
  id: string
  title: string
  width: number
  height: number
  strokeCount: number
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

export interface WhiteboardData {
  id: string
  strokes: WhiteboardStroke[]
}

export interface VaultChecklistItem {
  id: string
  text: string
}

export interface VaultItem {
  id: string
  type: VaultItemType
  title: string
  description: string
  category: string
  fileName: string | null
  mimeType: string | null
  size: number
  items: VaultChecklistItem[]
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

export interface VaultFile {
  id: string
  data: ArrayBuffer
  mimeType: string
}

export interface Expense {
  id: string
  description: string
  amountCents: number
  category: string
  date: string
  type: ExpenseType
  note: string
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

export interface Budget {
  id: string
  category: string
  amountCents: number
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

export interface EntityLink {
  id: string
  sourceType: LinkableType
  sourceId: string
  targetType: LinkableType
  targetId: string
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

export interface TimeEntry {
  id: string
  label: string
  category: string
  startedAt: string
  endedAt: string
  durationSec: number
  mode: TimerMode
  todoId: string | null
  noteId: string | null
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

export interface JournalEntry {
  id: string
  date: string
  done: string
  blockers: string
  reflection: string
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

export interface Habit {
  id: string
  name: string
  emoji: string
  color: string
  schedule: HabitSchedule
  weekdays: number[]
  targetPerWeek: number
  archived: boolean
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

export interface HabitLog {
  id: string
  habitId: string
  date: string
  value: number
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

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
  language: Language
  onboarded: boolean
  lastBackupAt: string | null
  seeded: boolean
  calendarView: CalendarView
}

export const DEFAULT_SETTINGS: AppSettings = {
  key: 'app',
  theme: 'system',
  accent: 'teal',
  language: 'it',
  onboarded: false,
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
  readingStatus: z.enum(['to-read', 'reading', 'done']).default('to-read'),
  readerContent: z.string().default(''),
  readerUpdatedAt: isoString.nullable().default(null),
  createdAt: isoString,
  updatedAt: isoString,
  deletedAt: isoString.nullable(),
})

export const recurrenceSchema = z.object({
  frequency: z.enum(['none', 'daily', 'weekly', 'monthly', 'yearly']).default('none'),
  interval: z.number().int().min(1).default(1),
  until: z.string().nullable().default(null),
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
  recurrence: recurrenceSchema.default({ frequency: 'none', interval: 1, until: null }),
  kind: z.enum(['event', 'birthday']).default('event'),
  birthYear: z.number().int().nullable().default(null),
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
  size: z.number().nonnegative().default(0),
  createdAt: isoString,
  updatedAt: isoString,
  deletedAt: isoString.nullable(),
})

export const alarmSchema = z.object({
  id: z.string(),
  label: z.string(),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  days: z.array(z.number().int().min(0).max(6)),
  enabled: z.boolean(),
  lastTriggeredAt: isoString.nullable(),
  createdAt: isoString,
  updatedAt: isoString,
  deletedAt: isoString.nullable(),
})

export const whiteboardPointSchema = z.object({
  x: z.number(),
  y: z.number(),
})

export const whiteboardStrokeSchema = z.object({
  id: z.string(),
  color: z.string(),
  width: z.number(),
  tool: z.enum(['pen', 'eraser']),
  points: z.array(whiteboardPointSchema),
})

export const whiteboardMetaSchema = z.object({
  id: z.string(),
  title: z.string(),
  width: z.number(),
  height: z.number(),
  strokeCount: z.number(),
  createdAt: isoString,
  updatedAt: isoString,
  deletedAt: isoString.nullable(),
})

export const whiteboardDataFileSchema = z.object({
  strokes: z.array(whiteboardStrokeSchema),
})

export const vaultChecklistItemSchema = z.object({
  id: z.string(),
  text: z.string(),
})

export const vaultItemSchema = z.object({
  id: z.string(),
  type: z.enum(['file', 'checklist']),
  title: z.string(),
  description: z.string(),
  category: z.string(),
  fileName: z.string().nullable(),
  mimeType: z.string().nullable(),
  size: z.number(),
  items: z.array(vaultChecklistItemSchema),
  createdAt: isoString,
  updatedAt: isoString,
  deletedAt: isoString.nullable(),
})

export const expenseSchema = z.object({
  id: z.string(),
  description: z.string(),
  amountCents: z.number(),
  category: z.string(),
  date: z.string(),
  type: z.enum(['expense', 'income']),
  note: z.string(),
  createdAt: isoString,
  updatedAt: isoString,
  deletedAt: isoString.nullable(),
})

export const budgetSchema = z.object({
  id: z.string(),
  category: z.string(),
  amountCents: z.number(),
  createdAt: isoString,
  updatedAt: isoString,
  deletedAt: isoString.nullable(),
})

export const entityLinkSchema = z.object({
  id: z.string(),
  sourceType: z.enum(['note', 'todo', 'bookmark', 'event', 'voice']),
  sourceId: z.string(),
  targetType: z.enum(['note', 'todo', 'bookmark', 'event', 'voice']),
  targetId: z.string(),
  createdAt: isoString,
  updatedAt: isoString,
  deletedAt: isoString.nullable(),
})

export const timeEntrySchema = z.object({
  id: z.string(),
  label: z.string(),
  category: z.string(),
  startedAt: isoString,
  endedAt: isoString,
  durationSec: z.number(),
  mode: z.enum(['pomodoro', 'stopwatch']),
  todoId: z.string().nullable(),
  noteId: z.string().nullable(),
  createdAt: isoString,
  updatedAt: isoString,
  deletedAt: isoString.nullable(),
})

export const journalEntrySchema = z.object({
  id: z.string(),
  date: z.string(),
  done: z.string(),
  blockers: z.string(),
  reflection: z.string(),
  createdAt: isoString,
  updatedAt: isoString,
  deletedAt: isoString.nullable(),
})

export const habitSchema = z.object({
  id: z.string(),
  name: z.string(),
  emoji: z.string(),
  color: z.string(),
  schedule: z.enum(['daily', 'weekdays']),
  weekdays: z.array(z.number()),
  targetPerWeek: z.number(),
  archived: z.boolean(),
  createdAt: isoString,
  updatedAt: isoString,
  deletedAt: isoString.nullable(),
})

export const habitLogSchema = z.object({
  id: z.string(),
  habitId: z.string(),
  date: z.string(),
  value: z.number(),
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
  language: z.enum(['it', 'en']).default('it'),
  onboarded: z.boolean().default(false),
  lastBackupAt: isoString.nullable(),
  seeded: z.boolean(),
  calendarView: z.enum(['month', 'week', 'day']),
})

export const BACKUP_SCHEMA_VERSION = 14

export const backupManifestSchema = z.object({
  app: z.literal('binhub'),
  schemaVersion: z.number().int().min(1).max(BACKUP_SCHEMA_VERSION),
  exportedAt: z.string(),
  counts: z.record(z.string(), z.number()),
})

export const backupPayloadSchema = z.object({
  notes: z.array(noteSchema),
  todos: z.array(todoSchema),
  bookmarks: z.array(bookmarkSchema),
  events: z.array(eventSchema),
  voiceNotes: z.array(voiceNoteMetaSchema),
  journalEntries: z.array(journalEntrySchema).default([]),
  timeEntries: z.array(timeEntrySchema).default([]),
  links: z.array(entityLinkSchema).default([]),
  expenses: z.array(expenseSchema).default([]),
  budgets: z.array(budgetSchema).default([]),
  vaultItems: z.array(vaultItemSchema).default([]),
  whiteboards: z.array(whiteboardMetaSchema).default([]),
  alarms: z.array(alarmSchema).default([]),
  habits: z.array(habitSchema).default([]),
  habitLogs: z.array(habitLogSchema).default([]),
  tags: z.array(tagSchema),
  settings: settingsSchema.nullable(),
})

export type BackupPayload = z.infer<typeof backupPayloadSchema>
