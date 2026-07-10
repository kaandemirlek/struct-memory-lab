"use client";

import { useStructStore } from "@/store/useStructStore";
import { optimizeLayout } from "@/engine/optimizer";
import { computeLayout } from "@/engine/layout";
import { toSegments } from "@/engine/segments";
import Button from "@/components/ui/Button";
import MiniLayoutStrip from "@/components/MiniLayoutStrip";

export default function OptimizerPanel() {
  const model = useStructStore((s) => s.currentModel);
  const setModel = useStructStore((s) => s.setModel);
  const platform = useStructStore((s) => s.platform);

  const result = optimizeLayout(model, computeLayout, platform);

  if (model.fields.length < 2 || result.bytesSaved <= 0) return null;

  // Stable color per field id so the same field keeps its color in both strips.
  const colorById = new Map(model.fields.map((f, i) => [f.id, i]));
  const colorIndexFor = (fieldId?: string) =>
    fieldId !== undefined ? colorById.get(fieldId) ?? 0 : 0;

  const currentLayout = computeLayout(model, platform);
  const optimizedLayout = computeLayout(result.optimizedModel, platform);
  const maxBytes = Math.max(currentLayout.totalSize, optimizedLayout.totalSize);

  return (
    <div className="space-y-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm">
          Reordering fields saves{" "}
          <span className="font-semibold text-emerald-600 dark:text-emerald-400">
            {result.bytesSaved} bytes
          </span>{" "}
          <span className="text-muted">
            ({result.currentSize} to {result.optimizedSize} B).
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

      <div className="space-y-2">
        <MiniLayoutStrip
          label="Current"
          segments={toSegments(currentLayout)}
          totalSize={currentLayout.totalSize}
          maxBytes={maxBytes}
          colorIndexFor={colorIndexFor}
        />
        <MiniLayoutStrip
          label="Optimized"
          segments={toSegments(optimizedLayout)}
          totalSize={optimizedLayout.totalSize}
          maxBytes={maxBytes}
          colorIndexFor={colorIndexFor}
        />
      </div>
    </div>
  );
}
