import { create } from 'zustand'

interface ContactState {
  isOpen: boolean
  open: () => void
  close: () => void
}

export const useContactStore = create<ContactState>((set) => ({
  isOpen: false,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
}))
