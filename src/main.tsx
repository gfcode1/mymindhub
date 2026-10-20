import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router'
import './index.css'
import App from './App'
import { draftFromShare } from '@/lib/clipboard'
import { useUIStore } from '@/hooks/useUI'

const incoming = new URLSearchParams(window.location.search)
if (incoming.get('share') === '1') {
  const draft = draftFromShare(incoming)
  if (draft) useUIStore.getState().setDraft(draft)
  const clean = new URL(window.location.href)
  clean.search = ''
  if (!clean.hash) clean.hash = '#/'
  window.history.replaceState({}, '', clean.toString())
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </StrictMode>,
)
