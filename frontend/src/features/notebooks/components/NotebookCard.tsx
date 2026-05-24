import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { RefreshCw, Archive, Trash2, Eye, Link2, Code, Upload } from "lucide-react";
import type { Notebook } from "@/types";

interface Props {
  notebook: Notebook;
  onReload: (id: string) => Promise<unknown>;
  onArchive: (id: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onPreview: (notebook: Notebook) => void;
  onAttach: (notebook: Notebook) => void;
}

const statusPill: Record<string, string> = {
  active:   "bg-green-500/15 text-green-700 dark:text-green-400",
  archived: "bg-orange-500/15 text-orange-600",
  deleted:  "bg-destructive/15 text-destructive",
};

export function NotebookCard({ notebook, onReload, onArchive, onDelete, onPreview, onAttach }: Props) {
  const [reloading, setReloading] = useState(false);

  const cells = (() => {
    if (!notebook.cells) return [];
    if (Array.isArray(notebook.cells)) return notebook.cells;
    try { const p = JSON.parse(notebook.cells as unknown as string); return Array.isArray(p) ? p : []; }
    catch { return []; }
  })();

  const codeCells = cells.filter((c: { type: string }) => c.type === "code").length;
  const mdCells   = cells.filter((c: { type: string }) => c.type === "markdown").length;

  async function handleReload() {
    setReloading(true);
    try { await onReload(notebook.id); } finally { setReloading(false); }
  }

  return (
    <div className="glass-card flex flex-col">
      {/* Header */}
      <div className="p-5 border-b border-border/50">
        <div className="flex items-center gap-2 mb-1">
          {notebook.sourceType === "github_url"
            ? <Code className="w-3.5 h-3.5 text-primary/60 shrink-0" />
            : <Upload className="w-3.5 h-3.5 text-primary/60 shrink-0" />}
          <p className="font-black text-sm truncate">{notebook.title}</p>
        </div>
        {notebook.description && (
          <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{notebook.description}</p>
        )}
      </div>

      {/* Meta */}
      <div className="px-5 py-3 flex items-center gap-2 flex-wrap text-xs text-muted-foreground border-b border-border/30">
        <span className={`px-2 py-0.5 rounded-full font-semibold text-[10px] ${statusPill[notebook.status] ?? ""}`}>
          {notebook.status}
        </span>
        {notebook.language && (
          <span className="px-2 py-0.5 rounded-full border border-border font-mono text-[10px]">
            {notebook.language}
          </span>
        )}
        {cells.length > 0 && <span>{codeCells} code · {mdCells} md</span>}
        <span className="ml-auto">
          {formatDistanceToNow(new Date(notebook.updatedAt), { addSuffix: true })}
        </span>
      </div>

      {/* Actions */}
      <div className="p-4 flex flex-col gap-2 mt-auto">
        <div className="flex gap-2">
          <button
            onClick={() => onPreview(notebook)}
            className="btn-ghost flex-1 flex items-center justify-center gap-1.5 text-xs min-h-0 py-2 px-3"
          >
            <Eye className="w-3.5 h-3.5" /> Preview
          </button>
          <button
            onClick={() => onAttach(notebook)}
            className="btn-primary flex-1 flex items-center justify-center gap-1.5 text-xs min-h-0 py-2 px-3"
          >
            <Link2 className="w-3.5 h-3.5" /> Attach
          </button>
        </div>
        <div className="flex gap-2">
          {notebook.sourceType === "github_url" && (
            <button
              onClick={handleReload}
              disabled={reloading}
              className="btn-ghost flex-1 flex items-center justify-center gap-1.5 text-xs min-h-0 py-1.5 px-3"
            >
              <RefreshCw className={`w-3 h-3 ${reloading ? "animate-spin" : ""}`} />
              {reloading ? "Reloading…" : "Reload"}
            </button>
          )}
          {notebook.status === "active" && (
            <button
              onClick={() => onArchive(notebook.id)}
              className="btn-ghost flex-1 flex items-center justify-center gap-1.5 text-xs min-h-0 py-1.5 px-3"
            >
              <Archive className="w-3 h-3" /> Archive
            </button>
          )}
          <button
            onClick={() => { if (confirm(`Delete "${notebook.title}"?`)) onDelete(notebook.id); }}
            className="btn-ghost flex items-center justify-center gap-1.5 text-xs min-h-0 py-1.5 px-3 hover:bg-destructive/15 hover:text-destructive hover:border-destructive/40"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
}
