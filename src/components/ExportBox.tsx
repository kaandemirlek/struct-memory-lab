// ExportBox.tsx  ← PERSON B
"use client";

import { useStructStore } from "@/store/useStructStore";
import { exportCpp } from "@/engine/exporter";

export default function ExportBox() {
  const model = useStructStore((s) => s.currentModel);
  const code = exportCpp(model);

  const download = () => {
    const blob = new Blob([code], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${model.name}.hpp`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="rounded-lg border border-black/10 dark:border-white/15 p-4">
      <h2 className="font-semibold mb-2">📤 Export (Person B)</h2>
      <pre className="font-mono text-xs rounded border border-black/10 dark:border-white/15 p-2 overflow-auto">
        {code}
      </pre>
      <div className="mt-2 flex gap-2">
        <button
          onClick={() => navigator.clipboard.writeText(code)}
          className="rounded border border-black/15 dark:border-white/20 px-3 py-1.5 text-sm"
        >
          Kopyala
        </button>
        <button
          onClick={download}
          className="rounded bg-foreground text-background px-3 py-1.5 text-sm font-medium"
        >
          .hpp indir
        </button>
      </div>
    </section>
  );
}
