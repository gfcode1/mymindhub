import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate'
import { db } from '@/db/db'
import { decryptBackup, encryptBackup, isEncryptedBackup } from '@/lib/crypto'
import { nowIso, uid } from '@/lib/utils'
import {
  backupManifestSchema,
  backupPayloadSchema,
  DEFAULT_SETTINGS,
  whiteboardDataFileSchema,
  type AppSettings,
  type BackupPayload,
  type VaultFile,
  type VaultItem,
  type WhiteboardData,
  type WhiteboardMeta,
  type VoiceNote,
  type VoiceNoteMeta,
} from '@/types/models'

const SCHEMA_VERSION = 11 as const

const VAULT_EXT: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'text/plain': 'txt',
  'text/markdown': 'md',
  'application/json': 'json',
  'application/zip': 'zip',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
}

function vaultExtension(item: VaultItem): string {
  const fromName = item.fileName?.split('.').pop()?.toLowerCase() ?? ''
  if (/^[a-z0-9]{1,8}$/.test(fromName)) return fromName
  return VAULT_EXT[item.mimeType ?? ''] ?? 'bin'
}

const AUDIO_EXT: Record<string, string> = {
  'audio/webm': 'webm',
  'audio/ogg': 'ogg',
  'audio/mp4': 'm4a',
  'audio/aac': 'm4a',
  'audio/wav': 'wav',
  'audio/mpeg': 'mp3',
}

function extensionFor(mimeType: string): string {
  return AUDIO_EXT[mimeType.split(';')[0]?.trim() ?? ''] ?? 'webm'
}

export interface BackupResult {
  blob: Blob
  filename: string
  counts: Record<string, number>
  encrypted: boolean
}

export async function buildBackup(options: { password?: string } = {}): Promise<BackupResult> {
  const [
    notes,
    todos,
    bookmarks,
    events,
    voiceNotes,
    journalEntries,
    habits,
    habitLogs,
    timeEntries,
    links,
    expenses,
    budgets,
    vaultItems,
    vaultFiles,
    whiteboards,
    whiteboardData,
    alarms,
    tags,
    settings,
  ] = await Promise.all([
    db.notes.toArray(),
    db.todos.toArray(),
    db.bookmarks.toArray(),
    db.events.toArray(),
    db.voiceNotes.toArray(),
    db.journalEntries.toArray(),
    db.habits.toArray(),
    db.habitLogs.toArray(),
    db.timeEntries.toArray(),
    db.links.toArray(),
    db.expenses.toArray(),
    db.budgets.toArray(),
    db.vaultItems.toArray(),
    db.vaultFiles.toArray(),
    db.whiteboards.toArray(),
    db.whiteboardData.toArray(),
    db.alarms.toArray(),
    db.tags.toArray(),
    db.settings.get('app'),
  ])

  const aliveNotes = notes.filter((item) => !item.deletedAt)
  const aliveTodos = todos.filter((item) => !item.deletedAt)
  const aliveBookmarks = bookmarks.filter((item) => !item.deletedAt)
  const aliveEvents = events.filter((item) => !item.deletedAt)
  const aliveVoice = voiceNotes.filter((item) => !item.deletedAt)
  const aliveJournal = journalEntries.filter((item) => !item.deletedAt)
  const aliveHabits = habits.filter((item) => !item.deletedAt)
  const aliveHabitLogs = habitLogs.filter((item) => !item.deletedAt)
  const aliveTimeEntries = timeEntries.filter((item) => !item.deletedAt)
  const aliveLinks = links.filter((item) => !item.deletedAt)
  const aliveExpenses = expenses.filter((item) => !item.deletedAt)
  const aliveBudgets = budgets.filter((item) => !item.deletedAt)
  const aliveVaultItems = vaultItems.filter((item) => !item.deletedAt)
  const aliveWhiteboards = whiteboards.filter((item) => !item.deletedAt)
  const aliveAlarms = alarms.filter((item) => !item.deletedAt)

  const counts = {
    notes: aliveNotes.length,
    todos: aliveTodos.length,
    bookmarks: aliveBookmarks.length,
    events: aliveEvents.length,
    voiceNotes: aliveVoice.length,
    journalEntries: aliveJournal.length,
    habits: aliveHabits.length,
    timeEntries: aliveTimeEntries.length,
    links: aliveLinks.length,
    expenses: aliveExpenses.length,
    budgets: aliveBudgets.length,
    vaultItems: aliveVaultItems.length,
    whiteboards: aliveWhiteboards.length,
    alarms: aliveAlarms.length,
    tags: tags.length,
  }

  const payload: BackupPayload = {
    notes: aliveNotes,
    todos: aliveTodos,
    bookmarks: aliveBookmarks,
    events: aliveEvents,
    voiceNotes: aliveVoice.map(({ blob: _blob, ...meta }): VoiceNoteMeta => meta),
    journalEntries: aliveJournal,
    habits: aliveHabits,
    habitLogs: aliveHabitLogs,
    timeEntries: aliveTimeEntries,
    links: aliveLinks,
    expenses: aliveExpenses,
    budgets: aliveBudgets,
    vaultItems: aliveVaultItems,
    whiteboards: aliveWhiteboards,
    alarms: aliveAlarms,
    tags,
    settings: settings ?? null,
  }

  const exportedAt = nowIso()
  const manifest = {
    app: 'binhub' as const,
    schemaVersion: SCHEMA_VERSION,
    exportedAt,
    counts,
  }

  const files: Record<string, Uint8Array> = {
    'manifest.json': strToU8(JSON.stringify(manifest, null, 2)),
    'data.json': strToU8(JSON.stringify(payload, null, 2)),
  }

  for (const voice of aliveVoice) {
    const bytes = new Uint8Array(await voice.blob.arrayBuffer())
    files[`audio/${voice.id}.${extensionFor(voice.mimeType)}`] = bytes
  }

  const vaultFilesById = new Map(vaultFiles.map((file) => [file.id, file]))
  for (const item of aliveVaultItems) {
    if (item.type !== 'file') continue
    const stored = vaultFilesById.get(item.id)
    if (!stored) continue
    files[`vault/${item.id}.${vaultExtension(item)}`] = new Uint8Array(stored.data)
  }

  const whiteboardDataById = new Map(whiteboardData.map((data) => [data.id, data]))
  for (const board of aliveWhiteboards) {
    const data = whiteboardDataById.get(board.id)
    files[`whiteboards/${board.id}.json`] = strToU8(
      JSON.stringify({ strokes: data?.strokes ?? [] }),
    )
  }

  const zipped = zipSync(files, { level: 6 })
  const encrypted = Boolean(options.password)
  const output = encrypted ? await encryptBackup(zipped, options.password ?? '') : zipped
  const extension = encrypted ? 'binhub' : 'zip'
  const filename = `binhub-backup-${exportedAt.slice(0, 10)}.${extension}`
  return {
    blob: new Blob([output as unknown as BlobPart], {
      type: encrypted ? 'application/octet-stream' : 'application/zip',
    }),
    filename,
    counts,
    encrypted,
  }
}

export type ImportMode = 'replace' | 'merge'

export interface ImportResult {
  mode: ImportMode
  imported: Record<string, number>
  skipped: number
}

function newer(incomingUpdatedAt: string, existingUpdatedAt: string): boolean {
  const incoming = Date.parse(incomingUpdatedAt)
  const existing = Date.parse(existingUpdatedAt)
  if (Number.isNaN(incoming)) return true
  if (Number.isNaN(existing)) return true
  return incoming >= existing
}

function audioFileFor(files: Record<string, Uint8Array>, id: string): Uint8Array | null {
  const prefix = `audio/${id}.`
  const key = Object.keys(files).find((name) => name.startsWith(prefix))
  return key ? (files[key] ?? null) : null
}

function vaultFileFor(files: Record<string, Uint8Array>, id: string): Uint8Array | null {
  const prefix = `vault/${id}.`
  const key = Object.keys(files).find((name) => name.startsWith(prefix))
  return key ? (files[key] ?? null) : null
}

export async function importBackup(
  file: File,
  mode: ImportMode,
  password?: string,
): Promise<ImportResult> {
  const original = new Uint8Array(await file.arrayBuffer())
  const bytes = isEncryptedBackup(original)
    ? await decryptBackup(original, password ?? '')
    : original
  let files: Record<string, Uint8Array>
  try {
    files = unzipSync(bytes)
  } catch {
    throw new Error('Il file non è un archivio BinHub valido.')
  }

  const manifestRaw = files['manifest.json']
  const dataRaw = files['data.json']
  if (!manifestRaw || !dataRaw) {
    throw new Error('Backup incompleto: mancano manifest.json o data.json.')
  }

  let manifestJson: unknown
  let dataJson: unknown
  try {
    manifestJson = JSON.parse(strFromU8(manifestRaw))
    dataJson = JSON.parse(strFromU8(dataRaw))
  } catch {
    throw new Error('Backup illeggibile: JSON non valido.')
  }

  const manifest = backupManifestSchema.safeParse(manifestJson)
  if (!manifest.success) {
    throw new Error('Backup non compatibile o versione schema non supportata.')
  }

  const payload = backupPayloadSchema.safeParse(dataJson)
  if (!payload.success) {
    throw new Error('I dati del backup non hanno il formato atteso.')
  }

  const data = payload.data
  const exportedAt = manifest.data.exportedAt
  const imported = {
    notes: 0,
    todos: 0,
    bookmarks: 0,
    events: 0,
    voiceNotes: 0,
    journalEntries: 0,
    habits: 0,
    habitLogs: 0,
    timeEntries: 0,
    links: 0,
    expenses: 0,
    budgets: 0,
    vaultItems: 0,
    whiteboards: 0,
    alarms: 0,
    tags: 0,
  }
  let skipped = 0

  const voices: VoiceNote[] = []
  for (const meta of data.voiceNotes) {
    const audio = audioFileFor(files, meta.id)
    if (!audio) {
      skipped += 1
      continue
    }
    voices.push({
      ...meta,
      blob: new Blob([audio as unknown as BlobPart], { type: meta.mimeType }),
    })
  }

  const whiteboardsToStore: WhiteboardMeta[] = []
  const whiteboardDataToStore: WhiteboardData[] = []
  for (const board of data.whiteboards) {
    const raw = files[`whiteboards/${board.id}.json`]
    if (!raw) {
      skipped += 1
      continue
    }
    try {
      const parsed = whiteboardDataFileSchema.safeParse(JSON.parse(strFromU8(raw)))
      if (!parsed.success) {
        skipped += 1
        continue
      }
      whiteboardsToStore.push(board)
      whiteboardDataToStore.push({ id: board.id, strokes: parsed.data.strokes })
    } catch {
      skipped += 1
    }
  }

  const vaultItemsToStore: VaultItem[] = []
  const vaultFilesToStore: VaultFile[] = []
  for (const item of data.vaultItems) {
    if (item.type === 'file') {
      const bytes = vaultFileFor(files, item.id)
      if (!bytes) {
        skipped += 1
        continue
      }
      vaultFilesToStore.push({
        id: item.id,
        data: bytes.slice().buffer,
        mimeType: item.mimeType ?? 'application/octet-stream',
      })
    }
    vaultItemsToStore.push(item)
  }

  if (mode === 'replace') {
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
        db.settings,
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
        await db.notes.bulkAdd(data.notes)
        await db.todos.bulkAdd(data.todos)
        await db.bookmarks.bulkAdd(data.bookmarks)
        await db.events.bulkAdd(data.events)
        await db.voiceNotes.bulkAdd(voices)
        await db.journalEntries.bulkAdd(data.journalEntries)
        await db.habits.bulkAdd(data.habits)
        await db.habitLogs.bulkAdd(data.habitLogs)
        await db.timeEntries.bulkAdd(data.timeEntries)
        await db.links.bulkAdd(data.links)
        await db.expenses.bulkAdd(data.expenses)
        await db.budgets.bulkAdd(data.budgets)
        await db.vaultItems.bulkAdd(vaultItemsToStore)
        if (vaultFilesToStore.length > 0) await db.vaultFiles.bulkAdd(vaultFilesToStore)
        await db.whiteboards.bulkAdd(whiteboardsToStore)
        if (whiteboardDataToStore.length > 0) await db.whiteboardData.bulkAdd(whiteboardDataToStore)
        await db.alarms.bulkAdd(data.alarms)
        await db.tags.bulkAdd(data.tags)
        const settings: AppSettings = data.settings
          ? { ...data.settings, key: 'app', seeded: true, lastBackupAt: exportedAt }
          : { ...DEFAULT_SETTINGS, lastBackupAt: exportedAt }
        await db.settings.put(settings)
      },
    )
    imported.notes = data.notes.length
    imported.todos = data.todos.length
    imported.bookmarks = data.bookmarks.length
    imported.events = data.events.length
    imported.voiceNotes = voices.length
    imported.journalEntries = data.journalEntries.length
    imported.habits = data.habits.length
    imported.habitLogs = data.habitLogs.length
    imported.timeEntries = data.timeEntries.length
    imported.links = data.links.length
    imported.expenses = data.expenses.length
    imported.budgets = data.budgets.length
    imported.vaultItems = vaultItemsToStore.length
    imported.whiteboards = whiteboardsToStore.length
    imported.alarms = data.alarms.length
    imported.tags = data.tags.length
    return { mode, imported, skipped }
  }

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
      db.settings,
    ],
    async () => {
      for (const item of data.notes) {
        const existing = await db.notes.get(item.id)
        if (existing && !newer(item.updatedAt, existing.updatedAt)) {
          skipped += 1
          continue
        }
        await db.notes.put(item)
        imported.notes += 1
      }
      for (const item of data.todos) {
        const existing = await db.todos.get(item.id)
        if (existing && !newer(item.updatedAt, existing.updatedAt)) {
          skipped += 1
          continue
        }
        await db.todos.put(item)
        imported.todos += 1
      }
      for (const item of data.bookmarks) {
        const existing = await db.bookmarks.get(item.id)
        if (existing && !newer(item.updatedAt, existing.updatedAt)) {
          skipped += 1
          continue
        }
        await db.bookmarks.put(item)
        imported.bookmarks += 1
      }
      for (const item of data.events) {
        const existing = await db.events.get(item.id)
        if (existing && !newer(item.updatedAt, existing.updatedAt)) {
          skipped += 1
          continue
        }
        await db.events.put(item)
        imported.events += 1
      }
      for (const item of voices) {
        const existing = await db.voiceNotes.get(item.id)
        if (existing && !newer(item.updatedAt, existing.updatedAt)) {
          skipped += 1
          continue
        }
        await db.voiceNotes.put(item)
        imported.voiceNotes += 1
      }
      for (const entry of data.journalEntries) {
        const existing = await db.journalEntries.where('date').equals(entry.date).first()
        if (existing && !newer(entry.updatedAt, existing.updatedAt)) {
          skipped += 1
          continue
        }
        await db.journalEntries.put(entry)
        imported.journalEntries += 1
      }
      for (const habit of data.habits) {
        const existing = await db.habits.get(habit.id)
        if (existing && !newer(habit.updatedAt, existing.updatedAt)) {
          skipped += 1
          continue
        }
        await db.habits.put(habit)
        imported.habits += 1
      }
      for (const log of data.habitLogs) {
        const existing = await db.habitLogs.where('[habitId+date]').equals([log.habitId, log.date]).first()
        if (existing && !newer(log.updatedAt, existing.updatedAt)) {
          skipped += 1
          continue
        }
        await db.habitLogs.put(log)
        imported.habitLogs += 1
      }
      for (const entry of data.timeEntries) {
        const existing = await db.timeEntries.get(entry.id)
        if (existing && !newer(entry.updatedAt, existing.updatedAt)) {
          skipped += 1
          continue
        }
        await db.timeEntries.put(entry)
        imported.timeEntries += 1
      }
      for (const link of data.links) {
        const existing = await db.links.get(link.id)
        if (existing && !newer(link.updatedAt, existing.updatedAt)) {
          skipped += 1
          continue
        }
        await db.links.put(link)
        imported.links += 1
      }
      for (const expense of data.expenses) {
        const existing = await db.expenses.get(expense.id)
        if (existing && !newer(expense.updatedAt, existing.updatedAt)) {
          skipped += 1
          continue
        }
        await db.expenses.put(expense)
        imported.expenses += 1
      }
      for (const budget of data.budgets) {
        const existing = await db.budgets.where('category').equals(budget.category).first()
        if (existing && !newer(budget.updatedAt, existing.updatedAt)) {
          skipped += 1
          continue
        }
        await db.budgets.put(existing ? { ...budget, id: existing.id } : budget)
        imported.budgets += 1
      }
      for (const item of vaultItemsToStore) {
        const existing = await db.vaultItems.get(item.id)
        if (existing && !newer(item.updatedAt, existing.updatedAt)) {
          skipped += 1
          continue
        }
        await db.vaultItems.put(item)
        const stored = vaultFilesToStore.find((file) => file.id === item.id)
        if (stored) await db.vaultFiles.put(stored)
        imported.vaultItems += 1
      }
      for (const board of whiteboardsToStore) {
        const existing = await db.whiteboards.get(board.id)
        if (existing && !newer(board.updatedAt, existing.updatedAt)) {
          skipped += 1
          continue
        }
        await db.whiteboards.put(board)
        const data = whiteboardDataToStore.find((item) => item.id === board.id)
        if (data) await db.whiteboardData.put(data)
        imported.whiteboards += 1
      }
      for (const alarm of data.alarms) {
        const existing = await db.alarms.get(alarm.id)
        if (existing && !newer(alarm.updatedAt, existing.updatedAt)) {
          skipped += 1
          continue
        }
        await db.alarms.put(alarm)
        imported.alarms += 1
      }
      for (const tag of data.tags) {
        const existing = await db.tags.where('name').equals(tag.name).first()
        if (existing) {
          skipped += 1
          continue
        }
        await db.tags.put({ ...tag, id: tag.id || uid() })
        imported.tags += 1
      }
      const settings = await db.settings.get('app')
      if (!settings) {
        await db.settings.put({ ...DEFAULT_SETTINGS, lastBackupAt: exportedAt })
      } else if (!settings.lastBackupAt || settings.lastBackupAt < exportedAt) {
        await db.settings.put({ ...settings, lastBackupAt: exportedAt })
      }
    },
  )

  return { mode, imported, skipped }
}
