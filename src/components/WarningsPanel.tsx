// WarningsPanel.tsx  ← PERSON B
"use client";

import { useStructStore, resolveComparison } from "@/store/useStructStore";
import { analyzeCompatibility } from "@/engine/compatibility";
import type { WarningSeverity } from "@/types";
import Panel from "@/components/ui/Panel";

const STYLES: Record<WarningSeverity, string> = {
  danger: "border-danger/30 bg-danger/10 text-danger",
  warning: "border-warning/30 bg-warning/10 text-warning",
  info: "border-info/30 bg-info/10 text-info",
};

export default function WarningsPanel() {
  const versions = useStructStore((s) => s.versions);
  const current = useStructStore((s) => s.currentModel);
  const baseVersionId = useStructStore((s) => s.baseVersionId);
  const targetVersionId = useStructStore((s) => s.targetVersionId);

  // Uses the same From/To selection chosen in the Changes panel.
  const cmp = resolveComparison(versions, current, baseVersionId, targetVersionId);
  const warnings =
    cmp.fromModel && cmp.toModel
      ? analyzeCompatibility(cmp.fromModel, cmp.toModel)
      : [];

  return (
    <Panel
      title="Compatibility"
      description={
        versions.length > 0
          ? `Risks going from ${cmp.fromLabel} to ${cmp.toLabel}.`
          : "Risks introduced by changes between two versions."
      }
    >
      {versions.length === 0 ? (
        <p className="text-sm text-muted">
          Save a version first to check compatibility.
        </p>
      ) : warnings.length === 0 ? (
        <p className="text-sm text-muted">No compatibility issues detected.</p>
      ) : (
        <ul className="space-y-1.5">
          {warnings.map((w, i) => (
            <li
              key={i}
              className={`break-words rounded-lg border px-3 py-2 text-sm ${STYLES[w.severity]}`}
            >
              {w.message}
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
