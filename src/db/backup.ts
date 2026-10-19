import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate'
import { db } from '@/db/db'
import { nowIso, uid } from '@/lib/utils'
import {
  backupManifestSchema,
  backupPayloadSchema,
  DEFAULT_SETTINGS,
  type AppSettings,
  type BackupPayload,
  type VoiceNote,
  type VoiceNoteMeta,
} from '@/types/models'

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
}

export async function buildBackup(): Promise<BackupResult> {
  const [notes, todos, bookmarks, events, voiceNotes, tags, settings] = await Promise.all([
    db.notes.toArray(),
    db.todos.toArray(),
    db.bookmarks.toArray(),
    db.events.toArray(),
    db.voiceNotes.toArray(),
    db.tags.toArray(),
    db.settings.get('app'),
  ])

  const aliveNotes = notes.filter((item) => !item.deletedAt)
  const aliveTodos = todos.filter((item) => !item.deletedAt)
  const aliveBookmarks = bookmarks.filter((item) => !item.deletedAt)
  const aliveEvents = events.filter((item) => !item.deletedAt)
  const aliveVoice = voiceNotes.filter((item) => !item.deletedAt)

  const counts = {
    notes: aliveNotes.length,
    todos: aliveTodos.length,
    bookmarks: aliveBookmarks.length,
    events: aliveEvents.length,
    voiceNotes: aliveVoice.length,
    tags: tags.length,
  }

  const payload: BackupPayload = {
    notes: aliveNotes,
    todos: aliveTodos,
    bookmarks: aliveBookmarks,
    events: aliveEvents,
    voiceNotes: aliveVoice.map(({ blob: _blob, ...meta }): VoiceNoteMeta => meta),
    tags,
    settings: settings ?? null,
  }

  const exportedAt = nowIso()
  const manifest = {
    app: 'binhub' as const,
    schemaVersion: 1 as const,
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

  const zipped = zipSync(files, { level: 6 })
  const filename = `binhub-backup-${exportedAt.slice(0, 10)}.zip`
  return {
    blob: new Blob([zipped as unknown as BlobPart], { type: 'application/zip' }),
    filename,
    counts,
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

export async function importBackup(file: File, mode: ImportMode): Promise<ImportResult> {
  const bytes = new Uint8Array(await file.arrayBuffer())
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

  if (mode === 'replace') {
    await db.transaction(
      'rw',
      [db.notes, db.todos, db.bookmarks, db.events, db.voiceNotes, db.tags, db.settings],
      async () => {
        await Promise.all([
          db.notes.clear(),
          db.todos.clear(),
          db.bookmarks.clear(),
          db.events.clear(),
          db.voiceNotes.clear(),
          db.tags.clear(),
        ])
        await db.notes.bulkAdd(data.notes)
        await db.todos.bulkAdd(data.todos)
        await db.bookmarks.bulkAdd(data.bookmarks)
        await db.events.bulkAdd(data.events)
        await db.voiceNotes.bulkAdd(voices)
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
    imported.tags = data.tags.length
    return { mode, imported, skipped }
  }

  await db.transaction(
    'rw',
    [db.notes, db.todos, db.bookmarks, db.events, db.voiceNotes, db.tags, db.settings],
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
