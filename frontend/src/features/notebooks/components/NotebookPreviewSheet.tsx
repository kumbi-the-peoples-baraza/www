import OverlayPanel from "@/components/ui/OverlayPanel";
import { NotebookRenderer } from "./NotebookRenderer";
import type { Notebook } from "@/types";

interface Props {
  notebook: Notebook | null;
  open: boolean;
  onClose: () => void;
}

export function NotebookPreviewSheet({ notebook, open, onClose }: Props) {
  return (
    <OverlayPanel
      open={open}
      onClose={onClose}
      title={notebook?.title ?? "Preview"}
      subtitle={notebook?.description || (notebook ? `${notebook.language || ""}${notebook.kernel ? ` · ${notebook.kernel}` : ""}` : undefined)}
    >
      <NotebookRenderer notebook={notebook} showAll />
    </OverlayPanel>
  );
}
