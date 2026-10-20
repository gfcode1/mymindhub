export async function findAppTab(appUrl: string): Promise<chrome.tabs.Tab | undefined> {
  const tabs = await chrome.tabs.query({})
  return tabs.find((tab) => tab.id !== undefined && tab.url?.startsWith(appUrl))
}

export async function openAppTab(appUrl: string, active: boolean): Promise<chrome.tabs.Tab> {
  const existing = await findAppTab(appUrl)
  if (existing?.id !== undefined) {
    if (active) await chrome.tabs.update(existing.id, { active: true })
    if (existing.discarded) await chrome.tabs.reload(existing.id)
    return existing
  }
  return chrome.tabs.create({ url: appUrl, active })
}

export function waitForTabComplete(tabId: number, timeoutMs = 15_000): Promise<void> {
  return new Promise((resolve, reject) => {
    let settled = false
    const finish = (error?: Error) => {
      if (settled) return
      settled = true
      chrome.tabs.onUpdated.removeListener(listener)
      clearTimeout(timer)
      if (error) reject(error)
      else resolve()
    }
    const listener = (updatedTabId: number, info: { status?: string }) => {
      if (updatedTabId === tabId && info.status === 'complete') finish()
    }
    const timer = setTimeout(() => finish(new Error('timeout')), timeoutMs)
    chrome.tabs.onUpdated.addListener(listener)
    void chrome.tabs
      .get(tabId)
      .then((tab) => {
        if (tab.status === 'complete') finish()
      })
      .catch(() => finish(new Error('tab not found')))
  })
}
