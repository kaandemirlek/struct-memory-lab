// LayoutVisualizer.tsx   (the app's signature visual)
"use client";

import { useState } from "react";
import { useStructStore } from "@/store/useStructStore";
import { computeLayout } from "@/engine/layout";
import { toSegments } from "@/engine/segments";
import type { LayoutResult } from "@/types";
import Panel from "@/components/ui/Panel";

// Stable color palette for fields (picked by color index).
const COLORS = ["#60a5fa", "#34d399", "#f472b6", "#fbbf24", "#a78bfa", "#fb7185"];

// Tek bir struct'ın yerleşim bandı. Nested (struct) alanlara tıklanınca,
// o alanın iç yerleşimi ALTINDA özyinelemeli olarak açılır.
function Band({ layout, pxPerByte }: { layout: LayoutResult; pxPerByte: number }) {
  const segments = toSegments(layout);
  // Açık nested alanlar (offset'e göre — bir band içinde offset benzersiz).
  const [open, setOpen] = useState<Record<number, boolean>>({});

  return (
    <div className="overflow-x-auto">
      {/* Bant: genişlikler byte × zoom. */}
      <div className="flex h-16 w-max overflow-hidden rounded-lg border border-border">
        {segments.map((s, i) => {
          if (s.kind === "padding") {
            return (
              <div
                key={i}
                style={{
                  width: s.size * pxPerByte,
                  backgroundImage:
                    "repeating-linear-gradient(45deg, rgba(120,120,120,.30) 0 4px, transparent 4px 8px)",
                }}
                className="flex shrink-0 items-center justify-center border-r border-border text-[10px] text-muted last:border-r-0"
                title={`padding: ${s.size} wasted bytes`}
              >
                {s.size}
              </div>
            );
          }

          const expandable = s.type === "struct" && !!s.nested;
          const isOpen = expandable && open[s.offset];
          return (
            <div
              key={i}
              onClick={
                expandable
                  ? () => setOpen((o) => ({ ...o, [s.offset]: !o[s.offset] }))
                  : undefined
              }
              style={{
                width: s.size * pxPerByte,
                background: COLORS[s.colorIndex! % COLORS.length],
              }}
              className={`flex shrink-0 flex-col items-center justify-center overflow-hidden border-r border-black/10 text-xs text-black last:border-r-0 ${
                expandable ? "cursor-pointer" : ""
              }`}
              title={`${s.name}: ${s.typeName ?? s.type} — offset ${s.offset}, ${s.size} bytes${
                expandable ? " (tıkla: aç/kapat)" : ""
              }`}
            >
              <span className="max-w-full truncate px-1 font-medium">
                {s.name}
                {expandable && <span className="ml-0.5">{isOpen ? "▾" : "▸"}</span>}
              </span>
              {/* nested için struct adı (Vec3), primitive için boyut */}
              <span className="max-w-full truncate px-1 opacity-70">
                {s.type === "struct" ? s.typeName : `${s.size}B`}
              </span>
            </div>
          );
        })}
      </div>

      {/* Offset cetveli: her segmentin başlangıç byte'ı (aynı genişlikler). */}
      <div className="mt-1 flex w-max">
        {segments.map((s, i) => (
          <div
            key={i}
            style={{ width: s.size * pxPerByte }}
            className="shrink-0 text-[10px] text-muted"
          >
            {s.offset}
          </div>
        ))}
        <span className="pl-0.5 text-[10px] text-muted">{layout.totalSize}</span>
      </div>

      {/* Açılan nested struct'ların iç yerleşimi (özyinelemeli). */}
      {segments
        .filter((s) => s.kind === "field" && s.type === "struct" && s.nested && open[s.offset])
        .map((s, i) => (
          <div key={i} className="mt-3 border-l-2 border-accent/40 pl-3">
            <div className="mb-1 text-xs text-muted">
              ▾ {s.name}: {s.typeName} — iç yerleşim ({s.nested!.totalSize} B, align{" "}
              {s.nested!.alignment} B)
            </div>
            <Band layout={s.nested!} pxPerByte={pxPerByte} />
          </div>
        ))}
    </div>
  );
}

export default function LayoutVisualizer() {
  const model = useStructStore((s) => s.currentModel);
  const layout = computeLayout(model);
  const segments = toSegments(layout);
  const hasNested = segments.some((s) => s.type === "struct" && s.nested);

  // Zoom: pixels per byte. Dragging the slider stretches the blocks.
  const [pxPerByte, setPxPerByte] = useState(28);

  return (
    <Panel
      title="Memory Layout"
      description={`size ${layout.totalSize} B · align ${layout.alignment} B · padding ${layout.totalPadding} B`}
    >
      {segments.length === 0 ? (
        <p className="text-sm text-muted">Add fields to see the memory layout.</p>
      ) : (
        <>
          <div className="mb-3 flex items-center gap-2">
            <label className="text-xs text-muted" htmlFor="zoom">
              Zoom
            </label>
            <input
              id="zoom"
              type="range"
              min={6}
              max={64}
              step={1}
              value={pxPerByte}
              onChange={(e) => setPxPerByte(Number(e.target.value))}
              className="flex-1 accent-accent"
            />
            <span className="text-xs tabular-nums text-muted">{pxPerByte} px/byte</span>
          </div>

          <Band layout={layout} pxPerByte={pxPerByte} />

          {hasNested && (
            <p className="mt-2 text-[11px] text-muted">
              İpucu: struct alanlarına (▸) tıklayıp iç yerleşimini açabilirsin.
            </p>
          )}

          {/* Legend (üst seviye alanlar) */}
          <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1">
            {segments
              .filter((s) => s.kind === "field")
              .map((s, i) => (
                <span key={i} className="flex items-center gap-1 text-[11px]">
                  <span
                    className="inline-block h-3 w-3 rounded-sm"
                    style={{ background: COLORS[s.colorIndex! % COLORS.length] }}
                  />
                  {s.name}
                  {s.type === "struct" && <span className="text-muted">:{s.typeName}</span>}
                  <span className="text-muted">
                    @{s.offset}·{s.size}B
                  </span>
                </span>
              ))}
          </div>
        </>
      )}
    </Panel>
  );
}
