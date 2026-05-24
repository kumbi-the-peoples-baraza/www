import { api } from "@/api/client";
import type { Notebook, Page, CreateNotebookPayload } from "@/types/";

export const notebooksApi = {
  list: (): Promise<Notebook[]> =>
    api.get("/notebooks").then((r) => r.data),

  get: (id: string): Promise<Notebook> =>
    api.get(`/notebooks/${id}`).then((r) => r.data),

  createFromGitHub: (payload: CreateNotebookPayload): Promise<Notebook> =>
    api.post("/notebooks", payload).then((r) => r.data),

  createFromUpload: (file: File, title: string, description?: string): Promise<Notebook> => {
    const form = new FormData();
    form.append("file", file);
    form.append("title", title);
    if (description) form.append("description", description);
    return api
      .post("/notebooks", form, { headers: { "Content-Type": "multipart/form-data" } })
      .then((r) => r.data);
  },

  reload: (id: string): Promise<Notebook> =>
    api.post(`/notebooks/${id}/reload`).then((r) => r.data),

  archive: (id: string): Promise<void> =>
    api.post(`/notebooks/${id}/archive`).then(() => undefined),

  delete: (id: string): Promise<void> =>
    api.delete(`/notebooks/${id}`).then(() => undefined),

  attachToPage: (notebookId: string, pageId: string): Promise<void> =>
    api.post(`/notebooks/${notebookId}/attach/${pageId}`).then(() => undefined),

  detachFromPage: (notebookId: string, pageId: string): Promise<void> =>
    api.delete(`/notebooks/${notebookId}/attach/${pageId}`).then(() => undefined),

  getPageWithNotebook: (slug: string): Promise<Page> =>
    api.get(`/notebooks/page/${slug}`).then((r) => r.data),
};
