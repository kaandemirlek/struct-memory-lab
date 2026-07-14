"use client";

import type { LayoutSegment } from "@/engine/segments";
// Same palette + hatch as the main visualizer so it all reads consistently.
import { FIELD_COLORS as COLORS } from "@/lib/fieldColors";
import { HATCH } from "@/lib/layoutStyles";

/**
 * Compact, proportional layout strip for side-by-side before/after comparison.
 * Both strips share `maxBytes` so a smaller struct renders visibly shorter.
 * Fields are colored by a caller-supplied map so the same field keeps its color
 * across the two strips even after reordering.
 */
export default function MiniLayoutStrip({
  label,
  segments,
  totalSize,
  maxBytes,
  colorIndexFor,
}: {
  label: string;
  segments: LayoutSegment[];
  totalSize: number;
  maxBytes: number;
  colorIndexFor: (fieldId?: string) => number;
}) {
  const pct = (bytes: number) => `${(bytes / maxBytes) * 100}%`;

  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <span className="text-xs font-medium text-foreground">{label}</span>
        <span className="text-xs tabular-nums text-muted">{totalSize} B</span>
      </div>
      <div
        className="flex h-7 overflow-hidden rounded border border-border"
        style={{ width: pct(totalSize) }}
      >
        {segments.map((s, i) =>
          s.kind === "field" ? (
            <div
              key={i}
              style={{
                width: pct(s.size),
                background: COLORS[colorIndexFor(s.fieldId) % COLORS.length],
              }}
              title={`${s.name}: offset ${s.offset}, ${s.size} B`}
              className="flex items-center justify-center overflow-hidden border-r border-black/10 text-[9px] text-field-ink/80 last:border-r-0"
            >
              <span className="truncate px-0.5">{s.name}</span>
            </div>
          ) : (
            <div
              key={i}
              style={{ width: pct(s.size), backgroundImage: HATCH }}
              title={`padding: ${s.size} B`}
              className="border-r border-border last:border-r-0"
            />
          )
        )}
      </div>
    </div>
  );
}
