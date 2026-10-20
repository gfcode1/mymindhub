import { describe, expect, it } from 'vitest'
import { extensionForMime, extensionFromName, filterVaultItems, vaultFileKind, vaultItemMatches } from '@/lib/vault'
import type { VaultItem } from '@/types/models'

function item(overrides: Partial<VaultItem> = {}): VaultItem {
  return {
    id: 'vault-1',
    type: 'checklist',
    title: 'Valigia',
    description: 'Vacanza',
    category: 'Viaggi',
    fileName: null,
    mimeType: null,
    size: 0,
    items: [
      { id: 'a', text: 'Passaporto' },
      { id: 'b', text: 'Caricabatterie' },
    ],
    createdAt: '2026-10-20T09:00:00.000Z',
    updatedAt: '2026-10-20T09:00:00.000Z',
    deletedAt: null,
    ...overrides,
  }
}

describe('vault helpers', () => {
  it('resolves extensions and file kinds', () => {
    expect(extensionForMime('application/pdf')).toBe('pdf')
    expect(extensionForMime(null)).toBe('')
    expect(extensionFromName('report.finale.PDF')).toBe('pdf')
    expect(extensionFromName('senzaestensione')).toBe('')
    expect(vaultFileKind('image/png')).toBe('image')
    expect(vaultFileKind('application/pdf')).toBe('pdf')
    expect(vaultFileKind('application/zip')).toBe('archive')
    expect(vaultFileKind('text/plain')).toBe('text')
    expect(vaultFileKind('application/octet-stream')).toBe('file')
  })

  it('matches and filters items', () => {
    expect(vaultItemMatches(item(), 'passaporto')).toBe(true)
    expect(vaultItemMatches(item(), 'vacanza')).toBe(true)
    expect(vaultItemMatches(item(), 'inesistente')).toBe(false)
    const items = [item(), item({ id: 'vault-2', title: 'Documenti', category: 'Casa' })]
    expect(filterVaultItems(items, '', 'Viaggi')).toHaveLength(1)
    expect(filterVaultItems(items, 'documenti', '')).toHaveLength(1)
  })
})
