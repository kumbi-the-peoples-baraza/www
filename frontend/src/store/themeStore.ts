import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type Theme = 'light' | 'dim' | 'dark'

interface ThemeState {
  theme: Theme
  textZoom: number
  setTheme: (t: Theme) => void
  setTextZoom: (zoom: number) => void
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      theme: 'light',
      textZoom: 1,
      setTheme: (theme) => set({ theme }),
      setTextZoom: (zoom) => set({ textZoom: Math.min(1.5, Math.max(0.75, zoom)) }),
    }),
    { name: 'kumbi-theme' }
  )
)
