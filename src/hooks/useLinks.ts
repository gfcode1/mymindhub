import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/db'
import { useI18n } from '@/hooks/useI18n'
import {
  useBookmarks,
  useEvents,
  useNotes,
  useTodos,
  useVoiceNotes,
} from '@/hooks/useData'
import type { LinkTarget } from '@/lib/links'
import { hostnameOf } from '@/lib/utils'
import type { EntityLink } from '@/types/models'

export function useLinks(): EntityLink[] {
  return (
    useLiveQuery(
      async () => {
        const all = await db.links.toArray()
        return all
          .filter((link) => !link.deletedAt)
          .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      },
      [],
      [],
    ) ?? []
  )
}

export function useLinkTargets(): LinkTarget[] {
  const notesActive = useNotes({ archived: false })
  const notesArchived = useNotes({ archived: true })
  const todos = useTodos()
  const bookmarksActive = useBookmarks({ archived: false })
  const bookmarksArchived = useBookmarks({ archived: true })
  const events = useEvents()
  const voices = useVoiceNotes()
  const { t } = useI18n()

  return useMemo(() => {
    const targets: LinkTarget[] = []
    for (const note of [...notesActive, ...notesArchived]) {
      targets.push({
        type: 'note',
        id: note.id,
        title: note.title || t('notes.untitled'),
        subtitle: t('search.typeNote'),
        href: `/notes/${note.id}`,
      })
    }
    for (const todo of todos) {
      targets.push({
        type: 'todo',
        id: todo.id,
        title: todo.title,
        subtitle: t('search.typeTodo'),
        href: '/todos',
      })
    }
    for (const bookmark of [...bookmarksActive, ...bookmarksArchived]) {
      targets.push({
        type: 'bookmark',
        id: bookmark.id,
        title: bookmark.title || hostnameOf(bookmark.url),
        subtitle: hostnameOf(bookmark.url),
        href: '/bookmarks',
      })
    }
    for (const event of events) {
      targets.push({
        type: 'event',
        id: event.id,
        title: event.title,
        subtitle: t('search.typeEvent'),
        href: '/calendar',
      })
    }
    for (const voice of voices) {
      targets.push({
        type: 'voice',
        id: voice.id,
        title: voice.title,
        subtitle: t('search.typeVoice'),
        href: '/voice',
      })
    }
    return targets
  }, [
    notesActive,
    notesArchived,
    todos,
    bookmarksActive,
    bookmarksArchived,
    events,
    voices,
    t,
  ])
}
