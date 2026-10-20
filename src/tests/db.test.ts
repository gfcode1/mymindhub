import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '@/db/db'
import {
  createAlarm,
  createBookmark,
  createEntityLink,
  createEvent,
  createExpense,
  createHabit,
  createNote,
  createTimeEntry,
  createVaultChecklist,
  createVaultFile,
  createWhiteboard,
  getVaultBlob,
  getWhiteboardData,
  saveWhiteboardStrokes,
  createTodo,
  deleteAlarm,
  deleteEntityLink,
  deleteNote,
  restoreAlarm,
  restoreEntityLink,
  restoreNote,
  markAlarmTriggered,
  saveJournalEntry,
  setBudget,
  toggleHabitLog,
  toggleTodo,
  updateAlarm,
  updateBookmark,
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

  it('stores reader content and status in a backup', async () => {
    const bookmark = await createBookmark({ url: 'https://example.com/article' })
    expect(bookmark.readingStatus).toBe('to-read')
    await updateBookmark(bookmark.id, {
      readerContent: 'Testo estratto dall’articolo',
      readerUpdatedAt: '2026-10-20T10:00:00.000Z',
      readingStatus: 'reading',
    })

    const backup = await buildBackup()
    await Promise.all(db.tables.map((table) => table.clear()))
    const file = new File([backup.blob], backup.filename, { type: 'application/zip' })
    await importBackup(file, 'replace')

    const restored = await db.bookmarks.get(bookmark.id)
    expect(restored?.readerContent).toBe('Testo estratto dall’articolo')
    expect(restored?.readingStatus).toBe('reading')
  })

  it('creates events', async () => {
    const event = await createEvent({
      title: 'Riunione',
      start: '2026-10-19T09:00',
      end: '2026-10-19T10:00',
    })
    expect((await db.events.get(event.id))?.title).toBe('Riunione')
  })

  it('normalizes birthdays to yearly all-day events', async () => {
    const event = await createEvent({
      title: 'Compleanno di Ada',
      start: '1990-01-08T09:00',
      end: '1990-01-08T10:00',
      kind: 'birthday',
      birthYear: 1990,
    })
    expect(event.kind).toBe('birthday')
    expect(event.allDay).toBe(true)
    expect(event.recurrence.frequency).toBe('yearly')
    expect(event.birthYear).toBe(1990)
  })

  it('exports and imports an encrypted backup', async () => {
    await createNote({ title: 'Segreta', content: 'top secret' })
    const backup = await buildBackup({ password: 'password123' })
    expect(backup.encrypted).toBe(true)
    expect(backup.filename.endsWith('.binhub')).toBe(true)

    await Promise.all(db.tables.map((table) => table.clear()))
    const file = new File([backup.blob], backup.filename, { type: 'application/octet-stream' })
    await importBackup(file, 'replace', 'password123')
    expect((await db.notes.toArray())[0]?.title).toBe('Segreta')
  })

  it('stores alarms and keeps them in a backup', async () => {
    const alarm = await createAlarm({
      label: 'Medicina',
      time: '08:00',
      days: [1, 2, 3, 4, 5],
    })
    await updateAlarm(alarm.id, { enabled: false })
    expect((await db.alarms.get(alarm.id))?.enabled).toBe(false)

    await markAlarmTriggered(alarm.id, '2026-10-20T08:00:00.000Z')
    expect((await db.alarms.get(alarm.id))?.lastTriggeredAt).toBe(
      '2026-10-20T08:00:00.000Z',
    )

    await deleteAlarm(alarm.id)
    expect((await db.alarms.get(alarm.id))?.deletedAt).not.toBeNull()
    await restoreAlarm(alarm.id)

    const backup = await buildBackup()
    expect(backup.counts.alarms).toBe(1)
    await Promise.all(db.tables.map((table) => table.clear()))
    const file = new File([backup.blob], backup.filename, { type: 'application/zip' })
    await importBackup(file, 'replace')
    expect((await db.alarms.get(alarm.id))?.label).toBe('Medicina')
  })

  it('stores whiteboards and strokes and keeps them in a backup', async () => {
    const board = await createWhiteboard('Idee')
    await saveWhiteboardStrokes(board.id, [
      {
        id: 'stroke-1',
        color: '#111827',
        width: 4,
        tool: 'pen',
        points: [
          { x: 10, y: 20 },
          { x: 30, y: 40 },
        ],
      },
    ])

    expect((await db.whiteboards.get(board.id))?.strokeCount).toBe(1)
    expect((await getWhiteboardData(board.id))?.strokes).toHaveLength(1)

    const backup = await buildBackup()
    expect(backup.counts.whiteboards).toBe(1)
    await Promise.all(db.tables.map((table) => table.clear()))
    const file = new File([backup.blob], backup.filename, { type: 'application/zip' })
    await importBackup(file, 'replace')

    expect((await db.whiteboards.get(board.id))?.title).toBe('Idee')
    expect((await getWhiteboardData(board.id))?.strokes[0]?.points).toHaveLength(2)
  })

  it('stores vault files and checklists and keeps them in a backup', async () => {
    const file = new File(['ciao vault'], 'nota.txt', { type: 'text/plain' })
    const vaultFile = await createVaultFile({ file, category: 'Documenti' })
    const checklist = await createVaultChecklist({
      title: 'Valigia',
      category: 'Viaggi',
      items: ['Passaporto', 'Caricabatterie'],
    })

    const stored = await getVaultBlob(vaultFile.id)
    expect(stored).toBeTruthy()
    expect(stored?.size).toBe(file.size)
    expect(checklist.items).toHaveLength(2)

    const backup = await buildBackup()
    expect(backup.counts.vaultItems).toBe(2)
    await Promise.all(db.tables.map((table) => table.clear()))
    const backupFile = new File([backup.blob], backup.filename, { type: 'application/zip' })
    await importBackup(backupFile, 'replace')

    expect((await db.vaultItems.get(vaultFile.id))?.fileName).toBe('nota.txt')
    expect((await db.vaultItems.get(checklist.id))?.items).toHaveLength(2)
    expect((await getVaultBlob(vaultFile.id))?.size).toBe(file.size)
  })

  it('stores expenses and budgets and keeps them in a backup', async () => {
    const expense = await createExpense({
      description: 'Pranzo',
      amountCents: 1250,
      category: 'Cibo',
      date: '2026-10-20',
    })
    await setBudget('', 50000)
    await setBudget('Cibo', 20000)

    expect((await db.expenses.get(expense.id))?.amountCents).toBe(1250)
    expect(await db.budgets.where('category').equals('').first()).toBeTruthy()
    expect((await db.budgets.where('category').equals('Cibo').first())?.amountCents).toBe(20000)

    const backup = await buildBackup()
    expect(backup.counts.expenses).toBe(1)
    expect(backup.counts.budgets).toBe(2)
    await Promise.all(db.tables.map((table) => table.clear()))
    const file = new File([backup.blob], backup.filename, { type: 'application/zip' })
    await importBackup(file, 'replace')

    expect((await db.expenses.get(expense.id))?.description).toBe('Pranzo')
    expect((await db.budgets.where('category').equals('Cibo').first())?.amountCents).toBe(20000)
  })

  it('creates, deduplicates and restores entity links', async () => {
    const note = await createNote({ title: 'Nota A' })
    const todo = await createTodo({ title: 'Todo B' })
    const first = await createEntityLink({
      sourceType: 'note',
      sourceId: note.id,
      targetType: 'todo',
      targetId: todo.id,
    })
    const duplicate = await createEntityLink({
      sourceType: 'note',
      sourceId: note.id,
      targetType: 'todo',
      targetId: todo.id,
    })
    expect(first).not.toBeNull()
    expect(duplicate?.id).toBe(first?.id)

    if (!first) throw new Error('link not created')
    await deleteEntityLink(first.id)
    expect((await db.links.get(first.id))?.deletedAt).not.toBeNull()
    await restoreEntityLink(first.id)
    expect((await db.links.get(first.id))?.deletedAt).toBeNull()
  })

  it('keeps links in a backup roundtrip', async () => {
    const note = await createNote({ title: 'Nota A' })
    const todo = await createTodo({ title: 'Todo B' })
    const link = await createEntityLink({
      sourceType: 'note',
      sourceId: note.id,
      targetType: 'todo',
      targetId: todo.id,
    })
    const backup = await buildBackup()
    expect(backup.counts.links).toBe(1)
    await Promise.all(db.tables.map((table) => table.clear()))
    const file = new File([backup.blob], backup.filename, { type: 'application/zip' })
    await importBackup(file, 'replace')
    expect((await db.links.get(link?.id ?? ''))?.targetId).toBe(todo.id)
  })

  it('keeps time entries in a backup roundtrip', async () => {
    const entry = await createTimeEntry({
      label: 'Focus',
      category: 'Lavoro',
      startedAt: '2026-10-20T09:00:00.000Z',
      endedAt: '2026-10-20T09:25:00.000Z',
      durationSec: 1500,
      mode: 'pomodoro',
    })
    const backup = await buildBackup()
    expect(backup.counts.timeEntries).toBe(1)
    await Promise.all(db.tables.map((table) => table.clear()))
    const file = new File([backup.blob], backup.filename, { type: 'application/zip' })
    await importBackup(file, 'replace')
    expect((await db.timeEntries.get(entry.id))?.durationSec).toBe(1500)
  })

  it('keeps recurrence in a backup roundtrip', async () => {
    const event = await createEvent({
      title: 'Revisione bisettimanale',
      start: '2026-01-05T09:00',
      end: '2026-01-05T10:00',
      recurrence: { frequency: 'weekly', interval: 2, until: null },
    })
    const backup = await buildBackup()
    await Promise.all(db.tables.map((table) => table.clear()))
    const file = new File([backup.blob], backup.filename, { type: 'application/zip' })
    await importBackup(file, 'replace')

    const restored = await db.events.get(event.id)
    expect(restored?.recurrence.frequency).toBe('weekly')
    expect(restored?.recurrence.interval).toBe(2)
  })

  it('upserts a journal entry by date', async () => {
    await saveJournalEntry('2026-10-20', { done: 'Prima' })
    const updated = await saveJournalEntry('2026-10-20', { reflection: 'Riflessione' })
    expect(updated.done).toBe('Prima')
    expect(updated.reflection).toBe('Riflessione')
    expect(await db.journalEntries.count()).toBe(1)
  })

  it('toggles habit logs', async () => {
    const habit = await createHabit({ name: 'Camminare' })
    await toggleHabitLog(habit.id, '2026-10-20')
    expect(await db.habitLogs.count()).toBe(1)
    await toggleHabitLog(habit.id, '2026-10-20')
    const log = await db.habitLogs.toArray()
    expect(log[0]?.deletedAt).not.toBeNull()
  })

  it('exports and restores a backup', async () => {
    await createNote({ title: 'Da salvare', content: 'test' })
    await createTodo({ title: 'Todo backup' })
    const habit = await createHabit({ name: 'Lettura' })
    await toggleHabitLog(habit.id, '2026-10-20')
    await saveJournalEntry('2026-10-20', { done: 'Fatto' })
    const backup = await buildBackup()
    expect(backup.counts.notes).toBe(1)
    expect(backup.counts.todos).toBe(1)
    expect(backup.counts.habits).toBe(1)
    expect(backup.counts.journalEntries).toBe(1)

    await Promise.all(db.tables.map((table) => table.clear()))
    const file = new File([backup.blob], backup.filename, { type: 'application/zip' })
    const result = await importBackup(file, 'replace')

    expect(result.imported.notes).toBe(1)
    expect(result.imported.todos).toBe(1)
    expect(result.imported.habits).toBe(1)
    expect(result.imported.habitLogs).toBe(1)
    expect(result.imported.journalEntries).toBe(1)
    expect((await db.notes.toArray())[0]?.title).toBe('Da salvare')
  })
})
