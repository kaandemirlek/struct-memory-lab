// ExportBox.tsx — top-bar action: opens an Export dialog.
"use client";

import { useState } from "react";
import { useStructStore } from "@/store/useStructStore";
import { exportCpp } from "@/engine/exporter";
import { validateStruct } from "@/engine/validation";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";

export default function ExportBox() {
  const model = useStructStore((s) => s.currentModel);
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const issues = validateStruct(model);
  const hasErrors = issues.length > 0;
  const code = exportCpp(model);

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
        Export
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Export C++ header"
        footer={
          <>
            <Button variant="secondary" onClick={copy} disabled={hasErrors}>
              {copied ? "Copied" : "Copy"}
            </Button>
            <Button variant="primary" onClick={download} disabled={hasErrors}>
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
        <pre className="max-h-[50vh] overflow-auto rounded-lg border border-border bg-surface-muted p-3 font-mono text-xs leading-relaxed">
          {code}
        </pre>
      </Modal>
    </>
  );
}
