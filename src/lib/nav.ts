import {
  Bookmark,
  CalendarDays,
  CircleCheckBig,
  LayoutDashboard,
  Mic,
  NotebookPen,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  end?: boolean
}

export const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Oggi', icon: LayoutDashboard, end: true },
  { to: '/notes', label: 'Note', icon: NotebookPen },
  { to: '/todos', label: 'Todo', icon: CircleCheckBig },
  { to: '/bookmarks', label: 'Link', icon: Bookmark },
  { to: '/calendar', label: 'Calendario', icon: CalendarDays },
  { to: '/voice', label: 'Vocali', icon: Mic },
]
