export interface Page {
  id: string
  slug: string
  title: string
  description: string
  status: 'published' | 'draft' | 'archived'
  displayMode: 'full' | 'modal' | 'overlay' | 'carousel' | 'hero' | 'link'
  order: number
  metadata: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export interface ContentBlock {
  id: string
  pageId: string
  type: 'text' | 'image' | 'video' | 'audio' | 'pdf' | 'notebook' | 'form'
  content: string
  mediaUrl?: string
  order: number
  settings: Record<string, unknown>
}

export interface FormSubmission {
  id: string
  formType: string
  data: Record<string, unknown>
  createdAt: string
}

export interface User {
  id: string
  name: string
  email: string
  role: 'admin' | 'editor' | 'viewer'
  active: boolean
  createdAt: string
}

export interface Appearance {
  primaryColor: string
  secondaryColor: string
  gradientStart: string
  gradientEnd: string
  backgroundImage?: string
  foregroundImage?: string
  darkMode: boolean
  fontFamily: string
}

export interface Notebook {
  id: string
  name: string
  path: string
  uploadedAt: string
}
