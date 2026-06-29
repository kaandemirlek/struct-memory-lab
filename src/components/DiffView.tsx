// DiffView.tsx  ← PERSON B
"use client";

import {
  useStructStore,
  resolveComparison,
  CURRENT_EDITS,
} from "@/store/useStructStore";
import { diffVersions } from "@/engine/diff";
import type { DiffKind } from "@/types";
import Panel from "@/components/ui/Panel";

const KIND_LABEL: Record<DiffKind, string> = {
  added: "Added",
  removed: "Removed",
  "type-changed": "Type",
  renamed: "Renamed",
  reordered: "Reordered",
};

export default function DiffView() {
  const versions = useStructStore((s) => s.versions);
  const current = useStructStore((s) => s.currentModel);
  const baseVersionId = useStructStore((s) => s.baseVersionId);
  const targetVersionId = useStructStore((s) => s.targetVersionId);
  const setBaseVersion = useStructStore((s) => s.setBaseVersion);
  const setTargetVersion = useStructStore((s) => s.setTargetVersion);

  const cmp = resolveComparison(versions, current, baseVersionId, targetVersionId);
  const entries =
    cmp.fromModel && cmp.toModel ? diffVersions(cmp.fromModel, cmp.toModel) : [];

  return (
    <Panel
      title="Changes"
      description="Compare any version (or your current edits) with another."
      actions={
        entries.length > 0 ? (
          <span className="rounded-full bg-surface-muted px-2 py-0.5 text-xs font-medium text-muted">
            {entries.length} {entries.length === 1 ? "change" : "changes"}
          </span>
        ) : undefined
      }
    >
      {versions.length === 0 ? (
        <p className="text-sm text-muted">Save a version first to compare changes.</p>
      ) : (
        <>
          <div className="mb-3 flex items-center gap-2 text-xs">
            <select
              value={cmp.fromValue}
              onChange={(e) => setBaseVersion(e.target.value)}
              className="w-32 truncate rounded border border-border bg-surface-muted px-2 py-1 outline-none focus:border-accent"
              aria-label="Compare from"
            >
              <option value={CURRENT_EDITS}>Current edits</option>
              {versions.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.label}
                </option>
              ))}
            </select>
            <span className="shrink-0 text-muted">→</span>
            <select
              value={cmp.toValue}
              onChange={(e) =>
                setTargetVersion(
                  e.target.value === CURRENT_EDITS ? null : e.target.value
                )
              }
              className="w-32 truncate rounded border border-border bg-surface-muted px-2 py-1 outline-none focus:border-accent"
              aria-label="Compare to"
            >
              <option value={CURRENT_EDITS}>Current edits</option>
              {versions.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.label}
                </option>
              ))}
            </select>
          </div>

          {entries.length === 0 ? (
            <p className="break-words text-sm text-muted">
              No changes between {cmp.fromLabel} and {cmp.toLabel}.
            </p>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {entries.map((e, i) => (
                <li key={i} className="flex items-center gap-2">
                  <span className="rounded bg-surface-muted px-1.5 py-0.5 text-xs font-medium text-muted">
                    {KIND_LABEL[e.kind] ?? e.kind}
                  </span>
                  <span>{e.detail}</span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </Panel>
  );
}
