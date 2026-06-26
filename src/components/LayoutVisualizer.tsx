// LayoutVisualizer.tsx  ← PERSON A   (uygulamanın imza görseli)
"use client";

import { useStructStore } from "@/store/useStructStore";
import { computeLayout } from "@/engine/layout";
import { toSegments } from "@/engine/segments";

// Alanlar için kararlı renk paleti (renk indeksine göre seçilir).
const COLORS = ["#60a5fa", "#34d399", "#f472b6", "#fbbf24", "#a78bfa", "#fb7185"];

export default function LayoutVisualizer() {
  const model = useStructStore((s) => s.currentModel);
  const layout = computeLayout(model);
  const segments = toSegments(layout);

  return (
    <section className="rounded-lg border border-black/10 dark:border-white/15 p-4">
      <h2 className="font-semibold mb-1">🧱 Memory Layout (Person A)</h2>
      <p className="text-xs opacity-70 mb-3">
        sizeof = {layout.totalSize} bytes · align = {layout.alignment} · padding ={" "}
        {layout.totalPadding} bytes
      </p>

      {segments.length === 0 ? (
        <p className="text-sm opacity-60">Boş struct — alan ekleyin.</p>
      ) : (
        <>
          {/* Bant: her segmentin GENİŞLİĞİ byte sayısıyla orantılı (flexGrow). */}
          <div className="flex h-16 w-full overflow-hidden rounded border border-black/10 dark:border-white/15">
            {segments.map((s, i) =>
              s.kind === "field" ? (
                <div
                  key={i}
                  style={{ flexGrow: s.size, flexBasis: 0, minWidth: 44, background: COLORS[s.colorIndex! % COLORS.length] }}
                  className="flex flex-col items-center justify-center text-black text-xs border-r border-black/20 last:border-r-0 overflow-hidden"
                  title={`${s.name}: offset ${s.offset}, ${s.size} byte`}
                >
                  <span className="font-medium truncate max-w-full px-1">{s.name}</span>
                  <span className="opacity-70">{s.size}B</span>
                </div>
              ) : (
                // Padding: gri çapraz tarama, boşa giden byte'lar.
                <div
                  key={i}
                  style={{
                    flexGrow: s.size,
                    flexBasis: 0,
                    minWidth: 18,
                    backgroundImage:
                      "repeating-linear-gradient(45deg, rgba(120,120,120,.35) 0 4px, transparent 4px 8px)",
                  }}
                  className="flex items-center justify-center text-[10px] text-gray-500 border-r border-black/20 last:border-r-0"
                  title={`padding: ${s.size} byte boşa`}
                >
                  {s.size}
                </div>
              )
            )}
          </div>

          {/* Offset cetveli: her segmentin başlangıç byte'ı (aynı orantı). */}
          <div className="flex w-full mt-1">
            {segments.map((s, i) => (
              <div
                key={i}
                style={{ flexGrow: s.size, flexBasis: 0, minWidth: s.kind === "field" ? 44 : 18 }}
                className="text-[10px] opacity-60"
              >
                {s.offset}
              </div>
            ))}
            <span className="text-[10px] opacity-60">{layout.totalSize}</span>
          </div>
        </>
      )}
    </section>
  );
}
