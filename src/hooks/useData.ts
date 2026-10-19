import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import MiniSearch from 'minisearch'
import { db } from '@/db/db'
import { DEFAULT_SETTINGS, type AppSettings } from '@/types/models'
import type { Bookmark, CalendarEvent, Note, Todo, VoiceNote } from '@/types/models'

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
  type: 'note' | 'todo' | 'bookmark' | 'event' | 'voice'
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
        body: `${bookmark.url} ${bookmark.description}`,
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
  }, [notes, todos, bookmarks, events, voices])

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
