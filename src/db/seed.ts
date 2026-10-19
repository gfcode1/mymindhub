import { db } from '@/db/db'
import { normalizeTags, nowIso, tagColor, uid } from '@/lib/utils'
import { todayKey } from '@/lib/dates'
import {
  DEFAULT_SETTINGS,
  type AppSettings,
  type Bookmark,
  type CalendarEvent,
  type Note,
  type Priority,
  type Subtask,
  type Todo,
  type VoiceNote,
} from '@/types/models'
import { addDays, format } from 'date-fns'

export async function ensureSettings(): Promise<AppSettings> {
  const existing = await db.settings.get('app')
  if (existing) return existing
  await db.settings.put(DEFAULT_SETTINGS)
  return DEFAULT_SETTINGS
}

export async function saveSettings(patch: Partial<Omit<AppSettings, 'key'>>): Promise<void> {
  const current = await ensureSettings()
  await db.settings.put({ ...current, ...patch, key: 'app' })
}

export async function registerTags(tags: string[]): Promise<void> {
  const normalized = normalizeTags(tags)
  if (normalized.length === 0) return
  await db.transaction('rw', db.tags, async () => {
    for (const name of normalized) {
      const existing = await db.tags.where('name').equals(name).first()
      if (!existing) {
        await db.tags.add({ id: uid(), name, color: tagColor(name), createdAt: nowIso() })
      }
    }
  })
}

export async function removeUnusedTags(): Promise<void> {
  const used = new Set<string>()
  for (const note of await db.notes.toArray()) note.tags.forEach((tag) => used.add(tag))
  for (const todo of await db.todos.toArray()) todo.tags.forEach((tag) => used.add(tag))
  for (const bookmark of await db.bookmarks.toArray()) bookmark.tags.forEach((tag) => used.add(tag))
  for (const voice of await db.voiceNotes.toArray()) voice.tags.forEach((tag) => used.add(tag))
  const all = await db.tags.toArray()
  const stale = all.filter((tag) => !used.has(tag.name)).map((tag) => tag.id)
  if (stale.length > 0) await db.tags.bulkDelete(stale)
}

type NewNote = { title?: string; content?: string; tags?: string[]; pinned?: boolean }
type NotePatch = Partial<Pick<Note, 'title' | 'content' | 'tags' | 'pinned' | 'archived'>>

export async function createNote(input: NewNote = {}): Promise<Note> {
  const timestamp = nowIso()
  const note: Note = {
    id: uid(),
    title: input.title?.trim() ?? '',
    content: input.content ?? '',
    tags: normalizeTags(input.tags ?? []),
    pinned: input.pinned ?? false,
    archived: false,
    createdAt: timestamp,
    updatedAt: timestamp,
    deletedAt: null,
  }
  await db.notes.add(note)
  await registerTags(note.tags)
  return note
}

export async function updateNote(id: string, patch: NotePatch): Promise<void> {
  const current = await db.notes.get(id)
  if (!current) return
  const next: Note = {
    ...current,
    ...patch,
    tags: patch.tags ? normalizeTags(patch.tags) : current.tags,
    updatedAt: nowIso(),
  }
  await db.notes.put(next)
  if (patch.tags) await registerTags(next.tags)
}

export async function deleteNote(id: string): Promise<void> {
  const note = await db.notes.get(id)
  if (!note) return
  await db.notes.put({ ...note, deletedAt: nowIso(), updatedAt: nowIso() })
}

export async function restoreNote(id: string): Promise<void> {
  const note = await db.notes.get(id)
  if (!note) return
  await db.notes.put({ ...note, deletedAt: null, updatedAt: nowIso() })
}

type NewTodo = {
  title: string
  notes?: string
  dueDate?: string | null
  priority?: Priority
  tags?: string[]
  subtasks?: Subtask[]
}
type TodoPatch = Partial<
  Pick<Todo, 'title' | 'notes' | 'dueDate' | 'priority' | 'tags' | 'subtasks' | 'done'>
>

export async function createTodo(input: NewTodo): Promise<Todo> {
  const timestamp = nowIso()
  const todo: Todo = {
    id: uid(),
    title: input.title.trim(),
    notes: input.notes ?? '',
    done: false,
    dueDate: input.dueDate ?? null,
    priority: input.priority ?? 'normal',
    tags: normalizeTags(input.tags ?? []),
    subtasks: input.subtasks ?? [],
    createdAt: timestamp,
    updatedAt: timestamp,
    deletedAt: null,
  }
  await db.todos.add(todo)
  await registerTags(todo.tags)
  return todo
}

export async function updateTodo(id: string, patch: TodoPatch): Promise<void> {
  const current = await db.todos.get(id)
  if (!current) return
  const next: Todo = {
    ...current,
    ...patch,
    title: patch.title?.trim() ?? current.title,
    tags: patch.tags ? normalizeTags(patch.tags) : current.tags,
    updatedAt: nowIso(),
  }
  await db.todos.put(next)
  if (patch.tags) await registerTags(next.tags)
}

export async function toggleTodo(id: string): Promise<void> {
  const current = await db.todos.get(id)
  if (!current) return
  await db.todos.put({ ...current, done: !current.done, updatedAt: nowIso() })
}

export async function deleteTodo(id: string): Promise<void> {
  const todo = await db.todos.get(id)
  if (!todo) return
  await db.todos.put({ ...todo, deletedAt: nowIso(), updatedAt: nowIso() })
}

export async function restoreTodo(id: string): Promise<void> {
  const todo = await db.todos.get(id)
  if (!todo) return
  await db.todos.put({ ...todo, deletedAt: null, updatedAt: nowIso() })
}

type NewBookmark = { url: string; title?: string; description?: string; tags?: string[] }
type BookmarkPatch = Partial<Pick<Bookmark, 'url' | 'title' | 'description' | 'tags' | 'archived'>>

export async function createBookmark(input: NewBookmark): Promise<Bookmark> {
  const timestamp = nowIso()
  const bookmark: Bookmark = {
    id: uid(),
    url: input.url,
    title: input.title?.trim() || input.url,
    description: input.description ?? '',
    tags: normalizeTags(input.tags ?? []),
    archived: false,
    createdAt: timestamp,
    updatedAt: timestamp,
    deletedAt: null,
  }
  await db.bookmarks.add(bookmark)
  await registerTags(bookmark.tags)
  return bookmark
}

export async function updateBookmark(id: string, patch: BookmarkPatch): Promise<void> {
  const current = await db.bookmarks.get(id)
  if (!current) return
  const next: Bookmark = {
    ...current,
    ...patch,
    tags: patch.tags ? normalizeTags(patch.tags) : current.tags,
    updatedAt: nowIso(),
  }
  await db.bookmarks.put(next)
  if (patch.tags) await registerTags(next.tags)
}

export async function deleteBookmark(id: string): Promise<void> {
  const bookmark = await db.bookmarks.get(id)
  if (!bookmark) return
  await db.bookmarks.put({ ...bookmark, deletedAt: nowIso(), updatedAt: nowIso() })
}

export async function restoreBookmark(id: string): Promise<void> {
  const bookmark = await db.bookmarks.get(id)
  if (!bookmark) return
  await db.bookmarks.put({ ...bookmark, deletedAt: null, updatedAt: nowIso() })
}

type NewEvent = {
  title: string
  description?: string
  start: string
  end: string
  allDay?: boolean
  location?: string
  color?: string
  linkedNoteId?: string | null
}
type EventPatch = Partial<
  Pick<
    CalendarEvent,
    'title' | 'description' | 'start' | 'end' | 'allDay' | 'location' | 'color' | 'linkedNoteId'
  >
>

export async function createEvent(input: NewEvent): Promise<CalendarEvent> {
  const timestamp = nowIso()
  const event: CalendarEvent = {
    id: uid(),
    title: input.title.trim(),
    description: input.description ?? '',
    start: input.start,
    end: input.end,
    allDay: input.allDay ?? false,
    location: input.location ?? '',
    color: input.color ?? '#0d9488',
    linkedNoteId: input.linkedNoteId ?? null,
    createdAt: timestamp,
    updatedAt: timestamp,
    deletedAt: null,
  }
  await db.events.add(event)
  return event
}

export async function updateEvent(id: string, patch: EventPatch): Promise<void> {
  const current = await db.events.get(id)
  if (!current) return
  await db.events.put({
    ...current,
    ...patch,
    title: patch.title?.trim() ?? current.title,
    updatedAt: nowIso(),
  })
}

export async function deleteEvent(id: string): Promise<void> {
  const event = await db.events.get(id)
  if (!event) return
  await db.events.put({ ...event, deletedAt: nowIso(), updatedAt: nowIso() })
}

export async function restoreEvent(id: string): Promise<void> {
  const event = await db.events.get(id)
  if (!event) return
  await db.events.put({ ...event, deletedAt: null, updatedAt: nowIso() })
}

type NewVoiceNote = {
  title: string
  blob: Blob
  mimeType: string
  durationSec: number
  waveform: number[]
  tags?: string[]
}

export async function createVoiceNote(input: NewVoiceNote): Promise<VoiceNote> {
  const timestamp = nowIso()
  const voice: VoiceNote = {
    id: uid(),
    title: input.title.trim(),
    blob: input.blob,
    mimeType: input.mimeType,
    durationSec: input.durationSec,
    waveform: input.waveform,
    transcript: null,
    tags: normalizeTags(input.tags ?? []),
    createdAt: timestamp,
    updatedAt: timestamp,
    deletedAt: null,
  }
  await db.voiceNotes.add(voice)
  await registerTags(voice.tags)
  return voice
}

export async function updateVoiceNote(
  id: string,
  patch: Partial<Pick<VoiceNote, 'title' | 'tags' | 'transcript'>>,
): Promise<void> {
  const current = await db.voiceNotes.get(id)
  if (!current) return
  const next: VoiceNote = {
    ...current,
    ...patch,
    title: patch.title?.trim() ?? current.title,
    tags: patch.tags ? normalizeTags(patch.tags) : current.tags,
    updatedAt: nowIso(),
  }
  await db.voiceNotes.put(next)
  if (patch.tags) await registerTags(next.tags)
}

export async function deleteVoiceNote(id: string): Promise<void> {
  const voice = await db.voiceNotes.get(id)
  if (!voice) return
  await db.voiceNotes.put({ ...voice, deletedAt: nowIso(), updatedAt: nowIso() })
}

export async function restoreVoiceNote(id: string): Promise<void> {
  const voice = await db.voiceNotes.get(id)
  if (!voice) return
  await db.voiceNotes.put({ ...voice, deletedAt: null, updatedAt: nowIso() })
}

export async function clearAllData(): Promise<void> {
  await db.transaction(
    'rw',
    [db.notes, db.todos, db.bookmarks, db.events, db.voiceNotes, db.tags],
    async () => {
      await Promise.all([
        db.notes.clear(),
        db.todos.clear(),
        db.bookmarks.clear(),
        db.events.clear(),
        db.voiceNotes.clear(),
        db.tags.clear(),
      ])
    },
  )
}

let seedPromise: Promise<void> | null = null

export function seedIfNeeded(): Promise<void> {
  seedPromise ??= doSeed()
  return seedPromise
}

async function doSeed(): Promise<void> {
  const settings = await ensureSettings()
  if (settings.seeded) return
  const timestamp = nowIso()
  const today = todayKey()
  const tomorrow = format(addDays(new Date(), 1), 'yyyy-MM-dd')
  const nextWeek = format(addDays(new Date(), 4), 'yyyy-MM-dd')

  const welcome: Note = {
    id: uid(),
    title: 'Benvenuto in BinHub',
    content: `# Il tuo hub personale

**BinHub** tiene insieme note, attività, link, calendario e vocali. Tutto vive sul tuo dispositivo: funziona senza connessione e non manda dati da nessuna parte.

## Da dove iniziare

- Apri **Note** e crea la tua prima nota (supporta Markdown).
- Aggiungi un todo con scadenza: lo vedrai anche nel calendario.
- Salva un bookmark e ritrovalo con la ricerca globale.
- Registra una nota vocale dal tab **Vocali**.

> Suggerimento: fai un backup da **Impostazioni → Dati** ogni tanto. Su iOS il browser può liberare spazio.`,
    tags: ['benvenuto'],
    pinned: true,
    archived: false,
    createdAt: timestamp,
    updatedAt: timestamp,
    deletedAt: null,
  }

  const todos: Todo[] = [
    {
      id: uid(),
      title: 'Esplorare BinHub',
      notes: 'Apri ogni tab e prova a creare qualcosa.',
      done: false,
      dueDate: today,
      priority: 'high',
      tags: ['benvenuto'],
      subtasks: [
        { id: uid(), title: 'Creare una nota', done: false },
        { id: uid(), title: 'Salvare un bookmark', done: false },
        { id: uid(), title: 'Registrare un vocale', done: false },
      ],
      createdAt: timestamp,
      updatedAt: timestamp,
      deletedAt: null,
    },
    {
      id: uid(),
      title: 'Fare un backup dei dati',
      notes: 'Impostazioni → Dati → Esporta backup.',
      done: false,
      dueDate: nextWeek,
      priority: 'normal',
      tags: ['backup'],
      subtasks: [],
      createdAt: timestamp,
      updatedAt: timestamp,
      deletedAt: null,
    },
    {
      id: uid(),
      title: 'Installare la PWA sul telefono',
      notes: 'Dal menu del browser scegli “Aggiungi a Home”.',
      done: false,
      dueDate: tomorrow,
      priority: 'low',
      tags: [],
      subtasks: [],
      createdAt: timestamp,
      updatedAt: timestamp,
      deletedAt: null,
    },
  ]

  const bookmarks: Bookmark[] = [
    {
      id: uid(),
      url: 'https://developer.mozilla.org/it/docs/Web/Progressive_web_apps',
      title: 'Progressive web apps — MDN',
      description: 'La guida di riferimento per capire cosa rende una web app installabile e offline.',
      tags: ['letture', 'pwa'],
      archived: false,
      createdAt: timestamp,
      updatedAt: timestamp,
      deletedAt: null,
    },
    {
      id: uid(),
      url: 'https://www.markdownguide.org/basic-syntax/',
      title: 'Markdown: sintassi di base',
      description: 'Promemoria rapido per formattare le note.',
      tags: ['letture'],
      archived: false,
      createdAt: timestamp,
      updatedAt: timestamp,
      deletedAt: null,
    },
  ]

  const events: CalendarEvent[] = [
    {
      id: uid(),
      title: 'Revisione settimanale',
      description: 'Dieci minuti per svuotare la inbox e pianificare la settimana.',
      start: `${today}T18:00`,
      end: `${today}T18:30`,
      allDay: false,
      location: '',
      color: '#0d9488',
      linkedNoteId: welcome.id,
      createdAt: timestamp,
      updatedAt: timestamp,
      deletedAt: null,
    },
    {
      id: uid(),
      title: 'Giornata di backup',
      description: 'Esporta i dati e conserva il file in un posto sicuro.',
      start: `${nextWeek}T09:00`,
      end: `${nextWeek}T09:15`,
      allDay: false,
      location: '',
      color: '#4f46e5',
      linkedNoteId: null,
      createdAt: timestamp,
      updatedAt: timestamp,
      deletedAt: null,
    },
  ]

  await db.transaction(
    'rw',
    [db.notes, db.todos, db.bookmarks, db.events, db.tags, db.settings],
    async () => {
      await db.notes.add(welcome)
      await db.todos.bulkAdd(todos)
      await db.bookmarks.bulkAdd(bookmarks)
      await db.events.bulkAdd(events)
      for (const name of ['benvenuto', 'backup', 'letture', 'pwa']) {
        await db.tags.put({ id: uid(), name, color: tagColor(name), createdAt: timestamp })
      }
      await db.settings.put({ ...settings, seeded: true })
    },
  )
}
