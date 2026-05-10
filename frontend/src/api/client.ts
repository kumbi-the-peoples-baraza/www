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
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),
  logout: () => api.post('/auth/logout'),
  me: () => api.get('/auth/me'),
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
  upload: (file: File) => {
    const fd = new FormData()
    fd.append('file', file)
    return api.post('/media', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
  },
  list: () => api.get('/media'),
  delete: (id: string) => api.delete(`/media/${id}`),
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
  create: (data: unknown) => api.post('/people', data),
  update: (id: string, data: unknown) => api.put(`/people/${id}`, data),
  delete: (id: string) => api.delete(`/people/${id}`),
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
