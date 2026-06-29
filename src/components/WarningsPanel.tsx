// WarningsPanel.tsx  ← PERSON B
"use client";

import { useEffect, useRef, useState } from "react";
import { useStructStore, resolveComparison } from "@/store/useStructStore";
import {
  analyzeCompatibility,
  sortWarnings,
  summarizeWarnings,
} from "@/engine/compatibility";
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

  const cmp = resolveComparison(versions, current, baseVersionId, targetVersionId);
  const warnings =
    cmp.fromModel && cmp.toModel
      ? analyzeCompatibility(cmp.fromModel, cmp.toModel)
      : [];

  const sorted = sortWarnings(warnings);
  const summaryCounts = summarizeWarnings(warnings);

  // Auto-open when issues appear, auto-close when clean; respect manual toggle otherwise.
  const [open, setOpen] = useState(warnings.length > 0);
  const prevCount = useRef(warnings.length);
  useEffect(() => {
    if (prevCount.current === 0 && warnings.length > 0) setOpen(true);
    else if (prevCount.current > 0 && warnings.length === 0) setOpen(false);
    prevCount.current = warnings.length;
  }, [warnings.length]);

  const verdictParts: string[] = [];
  if (summaryCounts.danger) verdictParts.push(`${summaryCounts.danger} breaking`);
  if (summaryCounts.warning)
    verdictParts.push(
      `${summaryCounts.warning} warning${summaryCounts.warning > 1 ? "s" : ""}`
    );
  if (summaryCounts.info)
    verdictParts.push(`${summaryCounts.info} note${summaryCounts.info > 1 ? "s" : ""}`);
  const verdictColor = summaryCounts.danger
    ? "text-danger"
    : summaryCounts.warning
      ? "text-warning"
      : "text-info";

  const summary =
    versions.length === 0 ? (
      <span className="text-muted">—</span>
    ) : warnings.length === 0 ? (
      <span className="font-medium text-emerald-600 dark:text-emerald-400">Safe</span>
    ) : (
      <span className={`font-semibold ${verdictColor}`}>
        {verdictParts.join(" · ")}
      </span>
    );

  return (
    <Panel
      title="Compatibility"
      collapsible
      summary={summary}
      open={open}
      onOpenChange={setOpen}
    >
      {versions.length === 0 ? (
        <p className="text-sm text-muted">
          Save a version first to check compatibility.
        </p>
      ) : warnings.length === 0 ? (
        <p className="text-sm text-muted">No compatibility issues detected.</p>
      ) : (
        <ul className="space-y-1.5">
          {sorted.map((w, i) => (
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
