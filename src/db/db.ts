import Dexie, { type EntityTable } from 'dexie'
import { dedupeHabitLogs } from '@/db/migrate'
import type {
  Alarm,
  AppSettings,
  Bookmark,
  BookmarkReadingStatus,
  Budget,
  CalendarEvent,
  EntityLink,
  Expense,
  Habit,
  HabitLog,
  JournalEntry,
  Note,
  TagRecord,
  TimeEntry,
  Todo,
  VaultFile,
  VaultItem,
  VoiceBlobRecord,
  VoiceNote,
  WhiteboardData,
  WhiteboardMeta,
} from '@/types/models'

export class BinHubDB extends Dexie {
  notes!: EntityTable<Note, 'id'>
  todos!: EntityTable<Todo, 'id'>
  bookmarks!: EntityTable<Bookmark, 'id'>
  events!: EntityTable<CalendarEvent, 'id'>
  voiceNotes!: EntityTable<VoiceNote, 'id'>
  journalEntries!: EntityTable<JournalEntry, 'id'>
  habits!: EntityTable<Habit, 'id'>
  habitLogs!: EntityTable<HabitLog, 'id'>
  timeEntries!: EntityTable<TimeEntry, 'id'>
  links!: EntityTable<EntityLink, 'id'>
  expenses!: EntityTable<Expense, 'id'>
  budgets!: EntityTable<Budget, 'id'>
  vaultItems!: EntityTable<VaultItem, 'id'>
  vaultFiles!: EntityTable<VaultFile, 'id'>
  whiteboards!: EntityTable<WhiteboardMeta, 'id'>
  whiteboardData!: EntityTable<WhiteboardData, 'id'>
  alarms!: EntityTable<Alarm, 'id'>
  tags!: EntityTable<TagRecord, 'id'>
  settings!: EntityTable<AppSettings, 'key'>

  constructor() {
    super('binhub')
    this.version(1).stores({
      notes: 'id, updatedAt, createdAt, *tags',
      todos: 'id, updatedAt, createdAt, dueDate, *tags',
      bookmarks: 'id, updatedAt, createdAt, *tags',
      events: 'id, start, end, updatedAt',
      voiceNotes: 'id, createdAt, updatedAt, *tags',
      tags: 'id, &name',
      settings: 'key',
    })
    this.version(2)
      .stores({})
      .upgrade(async (transaction) => {
        await transaction
          .table('settings')
          .toCollection()
          .modify((settings: Partial<AppSettings>) => {
            settings.language ??= 'it'
            settings.onboarded ??= true
          })
      })
    this.version(3).stores({
      journalEntries: 'id, &date, updatedAt',
    })
    this.version(4).stores({
      habits: 'id, updatedAt, createdAt, archived',
      habitLogs: 'id, habitId, date, [habitId+date], updatedAt',
    })
    this.version(5)
      .stores({})
      .upgrade(async (transaction) => {
        await transaction
          .table('events')
          .toCollection()
          .modify((event: Partial<CalendarEvent>) => {
            event.recurrence ??= { frequency: 'none', interval: 1, until: null }
            event.kind ??= 'event'
            event.birthYear ??= null
          })
      })
    this.version(6).stores({
      timeEntries: 'id, startedAt, category, updatedAt',
    })
    this.version(7).stores({
      links:
        'id, sourceType, sourceId, targetType, targetId, [sourceType+sourceId], [targetType+targetId], [sourceType+sourceId+targetType+targetId], updatedAt',
    })
    this.version(8).stores({
      expenses: 'id, date, category, type, updatedAt',
      budgets: 'id, category, updatedAt',
    })
    this.version(9).stores({
      vaultItems: 'id, category, type, updatedAt, createdAt',
      vaultFiles: 'id',
    })
    this.version(10).stores({
      whiteboards: 'id, updatedAt, createdAt',
      whiteboardData: 'id',
    })
    this.version(11).stores({
      alarms: 'id, time, updatedAt, enabled',
    })
    this.version(12)
      .stores({})
      .upgrade(async (transaction) => {
        await transaction
          .table('bookmarks')
          .toCollection()
          .modify((bookmark: Partial<Bookmark> & { readingStatus?: BookmarkReadingStatus }) => {
            bookmark.readingStatus ??= 'to-read'
            bookmark.readerContent ??= ''
            bookmark.readerUpdatedAt ??= null
          })
      })
  }
}

export const db = new BinHubDB()
