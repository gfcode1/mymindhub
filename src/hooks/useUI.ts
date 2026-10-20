import { create } from 'zustand'
import type { SharedDraft } from '@/lib/clipboard'

interface UIState {
  quickAddOpen: boolean
  searchOpen: boolean
  moreOpen: boolean
  draft: SharedDraft | null
  openQuickAdd: () => void
  closeQuickAdd: () => void
  setSearchOpen: (open: boolean) => void
  setMoreOpen: (open: boolean) => void
  setDraft: (draft: SharedDraft | null) => void
  consumeDraft: () => SharedDraft | null
}

export const useUIStore = create<UIState>((set, get) => ({
  quickAddOpen: false,
  searchOpen: false,
  moreOpen: false,
  draft: null,
  openQuickAdd: () => set({ quickAddOpen: true }),
  closeQuickAdd: () => set({ quickAddOpen: false }),
  setSearchOpen: (open) => set({ searchOpen: open }),
  setMoreOpen: (open) => set({ moreOpen: open }),
  setDraft: (draft) => set({ draft }),
  consumeDraft: () => {
    const draft = get().draft
    if (draft) set({ draft: null })
    return draft
  },
}))
