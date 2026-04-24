import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface ThemeState {
  theme: 'light' | 'dark'
  textZoom: number
  toggleTheme: () => void
  setTextZoom: (zoom: number) => void
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      theme: 'dark',
      textZoom: 1,
      toggleTheme: () => set((s) => ({ theme: s.theme === 'dark' ? 'light' : 'dark' })),
      setTextZoom: (zoom) => set({ textZoom: Math.min(1.5, Math.max(0.75, zoom)) }),
    }),
    { name: 'kumbi-theme' }
  )
)
