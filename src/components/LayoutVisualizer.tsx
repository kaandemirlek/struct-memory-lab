// LayoutVisualizer.tsx  ← PERSON A   (uygulamanın imza görseli)
"use client";

import { useStructStore } from "@/store/useStructStore";
import { computeLayout } from "@/engine/layout";

// Her tip için kararlı bir renk (öğrenmeyi kolaylaştırır).
const COLORS = ["#60a5fa", "#34d399", "#f472b6", "#fbbf24", "#a78bfa", "#fb7185"];

export default function LayoutVisualizer() {
  const model = useStructStore((s) => s.currentModel);
  const layout = computeLayout(model);

  return (
    <section className="rounded-lg border border-black/10 dark:border-white/15 p-4">
      <h2 className="font-semibold mb-1">🧱 Memory Layout (Person A)</h2>
      <p className="text-xs opacity-70 mb-3">
        sizeof = {layout.totalSize} bytes · align = {layout.alignment} · padding ={" "}
        {layout.totalPadding} bytes
      </p>

      {/* TODO (PERSON A): bunu byte-oranlı renkli bloklara çevir,
          padding'i gri boşluk olarak göster, offset etiketle. */}
      <div className="flex flex-wrap gap-1">
        {layout.fields.map((f, i) => (
          <div
            key={f.fieldId}
            className="rounded px-2 py-1 text-xs text-black"
            style={{ background: COLORS[i % COLORS.length] }}
            title={`offset ${f.offset}, ${f.size} bytes`}
          >
            {f.name}
            <span className="opacity-70"> @{f.offset} ({f.size}B)</span>
            {f.paddingBefore > 0 && (
              <span className="ml-1 text-gray-700">+{f.paddingBefore}pad</span>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
