import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import MiniSearch from 'minisearch'
import { db } from '@/db/db'
import { DEFAULT_SETTINGS, type AppSettings } from '@/types/models'
import type {
  Alarm,
  Bookmark,
  Budget,
  CalendarEvent,
  Expense,
  Habit,
  HabitLog,
  JournalEntry,
  Note,
  TimeEntry,
  Todo,
  VaultItem,
  VoiceNote,
  WhiteboardMeta,
} from '@/types/models'

export function useSettings(): { settings: AppSettings; loaded: boolean } {
  const settings = useLiveQuery(() => db.settings.get('app'), [])
  return { settings: settings ?? DEFAULT_SETTINGS, loaded: settings !== undefined }
}

export function useNotes(options: { archived?: boolean } = {}): Note[] {
  const archived = options.archived ?? false
  return (
    useLiveQuery(
      async () => {
        const all = await db.notes.toArray()
        return all
          .filter((note) => !note.deletedAt && note.archived === archived)
          .sort((a, b) => {
            if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
            return Date.parse(b.updatedAt) - Date.parse(a.updatedAt)
          })
      },
      [archived],
      [],
    ) ?? []
  )
}

export function useNote(id: string | undefined): Note | null | undefined {
  return useLiveQuery(() => (id ? db.notes.get(id) : undefined), [id])
}

export function useTodos(): Todo[] {
  return (
    useLiveQuery(
      async () => {
        const all = await db.todos.toArray()
        const priorityWeight = { high: 0, normal: 1, low: 2 } as const
        return all
          .filter((todo) => !todo.deletedAt)
          .sort((a, b) => {
            if (a.done !== b.done) return a.done ? 1 : -1
            if (a.dueDate && b.dueDate && a.dueDate !== b.dueDate) {
              return a.dueDate.localeCompare(b.dueDate)
            }
            if (a.dueDate && !b.dueDate) return -1
            if (!a.dueDate && b.dueDate) return 1
            if (a.priority !== b.priority) {
              return priorityWeight[a.priority] - priorityWeight[b.priority]
            }
            return Date.parse(b.createdAt) - Date.parse(a.createdAt)
          })
      },
      [],
      [],
    ) ?? []
  )
}

export function useBookmark(id: string | undefined): Bookmark | null | undefined {
  return useLiveQuery(() => (id ? db.bookmarks.get(id) : undefined), [id])
}

export function useBookmarks(options: { archived?: boolean } = {}): Bookmark[] {
  const archived = options.archived ?? false
  return (
    useLiveQuery(
      async () => {
        const all = await db.bookmarks.toArray()
        return all
          .filter((bookmark) => !bookmark.deletedAt && bookmark.archived === archived)
          .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
      },
      [archived],
      [],
    ) ?? []
  )
}

export function useEvents(): CalendarEvent[] {
  return (
    useLiveQuery(
      async () => {
        const all = await db.events.toArray()
        return all
          .filter((event) => !event.deletedAt)
          .sort((a, b) => Date.parse(a.start) - Date.parse(b.start))
      },
      [],
      [],
    ) ?? []
  )
}

export function useVoiceNotes(): VoiceNote[] {
  return (
    useLiveQuery(
      async () => {
        const all = await db.voiceNotes.toArray()
        return all
          .filter((voice) => !voice.deletedAt)
          .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
      },
      [],
      [],
    ) ?? []
  )
}

export function useJournalEntries(): JournalEntry[] {
  return (
    useLiveQuery(
      async () => {
        const all = await db.journalEntries.toArray()
        return all
          .filter((entry) => !entry.deletedAt)
          .sort((a, b) => b.date.localeCompare(a.date))
      },
      [],
      [],
    ) ?? []
  )
}

export function useJournalEntry(date: string): JournalEntry | null {
  const entries = useJournalEntries()
  return entries.find((entry) => entry.date === date) ?? null
}

export function useHabits(): Habit[] {
  return (
    useLiveQuery(
      async () => {
        const all = await db.habits.toArray()
        return all
          .filter((habit) => !habit.deletedAt)
          .sort((a, b) => {
            if (a.archived !== b.archived) return a.archived ? 1 : -1
            return a.createdAt.localeCompare(b.createdAt)
          })
      },
      [],
      [],
    ) ?? []
  )
}

export function useHabitLogs(): HabitLog[] {
  return (
    useLiveQuery(
      async () => {
        const all = await db.habitLogs.toArray()
        return all.filter((log) => !log.deletedAt)
      },
      [],
      [],
    ) ?? []
  )
}

export function useAlarms(): Alarm[] {
  return (
    useLiveQuery(
      async () => {
        const all = await db.alarms.toArray()
        return all
          .filter((alarm) => !alarm.deletedAt)
          .sort((a, b) => a.time.localeCompare(b.time))
      },
      [],
      [],
    ) ?? []
  )
}

export function useWhiteboards(): WhiteboardMeta[] {
  return (
    useLiveQuery(
      async () => {
        const all = await db.whiteboards.toArray()
        return all
          .filter((board) => !board.deletedAt)
          .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      },
      [],
      [],
    ) ?? []
  )
}

export function useWhiteboard(id: string | undefined): WhiteboardMeta | null | undefined {
  return useLiveQuery(() => (id ? db.whiteboards.get(id) : undefined), [id])
}

export function useVaultItems(): VaultItem[] {
  return (
    useLiveQuery(
      async () => {
        const all = await db.vaultItems.toArray()
        return all
          .filter((item) => !item.deletedAt)
          .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      },
      [],
      [],
    ) ?? []
  )
}

export function useExpenses(): Expense[] {
  return (
    useLiveQuery(
      async () => {
        const all = await db.expenses.toArray()
        return all
          .filter((expense) => !expense.deletedAt)
          .sort((a, b) => {
            if (a.date !== b.date) return b.date.localeCompare(a.date)
            return b.createdAt.localeCompare(a.createdAt)
          })
      },
      [],
      [],
    ) ?? []
  )
}

export function useBudgets(): Budget[] {
  return (
    useLiveQuery(
      async () => {
        const all = await db.budgets.toArray()
        return all
          .filter((budget) => !budget.deletedAt)
          .sort((a, b) => a.category.localeCompare(b.category))
      },
      [],
      [],
    ) ?? []
  )
}

export function useTimeEntries(): TimeEntry[] {
  return (
    useLiveQuery(
      async () => {
        const all = await db.timeEntries.toArray()
        return all
          .filter((entry) => !entry.deletedAt)
          .sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt))
      },
      [],
      [],
    ) ?? []
  )
}

export function useTags() {
  return (
    useLiveQuery(async () => {
      const all = await db.tags.toArray()
      return all.sort((a, b) => a.name.localeCompare(b.name))
    }, []) ?? []
  )
}

export function useOnline(): boolean {
  const [online, setOnline] = useState(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine,
  )
  useEffect(() => {
    const handleOnline = () => setOnline(true)
    const handleOffline = () => setOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])
  return online
}

export interface SearchHit {
  id: string
  type: 'note' | 'todo' | 'bookmark' | 'event' | 'voice' | 'journal' | 'habit'
  title: string
  subtitle: string
  href: string
  tags: string[]
}

interface SearchDoc {
  uid: string
  id: string
  type: SearchHit['type']
  title: string
  body: string
  tags: string
  subtitle: string
  href: string
}

export function useGlobalSearch(query: string): SearchHit[] {
  const notes = useNotes({ archived: false })
  const todos = useTodos()
  const bookmarks = useBookmarks({ archived: false })
  const events = useEvents()
  const voices = useVoiceNotes()
  const journals = useJournalEntries()
  const habits = useHabits()

  const index = useMemo(() => {
    const docs: SearchDoc[] = []
    for (const note of notes) {
      docs.push({
        uid: `note:${note.id}`,
        id: note.id,
        type: 'note',
        title: note.title || 'Nota senza titolo',
        body: note.content,
        tags: note.tags.join(' '),
        subtitle: note.content.replace(/[#>*_`-]/g, '').slice(0, 120),
        href: `/notes/${note.id}`,
      })
    }
    for (const todo of todos) {
      docs.push({
        uid: `todo:${todo.id}`,
        id: todo.id,
        type: 'todo',
        title: todo.title,
        body: `${todo.notes} ${todo.subtasks.map((sub) => sub.title).join(' ')}`,
        tags: todo.tags.join(' '),
        subtitle: todo.done ? 'Completato' : todo.dueDate ? `Scade ${todo.dueDate}` : 'Senza scadenza',
        href: '/todos',
      })
    }
    for (const bookmark of bookmarks) {
      docs.push({
        uid: `bookmark:${bookmark.id}`,
        id: bookmark.id,
        type: 'bookmark',
        title: bookmark.title,
        body: `${bookmark.url} ${bookmark.description} ${bookmark.readerContent}`,
        tags: bookmark.tags.join(' '),
        subtitle: bookmark.url,
        href: '/bookmarks',
      })
    }
    for (const event of events) {
      docs.push({
        uid: `event:${event.id}`,
        id: event.id,
        type: 'event',
        title: event.title,
        body: `${event.description} ${event.location}`,
        tags: '',
        subtitle: event.start,
        href: '/calendar',
      })
    }
    for (const entry of journals) {
      docs.push({
        uid: `journal:${entry.id}`,
        id: entry.id,
        type: 'journal',
        title: entry.date,
        body: `${entry.done} ${entry.blockers} ${entry.reflection}`,
        tags: '',
        subtitle: entry.done || entry.reflection || entry.blockers,
        href: '/journal',
      })
    }
    for (const habit of habits) {
      docs.push({
        uid: `habit:${habit.id}`,
        id: habit.id,
        type: 'habit',
        title: habit.name,
        body: '',
        tags: '',
        subtitle: habit.schedule === 'daily' ? 'Daily' : 'Weekly',
        href: '/habits',
      })
    }
    for (const voice of voices) {
      docs.push({
        uid: `voice:${voice.id}`,
        id: voice.id,
        type: 'voice',
        title: voice.title,
        body: voice.transcript ?? '',
        tags: voice.tags.join(' '),
        subtitle: 'Nota vocale',
        href: '/voice',
      })
    }
    const mini = new MiniSearch<SearchDoc>({
      fields: ['title', 'body', 'tags'],
      storeFields: ['id', 'type', 'title', 'subtitle', 'href', 'tags'],
      searchOptions: {
        boost: { title: 3, tags: 2 },
        fuzzy: 0.2,
        prefix: true,
        combineWith: 'AND',
      },
    })
    mini.addAll(docs)
    return mini
  }, [notes, todos, bookmarks, events, voices, journals, habits])

  return useMemo(() => {
    const trimmed = query.trim()
    if (trimmed.length < 2) return []
    return index.search(trimmed).slice(0, 40).map((result) => ({
      id: String(result.id),
      type: result.type as SearchHit['type'],
      title: String(result.title),
      subtitle: String(result.subtitle ?? ''),
      href: String(result.href),
      tags: String(result.tags ?? '')
        .split(' ')
        .filter(Boolean),
    }))
  }, [index, query])
}
