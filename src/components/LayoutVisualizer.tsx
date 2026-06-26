// LayoutVisualizer.tsx  ← PERSON A   (the app's signature visual)
"use client";

import { useStructStore } from "@/store/useStructStore";
import { computeLayout } from "@/engine/layout";
import Panel from "@/components/ui/Panel";

// A stable color per field, to make the layout easier to read.
const COLORS = ["#60a5fa", "#34d399", "#f472b6", "#fbbf24", "#a78bfa", "#fb7185"];

export default function LayoutVisualizer() {
  const model = useStructStore((s) => s.currentModel);
  const layout = computeLayout(model);

  return (
    <Panel
      title="Memory Layout"
      description={`size ${layout.totalSize} B · align ${layout.alignment} B · padding ${layout.totalPadding} B`}
    >
      {layout.fields.length === 0 ? (
        <p className="text-sm text-muted">Add fields to see the memory layout.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {layout.fields.map((f, i) => (
            <div
              key={f.fieldId}
              className="rounded-lg px-3 py-1.5 text-xs text-black"
              style={{ background: COLORS[i % COLORS.length] }}
              title={`offset ${f.offset} · ${f.size} bytes`}
            >
              <span className="font-mono font-medium">{f.name}</span>
              <span className="opacity-70">
                {" "}
                @{f.offset} · {f.size}B
              </span>
              {f.paddingBefore > 0 && (
                <span className="ml-1 opacity-60">+{f.paddingBefore} pad</span>
              )}
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}
