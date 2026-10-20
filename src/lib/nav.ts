import {
  AlarmClock,
  Archive,
  Bookmark,
  Clock,
  PenTool,
  CalendarDays,
  CircleCheckBig,
  LayoutDashboard,
  Mic,
  NotebookPen,
  Repeat2,
  ScrollText,
  Timer,
  Wallet,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { MessageKey } from '@/lib/i18n'

export interface NavItem {
  to: string
  labelKey: MessageKey
  icon: LucideIcon
  end?: boolean
}

export const NAV_ITEMS: NavItem[] = [
  { to: '/', labelKey: 'nav.today', icon: LayoutDashboard, end: true },
  { to: '/notes', labelKey: 'nav.notes', icon: NotebookPen },
  { to: '/todos', labelKey: 'nav.todos', icon: CircleCheckBig },
  { to: '/calendar', labelKey: 'nav.calendar', icon: CalendarDays },
]

export const MORE_NAV_ITEMS: NavItem[] = [
  { to: '/bookmarks', labelKey: 'nav.bookmarks', icon: Bookmark },
  { to: '/voice', labelKey: 'nav.voice', icon: Mic },
  { to: '/journal', labelKey: 'nav.journal', icon: ScrollText },
  { to: '/habits', labelKey: 'nav.habits', icon: Repeat2 },
  { to: '/timer', labelKey: 'nav.timer', icon: Timer },
  { to: '/time', labelKey: 'nav.timeAudit', icon: Clock },
  { to: '/expenses', labelKey: 'nav.expenses', icon: Wallet },
  { to: '/vault', labelKey: 'nav.vault', icon: Archive },
  { to: '/whiteboards', labelKey: 'nav.whiteboards', icon: PenTool },
  { to: '/alarms', labelKey: 'nav.alarms', icon: AlarmClock },
]

export const DESKTOP_NAV_ITEMS: NavItem[] = [...NAV_ITEMS, ...MORE_NAV_ITEMS]
