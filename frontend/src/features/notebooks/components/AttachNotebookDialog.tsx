import { useEffect, useState } from "react";
import { Loader2, Search, Link2, CheckCircle2 } from "lucide-react";
import type { Notebook, Page } from "@/types";
import { notebooksApi } from "@notebooks/api/notebooksApi";
import { pagesApi } from "@/api/client";
import OverlayPanel from "@/components/ui/OverlayPanel";

interface Props {
  notebook: Notebook | null;
  open: boolean;
  onClose: () => void;
  onAttached: (notebookId: string, pageId: string) => void;
}

export function AttachNotebookDialog({ notebook, open, onClose, onAttached }: Props) {
  const [pages, setPages] = useState<Page[]>([]);
  const [filtered, setFiltered] = useState<Page[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [attaching, setAttaching] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attached, setAttached] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setSearch("trace");
    setAttached(null);
    setError(null);
    pagesApi.list()
      .then((r) => { setPages(r.data); setFiltered(r.data); })
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, [open]);

  useEffect(() => {
    const q = search.toLowerCase();
    setFiltered(q ? pages.filter((p) => p.title.toLowerCase().includes(q) || p.slug.toLowerCase().includes(q)) : pages);
  }, [search, pages]);

  async function handleAttach(pageId: string) {
    if (!notebook) return;
    setAttaching(pageId);
    setError(null);
    try {
      await notebooksApi.attachToPage(notebook.id, pageId);
      setAttached(pageId);
      onAttached(notebook.id, pageId);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setAttaching(null);
    }
  }

  return (
    <OverlayPanel
      open={open}
      onClose={onClose}
      title="Attach to Page"
      subtitle={notebook ? `Choose which page displays "${notebook.title}"` : undefined}
    >
      {/* Search */}
      <div className="relative mb-5">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          className="input-field pl-10"
          placeholder="Search pages…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {error && <p className="text-sm font-semibold text-destructive mb-4">{error}</p>}

      {/* Pages list */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground py-10">No pages found</p>
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map((page) => {
            const isAttached = attached === page.id;
            const isLoading = attaching === page.id;
            const hasOther = !!page.notebookId && page.notebookId !== notebook?.id;

            return (
              <div
                key={page.id}
                className="glass-card p-4 flex items-center justify-between gap-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-sm truncate">{page.title}</p>
                    {hasOther && (
                      <span className="px-2 py-0.5 rounded-full bg-orange-500/15 text-orange-600 text-[10px] font-semibold shrink-0">
                        has notebook
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">/{page.slug}</p>
                </div>
                <button
                  disabled={isLoading || isAttached}
                  onClick={() => handleAttach(page.id)}
                  className={`flex items-center gap-1.5 text-xs font-bold min-h-0 py-2 px-4 rounded-xl border-2 transition-all shrink-0 ${
                    isAttached
                      ? "border-green-500/40 text-green-600 bg-green-500/10 cursor-default"
                      : "btn-primary"
                  }`}
                >
                  {isLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {isAttached
                    ? <><CheckCircle2 className="w-3.5 h-3.5" /> Attached</>
                    : <><Link2 className="w-3.5 h-3.5" /> Attach</>}
                </button>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-8">
        <button onClick={onClose} className="btn-ghost w-full">Done</button>
      </div>
    </OverlayPanel>
  );
}
