export const DEFAULT_APP_URL = 'https://gfcode1.github.io/mymindhub/'

export interface ExtensionSettings {
  appUrl: string
  openInBackground: boolean
}

const SETTINGS_KEY = 'binhubSettings'

const DEFAULTS: ExtensionSettings = {
  appUrl: DEFAULT_APP_URL,
  openInBackground: true,
}

export function normalizeAppUrl(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  try {
    const url = new URL(trimmed)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
    url.hash = ''
    url.search = ''
    let pathname = url.pathname
    if (!pathname.endsWith('/')) pathname += '/'
    return `${url.origin}${pathname}`
  } catch {
    return null
  }
}

export function hostPatternForAppUrl(appUrl: string): string | null {
  try {
    const url = new URL(appUrl)
    return `${url.protocol}//${url.hostname}/*`
  } catch {
    return null
  }
}

export async function getSettings(): Promise<ExtensionSettings> {
  const stored = await chrome.storage.sync.get(SETTINGS_KEY)
  const value = stored[SETTINGS_KEY] as Partial<ExtensionSettings> | undefined
  const appUrl = normalizeAppUrl(value?.appUrl ?? '') ?? DEFAULTS.appUrl
  return {
    appUrl,
    openInBackground: value?.openInBackground ?? DEFAULTS.openInBackground,
  }
}

export async function saveSettings(patch: Partial<ExtensionSettings>): Promise<ExtensionSettings> {
  const current = await getSettings()
  const next: ExtensionSettings = {
    appUrl: patch.appUrl ? normalizeAppUrl(patch.appUrl) ?? current.appUrl : current.appUrl,
    openInBackground: patch.openInBackground ?? current.openInBackground,
  }
  await chrome.storage.sync.set({ [SETTINGS_KEY]: next })
  return next
}

export async function hasHostPermission(appUrl: string): Promise<boolean> {
  const pattern = hostPatternForAppUrl(appUrl)
  if (!pattern) return false
  return chrome.permissions.contains({ origins: [pattern] })
}

export async function requestHostPermission(appUrl: string): Promise<boolean> {
  const pattern = hostPatternForAppUrl(appUrl)
  if (!pattern) return false
  // Call request synchronously from the user gesture: do not await anything first.
  return chrome.permissions.request({ origins: [pattern] })
}
