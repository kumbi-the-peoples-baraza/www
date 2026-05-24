import { useState, useEffect, useCallback } from "react";
import { notebooksApi } from "@notebooks/api/notebooksApi";
import type { Notebook } from "@/types";

export function useNotebooks() {
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await notebooksApi.list();
      setNotebooks(data ?? []);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const reload = useCallback(async (id: string) => {
    const updated = await notebooksApi.reload(id);
    setNotebooks((prev) => prev.map((n) => (n.id === id ? updated : n)));
    return updated;
  }, []);

  const archive = useCallback(async (id: string) => {
    await notebooksApi.archive(id);
    setNotebooks((prev) =>
      prev.map((n) =>
        n.id === id ? { ...n, status: "archived" as const } : n,
      ),
    );
  }, []);

  const remove = useCallback(async (id: string) => {
    await notebooksApi.delete(id);
    setNotebooks((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const attach = useCallback(async (notebookId: string, pageId: string) => {
    await notebooksApi.attachToPage(notebookId, pageId);
  }, []);

  const detach = useCallback(async (notebookId: string, pageId: string) => {
    await notebooksApi.detachFromPage(notebookId, pageId);
  }, []);

  const addToList = useCallback((nb: Notebook) => {
    setNotebooks((prev) => [nb, ...prev]);
  }, []);

  return {
    notebooks,
    loading,
    error,
    refresh: load,
    reload,
    archive,
    remove,
    attach,
    detach,
    addToList,
  };
}

export function useNotebook(id: string | null) {
  const [notebook, setNotebook] = useState<Notebook | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    notebooksApi
      .get(id)
      .then(setNotebook)
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, [id]);

  return { notebook, loading, error };
}
