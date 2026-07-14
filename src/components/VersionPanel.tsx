"use client";

import { useState, type ReactNode } from "react";
import {
  CURRENT_EDITS,
  CURRENT_EDITS_LABEL,
  resolveComparison,
  useStructStore,
} from "@/store/useStructStore";
import { timeAgo } from "@/engine/versioning";
import { diffVersions, summarizeDiff } from "@/engine/diff";
import type { StructModel, Version } from "@/types";
import Panel from "@/components/ui/Panel";
import Button from "@/components/ui/Button";
import { RestoreIcon, PencilIcon, TrashIcon, LinkIcon } from "@/components/ui/icons";
import { buildShareUrl } from "@/lib/share";

export type VersionPanelMode = "edit" | "compare";

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
        -{s.removed}
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

// Karşılaştırma hedefi seçimi — gizli sağ-tık jesti yerine görünür From/To düğmeleri.
function FromToButtons({
  label,
  isFrom,
  isTo,
  onFrom,
  onTo,
}: {
  label: string;
  isFrom: boolean;
  isTo: boolean;
  onFrom: () => void;
  onTo: () => void;
}) {
  return (
    <span className="flex shrink-0 self-center overflow-hidden rounded-md border border-border">
      <button
        type="button"
        onClick={onFrom}
        aria-pressed={isFrom}
        title={`Compare from ${label}`}
        className={`px-1.5 py-1 text-[10px] font-semibold uppercase leading-none transition-colors ${
          isFrom
            ? "bg-accent/15 text-accent"
            : "text-muted hover:bg-surface-muted hover:text-foreground"
        }`}
      >
        From
      </button>
      <span className="w-px self-stretch bg-border" aria-hidden />
      <button
        type="button"
        onClick={onTo}
        aria-pressed={isTo}
        title={`Compare to ${label}`}
        className={`px-1.5 py-1 text-[10px] font-semibold uppercase leading-none transition-colors ${
          isTo
            ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
            : "text-muted hover:bg-surface-muted hover:text-foreground"
        }`}
      >
        To
      </button>
    </span>
  );
}

function LiveCard({
  model,
  active,
  onClick,
}: {
  model: StructModel;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <li
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      title="View your live, unsaved edits."
      aria-pressed={active}
      className={`cursor-pointer rounded-lg border border-dashed p-2.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
        active
          ? "border-accent bg-accent/10"
          : "border-accent/40 bg-accent/5 hover:border-accent/60"
      }`}
    >
      <span className="flex min-w-0 items-center gap-2">
        <span className="min-w-0 truncate text-sm font-semibold">
          {CURRENT_EDITS_LABEL}
        </span>
        {active && (
          <span className="shrink-0 rounded bg-accent/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-accent">
            Viewing
          </span>
        )}
      </span>
      <span className="mt-0.5 block min-w-0 truncate text-xs text-muted">
        {model.name || "Unnamed"} - {model.fields.length} fields - unsaved
      </span>
    </li>
  );
}

export default function VersionPanel({
  mode = "edit",
  collapseAction,
}: {
  mode?: VersionPanelMode;
  collapseAction?: ReactNode;
}) {
  const versions = useStructStore((s) => s.versions);
  const current = useStructStore((s) => s.currentModel);
  const saveVersion = useStructStore((s) => s.saveVersion);
  const loadVersion = useStructStore((s) => s.loadVersion);
  const previewVersionId = useStructStore((s) => s.previewVersionId);
  const setPreviewVersion = useStructStore((s) => s.setPreviewVersion);
  const renameVersion = useStructStore((s) => s.renameVersion);
  const deleteVersion = useStructStore((s) => s.deleteVersion);
  const baseVersionId = useStructStore((s) => s.baseVersionId);
  const targetVersionId = useStructStore((s) => s.targetVersionId);
  const setBaseVersion = useStructStore((s) => s.setBaseVersion);
  const setTargetVersion = useStructStore((s) => s.setTargetVersion);
  const { fromVersionId, toVersionId, fromValue, toValue } = resolveComparison(
    versions,
    current,
    baseVersionId,
    targetVersionId
  );

  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const shareVersion = async (versionId: string, model: StructModel) => {
    try {
      await navigator.clipboard.writeText(buildShareUrl(model));
      setCopiedId(versionId);
      setTimeout(() => setCopiedId((id) => (id === versionId ? null : id)), 1500);
    } catch {
      setCopiedId(null);
    }
  };

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

  if (mode === "compare") {
    const isCurrentFrom = fromValue === CURRENT_EDITS;
    const isCurrentTo = toValue === CURRENT_EDITS;

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
        actions={collapseAction}
      >
        {versions.length === 0 ? (
          <p className="text-sm text-muted">
            Save a version in Edit Layout before comparing.
          </p>
        ) : (
          <ul className="space-y-2 lg:max-h-[calc(100vh-250px)] lg:overflow-y-auto lg:pr-1">
            {versions.map((v) => {
              const isFrom = fromVersionId === v.id;
              const isTo = toVersionId === v.id;
              const isEditing = editingId === v.id;

              return (
                <li
                  key={v.id}
                  className={`rounded-lg border p-2.5 transition-colors ${
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
                  ) : (
                    <div className="flex items-start justify-between gap-2">
                      <div
                        onDoubleClick={() => startEdit(v.id, v.label)}
                        className="min-w-0 flex-1"
                      >
                        <span className="block min-w-0 truncate text-sm font-semibold">
                          {v.label}
                        </span>
                        <span
                          className="mt-0.5 block text-xs text-muted"
                          title={new Date(v.createdAt).toLocaleString()}
                        >
                          {v.model.fields.length} fields - {timeAgo(v.createdAt)}
                        </span>
                      </div>
                      <FromToButtons
                        label={v.label}
                        isFrom={isFrom}
                        isTo={isTo}
                        onFrom={() => setBaseVersion(v.id)}
                        onTo={() => setTargetVersion(v.id)}
                      />
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
                    </div>
                  )}
                </li>
              );
            })}

            <li
              title="Live working state (unsaved edits)."
              className={`rounded-lg border border-dashed p-2.5 transition-colors ${
                isCurrentFrom
                  ? "border-accent bg-accent/10"
                  : isCurrentTo
                    ? "border-emerald-500/50 bg-emerald-500/10"
                    : "border-border"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <span className="block min-w-0 truncate text-sm font-semibold">
                    {CURRENT_EDITS_LABEL}
                  </span>
                  <span className="mt-0.5 block text-xs text-muted">
                    {current.fields.length} fields - unsaved
                  </span>
                </div>
                <FromToButtons
                  label={CURRENT_EDITS_LABEL}
                  isFrom={isCurrentFrom}
                  isTo={isCurrentTo}
                  onFrom={() => setBaseVersion(CURRENT_EDITS)}
                  onTo={() => setTargetVersion(null)}
                />
              </div>
            </li>
          </ul>
        )}
      </Panel>
    );
  }

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
      <ul className="space-y-2 lg:max-h-[calc(100vh-250px)] lg:overflow-y-auto lg:pr-1">
        <LiveCard
          model={current}
          active={previewVersionId === null}
          onClick={() => setPreviewVersion(null)}
        />
        {versions.length === 0 ? (
          <li className="break-words rounded-lg border border-border bg-surface p-2.5 text-sm text-muted">
            No saved versions yet.
          </li>
        ) : (
          versions.map((v, idx) => {
            const isEditing = editingId === v.id;
            const isConfirming = confirmingId === v.id;
            const isPreviewing = previewVersionId === v.id;

            return (
              <li
                key={v.id}
                className={`rounded-lg border p-2.5 transition-colors ${
                  isPreviewing
                    ? "border-accent bg-accent/10"
                    : "border-border bg-surface hover:border-accent/50"
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
                      onClick={() => setPreviewVersion(v.id)}
                      onDoubleClick={() => startEdit(v.id, v.label)}
                      className="block min-w-0 flex-1 text-left"
                      title="Preview this version (read-only). Double-click to rename."
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="min-w-0 truncate text-sm font-semibold">
                          {v.label}
                        </span>
                        {isPreviewing && (
                          <span className="shrink-0 rounded bg-accent/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-accent">
                            Viewing
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
                        className={
                          copiedId === v.id
                            ? "text-accent"
                            : "text-muted hover:text-foreground"
                        }
                        aria-label="Copy a shareable link to this version"
                        title={copiedId === v.id ? "Link copied!" : "Copy share link"}
                        onClick={() => shareVersion(v.id, v.model)}
                      >
                        <LinkIcon />
                      </Button>
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
          })
        )}
      </ul>
    </Panel>
  );
}
