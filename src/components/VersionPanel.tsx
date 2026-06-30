"use client";

import { useState, type ReactNode } from "react";
import {
  useStructStore,
  resolveComparison,
  CURRENT_EDITS,
  CURRENT_EDITS_LABEL,
} from "@/store/useStructStore";
import { timeAgo } from "@/engine/versioning";
import { diffVersions, summarizeDiff } from "@/engine/diff";
import type { Version } from "@/types";
import Panel from "@/components/ui/Panel";
import Button from "@/components/ui/Button";
import { RestoreIcon, PencilIcon, TrashIcon } from "@/components/ui/icons";

/** Compact, colored "what changed vs the previous version" summary. */
function VersionChangeSummary({ prev, curr }: { prev?: Version; curr: Version }) {
  if (!prev) return <span className="text-muted">Initial version</span>;
  const s = summarizeDiff(diffVersions(prev.model, curr.model));
  const parts: ReactNode[] = [];
  if (s.added)
    parts.push(
      <span key="a" className="text-emerald-600 dark:text-emerald-400">
        +{s.added}
      </span>
    );
  if (s.removed)
    parts.push(
      <span key="r" className="text-danger">
        −{s.removed}
      </span>
    );
  if (s.changed)
    parts.push(
      <span key="c" className="text-warning">
        ~{s.changed}
      </span>
    );
  if (s.reordered)
    parts.push(
      <span key="o" className="text-muted">
        reordered
      </span>
    );
  if (parts.length === 0) return <span className="text-muted">no changes</span>;
  return <>{parts}</>;
}

export default function VersionPanel({
  collapseAction,
}: {
  collapseAction?: ReactNode;
}) {
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
  const { fromVersionId, toVersionId, fromValue, toValue } = resolveComparison(
    versions,
    current,
    baseVersionId,
    targetVersionId
  );
  const isCurrentFrom = fromValue === CURRENT_EDITS;
  const isCurrentTo = toValue === CURRENT_EDITS;

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
      collapsible
      defaultOpen
      summary={
        <span className="text-muted">
          {versions.length} {versions.length === 1 ? "version" : "versions"}
        </span>
      }
      actions={
        <>
          <Button variant="primary" size="sm" onClick={saveVersion}>
            Save version
          </Button>
          {collapseAction}
        </>
      }
    >
      {versions.length === 0 ? (
        <p className="text-sm text-muted">
          No versions yet. Save one to start tracking changes.
        </p>
      ) : (
        <ul className="space-y-2">
          {versions.map((v, idx) => {
            const isFrom = fromVersionId === v.id;
            const isTo = toVersionId === v.id;
            const isEditing = editingId === v.id;
            const isConfirming = confirmingId === v.id;
            const selectable = !isEditing && !isConfirming;

            return (
              <li
                key={v.id}
                onClick={selectable ? () => setBaseVersion(v.id) : undefined}
                onDoubleClick={selectable ? () => startEdit(v.id, v.label) : undefined}
                onContextMenu={(e) => {
                  e.preventDefault();
                  if (selectable) setTargetVersion(v.id);
                }}
                title={selectable ? "Left-click: From. Right-click: To." : undefined}
                className={`rounded-lg border p-2.5 transition-colors ${
                  selectable ? "cursor-pointer hover:border-accent/50" : ""
                } ${
                  isFrom
                    ? "border-accent bg-accent/10"
                    : isTo
                      ? "border-emerald-500/50 bg-emerald-500/10"
                      : "border-border bg-surface"
                }`}
              >
                {isEditing ? (
                  <div className="space-y-2">
                    <input
                      autoFocus
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      onBlur={() => setEditingId(null)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") commitEdit();
                        if (e.key === "Escape") setEditingId(null);
                      }}
                      className="w-full rounded-md border border-border bg-surface-muted px-2 py-1.5 text-sm outline-none focus:border-accent"
                    />
                    <div className="flex justify-end gap-1">
                      <Button variant="primary" size="sm" onMouseDown={commitEdit}>
                        Save
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onMouseDown={() => setEditingId(null)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : isConfirming ? (
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-danger">
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
                  </div>
                ) : (
                  <div className="flex items-start justify-between gap-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setBaseVersion(v.id);
                      }}
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        startEdit(v.id, v.label);
                      }}
                      className="block min-w-0 flex-1 text-left"
                      title="Left-click: From. Right-click: To. Double-click: rename."
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="min-w-0 truncate text-sm font-semibold">
                          {v.label}
                        </span>
                        {isFrom && (
                          <span className="shrink-0 rounded bg-accent/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-accent">
                            From
                          </span>
                        )}
                        {isTo && (
                          <span className="shrink-0 rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-emerald-600 dark:text-emerald-400">
                            To
                          </span>
                        )}
                      </span>
                      <span
                        className="mt-0.5 block text-xs text-muted"
                        title={new Date(v.createdAt).toLocaleString()}
                      >
                        {v.model.fields.length} fields - {timeAgo(v.createdAt)}
                      </span>
                      <span className="mt-1 flex flex-wrap items-center gap-1.5 text-xs font-medium">
                        <VersionChangeSummary prev={versions[idx - 1]} curr={v} />
                      </span>
                    </button>

                    <div
                      className="flex shrink-0 items-center gap-0.5"
                      onClick={(e) => e.stopPropagation()}
                      onDoubleClick={(e) => e.stopPropagation()}
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
                        title="Rename"
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
                  </div>
                )}
              </li>
            );
          })}

          <li
            role="button"
            tabIndex={0}
            onClick={() => setBaseVersion(CURRENT_EDITS)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setBaseVersion(CURRENT_EDITS);
              }
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              setTargetVersion(null);
            }}
            title="Live working state. Left-click: From. Right-click: To."
            className={`cursor-pointer rounded-lg border border-dashed p-2.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
              isCurrentFrom
                ? "border-accent bg-accent/10"
                : isCurrentTo
                  ? "border-emerald-500/50 bg-emerald-500/10"
                  : "border-border hover:border-accent/50"
            }`}
          >
            <span className="flex min-w-0 items-center gap-2">
              <span className="min-w-0 truncate text-sm font-semibold">
                {CURRENT_EDITS_LABEL}
              </span>
              {isCurrentFrom && (
                <span className="shrink-0 rounded bg-accent/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-accent">
                  From
                </span>
              )}
              {isCurrentTo && (
                <span className="shrink-0 rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-emerald-600 dark:text-emerald-400">
                  To
                </span>
              )}
            </span>
            <span className="mt-0.5 block text-xs text-muted">
              {current.fields.length} fields · unsaved
            </span>
          </li>
        </ul>
      )}
    </Panel>
  );
}
