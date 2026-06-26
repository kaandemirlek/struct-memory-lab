// ExportBox.tsx  ← PERSON B
"use client";

import { useState } from "react";
import { useStructStore } from "@/store/useStructStore";
import { exportCpp } from "@/engine/exporter";
import Panel from "@/components/ui/Panel";
import Button from "@/components/ui/Button";

export default function ExportBox() {
  const model = useStructStore((s) => s.currentModel);
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
          <Button variant="secondary" onClick={copy}>
            {copied ? "Copied" : "Copy"}
          </Button>
          <Button variant="primary" onClick={download}>
            Download .hpp
          </Button>
        </>
      }
    >
      <pre className="overflow-auto rounded-lg border border-border bg-surface-muted p-3 font-mono text-xs leading-relaxed">
        {code}
      </pre>
    </Panel>
  );
}
