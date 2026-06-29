// OptimizerPanel.tsx  ← PERSON B
"use client";

import { useStructStore } from "@/store/useStructStore";
import { optimizeLayout } from "@/engine/optimizer";
import Panel from "@/components/ui/Panel";
import Button from "@/components/ui/Button";

export default function OptimizerPanel() {
  const model = useStructStore((s) => s.currentModel);
  const setModel = useStructStore((s) => s.setModel);

  const result = optimizeLayout(model);
  const improved = result.bytesSaved > 0;

  return (
    <Panel
      title="Optimize"
      description="Reorder fields by alignment to remove padding."
    >
      {model.fields.length < 2 ? (
        <p className="text-sm text-muted">
          Add a few fields to see optimization suggestions.
        </p>
      ) : improved ? (
        <div className="space-y-3">
          <p className="text-sm">
            Reordering shrinks the struct from{" "}
            <span className="font-medium">{result.currentSize} B</span> to{" "}
            <span className="font-medium text-emerald-600 dark:text-emerald-400">
              {result.optimizedSize} B
            </span>{" "}
            <span className="text-muted">(saves {result.bytesSaved} B).</span>
          </p>
          <Button
            variant="primary"
            onClick={() => setModel(result.optimizedModel)}
          >
            Apply suggested order
          </Button>
        </div>
      ) : (
        <p className="text-sm text-muted">
          Layout is already optimal — no padding to remove by reordering.
        </p>
      )}
    </Panel>
  );
}
