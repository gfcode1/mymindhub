import { describe, expect, it } from 'vitest'
import { resolveEntityLinks, type LinkTarget } from '@/lib/links'
import type { EntityLink } from '@/types/models'

function link(overrides: Partial<EntityLink> = {}): EntityLink {
  return {
    id: 'link-1',
    sourceType: 'note',
    sourceId: 'note-a',
    targetType: 'todo',
    targetId: 'todo-b',
    createdAt: '2026-10-20T09:00:00.000Z',
    updatedAt: '2026-10-20T09:00:00.000Z',
    deletedAt: null,
    ...overrides,
  }
}

const targets: LinkTarget[] = [
  { type: 'note', id: 'note-a', title: 'Alfa', subtitle: 'Nota', href: '/notes/note-a' },
  { type: 'todo', id: 'todo-b', title: 'Beta', subtitle: 'Todo', href: '/todos' },
  { type: 'bookmark', id: 'bookmark-c', title: 'Gamma', subtitle: 'Link', href: '/bookmarks' },
]

describe('entity links', () => {
  it('resolves outgoing and incoming directions', () => {
    const links = [link()]
    const fromNote = resolveEntityLinks(links, targets, 'note', 'note-a')
    expect(fromNote.outgoing).toHaveLength(1)
    expect(fromNote.outgoing[0]?.target.title).toBe('Beta')
    expect(fromNote.incoming).toHaveLength(0)

    const fromTodo = resolveEntityLinks(links, targets, 'todo', 'todo-b')
    expect(fromTodo.incoming).toHaveLength(1)
    expect(fromTodo.incoming[0]?.target.title).toBe('Alfa')
  })

  it('hides links to missing entities and ignores deleted links', () => {
    const links = [
      link({ id: 'orphan', targetId: 'missing' }),
      link({ id: 'deleted', deletedAt: '2026-10-21T09:00:00.000Z' }),
    ]
    const groups = resolveEntityLinks(links, targets, 'note', 'note-a')
    expect(groups.outgoing).toHaveLength(0)
  })

  it('deduplicates reciprocal links', () => {
    const links = [
      link({ id: 'forward' }),
      link({
        id: 'reverse',
        sourceType: 'todo',
        sourceId: 'todo-b',
        targetType: 'note',
        targetId: 'note-a',
      }),
    ]
    const groups = resolveEntityLinks(links, targets, 'note', 'note-a')
    expect(groups.outgoing).toHaveLength(1)
    expect(groups.incoming).toHaveLength(0)
  })
})
