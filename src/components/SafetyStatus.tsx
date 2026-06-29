"use client";

import { useStructStore, resolveComparison } from "@/store/useStructStore";
import { analyzeCompatibility, summarizeWarnings } from "@/engine/compatibility";

export default function SafetyStatus() {
  const versions = useStructStore((s) => s.versions);
  const current = useStructStore((s) => s.currentModel);
  const baseVersionId = useStructStore((s) => s.baseVersionId);
  const targetVersionId = useStructStore((s) => s.targetVersionId);

  if (versions.length === 0) return null;

  const cmp = resolveComparison(versions, current, baseVersionId, targetVersionId);
  const warnings =
    cmp.fromModel && cmp.toModel
      ? analyzeCompatibility(cmp.fromModel, cmp.toModel)
      : [];
  const summary = summarizeWarnings(warnings);

  if (summary.total === 0) {
    return (
      <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-sm font-medium text-emerald-600 dark:text-emerald-400">
        Safe - no compatibility issues from {cmp.fromLabel} to {cmp.toLabel}.
      </div>
    );
  }

  const parts: string[] = [];
  if (summary.danger) parts.push(`${summary.danger} breaking`);
  if (summary.warning)
    parts.push(`${summary.warning} warning${summary.warning > 1 ? "s" : ""}`);
  if (summary.info) parts.push(`${summary.info} note${summary.info > 1 ? "s" : ""}`);

  const color = summary.danger
    ? "border-danger/30 bg-danger/10 text-danger"
    : summary.warning
      ? "border-warning/30 bg-warning/10 text-warning"
      : "border-info/30 bg-info/10 text-info";

  return (
    <div className={`rounded-lg border px-4 py-2.5 text-sm font-semibold ${color}`}>
      {parts.join(" - ")} from {cmp.fromLabel} to {cmp.toLabel}
    </div>
  );
}
