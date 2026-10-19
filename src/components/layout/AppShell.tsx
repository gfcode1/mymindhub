import { NavLink, Outlet, useLocation, useNavigate } from 'react-router'
import { useEffect } from 'react'
import {
  Bookmark,
  CalendarPlus,
  CircleCheckBig,
  Command,
  Mic,
  Plus,
  Search,
  Settings,
  StickyNote,
  WifiOff,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { NAV_ITEMS } from '@/lib/nav'
import { useUIStore } from '@/hooks/useUI'
import { useOnline } from '@/hooks/useData'
import { IconButton } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Logo } from './Logo'

export function AppShell() {
  const online = useOnline()
  const location = useLocation()
  const navigate = useNavigate()
  const { quickAddOpen, openQuickAdd, closeQuickAdd, setSearchOpen } = useUIStore()

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setSearchOpen(true)
        navigate('/search')
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [navigate, setSearchOpen])

  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [location.pathname])

  const isNoteDetail = /^\/notes\/.+/.test(location.pathname)

  return (
    <div className="min-h-dvh bg-canvas">
      <header className="safe-top sticky top-0 z-30 border-b border-line/80 bg-canvas/85 backdrop-blur-xl lg:hidden">
        <div className="flex h-12 items-center justify-between gap-2 px-4">
          <NavLink to="/" className="flex items-center gap-2">
            <Logo size={28} />
            <span className="text-[15px] font-semibold tracking-tight">BinHub</span>
            {!online ? (
              <span className="flex items-center gap-1 rounded-full bg-raised px-2 py-0.5 text-[10px] font-medium text-muted">
                <WifiOff size={10} />
                Offline
              </span>
            ) : null}
          </NavLink>
          <div className="flex items-center gap-0.5">
            <IconButton label="Cerca" onClick={() => navigate('/search')}>
              <Search size={19} />
            </IconButton>
            <IconButton label="Impostazioni" onClick={() => navigate('/settings')}>
              <Settings size={19} />
            </IconButton>
          </div>
        </div>
      </header>

      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-line bg-surface/60 px-3 py-5 lg:flex">
        <NavLink to="/" className="mb-6 flex items-center gap-2.5 px-2">
          <Logo size={34} />
          <div>
            <p className="text-[17px] font-semibold leading-none tracking-tight">BinHub</p>
            <p className="mt-1 text-[11px] text-faint">Il tuo hub offline</p>
          </div>
        </NavLink>

        <button
          type="button"
          onClick={() => {
            setSearchOpen(true)
            navigate('/search')
          }}
          className="mb-4 flex h-10 items-center gap-2 rounded-xl border border-line bg-surface px-3 text-sm text-faint transition-colors hover:border-accent/40 hover:text-ink"
        >
          <Search size={16} />
          <span className="flex-1 text-left">Cerca…</span>
          <span className="flex items-center gap-0.5 rounded-md border border-line px-1 py-0.5 text-[10px]">
            <Command size={10} />K
          </span>
        </button>

        <nav className="flex flex-1 flex-col gap-0.5">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-accent-soft text-accent'
                    : 'text-muted hover:bg-raised hover:text-ink',
                )
              }
            >
              <item.icon size={18} />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="mt-4 border-t border-line pt-3">
          <NavLink
            to="/settings"
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                isActive ? 'bg-accent-soft text-accent' : 'text-muted hover:bg-raised hover:text-ink',
              )
            }
          >
            <Settings size={18} />
            Impostazioni
          </NavLink>
          <p className="px-3 pt-3 text-[11px] leading-relaxed text-faint">
            Dati solo sul dispositivo.
            <br />
            {online ? 'Connesso' : 'Modalità offline'} · v1.0
          </p>
        </div>
      </aside>

      <main className="lg:pl-64">
        <div className="mx-auto w-full max-w-5xl px-4 pb-nav pt-4 lg:px-8 lg:pb-10 lg:pt-8">
          <Outlet />
        </div>
      </main>

      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 backdrop-blur-xl lg:hidden">
        <div className="mx-auto flex h-16 max-w-lg items-stretch justify-between px-1">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  'relative flex flex-1 flex-col items-center justify-center gap-1 rounded-xl px-0.5 text-[10px] font-medium transition-colors',
                  isActive ? 'text-accent' : 'text-faint',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon size={20} strokeWidth={isActive ? 2.2 : 1.8} />
                  <span className="leading-none">{item.label}</span>
                  {isActive ? (
                    <span className="absolute -top-px h-0.5 w-7 rounded-full bg-accent" />
                  ) : null}
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>

      {!isNoteDetail ? (
        <button
          type="button"
          onClick={openQuickAdd}
          aria-label="Crea nuovo"
          className="fixed bottom-[calc(5.25rem+env(safe-area-inset-bottom))] right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-accent-ink shadow-[0_10px_30px_-8px_var(--accent)] transition-transform active:scale-95 lg:hidden"
        >
          <Plus size={26} strokeWidth={2.4} />
        </button>
      ) : null}

      <QuickAddSheet open={quickAddOpen} onClose={closeQuickAdd} />
    </div>
  )
}

function QuickAddSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate()

  const go = (to: string) => {
    onClose()
    navigate(to)
  }

  const options = [
    { label: 'Nota', hint: 'Testo e markdown', icon: StickyNote, to: '/notes?new=1', color: 'text-teal-500' },
    { label: 'Todo', hint: 'Attività e scadenze', icon: CircleCheckBig, to: '/todos?new=1', color: 'text-emerald-500' },
    { label: 'Bookmark', hint: 'Salva un link', icon: Bookmark, to: '/bookmarks?new=1', color: 'text-indigo-400' },
    { label: 'Evento', hint: 'Calendario', icon: CalendarPlus, to: '/calendar?new=1', color: 'text-violet-400' },
    { label: 'Nota vocale', hint: 'Registra con il microfono', icon: Mic, to: '/voice?record=1', color: 'text-rose-400' },
    { label: 'Cerca', hint: 'In tutto il contenuto', icon: Search, to: '/search', color: 'text-amber-400' },
  ]

  return (
    <Modal open={open} onClose={onClose} title="Crea" description="Cosa vuoi aggiungere a BinHub?">
      <div className="grid grid-cols-2 gap-2.5 pb-2">
        {options.map((option) => (
          <button
            key={option.label}
            type="button"
            onClick={() => go(option.to)}
            className="flex flex-col items-start gap-2 rounded-2xl border border-line bg-canvas/40 p-3.5 text-left transition-colors hover:border-accent/40 hover:bg-accent-soft/40"
          >
            <option.icon size={22} className={option.color} />
            <span>
              <span className="block text-sm font-semibold">{option.label}</span>
              <span className="mt-0.5 block text-[11px] leading-snug text-muted">{option.hint}</span>
            </span>
          </button>
        ))}
      </div>
    </Modal>
  )
}
