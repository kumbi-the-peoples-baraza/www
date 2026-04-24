import { create } from 'zustand'

interface VolunteerState {
  isOpen: boolean
  open: () => void
  close: () => void
}

export const useVolunteerStore = create<VolunteerState>((set) => ({
  isOpen: false,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
}))
