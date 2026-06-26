// DiffView.tsx  ← PERSON B
"use client";

import { useStructStore } from "@/store/useStructStore";
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

  // Compare the latest saved version with the current working model.
  const last = versions[versions.length - 1];
  const entries = last ? diffVersions(last.model, current) : [];

  return (
    <Panel
      title="Changes"
      description="Differences between the latest version and your current edits."
    >
      {!last ? (
        <p className="text-sm text-muted">Save a version first to compare changes.</p>
      ) : entries.length === 0 ? (
        <p className="text-sm text-muted">No changes since {last.label}.</p>
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
    </Panel>
  );
}
