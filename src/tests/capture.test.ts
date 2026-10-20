import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '@/db/db'
import { createBookmark, getVaultBlob, updateBookmark } from '@/db/seed'
import { applyCapture } from '@/lib/capture'
import type { BookmarkCapture, ReaderCapture } from '@/lib/captureProtocol'

beforeEach(async () => {
  await Promise.all(db.tables.map((table) => table.clear()))
})

const bookmarkItem: BookmarkCapture = {
  id: 'capture-1',
  kind: 'bookmark',
  url: 'https://example.com/article',
  title: 'Articolo',
  description: 'Descrizione dal web',
}

describe('captures', () => {
  it('reuses an existing bookmark and fills only empty fields', async () => {
    const existing = await createBookmark({ url: 'https://example.com/article', title: 'Titolo mio' })
    const result = await applyCapture(bookmarkItem)
    expect(result.status).toBe('updated')
    const updated = await db.bookmarks.get(existing.id)
    expect(updated?.title).toBe('Titolo mio')
    expect(updated?.description).toBe('Descrizione dal web')

    const again = await applyCapture(bookmarkItem)
    expect(again.status).toBe('skipped')
    expect(await db.bookmarks.count()).toBe(1)
  })

  it('reuses archived bookmarks without unarchiving them', async () => {
    const existing = await createBookmark({ url: 'https://example.com/article', title: 'Archiviato' })
    await updateBookmark(existing.id, { archived: true })
    await applyCapture({ ...bookmarkItem, title: 'Nuovo titolo', description: '' })
    const updated = await db.bookmarks.get(existing.id)
    expect(updated?.archived).toBe(true)
    expect(updated?.title).toBe('Archiviato')
  })

  it('saves reader content only when empty', async () => {
    const reader: ReaderCapture = {
      id: 'capture-reader',
      kind: 'reader',
      url: 'https://example.com/long-read',
      title: 'Lettura',
      content: 'Testo estratto dalla pagina',
    }
    const first = await applyCapture(reader)
    expect(first.status).toBe('created')
    const bookmark = (await db.bookmarks.toArray()).find((item) => item.url === 'https://example.com/long-read')
    expect(bookmark?.readerContent).toBe('Testo estratto dalla pagina')
    expect(bookmark?.readingStatus).toBe('reading')

    const second = await applyCapture({ ...reader, id: 'capture-reader-2', content: 'Contenuto nuovo' })
    expect(second.status).toBe('skipped')
    expect((await db.bookmarks.get(bookmark?.id ?? ''))?.readerContent).toBe('Testo estratto dalla pagina')
  })

  it('creates notes and todos with the source url', async () => {
    const note = await applyCapture({
      id: 'note-1',
      kind: 'note',
      title: 'Selezione',
      text: 'Testo selezionato',
      sourceUrl: 'https://example.com/source',
    })
    expect(note.status).toBe('created')
    const storedNote = await db.notes.toArray()
    expect(storedNote[0]?.content).toContain('Testo selezionato')
    expect(storedNote[0]?.content).toContain('https://example.com/source')

    const todo = await applyCapture({
      id: 'todo-1',
      kind: 'todo',
      title: 'Da fare',
      notes: 'Dettagli',
      sourceUrl: 'https://example.com/source',
    })
    expect(todo.status).toBe('created')
    const storedTodo = await db.todos.toArray()
    expect(storedTodo[0]?.title).toBe('Da fare')
    expect(storedTodo[0]?.notes).toContain('https://example.com/source')
  })

  it('stores screenshots in the vault', async () => {
    const result = await applyCapture({
      id: 'shot-1',
      kind: 'screenshot',
      dataUrl: 'data:image/png;base64,iVBORw0KGgo=',
      title: 'Screenshot — example.com',
      sourceUrl: 'https://example.com/source',
    })
    expect(result.status).toBe('created')
    const item = await db.vaultItems.toArray()
    expect(item[0]?.category).toBe('Screenshot')
    expect(item[0]?.fileName?.endsWith('.png')).toBe(true)
    const blob = await getVaultBlob(item[0]?.id ?? '')
    expect(blob?.size).toBeGreaterThan(0)
  })

  it('reports invalid urls without crashing', async () => {
    const result = await applyCapture({ ...bookmarkItem, id: 'bad', url: 'javascript:alert(1)' })
    expect(result.status).toBe('error')
  })
})
