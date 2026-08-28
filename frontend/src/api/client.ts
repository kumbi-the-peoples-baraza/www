import axios from 'axios'
import { useAuthStore } from '@/store/authStore'

export const api = axios.create({
  baseURL: '/api/v1',
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) useAuthStore.getState().logout()
    return Promise.reject(err)
  }
)

// Auth
export const authApi = {
  login: (data: { email: string; password: string; cf_turnstile_response?: string; remember_me?: boolean; device_fingerprint?: string }) =>
    api.post('/auth/login', data),
  verifyOtp: (data: { email: string; otp: string; remember_me?: boolean }) =>
    api.post('/auth/verify-otp', data),
  logout: () => api.post('/auth/logout'),
  me: () => api.get('/auth/me'),
  forgotPassword: (email: string) => api.post('/auth/forgot-password', { email }),
  verifyResetOtp: (data: { email: string; otp: string }) => api.post('/auth/verify-reset-otp', data),
  verifyReset: (token: string) => api.get(`/auth/verify-reset/${token}`),
  resetPassword: (data: { token: string; password: string }) => api.post('/auth/reset-password', data),
  setPassword: (data: { token: string; password: string }) => api.post('/auth/set-password', data),
  captchaConfig: () => api.get('/auth/captcha-config'),
  turnstileConfig: () => api.get('/auth/captcha-config'),
}

// Pages
export const pagesApi = {
  list: () => api.get('/pages'),
  get: (slug: string) => api.get(`/pages/${slug}`),
  create: (data: unknown) => api.post('/pages', data),
  update: (id: string, data: unknown) => api.put(`/pages/${id}`, data),
  delete: (id: string) => api.delete(`/pages/${id}`),
}

// Content
export const contentApi = {
  list: (pageId: string) => api.get(`/content/${pageId}`),
  create: (pageId: string, data: unknown) => api.post(`/content/${pageId}`, data),
  update: (id: string, data: unknown) => api.put(`/content/${id}`, data),
  delete: (id: string) => api.delete(`/content/${id}`),
}

// Forms
export const formsApi = {
  submitContact: (data: unknown) => api.post('/forms/contact', data),
  submitVolunteer: (data: unknown) => api.post('/forms/volunteer', data),
  listSubmissions: (formType: string) => api.get(`/forms/${formType}/submissions`),
  exportCsv: (formType: string) => api.get(`/forms/${formType}/export/csv`, { responseType: 'blob' }),
  exportPdf: (formType: string) => api.get(`/forms/${formType}/export/pdf`, { responseType: 'blob' }),
}

// Media
export const mediaApi = {
  upload: (file: File, data: { name?: string; caption?: string; photographer?: string; dateTaken?: string }, onProgress?: (pct: number) => void) => {
    const fd = new FormData()
    fd.append('file', file)
    if (data.name) fd.append('name', data.name)
    if (data.caption) fd.append('caption', data.caption)
    if (data.photographer) fd.append('photographer', data.photographer)
    if (data.dateTaken) fd.append('date_taken', data.dateTaken)
    return api.post('/media', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (e) => { if (onProgress && e.total) onProgress(Math.round((e.loaded / e.total) * 100)) },
    })
  },
  list: (params?: { search?: string; sort?: string; order?: string; page?: number; limit?: number }) =>
    api.get('/media', { params }),
  delete: (id: string) => api.delete(`/media/${id}`),
  get: (id: string) => api.get(`/media/${id}`),
  updateCaption: (id: string, caption: string) => api.put(`/media/${id}/caption`, { caption }),
  updateName: (id: string, name: string) => api.put(`/media/${id}/name`, { name }),
  updateMetadata: (id: string, data: { name?: string; caption?: string; photographer?: string; dateTaken?: string }) =>
    api.put(`/media/${id}/metadata`, data),
}

// Notebooks
export const notebooksApi = {
  list: () => api.get('/notebooks'),
  get: (id: string) => api.get(`/notebooks/${id}`),
  upload: (file: File) => {
    const fd = new FormData()
    fd.append('notebook', file)
    return api.post('/notebooks', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
  },
  importFromGitHub: (url: string) => api.post('/notebooks/import-github', { url }),
}

// Users
export const usersApi = {
  list: () => api.get('/users'),
  create: (data: unknown) => api.post('/users', data),
  update: (id: string, data: unknown) => api.put(`/users/${id}`, data),
  delete: (id: string) => api.delete(`/users/${id}`),
}

// Blog
export const blogApi = {
  list: () => api.get('/blog'),
  popular: () => api.get('/blog/popular'),
  listAll: () => api.get('/blog/all'),
  get: (slug: string) => api.get(`/blog/${slug}`),
  create: (data: unknown) => api.post('/blog', data),
  update: (id: string, data: unknown) => api.put(`/blog/${id}`, data),
  delete: (id: string) => api.delete(`/blog/${id}`),
}

// People
export const peopleApi = {
  list: () => api.get('/people'),
  listAll: () => api.get('/people/all'),
  byRole: (role: string) => api.get(`/people?role=${role}`),
  create: (data: unknown) => api.post('/people', data),
  update: (id: string, data: unknown) => api.put(`/people/${id}`, data),
  delete: (id: string) => api.delete(`/people/${id}`),
}

// Authors (searchable, create-if-not-found)
export const authorsApi = {
  search: (q: string) => api.get(`/authors?q=${encodeURIComponent(q)}`),
  get: (id: string) => api.get(`/authors/${id}`),
}

// Media gallery
export const galleryApi = {
  list: () => api.get('/media/gallery'),
  setPublished: (id: string, published: boolean) => api.put(`/media/${id}/gallery`, { published }),
}

// Site config (editable text, images, nav, footer)
export const configApi = {
  get: () => api.get('/config'),
  update: (data: unknown) => api.put('/config', data),
}

// Analytics / tracking
export const analyticsApi = {
  get: () => api.get('/analytics'),
  update: (config: Record<string, unknown>) => api.put('/analytics', { config }),
  stats: () => api.get('/analytics/stats'),
  track: (path: string, referrer: string) => api.post('/track', { path, referrer }),
}

// Dashboard
export const dashboardApi = {
  stats: () => api.get('/dashboard/stats'),
}

// Appearance
export const appearanceApi = {
  get: () => api.get('/appearance'),
  update: (data: unknown) => api.put('/appearance', data),
}

// Security (admin only)
export const securityApi = {
  getSessions: () => api.get('/security/sessions'),
  getUserSessions: (id: string) => api.get(`/security/sessions/${id}`),
  getSuspiciousLogins: () => api.get('/security/suspicious-logins'),
  getLoginAttempts: () => api.get('/security/login-attempts'),
  getSecurityEvents: () => api.get('/security/events'),
  getLockedUsers: () => api.get('/security/locked-users'),
  getOTPStatus: () => api.get('/security/otp-status'),
  unlockAccount: (id: string) => api.post(`/security/unlock/${id}`),
  blockIp: (data: { ip: string; reason?: string }) => api.post('/security/block-ip', data),
  blockDevice: (data: { fingerprint: string; reason?: string }) => api.post('/security/block-device', data),
  getBlockedIps: () => api.get('/security/blocked-ips'),
  unblockIp: (id: string) => api.delete(`/security/unblock-ip/${id}`),
}
