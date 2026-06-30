"use client";

import { useState } from "react";
import {
  CURRENT_EDITS,
  resolveComparison,
  useStructStore,
} from "@/store/useStructStore";
import { computeLayout } from "@/engine/layout";
import { toSegments } from "@/engine/segments";
import {
  analyzeFieldImpacts,
  type FieldImpact,
} from "@/engine/compatibility";
import type { WarningSeverity } from "@/types";
import Panel from "@/components/ui/Panel";

const COLORS = ["#60a5fa", "#34d399", "#f472b6", "#fbbf24", "#a78bfa", "#fb7185"];

const SEVERITY_RANK: Record<WarningSeverity, number> = {
  danger: 0,
  warning: 1,
  info: 2,
};

const BADGE_STYLES: Record<WarningSeverity, string> = {
  danger: "border-danger/30 bg-danger/10 text-danger",
  warning: "border-warning/30 bg-warning/10 text-warning",
  info: "border-info/30 bg-info/10 text-info",
};

const RING_STYLES: Record<WarningSeverity, string> = {
  danger: "ring-2 ring-danger",
  warning: "ring-2 ring-warning",
  info: "ring-2 ring-info",
};

function strongestSeverity(impact: FieldImpact): WarningSeverity {
  return impact.badges.reduce<WarningSeverity>(
    (strongest, badge) =>
      SEVERITY_RANK[badge.severity] < SEVERITY_RANK[strongest]
        ? badge.severity
        : strongest,
    "info"
  );
}

function impactTitle(impact: FieldImpact): string {
  return impact.badges.map((b) => b.detail).join("\n");
}

function ImpactBadges({ impact }: { impact: FieldImpact }) {
  return (
    <span className="flex flex-wrap items-center gap-1">
      {impact.badges.map((badge) => (
        <span
          key={`${badge.kind}-${badge.label}`}
          title={badge.detail}
          className={`rounded border px-1 py-0.5 text-[10px] font-medium leading-none ${BADGE_STYLES[badge.severity]}`}
        >
          {badge.label}
        </span>
      ))}
    </span>
  );
}

export default function LayoutVisualizer() {
  const model = useStructStore((s) => s.currentModel);
  const versions = useStructStore((s) => s.versions);
  const baseVersionId = useStructStore((s) => s.baseVersionId);
  const targetVersionId = useStructStore((s) => s.targetVersionId);
  const layout = computeLayout(model);
  const segments = toSegments(layout);
  const [pxPerByte, setPxPerByte] = useState(28);
  const cmp = resolveComparison(versions, model, baseVersionId, targetVersionId);
  const impacts =
    cmp.fromModel && cmp.toModel && cmp.toValue === CURRENT_EDITS
      ? analyzeFieldImpacts(cmp.fromModel, cmp.toModel)
      : [];
  const impactsById = new Map(impacts.map((impact) => [impact.fieldId, impact]));

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
              {segments.map((s, i) => {
                const impact = s.fieldId ? impactsById.get(s.fieldId) : undefined;
                const severity = impact ? strongestSeverity(impact) : undefined;
                const title =
                  s.kind === "field"
                    ? [
                        `${s.name}: offset ${s.offset}, ${s.size} bytes`,
                        impact ? impactTitle(impact) : "",
                      ]
                        .filter(Boolean)
                        .join("\n")
                    : `padding: ${s.size} wasted bytes`;

                return s.kind === "field" ? (
                  <div
                    key={i}
                    style={{
                      width: s.size * pxPerByte,
                      background: COLORS[s.colorIndex! % COLORS.length],
                    }}
                    className={`relative flex shrink-0 flex-col items-center justify-center overflow-hidden border-r border-black/10 text-xs text-black last:border-r-0 ${
                      severity ? RING_STYLES[severity] : ""
                    }`}
                    title={title}
                  >
                    {impact && severity && (
                      <span
                        className={`absolute right-1 top-1 rounded border bg-white/90 px-1 text-[9px] font-bold leading-3 ${BADGE_STYLES[severity]}`}
                        title={impactTitle(impact)}
                      >
                        !
                      </span>
                    )}
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
                    title={title}
                  >
                    {s.size}
                  </div>
                );
              })}
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
              .map((s, i) => {
                const impact = s.fieldId ? impactsById.get(s.fieldId) : undefined;
                return (
                  <span
                    key={i}
                    className="flex min-w-0 flex-wrap items-center gap-1 text-[11px]"
                    title={impact ? impactTitle(impact) : undefined}
                  >
                    <span
                      className="inline-block h-3 w-3 shrink-0 rounded-sm"
                      style={{ background: COLORS[s.colorIndex! % COLORS.length] }}
                    />
                    <span className="min-w-0 truncate">{s.name}</span>
                    <span className="text-muted">
                      @{s.offset}/{s.size}B
                    </span>
                    {impact && <ImpactBadges impact={impact} />}
                  </span>
                );
              })}
          </div>
        </>
      )}
    </Panel>
  );
}
