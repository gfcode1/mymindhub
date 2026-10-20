import type { VaultItem } from '@/types/models'

const MIME_EXT: Record<string, string> = {
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

export type VaultFileKind = 'image' | 'pdf' | 'archive' | 'text' | 'file'

export function extensionFromName(fileName: string | null): string {
  const value = fileName?.split('.').pop()?.toLowerCase() ?? ''
  return /^[a-z0-9]{1,8}$/.test(value) ? value : ''
}

export function extensionForMime(mimeType: string | null): string {
  return MIME_EXT[mimeType ?? ''] ?? ''
}

export function vaultFileKind(mimeType: string | null): VaultFileKind {
  const mime = mimeType ?? ''
  if (mime.startsWith('image/')) return 'image'
  if (mime === 'application/pdf') return 'pdf'
  if (mime === 'application/zip' || mime.includes('compressed')) return 'archive'
  if (mime.startsWith('text/')) return 'text'
  return 'file'
}

export function vaultItemMatches(item: VaultItem, query: string): boolean {
  const needle = query.trim().toLowerCase()
  if (!needle) return true
  if (item.title.toLowerCase().includes(needle)) return true
  if (item.description.toLowerCase().includes(needle)) return true
  if (item.category.toLowerCase().includes(needle)) return true
  if (item.fileName?.toLowerCase().includes(needle)) return true
  return item.items.some((entry) => entry.text.toLowerCase().includes(needle))
}

export function filterVaultItems(items: VaultItem[], query: string, category: string): VaultItem[] {
  return items.filter(
    (item) => (category === '' || item.category === category) && vaultItemMatches(item, query),
  )
}
