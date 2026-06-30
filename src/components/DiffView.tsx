"use client";

import { useEffect, useRef, useState } from "react";
import { useStructStore, resolveComparison } from "@/store/useStructStore";
import { diffVersions, diffReport } from "@/engine/diff";
import type { DiffKind } from "@/types";
import Panel from "@/components/ui/Panel";
import Button from "@/components/ui/Button";
import { CopyIcon, DownloadIcon } from "@/components/ui/icons";

const safe = (s: string) => s.replace(/[^\w.-]+/g, "-");

const KIND_LABEL: Record<DiffKind, string> = {
  added: "Added",
  removed: "Removed",
  "type-changed": "Type",
  renamed: "Renamed",
  reordered: "Reordered",
};

const KIND_STYLE: Record<DiffKind, string> = {
  added:
    "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  removed: "border-danger/30 bg-danger/10 text-danger",
  "type-changed": "border-warning/30 bg-warning/10 text-warning",
  renamed: "border-warning/30 bg-warning/10 text-warning",
  reordered: "border-border bg-surface-muted text-muted",
};

export default function DiffView() {
  const versions = useStructStore((s) => s.versions);
  const current = useStructStore((s) => s.currentModel);
  const baseVersionId = useStructStore((s) => s.baseVersionId);
  const targetVersionId = useStructStore((s) => s.targetVersionId);

  const cmp = resolveComparison(versions, current, baseVersionId, targetVersionId);
  const entries =
    cmp.fromModel && cmp.toModel ? diffVersions(cmp.fromModel, cmp.toModel) : [];

  const [reportCopied, setReportCopied] = useState(false);
  const buildReport = () =>
    cmp.fromModel && cmp.toModel
      ? diffReport(cmp.fromModel, cmp.toModel, cmp.fromLabel, cmp.toLabel)
      : "";

  const copyReport = async () => {
    try {
      await navigator.clipboard.writeText(buildReport());
      setReportCopied(true);
      setTimeout(() => setReportCopied(false), 1500);
    } catch {
      setReportCopied(false);
    }
  };

  const downloadReport = () => {
    const blob = new Blob([buildReport()], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `diff-${safe(cmp.fromLabel)}-to-${safe(cmp.toLabel)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const [open, setOpen] = useState(entries.length > 0);
  const prevCount = useRef(entries.length);
  useEffect(() => {
    if (prevCount.current === 0 && entries.length > 0) setOpen(true);
    else if (prevCount.current > 0 && entries.length === 0) setOpen(false);
    prevCount.current = entries.length;
  }, [entries.length]);

  const summary =
    versions.length === 0 ? (
      <span className="text-muted">-</span>
    ) : entries.length > 0 ? (
      <span className="rounded-full bg-surface-muted px-2 py-0.5 font-medium text-muted">
        {entries.length} {entries.length === 1 ? "change" : "changes"}
      </span>
    ) : (
      <span className="text-muted">no changes</span>
    );

  return (
    <Panel
      title="Changes"
      collapsible
      summary={summary}
      open={open}
      onOpenChange={setOpen}
    >
      {versions.length === 0 ? (
        <p className="text-sm text-muted">Save a version first to compare changes.</p>
      ) : entries.length === 0 ? (
        <p className="break-words text-sm text-muted">
          No changes between {cmp.fromLabel} and {cmp.toLabel}.
        </p>
      ) : (
        <>
          <ul className="space-y-1.5 text-sm">
            {entries.map((e, i) => (
              <li key={i} className="flex items-center gap-2">
                <span
                  className={`shrink-0 rounded border px-1.5 py-0.5 text-xs font-medium ${KIND_STYLE[e.kind]}`}
                >
                  {KIND_LABEL[e.kind] ?? e.kind}
                </span>
                <span className="break-words">{e.detail}</span>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex gap-2">
            <Button variant="secondary" size="sm" onClick={copyReport}>
              <CopyIcon />
              {reportCopied ? "Copied" : "Copy report"}
            </Button>
            <Button variant="secondary" size="sm" onClick={downloadReport}>
              <DownloadIcon />
              Download .md
            </Button>
          </div>
        </>
      )}
    </Panel>
  );
}
