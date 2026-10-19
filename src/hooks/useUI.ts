import { create } from 'zustand'

interface UIState {
  quickAddOpen: boolean
  searchOpen: boolean
  openQuickAdd: () => void
  closeQuickAdd: () => void
  setSearchOpen: (open: boolean) => void
}

export const useUIStore = create<UIState>((set) => ({
  quickAddOpen: false,
  searchOpen: false,
  openQuickAdd: () => set({ quickAddOpen: true }),
  closeQuickAdd: () => set({ quickAddOpen: false }),
  setSearchOpen: (open) => set({ searchOpen: open }),
}))
