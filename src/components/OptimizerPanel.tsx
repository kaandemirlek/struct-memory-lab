"use client";

import { useStructStore } from "@/store/useStructStore";
import { optimizeLayout } from "@/engine/optimizer";
import { computeLayout } from "@/engine/layout";
import { toSegments } from "@/engine/segments";
import Button from "@/components/ui/Button";
import Panel from "@/components/ui/Panel";
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
    <Panel
      title="Optimizer"
      collapsible
      defaultOpen={false}
      summary={
        <span>
          reordering saves{" "}
          <span className="font-semibold text-emerald-600 dark:text-emerald-400">
            {result.bytesSaved} B
          </span>{" "}
          <span className="text-muted">
            ({result.currentSize} → {result.optimizedSize} B)
          </span>
        </span>
      }
      actions={
        <Button
          variant="primary"
          size="sm"
          className="shrink-0"
          onClick={() => setModel(result.optimizedModel)}
        >
          Apply
        </Button>
      }
    >
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
    </Panel>
  );
}
