"use client";

import { useState } from "react";
import { useStructStore } from "@/store/useStructStore";
import { exportCpp, exportModelJson } from "@/engine/exporter";
import { validateStruct } from "@/engine/validation";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { CopyIcon, DownloadIcon } from "@/components/ui/icons";

type Format = "cpp" | "json";

export default function ExportBox() {
  const model = useStructStore((s) => s.currentModel);
  const [open, setOpen] = useState(false);
  const [format, setFormat] = useState<Format>("cpp");
  const [comments, setComments] = useState(true);
  const [copied, setCopied] = useState(false);

  const issues = validateStruct(model);
  const hasErrors = issues.length > 0;

  const isCpp = format === "cpp";
  const code = isCpp ? exportCpp(model, { comments }) : exportModelJson(model);
  const fileName = `${model.name.trim() || "Struct"}.${isCpp ? "hpp" : "json"}`;
  // C++ requires a valid struct; JSON is just the model, so it's always exportable.
  const blocked = isCpp && hasErrors;

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
    const blob = new Blob([code], {
      type: isCpp ? "text/plain" : "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  };

  const tab = (f: Format, label: string) => (
    <button
      type="button"
      onClick={() => {
        setFormat(f);
        setCopied(false);
      }}
      className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
        format === f
          ? "bg-accent text-accent-foreground"
          : "text-muted hover:bg-surface-muted"
      }`}
    >
      {label}
    </button>
  );

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
        description={fileName}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={copy} disabled={blocked}>
              <CopyIcon />
              {copied ? "Copied" : "Copy"}
            </Button>
            <Button variant="primary" onClick={download} disabled={blocked}>
              <DownloadIcon />
              Download {isCpp ? ".hpp" : ".json"}
            </Button>
          </>
        }
      >
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex rounded-lg border border-border bg-surface p-0.5">
            {tab("cpp", "C++ header")}
            {tab("json", "JSON")}
          </div>
          {isCpp && (
            <label className="flex cursor-pointer items-center gap-2 text-xs text-muted">
              <input
                type="checkbox"
                checked={comments}
                onChange={(e) => setComments(e.target.checked)}
                className="accent-accent"
              />
              Offset/size comments
            </label>
          )}
        </div>

        {blocked && (
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

        <pre className="max-h-[55vh] overflow-auto rounded-lg border border-border bg-surface-muted p-4 font-mono text-sm leading-6">
          {code}
        </pre>
      </Modal>
    </>
  );
}
