import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '@/db/db'
import {
  createBookmark,
  createEvent,
  createNote,
  createTodo,
  deleteNote,
  restoreNote,
  toggleTodo,
  updateNote,
} from '@/db/seed'
import { buildBackup, importBackup } from '@/db/backup'

beforeEach(async () => {
  await Promise.all(db.tables.map((table) => table.clear()))
})

describe('database', () => {
  it('creates and updates a note', async () => {
    const note = await createNote({ title: '  Idee ', content: 'contenuto', tags: ['Lavoro'] })
    expect(note.title).toBe('Idee')
    expect(note.tags).toEqual(['lavoro'])

    await updateNote(note.id, { title: 'Idee nuove', pinned: true })
    const updated = await db.notes.get(note.id)
    expect(updated?.title).toBe('Idee nuove')
    expect(updated?.pinned).toBe(true)
    expect(updated?.updatedAt).toBeDefined()
    expect((updated?.updatedAt ?? '') >= note.updatedAt).toBe(true)
  })

  it('soft deletes and restores a note', async () => {
    const note = await createNote({ title: 'Temporanea' })
    await deleteNote(note.id)
    expect((await db.notes.get(note.id))?.deletedAt).not.toBeNull()
    await restoreNote(note.id)
    expect((await db.notes.get(note.id))?.deletedAt).toBeNull()
  })

  it('toggles a todo and keeps subtasks', async () => {
    const todo = await createTodo({
      title: 'Fare la spesa',
      subtasks: [{ id: 'a', title: 'Pane', done: false }],
    })
    await toggleTodo(todo.id)
    const updated = await db.todos.get(todo.id)
    expect(updated?.done).toBe(true)
    expect(updated?.subtasks).toHaveLength(1)
  })

  it('normalizes bookmark urls and registers tags', async () => {
    const bookmark = await createBookmark({ url: 'https://example.com', tags: ['Letture'] })
    expect(bookmark.tags).toEqual(['letture'])
    const tag = await db.tags.where('name').equals('letture').first()
    expect(tag).toBeTruthy()
  })

  it('creates events', async () => {
    const event = await createEvent({
      title: 'Riunione',
      start: '2026-10-19T09:00',
      end: '2026-10-19T10:00',
    })
    expect((await db.events.get(event.id))?.title).toBe('Riunione')
  })

  it('exports and restores a backup', async () => {
    await createNote({ title: 'Da salvare', content: 'test' })
    await createTodo({ title: 'Todo backup' })
    const backup = await buildBackup()
    expect(backup.counts.notes).toBe(1)
    expect(backup.counts.todos).toBe(1)

    await Promise.all(db.tables.map((table) => table.clear()))
    const file = new File([backup.blob], backup.filename, { type: 'application/zip' })
    const result = await importBackup(file, 'replace')

    expect(result.imported.notes).toBe(1)
    expect(result.imported.todos).toBe(1)
    expect((await db.notes.toArray())[0]?.title).toBe('Da salvare')
  })
})
