// LayoutVisualizer.tsx  ← PERSON A   (uygulamanın imza görseli)
"use client";

import { useState } from "react";
import { useStructStore } from "@/store/useStructStore";
import { computeLayout } from "@/engine/layout";
import { toSegments } from "@/engine/segments";

// Alanlar için kararlı renk paleti (renk indeksine göre seçilir).
const COLORS = ["#60a5fa", "#34d399", "#f472b6", "#fbbf24", "#a78bfa", "#fb7185"];

export default function LayoutVisualizer() {
  const model = useStructStore((s) => s.currentModel);
  const layout = computeLayout(model);
  const segments = toSegments(layout);

  // Zoom: byte başına piksel. Slider'ı çekince bloklar uzayıp kısalır,
  // taşınca yatay kaydırma devreye girer.
  const [pxPerByte, setPxPerByte] = useState(28);

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
          {/* Zoom kontrolü (yatay çekerek büyüt/küçült) */}
          <div className="flex items-center gap-2 mb-2">
            <label className="text-xs opacity-70" htmlFor="zoom">
              Yakınlaştırma
            </label>
            <input
              id="zoom"
              type="range"
              min={6}
              max={64}
              step={1}
              value={pxPerByte}
              onChange={(e) => setPxPerByte(Number(e.target.value))}
              className="flex-1"
            />
            <span className="text-xs opacity-70 tabular-nums">{pxPerByte} px/byte</span>
          </div>

          {/* Bant + cetvel: yatay kaydırılabilir; genişlikler byte × zoom. */}
          <div className="overflow-x-auto">
            <div className="flex h-16 w-max overflow-hidden rounded border border-black/10 dark:border-white/15">
              {segments.map((s, i) =>
                s.kind === "field" ? (
                  <div
                    key={i}
                    style={{ width: s.size * pxPerByte, background: COLORS[s.colorIndex! % COLORS.length] }}
                    className="flex flex-col items-center justify-center text-black text-xs border-r border-black/20 last:border-r-0 overflow-hidden shrink-0"
                    title={`${s.name}: offset ${s.offset}, ${s.size} byte`}
                  >
                    <span className="font-medium truncate max-w-full px-1">{s.name}</span>
                    <span className="opacity-70">{s.size}B</span>
                  </div>
                ) : (
                  <div
                    key={i}
                    style={{
                      width: s.size * pxPerByte,
                      backgroundImage:
                        "repeating-linear-gradient(45deg, rgba(120,120,120,.35) 0 4px, transparent 4px 8px)",
                    }}
                    className="flex items-center justify-center text-[10px] text-gray-500 border-r border-black/20 last:border-r-0 shrink-0"
                    title={`padding: ${s.size} byte boşa`}
                  >
                    {s.size}
                  </div>
                )
              )}
            </div>

            {/* Offset cetveli: her segmentin başlangıç byte'ı (aynı genişlikler). */}
            <div className="flex w-max mt-1">
              {segments.map((s, i) => (
                <div
                  key={i}
                  style={{ width: s.size * pxPerByte }}
                  className="text-[10px] opacity-60 shrink-0"
                >
                  {s.offset}
                </div>
              ))}
              <span className="text-[10px] opacity-60 pl-0.5">{layout.totalSize}</span>
            </div>
          </div>

          {/* Renk açıklaması (legend) */}
          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-3">
            {segments
              .filter((s) => s.kind === "field")
              .map((s, i) => (
                <span key={i} className="flex items-center gap-1 text-[11px]">
                  <span
                    className="inline-block w-3 h-3 rounded-sm"
                    style={{ background: COLORS[s.colorIndex! % COLORS.length] }}
                  />
                  {s.name}
                  <span className="opacity-60">
                    @{s.offset}·{s.size}B
                  </span>
                </span>
              ))}
          </div>
        </>
      )}
    </section>
  );
}
