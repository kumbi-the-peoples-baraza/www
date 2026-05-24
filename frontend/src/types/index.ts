export interface BlogPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  body: string;
  coverImage?: string;
  coverCaption?: string;
  status: "published" | "draft" | "archived";
  authorId?: string;
  publishedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Person {
  id: string;
  name: string;
  position: string;
  bio: string;
  portrait?: string;
  published: boolean;
  order: number;
  createdAt: string;
}

export interface Page {
  id: string;
  slug: string;
  title: string;
  description: string;
  status: "published" | "draft" | "archived";
  displayMode: "full" | "modal" | "overlay" | "carousel" | "hero" | "link";
  order: number;
  metadata: Record<string, unknown>;
  notebookId?: string;
  notebook?: Notebook;
  createdAt: string;
  updatedAt: string;
}

export interface ContentBlock {
  id: string;
  pageId: string;
  type: "text" | "image" | "video" | "audio" | "pdf" | "notebook" | "form";
  content: string;
  mediaUrl?: string;
  order: number;
  settings: Record<string, unknown>;
}

export interface FormSubmission {
  id: string;
  formType: string;
  data: Record<string, unknown>;
  createdAt: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: "admin" | "editor" | "viewer";
  active: boolean;
  createdAt: string;
}

export interface Appearance {
  primaryColor: string;
  secondaryColor: string;
  gradientStart: string;
  gradientEnd: string;
  backgroundImage?: string;
  foregroundImage?: string;
  darkMode: boolean;
  fontFamily: string;
}

export type NotebookStatus = "active" | "archived" | "deleted";
export type NotebookSource = "github_url" | "local_upload";

export interface OutputDTO {
  outputType: "execute_result" | "display_data" | "stream" | "error";
  data?: Record<string, unknown>;
  text?: string[];
  mimeBundle?: Record<string, unknown>;
}

export interface CellDTO {
  id: string;
  type: "code" | "markdown" | "raw";
  source: string;
  outputs: OutputDTO[];
}

export interface Notebook {
  id: string;
  title: string;
  description: string;
  sourceType: NotebookSource;
  sourceUrl: string;
  cells: CellDTO[];
  readme: string;
  kernel: string;
  language: string;
  status: NotebookStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CreateNotebookPayload {
  title: string;
  description?: string;
  sourceType: NotebookSource;
  sourceUrl?: string;
}
