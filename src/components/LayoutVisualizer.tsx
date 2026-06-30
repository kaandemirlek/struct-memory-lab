"use client";

import { useState } from "react";
import { useStructStore } from "@/store/useStructStore";
import { computeLayout } from "@/engine/layout";
import { toSegments } from "@/engine/segments";
import Panel from "@/components/ui/Panel";

const COLORS = ["#60a5fa", "#34d399", "#f472b6", "#fbbf24", "#a78bfa", "#fb7185"];

export default function LayoutVisualizer() {
  const model = useStructStore((s) => s.currentModel);
  const layout = computeLayout(model);
  const segments = toSegments(layout);
  const [pxPerByte, setPxPerByte] = useState(28);

  return (
    <Panel
      title="Memory Layout"
      description={`size ${layout.totalSize} B / align ${layout.alignment} B / padding ${layout.totalPadding} B`}
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

          <div className="overflow-x-auto">
            <div className="flex h-32 w-max overflow-hidden rounded-lg border border-border">
              {segments.map((s, i) =>
                s.kind === "field" ? (
                  <div
                    key={i}
                    style={{
                      width: s.size * pxPerByte,
                      background: COLORS[s.colorIndex! % COLORS.length],
                    }}
                    className="flex shrink-0 flex-col items-center justify-center overflow-hidden border-r border-black/10 text-xs text-black last:border-r-0"
                    title={`${s.name}: offset ${s.offset}, ${s.size} bytes`}
                  >
                    <span className="max-w-full truncate px-1 font-medium">{s.name}</span>
                    <span className="opacity-70">{s.size}B</span>
                  </div>
                ) : (
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
                )
              )}
            </div>

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
          </div>

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
                  <span className="text-muted">
                    @{s.offset}/{s.size}B
                  </span>
                </span>
              ))}
          </div>
        </>
      )}
    </Panel>
  );
}
