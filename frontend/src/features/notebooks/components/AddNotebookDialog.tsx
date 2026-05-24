import { useRef, useState } from "react";
import { Loader2, Upload, Code } from "lucide-react";
import { notebooksApi } from "@notebooks/api/notebooksApi";
import OverlayPanel from "@/components/ui/OverlayPanel";
import type { Notebook } from "@/types";

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: (nb: Notebook) => void;
}

export function AddNotebookDialog({ open, onClose, onCreated }: Props) {
  const [tab, setTab] = useState<"github" | "upload">("github");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [ghTitle, setGhTitle] = useState("");
  const [ghDesc, setGhDesc] = useState("");
  const [ghUrl, setGhUrl] = useState("");

  const [upTitle, setUpTitle] = useState("");
  const [upDesc, setUpDesc] = useState("");
  const [upFile, setUpFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function reset() {
    setGhTitle(""); setGhDesc(""); setGhUrl("");
    setUpTitle(""); setUpDesc(""); setUpFile(null);
    setError(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  function handleClose() { reset(); onClose(); }

  async function handleSubmit() {
    setError(null);
    setLoading(true);
    try {
      let nb: Notebook;
      if (tab === "github") {
        if (!ghTitle.trim() || !ghUrl.trim()) { setError("Title and GitHub URL are required."); return; }
        nb = await notebooksApi.createFromGitHub({
          title: ghTitle.trim(), description: ghDesc.trim(),
          sourceType: "github_url", sourceUrl: ghUrl.trim(),
        });
      } else {
        if (!upTitle.trim() || !upFile) { setError("Title and file are required."); return; }
        nb = await notebooksApi.createFromUpload(upFile, upTitle.trim(), upDesc.trim());
      }
      onCreated(nb);
      reset();
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <OverlayPanel open={open} onClose={handleClose} title="Import Notebook" subtitle="Add a Jupyter notebook from GitHub or upload a local .ipynb file">
      {/* Tab switcher */}
      <div className="flex gap-2 mb-6">
        {([
          { value: "github", label: "GitHub URL", icon: Code },
          { value: "upload", label: "Local File",  icon: Upload },
        ] as const).map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            onClick={() => { setTab(value); setError(null); }}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-sm transition-all border-2 ${
              tab === value
                ? "bg-primary text-primary-foreground border-primary shadow-sm"
                : "border-border hover:bg-primary/10 hover:border-primary"
            }`}
          >
            <Icon className="w-4 h-4" /> {label}
          </button>
        ))}
      </div>

      {/* GitHub tab */}
      {tab === "github" && (
        <div className="flex flex-col gap-5">
          <div>
            <label className="form-label">Title <span className="text-destructive">*</span></label>
            <input
              className="input-field"
              value={ghTitle}
              onChange={(e) => setGhTitle(e.target.value)}
              placeholder="e.g. Nairobi Protest Data Analysis"
            />
          </div>
          <div>
            <label className="form-label">GitHub URL <span className="text-destructive">*</span></label>
            <input
              className="input-field"
              value={ghUrl}
              onChange={(e) => setGhUrl(e.target.value)}
              placeholder="https://github.com/user/repo/blob/main/analysis.ipynb"
            />
            <p className="text-xs text-muted-foreground mt-1.5">
              Blob or raw URLs both work — the raw URL is resolved automatically.
            </p>
          </div>
          <div>
            <label className="form-label">Description</label>
            <textarea
              className="input-field resize-none"
              rows={3}
              value={ghDesc}
              onChange={(e) => setGhDesc(e.target.value)}
              placeholder="Optional description shown in the CMS"
            />
          </div>
        </div>
      )}

      {/* Upload tab */}
      {tab === "upload" && (
        <div className="flex flex-col gap-5">
          <div>
            <label className="form-label">Title <span className="text-destructive">*</span></label>
            <input
              className="input-field"
              value={upTitle}
              onChange={(e) => setUpTitle(e.target.value)}
              placeholder="My notebook"
            />
          </div>
          <div>
            <label className="form-label">Notebook file (.ipynb) <span className="text-destructive">*</span></label>
            <input
              type="file"
              accept=".ipynb,application/json"
              ref={fileRef}
              onChange={(e) => setUpFile(e.target.files?.[0] ?? null)}
              className="input-field"
            />
            {upFile && (
              <p className="text-xs text-muted-foreground mt-1.5">
                {upFile.name} — {(upFile.size / 1024).toFixed(1)} KB
              </p>
            )}
          </div>
          <div>
            <label className="form-label">Description</label>
            <textarea
              className="input-field resize-none"
              rows={3}
              value={upDesc}
              onChange={(e) => setUpDesc(e.target.value)}
              placeholder="Optional description"
            />
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <p className="mt-4 text-sm font-semibold text-destructive">{error}</p>
      )}

      {/* Actions */}
      <div className="flex gap-3 mt-8">
        <button onClick={handleSubmit} disabled={loading} className="btn-primary flex items-center gap-2">
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          {loading ? "Importing…" : "Import Notebook"}
        </button>
        <button onClick={handleClose} disabled={loading} className="btn-ghost">
          Cancel
        </button>
      </div>
    </OverlayPanel>
  );
}
