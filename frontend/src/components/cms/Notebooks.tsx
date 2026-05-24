import { useState } from "react";
import { Plus, BookOpen, Search } from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";
import { useNotebooks } from "@notebooks/hooks/useNotebooks";
import { NotebookCard } from "@notebooks/components/NotebookCard";
import { NotebookPreviewSheet } from "@notebooks/components/NotebookPreviewSheet";
import { AddNotebookDialog } from "@notebooks/components/AddNotebookDialog";
import { AttachNotebookDialog } from "@notebooks/components/AttachNotebookDialog";
import type { Notebook } from "@/types";

type StatusFilter = "all" | "active" | "archived";

export default function CmsNotebooksPage() {
  const { notebooks, loading, error, refresh, reload, archive, remove, addToList } = useNotebooks();

  const [addOpen, setAddOpen] = useState(false);
  const [preview, setPreview] = useState<Notebook | null>(null);
  const [attaching, setAttaching] = useState<Notebook | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const filtered = notebooks
    .filter((nb) => statusFilter === "all" || nb.status === statusFilter)
    .filter((nb) =>
      !search ||
      nb.title.toLowerCase().includes(search.toLowerCase()) ||
      nb.description.toLowerCase().includes(search.toLowerCase()),
    );

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-black">Notebooks</h1>
        <button onClick={() => setAddOpen(true)} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> Import Notebook
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            className="input-field pl-10"
            placeholder="Search notebooks…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          className="input-field w-40"
        >
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="archived">Archived</option>
        </select>
      </div>

      {/* Error */}
      {error && (
        <div className="glass-card p-4 border-destructive/40 text-destructive text-sm font-semibold">
          {error}
        </div>
      )}

      {/* Grid */}
      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-48 rounded-2xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass-card p-16 text-center flex flex-col items-center gap-3">
          <BookOpen className="w-10 h-10 text-primary/25" />
          <p className="font-bold text-base">
            {notebooks.length === 0 ? "No notebooks yet" : "No results"}
          </p>
          <p className="text-sm text-muted-foreground">
            {notebooks.length === 0
              ? "Import a Jupyter notebook from GitHub or upload a local .ipynb file."
              : "Try a different search or filter."}
          </p>
          {notebooks.length === 0 && (
            <button onClick={() => setAddOpen(true)} className="btn-primary mt-2 flex items-center gap-2">
              <Plus className="w-4 h-4" /> Import your first notebook
            </button>
          )}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((nb) => (
            <NotebookCard
              key={nb.id}
              notebook={nb}
              onReload={reload}
              onArchive={archive}
              onDelete={remove}
              onPreview={setPreview}
              onAttach={setAttaching}
            />
          ))}
        </div>
      )}

      <AddNotebookDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onCreated={(nb) => { addToList(nb); setPreview(nb); }}
      />
      <AttachNotebookDialog
        notebook={attaching}
        open={!!attaching}
        onClose={() => setAttaching(null)}
        onAttached={(_nbId, _pageId) => { refresh(); setAttaching(null); }}
      />
      <NotebookPreviewSheet
        notebook={preview}
        open={!!preview}
        onClose={() => setPreview(null)}
      />
    </div>
  );
}
