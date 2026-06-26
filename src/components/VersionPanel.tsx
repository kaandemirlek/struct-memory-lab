// VersionPanel.tsx  ← PERSON B
"use client";

import { useState } from "react";
import { useStructStore, resolveComparison } from "@/store/useStructStore";
import Panel from "@/components/ui/Panel";
import Button from "@/components/ui/Button";
import { RestoreIcon, PencilIcon, TrashIcon } from "@/components/ui/icons";

export default function VersionPanel() {
  const versions = useStructStore((s) => s.versions);
  const saveVersion = useStructStore((s) => s.saveVersion);
  const loadVersion = useStructStore((s) => s.loadVersion);
  const current = useStructStore((s) => s.currentModel);
  const setBaseVersion = useStructStore((s) => s.setBaseVersion);
  const setTargetVersion = useStructStore((s) => s.setTargetVersion);
  const renameVersion = useStructStore((s) => s.renameVersion);
  const deleteVersion = useStructStore((s) => s.deleteVersion);
  const baseVersionId = useStructStore((s) => s.baseVersionId);
  const targetVersionId = useStructStore((s) => s.targetVersionId);
  const { fromVersionId, toVersionId } = resolveComparison(
    versions,
    current,
    baseVersionId,
    targetVersionId
  );

  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const startEdit = (id: string, label: string) => {
    setConfirmingId(null);
    setEditingId(id);
    setDraft(label);
  };

  const commitEdit = () => {
    if (editingId) {
      const label = draft.trim();
      if (label) renameVersion(editingId, label);
    }
    setEditingId(null);
  };

  const startDelete = (id: string) => {
    setEditingId(null);
    setConfirmingId(id);
  };

  const confirmDelete = (id: string) => {
    deleteVersion(id);
    setConfirmingId(null);
  };

  return (
    <Panel
      title="Versions"
      description="Left-click a row for From, right-click for To, double-click to rename."
      actions={
        <Button variant="primary" onClick={saveVersion}>
          Save version
        </Button>
      }
    >
      {versions.length === 0 ? (
        <p className="text-sm text-muted">
          No versions yet. Save one to start tracking changes.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {versions.map((v) => {
            const isFrom = fromVersionId === v.id;
            const isTo = toVersionId === v.id;
            const isEditing = editingId === v.id;
            const isConfirming = confirmingId === v.id;
            const selectable = !isEditing && !isConfirming;

            return (
              <li
                key={v.id}
                onClick={selectable ? () => setBaseVersion(v.id) : undefined}
                onDoubleClick={
                  selectable ? () => startEdit(v.id, v.label) : undefined
                }
                onContextMenu={
                  selectable
                    ? (e) => {
                        e.preventDefault();
                        setTargetVersion(v.id);
                      }
                    : undefined
                }
                title={
                  selectable
                    ? "Left-click: From · Right-click: To · Double-click: rename"
                    : undefined
                }
                className={`flex select-none items-center gap-2 rounded-lg border px-3 py-2 transition-colors ${
                  selectable ? "cursor-pointer" : ""
                } ${
                  isFrom
                    ? "border-accent bg-accent/10"
                    : isTo
                      ? "border-emerald-500/50 bg-emerald-500/10"
                      : "border-border"
                }`}
              >
                {isEditing ? (
                  <div className="relative min-w-0 flex-1">
                    <input
                      autoFocus
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      onBlur={() => setEditingId(null)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") commitEdit();
                        if (e.key === "Escape") setEditingId(null);
                      }}
                      className="w-full rounded border border-border bg-surface-muted py-1 pl-2 pr-24 text-sm outline-none focus:border-accent"
                    />
                    {/* Faint inline hints: gray "enter" updates, red "esc" cancels. */}
                    <div className="pointer-events-none absolute inset-y-0 right-2 flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide">
                      <span className="rounded bg-foreground/5 px-1.5 py-0.5 text-muted/70">
                        enter
                      </span>
                      <span className="rounded bg-danger/10 px-1.5 py-0.5 text-danger/60">
                        esc
                      </span>
                    </div>
                  </div>
                ) : isConfirming ? (
                  <>
                    <span className="min-w-0 flex-1 truncate text-sm text-danger">
                      Delete {v.label}?
                    </span>
                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => confirmDelete(v.id)}
                      >
                        Delete
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setConfirmingId(null)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex min-w-0 flex-1 items-center gap-2 text-sm">
                      <span className="truncate font-medium">{v.label}</span>
                      <span className="shrink-0 text-xs text-muted">
                        {v.model.fields.length} fields
                      </span>
                      {isFrom && (
                        <span className="shrink-0 rounded bg-accent/15 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-accent">
                          From
                        </span>
                      )}
                      {isTo && (
                        <span className="shrink-0 rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
                          To
                        </span>
                      )}
                    </div>
                    {/* Stop clicks here from also selecting the row. */}
                    <div
                      className="flex shrink-0 items-center gap-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-muted hover:text-foreground"
                        aria-label="Restore this version into the editor"
                        title="Restore into editor"
                        onClick={() => loadVersion(v.id)}
                      >
                        <RestoreIcon />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-muted hover:text-foreground"
                        aria-label="Rename this version"
                        title="Rename (or double-click the row)"
                        onClick={() => startEdit(v.id, v.label)}
                      >
                        <PencilIcon />
                      </Button>
                      <Button
                        variant="danger"
                        size="icon"
                        aria-label="Delete this version"
                        title="Delete"
                        onClick={() => startDelete(v.id)}
                      >
                        <TrashIcon />
                      </Button>
                    </div>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}
