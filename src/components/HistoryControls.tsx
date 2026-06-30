"use client";

import { useEffect } from "react";
import { useStructStore } from "@/store/useStructStore";
import Button from "@/components/ui/Button";
import { UndoIcon, RedoIcon } from "@/components/ui/icons";

export default function HistoryControls() {
  const undo = useStructStore((s) => s.undo);
  const redo = useStructStore((s) => s.redo);
  const canUndo = useStructStore((s) => s.past.length > 0);
  const canRedo = useStructStore((s) => s.future.length > 0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const tag = t?.tagName?.toLowerCase();
      // Let inputs handle their own text undo/redo.
      if (tag === "input" || tag === "textarea" || tag === "select" || t?.isContentEditable) {
        return;
      }
      if (!(e.ctrlKey || e.metaKey)) return;
      const key = e.key.toLowerCase();
      if (key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if (key === "y" || (key === "z" && e.shiftKey)) {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo]);

  return (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="icon"
        className="text-muted hover:text-foreground"
        onClick={undo}
        disabled={!canUndo}
        aria-label="Undo (Ctrl+Z)"
        title="Undo (Ctrl+Z)"
      >
        <UndoIcon />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="text-muted hover:text-foreground"
        onClick={redo}
        disabled={!canRedo}
        aria-label="Redo (Ctrl+Y)"
        title="Redo (Ctrl+Y)"
      >
        <RedoIcon />
      </Button>
    </div>
  );
}
