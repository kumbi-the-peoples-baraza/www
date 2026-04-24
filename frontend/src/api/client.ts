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
  get: (pageId: string) => api.get(`/content/${pageId}`),
  update: (id: string, data: unknown) => api.put(`/content/${id}`, data),
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
}

// Users
export const usersApi = {
  list: () => api.get('/users'),
  create: (data: unknown) => api.post('/users', data),
  update: (id: string, data: unknown) => api.put(`/users/${id}`, data),
  delete: (id: string) => api.delete(`/users/${id}`),
}

// Appearance
export const appearanceApi = {
  get: () => api.get('/appearance'),
  update: (data: unknown) => api.put('/appearance', data),
}
