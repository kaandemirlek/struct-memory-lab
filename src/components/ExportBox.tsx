"use client";

import { useState } from "react";
import { useStructStore } from "@/store/useStructStore";
import { exportCpp } from "@/engine/exporter";
import { computeLayout } from "@/engine/layout";
import { validateStruct } from "@/engine/validation";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { CopyIcon, DownloadIcon, FileCodeIcon } from "@/components/ui/icons";

export default function ExportBox() {
  const model = useStructStore((s) => s.currentModel);
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const codePreviewClass =
    "bg-transparent p-4 font-mono text-sm leading-6 text-slate-100";

  const issues = validateStruct(model);
  const hasErrors = issues.length > 0;
  const code = exportCpp(model);
  const codeLines = code.trimEnd().split("\n");
  const layout = computeLayout(model);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  const download = () => {
    const blob = new Blob([code], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${model.name.trim() || "Struct"}.hpp`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <Button variant="primary" size="sm" onClick={() => setOpen(true)}>
        <DownloadIcon />
        Export
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Export"
        size="xl"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={download} disabled={hasErrors}>
              <DownloadIcon />
              Download .hpp
            </Button>
          </>
        }
      >
        {hasErrors && (
          <div className="mb-3 rounded-lg border border-danger/30 bg-danger/10 p-3 text-sm text-danger">
            <p className="mb-1 font-medium">
              Fix {issues.length} {issues.length === 1 ? "issue" : "issues"} before exporting:
            </p>
            <ul className="list-inside list-disc space-y-0.5">
              {issues.map((issue, i) => (
                <li key={i}>{issue.message}</li>
              ))}
            </ul>
          </div>
        )}
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
          <div className="overflow-hidden rounded-lg border border-border bg-[#111827] shadow-sm">
            <div className="flex items-center justify-between gap-3 border-b border-white/10 bg-[#0b1220] px-3 py-2">
              <div className="flex min-w-0 items-center gap-2 text-xs font-medium text-slate-300">
                <FileCodeIcon />
                <span className="truncate">{model.name.trim() || "Struct"}.hpp</span>
              </div>
              <span className="shrink-0 text-xs tabular-nums text-slate-500">
                {codeLines.length} lines
              </span>
            </div>
            <div className="max-h-[58vh] overflow-auto">
              <div className="grid min-w-max grid-cols-[3rem_minmax(0,1fr)]">
                <div
                  className="select-none border-r border-white/10 bg-black/20 px-2 py-4 text-right font-mono text-xs leading-6 text-slate-500"
                  aria-hidden
                >
                  {codeLines.map((_, i) => (
                    <div key={i}>{i + 1}</div>
                  ))}
                </div>
                <pre className={codePreviewClass}>{codeLines.join("\n")}</pre>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="rounded-lg border border-border bg-surface p-3">
              <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase text-muted">
                <FileCodeIcon />
                <span>Header</span>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted">Struct</span>
                  <span className="max-w-28 truncate font-medium">
                    {model.name.trim() || "Struct"}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted">Fields</span>
                  <span className="font-medium tabular-nums">{model.fields.length}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted">Size</span>
                  <span className="font-medium tabular-nums">{layout.totalSize} B</span>
                </div>
              </div>
            </div>

            <Button
              variant="secondary"
              className="w-full"
              onClick={copy}
              disabled={hasErrors}
            >
              <CopyIcon />
              {copied ? "Copied" : "Copy code"}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
