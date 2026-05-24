import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Loader2, AlertCircle } from "lucide-react";
import { NotebookRenderer } from "@notebooks/components/NotebookRenderer";
import { notebooksApi } from "@notebooks/api/notebooksApi";
import type { Page } from "@/types";

export function PublicNotebookPage() {
  const { slug } = useParams<{ slug: string }>();
  const [page, setPage] = useState<Page | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    notebooksApi
      .getPageWithNotebook(slug)
      .then(setPage)
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !page) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-3 text-muted-foreground">
        <AlertCircle className="h-8 w-8" />
        <p className="font-medium">Page not found</p>
        <p className="text-sm">{error}</p>
      </div>
    );
  }

  const notebook = page.notebook;

  return (
    <div className="min-h-screen bg-background">
      {/* Page header */}
      <header className="border-b bg-background/95 backdrop-blur sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <h1 className="text-xl font-bold">{page.title}</h1>
          {page.description && (
            <p className="text-sm text-muted-foreground mt-0.5">
              {page.description}
            </p>
          )}
          {notebook && (
            <p className="text-xs text-muted-foreground mt-1">
              {notebook.title}
              {notebook.language && ` · ${notebook.language}`}
              {notebook.kernel && ` · ${notebook.kernel}`}
            </p>
          )}
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        {!notebook ? (
          <div className="text-center py-20 text-muted-foreground">
            <p>No notebook is attached to this page.</p>
          </div>
        ) : (
          <NotebookRenderer notebook={notebook} />
        )}
      </main>
    </div>
  );
}
