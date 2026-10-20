import { NavLink, Outlet, useLocation, useNavigate } from 'react-router'
import { useEffect } from 'react'
import { Command, Ellipsis, Plus, Search, Settings, StickyNote, WifiOff } from 'lucide-react'
import { cn } from '@/lib/utils'
import { DESKTOP_NAV_ITEMS, MORE_NAV_ITEMS, NAV_ITEMS } from '@/lib/nav'
import { useUIStore } from '@/hooks/useUI'
import { useI18n } from '@/hooks/useI18n'
import { useOnline } from '@/hooks/useData'
import { draftFromText } from '@/lib/clipboard'
import { IconButton } from '@/components/ui/Button'
import { EmojiIcon } from '@/components/ui/EmojiIcon'
import { Modal } from '@/components/ui/Modal'
import { toast } from 'sonner'
import { Logo } from './Logo'

export function AppShell() {
  const online = useOnline()
  const location = useLocation()
  const navigate = useNavigate()
  const { t } = useI18n()
  const {
    quickAddOpen,
    openQuickAdd,
    closeQuickAdd,
    setSearchOpen,
    moreOpen,
    setMoreOpen,
    draft,
  } = useUIStore()

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

  useEffect(() => {
    if (!draft) return
    const target =
      draft.kind === 'bookmark' ? '/bookmarks' : draft.kind === 'todo' ? '/todos' : '/notes'
    closeQuickAdd()
    setMoreOpen(false)
    navigate(target)
  }, [draft, navigate, closeQuickAdd, setMoreOpen])

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
                {t('nav.offline')}
              </span>
            ) : null}
          </NavLink>
          <div className="flex items-center gap-0.5">
            <IconButton label={t('common.search')} onClick={() => navigate('/search')}>
              <Search size={19} />
            </IconButton>
            <IconButton label={t('common.settings')} onClick={() => navigate('/settings')}>
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
            <p className="mt-1 text-[11px] text-faint">{t('nav.subtitle')}</p>
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
          <span className="flex-1 text-left">{t('common.search')}…</span>
          <span className="flex items-center gap-0.5 rounded-md border border-line px-1 py-0.5 text-[10px]">
            <Command size={10} />K
          </span>
        </button>

        <nav className="flex flex-1 flex-col gap-0.5">
          {DESKTOP_NAV_ITEMS.map((item) => (
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
              {t(item.labelKey)}
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
            {t('common.settings')}
          </NavLink>
          <p className="px-3 pt-3 text-[11px] leading-relaxed text-faint">
            {t('nav.localOnly')}
            <br />
            {online ? t('nav.connected') : t('nav.offline')} · v1.0
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
                  <span className="leading-none">{t(item.labelKey)}</span>
                  {isActive ? (
                    <span className="absolute -top-px h-0.5 w-7 rounded-full bg-accent" />
                  ) : null}
                </>
              )}
            </NavLink>
          ))}
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            className="relative flex flex-1 flex-col items-center justify-center gap-1 rounded-xl px-0.5 text-[10px] font-medium text-faint transition-colors"
          >
            <Ellipsis size={20} strokeWidth={1.8} />
            <span className="leading-none">{t('nav.more')}</span>
          </button>
        </div>
      </nav>

      {!isNoteDetail ? (
        <button
          type="button"
          onClick={openQuickAdd}
          aria-label={t('quick.newAria')}
          className="fixed bottom-[calc(5.25rem+env(safe-area-inset-bottom))] right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-accent-ink shadow-[0_10px_30px_-8px_var(--accent)] transition-transform active:scale-95 lg:hidden"
        >
          <Plus size={26} strokeWidth={2.4} />
        </button>
      ) : null}

      <QuickAddSheet open={quickAddOpen} onClose={closeQuickAdd} />
      <MoreSheet open={moreOpen} onClose={() => setMoreOpen(false)} />
    </div>
  )
}

function MoreSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate()
  const { t } = useI18n()

  const go = (to: string) => {
    onClose()
    navigate(to)
  }

  return (
    <Modal open={open} onClose={onClose} title={t('nav.more')}>
      <div className="grid grid-cols-2 gap-2.5 pb-2">
        {MORE_NAV_ITEMS.map((item) => (
          <button
            key={item.to}
            type="button"
            onClick={() => go(item.to)}
            className="flex items-center gap-2.5 rounded-2xl border border-line bg-canvas/40 px-3.5 py-3 text-left transition-colors hover:border-accent/40 hover:bg-accent-soft/40"
          >
            <item.icon size={19} className="text-accent" />
            <span className="text-sm font-semibold">{t(item.labelKey)}</span>
          </button>
        ))}
        <button
          type="button"
          onClick={() => go('/settings')}
          className="flex items-center gap-2.5 rounded-2xl border border-line bg-canvas/40 px-3.5 py-3 text-left transition-colors hover:border-accent/40 hover:bg-accent-soft/40"
        >
          <Settings size={19} className="text-accent" />
          <span className="text-sm font-semibold">{t('common.settings')}</span>
        </button>
      </div>
    </Modal>
  )
}

function QuickAddSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate()
  const { t } = useI18n()
  const setDraft = useUIStore((state) => state.setDraft)

  const go = (to: string) => {
    onClose()
    navigate(to)
  }

  const paste = async () => {
    try {
      const text = await navigator.clipboard.readText()
      const next = draftFromText(text)
      if (!next) {
        toast.info(t('quick.pasteEmpty'))
        return
      }
      setDraft(next)
      toast.success(t('quick.pasteReady'), { description: t('quick.pasteReadyDesc') })
    } catch {
      toast.error(t('quick.pasteError'))
    }
  }

  const options = [
    { label: t('quick.note'), hint: t('quick.noteHint'), emoji: 'note' as const, to: '/notes?new=1' },
    { label: t('quick.todo'), hint: t('quick.todoHint'), emoji: 'todo' as const, to: '/todos?new=1' },
    { label: t('quick.bookmark'), hint: t('quick.bookmarkHint'), emoji: 'bookmark' as const, to: '/bookmarks?new=1' },
    { label: t('quick.event'), hint: t('quick.eventHint'), emoji: 'calendar' as const, to: '/calendar?new=1' },
    { label: t('quick.voice'), hint: t('quick.voiceHint'), emoji: 'microphone' as const, to: '/voice?record=1' },
    { label: t('quick.search'), hint: t('quick.searchHint'), emoji: 'search' as const, to: '/search' },
  ]

  return (
    <Modal open={open} onClose={onClose} title={t('quick.title')} description={t('quick.description')}>
      <button
        type="button"
        onClick={() => void paste()}
        className="mb-3 flex w-full items-center gap-3 rounded-2xl border border-accent/30 bg-accent-soft/60 px-3.5 py-3 text-left transition-colors hover:bg-accent-soft"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-ink">
          <StickyNote size={17} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">{t('quick.paste')}</span>
          <span className="block text-[11px] text-muted">{t('quick.pasteHint')}</span>
        </span>
      </button>
      <div className="grid grid-cols-2 gap-2.5 pb-2">
        {options.map((option) => (
          <button
            key={option.label}
            type="button"
            onClick={() => go(option.to)}
            className="flex flex-col items-start gap-2 rounded-2xl border border-line bg-canvas/40 p-3.5 text-left transition-colors hover:border-accent/40 hover:bg-accent-soft/40"
          >
            <EmojiIcon name={option.emoji} className="h-7 w-7" />
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
