import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface User {
  id: string
  name: string
  email: string
  role: string
}

interface AuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  pendingOtpEmail: string | null
  pendingPasswordChange: boolean
  setAuth: (user: User, token: string) => void
  setPendingOtp: (email: string) => void
  clearPendingOtp: () => void
  setPendingPasswordChange: () => void
  clearPendingPasswordChange: () => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      pendingOtpEmail: null,
      pendingPasswordChange: false,
      setAuth: (user, token) => set({ user, token, isAuthenticated: true, pendingOtpEmail: null, pendingPasswordChange: false }),
      setPendingOtp: (email) => set({ pendingOtpEmail: email }),
      clearPendingOtp: () => set({ pendingOtpEmail: null }),
      setPendingPasswordChange: () => set({ pendingPasswordChange: true }),
      clearPendingPasswordChange: () => set({ pendingPasswordChange: false }),
      logout: () => set({ user: null, token: null, isAuthenticated: false, pendingOtpEmail: null, pendingPasswordChange: false }),
    }),
    { name: 'kumbi-auth' }
  )
)
