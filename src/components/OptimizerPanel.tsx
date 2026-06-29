// OptimizerPanel.tsx — contextual banner: only shows when reordering saves bytes.
"use client";

import { useStructStore } from "@/store/useStructStore";
import { optimizeLayout } from "@/engine/optimizer";
import Button from "@/components/ui/Button";

export default function OptimizerPanel() {
  const model = useStructStore((s) => s.currentModel);
  const setModel = useStructStore((s) => s.setModel);

  const result = optimizeLayout(model);

  // Nothing to suggest → render nothing (stay out of the way).
  if (model.fields.length < 2 || result.bytesSaved <= 0) return null;

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3">
      <p className="text-sm">
        Reordering fields saves{" "}
        <span className="font-semibold text-emerald-600 dark:text-emerald-400">
          {result.bytesSaved} bytes
        </span>{" "}
        <span className="text-muted">
          ({result.currentSize} → {result.optimizedSize} B).
        </span>
      </p>
      <Button
        variant="primary"
        size="sm"
        className="shrink-0"
        onClick={() => setModel(result.optimizedModel)}
      >
        Apply
      </Button>
    </div>
  );
}
