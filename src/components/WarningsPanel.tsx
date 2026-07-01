// WarningsPanel.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { useStructStore, resolveComparison } from "@/store/useStructStore";
import { generateCompatibilityReport } from "@/engine/compatibility";
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
  const report =
    cmp.fromModel && cmp.toModel
      ? generateCompatibilityReport(cmp.fromModel, cmp.toModel)
      : null;
  const warnings = report?.warnings ?? [];
  const summaryCounts = report?.summary ?? {
    danger: 0,
    warning: 0,
    info: 0,
    total: 0,
  };

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
  if (summaryCounts.warning) {
    verdictParts.push(
      `${summaryCounts.warning} warning${summaryCounts.warning > 1 ? "s" : ""}`
    );
  }
  if (summaryCounts.info) {
    verdictParts.push(
      `${summaryCounts.info} note${summaryCounts.info > 1 ? "s" : ""}`
    );
  }

  const verdictColor = summaryCounts.danger
    ? "text-danger"
    : summaryCounts.warning
      ? "text-warning"
      : "text-info";
  const verdictLabel =
    report?.verdict === "breaking"
      ? "Breaking changes found"
      : report?.verdict === "risky"
        ? "No breaking changes; review warnings"
        : "Compatible";

  const summary =
    versions.length === 0 ? (
      <span className="text-muted">-</span>
    ) : warnings.length === 0 ? (
      <span className="font-medium text-emerald-600 dark:text-emerald-400">
        Compatible
      </span>
    ) : (
      <span className={`font-semibold ${verdictColor}`}>
        {verdictParts.join(" / ")}
      </span>
    );

  const groups = report
    ? [
        { title: "Breaking changes", items: report.breakingChanges },
        { title: "Warnings", items: report.riskWarnings },
        { title: "Notes", items: report.notes },
      ]
    : [];

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
      ) : (
        <>
          {report && (
            <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
              <span className="text-muted">
                Comparing{" "}
                <span className="font-medium text-foreground">{cmp.fromLabel}</span>
                {" -> "}
                <span className="font-medium text-foreground">{cmp.toLabel}</span>
              </span>
              <span className={`font-semibold ${verdictColor}`}>
                Binary compatibility: {verdictLabel}
              </span>
            </div>
          )}

          {warnings.length === 0 ? (
            <p className="text-sm text-muted">No compatibility issues detected.</p>
          ) : (
            <div className="space-y-3">
              {groups.map(({ title, items }) =>
                items.length > 0 ? (
                  <section key={title}>
                    <h3 className="mb-1.5 text-xs font-semibold text-muted">
                      {title}
                    </h3>
                    <ul className="space-y-1.5">
                      {items.map((w, i) => (
                        <li
                          key={i}
                          className={`break-words rounded-lg border px-3 py-2 text-sm ${STYLES[w.severity]}`}
                        >
                          {w.message}
                        </li>
                      ))}
                    </ul>
                  </section>
                ) : null
              )}
            </div>
          )}
        </>
      )}
    </Panel>
  );
}
