import Dexie, { type EntityTable } from 'dexie'
import type {
  AppSettings,
  Bookmark,
  CalendarEvent,
  Note,
  TagRecord,
  Todo,
  VoiceNote,
} from '@/types/models'

export class BinHubDB extends Dexie {
  notes!: EntityTable<Note, 'id'>
  todos!: EntityTable<Todo, 'id'>
  bookmarks!: EntityTable<Bookmark, 'id'>
  events!: EntityTable<CalendarEvent, 'id'>
  voiceNotes!: EntityTable<VoiceNote, 'id'>
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
  }
}

export const db = new BinHubDB()
