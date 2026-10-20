import { db } from '@/db/db'
import { normalizeTags, normalizeUrl, nowIso, tagColor, uid } from '@/lib/utils'
import { todayKey } from '@/lib/dates'
import {
  DEFAULT_SETTINGS,
  type Alarm,
  type AppSettings,
  type Bookmark,
  type BookmarkReadingStatus,
  type Budget,
  type CalendarEvent,
  type Expense,
  type ExpenseType,
  type EntityLink,
  type EventKind,
  type Habit,
  type HabitLog,
  type HabitSchedule,
  type JournalEntry,
  type Note,
  type Priority,
  type LinkableType,
  type RecurrenceRule,
  type TimeEntry,
  type TimerMode,
  type VaultChecklistItem,
  type VaultItem,
  type WhiteboardData,
  type WhiteboardMeta,
  type WhiteboardStroke,
  type Subtask,
  type Todo,
  type VoiceNote,
} from '@/types/models'
import { addDays, format } from 'date-fns'
import { normalizeRecurrence } from '@/lib/recurrence'

export async function ensureSettings(): Promise<AppSettings> {
  const existing = await db.settings.get('app')
  if (!existing) {
    await db.settings.put(DEFAULT_SETTINGS)
    return DEFAULT_SETTINGS
  }
  if (existing.language === undefined || existing.onboarded === undefined) {
    const merged: AppSettings = { ...DEFAULT_SETTINGS, ...existing, key: 'app' }
    await db.settings.put(merged)
    return merged
  }
  return existing
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

type NewBookmark = {
  url: string
  title?: string
  description?: string
  tags?: string[]
  readingStatus?: BookmarkReadingStatus
}
type BookmarkPatch = Partial<
  Pick<
    Bookmark,
    | 'url'
    | 'title'
    | 'description'
    | 'tags'
    | 'archived'
    | 'readingStatus'
    | 'readerContent'
    | 'readerUpdatedAt'
  >
>

export async function findBookmarkByUrl(url: string): Promise<Bookmark | undefined> {
  const normalized = normalizeUrl(url)
  if (!normalized) return undefined
  const all = await db.bookmarks.toArray()
  return all.find((bookmark) => !bookmark.deletedAt && bookmark.url === normalized)
}

export async function createBookmark(input: NewBookmark): Promise<Bookmark> {
  const timestamp = nowIso()
  const bookmark: Bookmark = {
    id: uid(),
    url: input.url,
    title: input.title?.trim() || input.url,
    description: input.description ?? '',
    tags: normalizeTags(input.tags ?? []),
    archived: false,
    readingStatus: input.readingStatus ?? 'to-read',
    readerContent: '',
    readerUpdatedAt: null,
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
  recurrence?: Partial<RecurrenceRule>
  kind?: EventKind
  birthYear?: number | null
}
type EventPatch = Partial<
  Pick<
    CalendarEvent,
    | 'title'
    | 'description'
    | 'start'
    | 'end'
    | 'allDay'
    | 'location'
    | 'color'
    | 'linkedNoteId'
    | 'recurrence'
    | 'kind'
    | 'birthYear'
  >
>

export async function createEvent(input: NewEvent): Promise<CalendarEvent> {
  const timestamp = nowIso()
  const kind = input.kind ?? 'event'
  const event: CalendarEvent = {
    id: uid(),
    title: input.title.trim(),
    description: input.description ?? '',
    start: input.start,
    end: input.end,
    allDay: kind === 'birthday' ? true : input.allDay ?? false,
    location: input.location ?? '',
    color: input.color ?? '#0d9488',
    linkedNoteId: input.linkedNoteId ?? null,
    recurrence:
      kind === 'birthday'
        ? { frequency: 'yearly', interval: 1, until: null }
        : normalizeRecurrence(input.recurrence),
    kind,
    birthYear: kind === 'birthday' ? input.birthYear ?? null : null,
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
  const kind = patch.kind ?? current.kind
  const recurrence =
    kind === 'birthday'
      ? { frequency: 'yearly' as const, interval: 1, until: null }
      : patch.recurrence
        ? normalizeRecurrence(patch.recurrence)
        : normalizeRecurrence(current.recurrence)
  const birthYear =
    kind === 'birthday'
      ? patch.birthYear !== undefined
        ? patch.birthYear
        : current.birthYear
      : null
  await db.events.put({
    ...current,
    ...patch,
    title: patch.title?.trim() ?? current.title,
    allDay: kind === 'birthday' ? true : patch.allDay ?? current.allDay,
    recurrence,
    kind,
    birthYear,
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
  transcript?: string | null
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
    transcript: input.transcript?.trim() || null,
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

export async function saveJournalEntry(
  date: string,
  patch: Partial<Pick<JournalEntry, 'done' | 'blockers' | 'reflection'>>,
): Promise<JournalEntry> {
  const timestamp = nowIso()
  const existing = await db.journalEntries.where('date').equals(date).first()
  if (existing) {
    const next: JournalEntry = {
      ...existing,
      ...patch,
      deletedAt: null,
      updatedAt: timestamp,
    }
    await db.journalEntries.put(next)
    return next
  }
  const entry: JournalEntry = {
    id: uid(),
    date,
    done: patch.done ?? '',
    blockers: patch.blockers ?? '',
    reflection: patch.reflection ?? '',
    createdAt: timestamp,
    updatedAt: timestamp,
    deletedAt: null,
  }
  await db.journalEntries.add(entry)
  return entry
}

export async function deleteJournalEntry(id: string): Promise<void> {
  const entry = await db.journalEntries.get(id)
  if (!entry) return
  await db.journalEntries.put({ ...entry, deletedAt: nowIso(), updatedAt: nowIso() })
}

type NewHabit = {
  name: string
  emoji?: string
  color?: string
  schedule?: HabitSchedule
  weekdays?: number[]
  targetPerWeek?: number
}

export async function createHabit(input: NewHabit): Promise<Habit> {
  const timestamp = nowIso()
  const habit: Habit = {
    id: uid(),
    name: input.name.trim(),
    emoji: input.emoji ?? '1F331',
    color: input.color ?? '#0d9488',
    schedule: input.schedule ?? 'daily',
    weekdays: input.weekdays ?? [1, 2, 3, 4, 5, 6, 0],
    targetPerWeek: input.targetPerWeek ?? 7,
    archived: false,
    createdAt: timestamp,
    updatedAt: timestamp,
    deletedAt: null,
  }
  await db.habits.add(habit)
  return habit
}

export async function updateHabit(
  id: string,
  patch: Partial<Pick<Habit, 'name' | 'emoji' | 'color' | 'schedule' | 'weekdays' | 'targetPerWeek' | 'archived'>>,
): Promise<void> {
  const current = await db.habits.get(id)
  if (!current) return
  await db.habits.put({
    ...current,
    ...patch,
    name: patch.name?.trim() ?? current.name,
    updatedAt: nowIso(),
  })
}

export async function deleteHabit(id: string): Promise<void> {
  const habit = await db.habits.get(id)
  if (!habit) return
  await db.habits.put({ ...habit, deletedAt: nowIso(), updatedAt: nowIso() })
}

export async function restoreHabit(id: string): Promise<void> {
  const habit = await db.habits.get(id)
  if (!habit) return
  await db.habits.put({ ...habit, deletedAt: null, updatedAt: nowIso() })
}

export async function toggleHabitLog(habitId: string, date: string): Promise<void> {
  const existing = await db.habitLogs.where('[habitId+date]').equals([habitId, date]).first()
  const timestamp = nowIso()
  if (existing) {
    await db.habitLogs.put({
      ...existing,
      deletedAt: existing.deletedAt ? null : timestamp,
      updatedAt: timestamp,
    })
    return
  }
  const log: HabitLog = {
    id: uid(),
    habitId,
    date,
    value: 1,
    createdAt: timestamp,
    updatedAt: timestamp,
    deletedAt: null,
  }
  await db.habitLogs.add(log)
}

type NewAlarm = {
  label?: string
  time: string
  days?: number[]
  enabled?: boolean
}

function normalizeAlarmDays(days: number[] | undefined): number[] {
  const values = [...new Set((days ?? [0, 1, 2, 3, 4, 5, 6]).filter((day) => day >= 0 && day <= 6))]
    .sort((a, b) => a - b)
  return values.length > 0 ? values : [0, 1, 2, 3, 4, 5, 6]
}

export async function createAlarm(input: NewAlarm): Promise<Alarm> {
  const timestamp = nowIso()
  const alarm: Alarm = {
    id: uid(),
    label: input.label?.trim() ?? '',
    time: input.time,
    days: normalizeAlarmDays(input.days),
    enabled: input.enabled ?? true,
    lastTriggeredAt: null,
    createdAt: timestamp,
    updatedAt: timestamp,
    deletedAt: null,
  }
  await db.alarms.add(alarm)
  return alarm
}

export async function updateAlarm(
  id: string,
  patch: Partial<Pick<Alarm, 'label' | 'time' | 'days' | 'enabled'>>,
): Promise<void> {
  const current = await db.alarms.get(id)
  if (!current) return
  await db.alarms.put({
    ...current,
    ...patch,
    label: patch.label !== undefined ? patch.label.trim() : current.label,
    days: patch.days ? normalizeAlarmDays(patch.days) : current.days,
    updatedAt: nowIso(),
  })
}

export async function markAlarmTriggered(id: string, at: string): Promise<void> {
  const current = await db.alarms.get(id)
  if (!current) return
  await db.alarms.put({ ...current, lastTriggeredAt: at, updatedAt: nowIso() })
}

export async function deleteAlarm(id: string): Promise<void> {
  const alarm = await db.alarms.get(id)
  if (!alarm) return
  await db.alarms.put({ ...alarm, deletedAt: nowIso(), updatedAt: nowIso() })
}

export async function restoreAlarm(id: string): Promise<void> {
  const alarm = await db.alarms.get(id)
  if (!alarm) return
  await db.alarms.put({ ...alarm, deletedAt: null, updatedAt: nowIso() })
}

export async function createWhiteboard(
  title: string,
  width = 1600,
  height = 1000,
): Promise<WhiteboardMeta> {
  const timestamp = nowIso()
  const board: WhiteboardMeta = {
    id: uid(),
    title: title.trim() || 'Lavagna',
    width,
    height,
    strokeCount: 0,
    createdAt: timestamp,
    updatedAt: timestamp,
    deletedAt: null,
  }
  await db.transaction('rw', [db.whiteboards, db.whiteboardData], async () => {
    await db.whiteboards.add(board)
    await db.whiteboardData.add({ id: board.id, strokes: [] })
  })
  return board
}

export async function updateWhiteboardMeta(
  id: string,
  patch: Partial<Pick<WhiteboardMeta, 'title' | 'width' | 'height'>>,
): Promise<void> {
  const current = await db.whiteboards.get(id)
  if (!current) return
  await db.whiteboards.put({
    ...current,
    ...patch,
    title: patch.title?.trim() || current.title,
    updatedAt: nowIso(),
  })
}

export async function saveWhiteboardStrokes(id: string, strokes: WhiteboardStroke[]): Promise<void> {
  const current = await db.whiteboards.get(id)
  if (!current) return
  const timestamp = nowIso()
  await db.transaction('rw', [db.whiteboards, db.whiteboardData], async () => {
    await db.whiteboardData.put({ id, strokes })
    await db.whiteboards.put({
      ...current,
      strokeCount: strokes.length,
      updatedAt: timestamp,
    })
  })
}

export async function getWhiteboardData(id: string): Promise<WhiteboardData | null> {
  return (await db.whiteboardData.get(id)) ?? null
}

export async function deleteWhiteboard(id: string): Promise<void> {
  const board = await db.whiteboards.get(id)
  if (!board) return
  await db.whiteboards.put({ ...board, deletedAt: nowIso(), updatedAt: nowIso() })
}

export async function restoreWhiteboard(id: string): Promise<void> {
  const board = await db.whiteboards.get(id)
  if (!board) return
  await db.whiteboards.put({ ...board, deletedAt: null, updatedAt: nowIso() })
}

type NewVaultFile = {
  file: File
  title?: string
  description?: string
  category?: string
}

export async function createVaultFile(input: NewVaultFile): Promise<VaultItem> {
  const timestamp = nowIso()
  const item: VaultItem = {
    id: uid(),
    type: 'file',
    title: input.title?.trim() || input.file.name,
    description: input.description ?? '',
    category: input.category?.trim() ?? '',
    fileName: input.file.name,
    mimeType: input.file.type || 'application/octet-stream',
    size: input.file.size,
    items: [],
    createdAt: timestamp,
    updatedAt: timestamp,
    deletedAt: null,
  }
  const data = await input.file.arrayBuffer()
  await db.transaction('rw', [db.vaultItems, db.vaultFiles], async () => {
    await db.vaultItems.add(item)
    await db.vaultFiles.add({ id: item.id, data, mimeType: item.mimeType ?? 'application/octet-stream' })
  })
  return item
}

type NewVaultChecklist = {
  title: string
  description?: string
  category?: string
  items: string[]
}

export async function createVaultChecklist(input: NewVaultChecklist): Promise<VaultItem> {
  const timestamp = nowIso()
  const item: VaultItem = {
    id: uid(),
    type: 'checklist',
    title: input.title.trim(),
    description: input.description ?? '',
    category: input.category?.trim() ?? '',
    fileName: null,
    mimeType: null,
    size: 0,
    items: input.items
      .map((text) => text.trim())
      .filter(Boolean)
      .map((text) => ({ id: uid(), text })),
    createdAt: timestamp,
    updatedAt: timestamp,
    deletedAt: null,
  }
  await db.vaultItems.add(item)
  return item
}

export async function updateVaultItem(
  id: string,
  patch: Partial<Pick<VaultItem, 'title' | 'description' | 'category' | 'items'>>,
): Promise<void> {
  const current = await db.vaultItems.get(id)
  if (!current) return
  const items: VaultChecklistItem[] = patch.items
    ? patch.items
        .map((item) => ({ id: item.id || uid(), text: item.text.trim() }))
        .filter((item) => item.text.length > 0)
    : current.items
  await db.vaultItems.put({
    ...current,
    ...patch,
    title: patch.title?.trim() || current.title,
    category: patch.category?.trim() ?? current.category,
    items,
    updatedAt: nowIso(),
  })
}

export async function deleteVaultItem(id: string): Promise<void> {
  const item = await db.vaultItems.get(id)
  if (!item) return
  await db.vaultItems.put({ ...item, deletedAt: nowIso(), updatedAt: nowIso() })
}

export async function restoreVaultItem(id: string): Promise<void> {
  const item = await db.vaultItems.get(id)
  if (!item) return
  await db.vaultItems.put({ ...item, deletedAt: null, updatedAt: nowIso() })
}

export async function getVaultBlob(id: string): Promise<Blob | null> {
  const file = await db.vaultFiles.get(id)
  if (!file) return null
  return new Blob([file.data], { type: file.mimeType })
}

type NewExpense = {
  description?: string
  amountCents: number
  category?: string
  date?: string
  type?: ExpenseType
  note?: string
}

export async function createExpense(input: NewExpense): Promise<Expense> {
  const timestamp = nowIso()
  const expense: Expense = {
    id: uid(),
    description: input.description?.trim() ?? '',
    amountCents: Math.max(0, Math.round(input.amountCents)),
    category: input.category?.trim() ?? '',
    date: input.date ?? todayKey(),
    type: input.type ?? 'expense',
    note: input.note ?? '',
    createdAt: timestamp,
    updatedAt: timestamp,
    deletedAt: null,
  }
  await db.expenses.add(expense)
  return expense
}

export async function updateExpense(
  id: string,
  patch: Partial<Pick<Expense, 'description' | 'amountCents' | 'category' | 'date' | 'type' | 'note'>>,
): Promise<void> {
  const current = await db.expenses.get(id)
  if (!current) return
  await db.expenses.put({
    ...current,
    ...patch,
    description: patch.description?.trim() ?? current.description,
    amountCents:
      patch.amountCents !== undefined
        ? Math.max(0, Math.round(patch.amountCents))
        : current.amountCents,
    category: patch.category?.trim() ?? current.category,
    updatedAt: nowIso(),
  })
}

export async function deleteExpense(id: string): Promise<void> {
  const expense = await db.expenses.get(id)
  if (!expense) return
  await db.expenses.put({ ...expense, deletedAt: nowIso(), updatedAt: nowIso() })
}

export async function restoreExpense(id: string): Promise<void> {
  const expense = await db.expenses.get(id)
  if (!expense) return
  await db.expenses.put({ ...expense, deletedAt: null, updatedAt: nowIso() })
}

export async function setBudget(category: string, amountCents: number): Promise<void> {
  const name = category.trim()
  const value = Math.max(0, Math.round(amountCents))
  const existing = await db.budgets.where('category').equals(name).first()
  const timestamp = nowIso()
  if (value <= 0) {
    if (existing && !existing.deletedAt) {
      await db.budgets.put({ ...existing, deletedAt: timestamp, updatedAt: timestamp })
    }
    return
  }
  if (existing) {
    await db.budgets.put({
      ...existing,
      amountCents: value,
      deletedAt: null,
      updatedAt: timestamp,
    })
    return
  }
  const budget: Budget = {
    id: uid(),
    category: name,
    amountCents: value,
    createdAt: timestamp,
    updatedAt: timestamp,
    deletedAt: null,
  }
  await db.budgets.add(budget)
}

export async function deleteBudget(id: string): Promise<void> {
  const budget = await db.budgets.get(id)
  if (!budget) return
  await db.budgets.put({ ...budget, deletedAt: nowIso(), updatedAt: nowIso() })
}

type NewEntityLink = {
  sourceType: LinkableType
  sourceId: string
  targetType: LinkableType
  targetId: string
}

export async function createEntityLink(input: NewEntityLink): Promise<EntityLink | null> {
  if (input.sourceType === input.targetType && input.sourceId === input.targetId) return null
  const exact = await db.links
    .where('[sourceType+sourceId+targetType+targetId]')
    .equals([input.sourceType, input.sourceId, input.targetType, input.targetId])
    .first()
  const reverse =
    exact ??
    (await db.links
      .where('[sourceType+sourceId+targetType+targetId]')
      .equals([input.targetType, input.targetId, input.sourceType, input.sourceId])
      .first())
  const timestamp = nowIso()
  if (reverse) {
    if (reverse.deletedAt) {
      const revived: EntityLink = { ...reverse, deletedAt: null, updatedAt: timestamp }
      await db.links.put(revived)
      return revived
    }
    return reverse
  }
  const link: EntityLink = {
    id: uid(),
    sourceType: input.sourceType,
    sourceId: input.sourceId,
    targetType: input.targetType,
    targetId: input.targetId,
    createdAt: timestamp,
    updatedAt: timestamp,
    deletedAt: null,
  }
  await db.links.add(link)
  return link
}

export async function deleteEntityLink(id: string): Promise<void> {
  const link = await db.links.get(id)
  if (!link) return
  await db.links.put({ ...link, deletedAt: nowIso(), updatedAt: nowIso() })
}

export async function restoreEntityLink(id: string): Promise<void> {
  const link = await db.links.get(id)
  if (!link) return
  await db.links.put({ ...link, deletedAt: null, updatedAt: nowIso() })
}

type NewTimeEntry = {
  label: string
  category: string
  startedAt: string
  endedAt: string
  durationSec: number
  mode: TimerMode
  todoId?: string | null
  noteId?: string | null
}

export async function createTimeEntry(input: NewTimeEntry): Promise<TimeEntry> {
  const timestamp = nowIso()
  const entry: TimeEntry = {
    id: uid(),
    label: input.label.trim(),
    category: input.category.trim(),
    startedAt: input.startedAt,
    endedAt: input.endedAt,
    durationSec: Math.max(0, Math.round(input.durationSec)),
    mode: input.mode,
    todoId: input.todoId ?? null,
    noteId: input.noteId ?? null,
    createdAt: timestamp,
    updatedAt: timestamp,
    deletedAt: null,
  }
  await db.timeEntries.add(entry)
  return entry
}

export async function deleteTimeEntry(id: string): Promise<void> {
  const entry = await db.timeEntries.get(id)
  if (!entry) return
  await db.timeEntries.put({ ...entry, deletedAt: nowIso(), updatedAt: nowIso() })
}

export async function restoreTimeEntry(id: string): Promise<void> {
  const entry = await db.timeEntries.get(id)
  if (!entry) return
  await db.timeEntries.put({ ...entry, deletedAt: null, updatedAt: nowIso() })
}

export async function clearAllData(): Promise<void> {
  await db.transaction(
    'rw',
    [
      db.notes,
      db.todos,
      db.bookmarks,
      db.events,
      db.voiceNotes,
      db.journalEntries,
      db.habits,
      db.habitLogs,
      db.timeEntries,
      db.links,
      db.expenses,
      db.budgets,
      db.vaultItems,
      db.vaultFiles,
      db.whiteboards,
      db.whiteboardData,
      db.alarms,
      db.tags,
    ],
    async () => {
      await Promise.all([
        db.notes.clear(),
        db.todos.clear(),
        db.bookmarks.clear(),
        db.events.clear(),
        db.voiceNotes.clear(),
        db.journalEntries.clear(),
        db.habits.clear(),
        db.habitLogs.clear(),
        db.timeEntries.clear(),
        db.links.clear(),
        db.expenses.clear(),
        db.budgets.clear(),
        db.vaultItems.clear(),
        db.vaultFiles.clear(),
        db.whiteboards.clear(),
        db.whiteboardData.clear(),
        db.alarms.clear(),
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
      readingStatus: 'to-read',
      readerContent: '',
      readerUpdatedAt: null,
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
      readingStatus: 'to-read',
      readerContent: '',
      readerUpdatedAt: null,
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
      recurrence: { frequency: 'none', interval: 1, until: null },
      kind: 'event',
      birthYear: null,
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
      recurrence: { frequency: 'none', interval: 1, until: null },
      kind: 'event',
      birthYear: null,
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
