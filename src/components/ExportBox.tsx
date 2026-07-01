// ExportBox.tsx  ← PERSON B
"use client";

import { useState } from "react";
import { useStructStore } from "@/store/useStructStore";
import { exportCpp } from "@/engine/exporter";
import { validateStruct } from "@/engine/validation";
import { analyzeBitWarnings } from "@/engine/bitfields";
import Panel from "@/components/ui/Panel";
import Button from "@/components/ui/Button";

export default function ExportBox() {
  const model = useStructStore((s) => s.currentModel);
  const issues = validateStruct(model);

  // Bit alanı uyarıları: 'danger' (overlap/OOB) export'u bloklar, 'warning' sadece bilgi verir.
  const bitWarnings = analyzeBitWarnings(model);
  const bitDangers = bitWarnings.filter((w) => w.severity === "danger");
  const bitInfos = bitWarnings.filter((w) => w.severity !== "danger");

  const hasErrors = issues.length > 0 || bitDangers.length > 0;
  const code = exportCpp(model);
  const [copied, setCopied] = useState(false);

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
    <Panel
      title="Export"
      description="Generated C++ header for the current struct."
      actions={
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
            Fix {issues.length + bitDangers.length}{" "}
            {issues.length + bitDangers.length === 1 ? "issue" : "issues"} before exporting:
          </p>
          <ul className="list-inside list-disc space-y-0.5">
            {issues.map((issue, i) => (
              <li key={`v${i}`}>{issue.message}</li>
            ))}
            {bitDangers.map((w, i) => (
              <li key={`b${i}`}>{w.message}</li>
            ))}
          </ul>
        </div>
      )}

      {bitInfos.length > 0 && (
        <div className="mb-3 rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm text-warning">
          <p className="mb-1 font-medium">Bit alanı uyarıları (export'u engellemez):</p>
          <ul className="list-inside list-disc space-y-0.5">
            {bitInfos.map((w, i) => (
              <li key={i}>{w.message}</li>
            ))}
          </ul>
        </div>
      )}
      <pre className="overflow-auto rounded-lg border border-border bg-surface-muted p-3 font-mono text-xs leading-relaxed">
        {code}
      </pre>
    </Panel>
  );
}
