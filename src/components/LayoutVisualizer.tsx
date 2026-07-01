"use client";

import { useState } from "react";
import {
  resolveComparison,
  useStructStore,
} from "@/store/useStructStore";
import { computeLayout } from "@/engine/layout";
import { toSegments, type LayoutSegment } from "@/engine/segments";
import {
  analyzeFieldImpacts,
  type FieldImpact,
} from "@/engine/compatibility";
import type { LayoutResult, StructModel, WarningSeverity } from "@/types";
import Panel from "@/components/ui/Panel";

type Mode = "edit" | "compare";

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

function buildColorById(a: StructModel, b: StructModel): Map<string, number> {
  const colorById = new Map<string, number>();
  for (const field of [...a.fields, ...b.fields]) {
    if (!colorById.has(field.id)) colorById.set(field.id, colorById.size);
  }
  return colorById;
}

function fieldColorIndex(segment: LayoutSegment, colorById?: Map<string, number>) {
  if (segment.fieldId && colorById?.has(segment.fieldId)) {
    return colorById.get(segment.fieldId)!;
  }
  return segment.colorIndex ?? 0;
}

function LayoutStrip({
  label,
  layout,
  segments,
  pxPerByte,
  impactsById,
  colorById,
}: {
  label?: string;
  layout: LayoutResult;
  segments: LayoutSegment[];
  pxPerByte: number;
  impactsById?: Map<string, FieldImpact>;
  colorById?: Map<string, number>;
}) {
  if (segments.length === 0) {
    return <p className="text-sm text-muted">Add fields to see the memory layout.</p>;
  }

  return (
    <section className="min-w-0">
      {label && (
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="min-w-0 truncate text-xs font-semibold text-foreground">
            {label}
          </h3>
          <span className="shrink-0 text-xs tabular-nums text-muted">
            {layout.totalSize} B / align {layout.alignment} B / pad{" "}
            {layout.totalPadding} B
          </span>
        </div>
      )}

      <div className="overflow-x-auto">
        <div className="flex h-32 w-max overflow-hidden rounded-lg border border-border">
          {segments.map((s, i) => {
            const impact = s.fieldId ? impactsById?.get(s.fieldId) : undefined;
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
                  background: COLORS[fieldColorIndex(s, colorById) % COLORS.length],
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
            const impact = s.fieldId ? impactsById?.get(s.fieldId) : undefined;
            return (
              <span
                key={i}
                className="flex min-w-0 flex-wrap items-center gap-1 text-[11px]"
                title={impact ? impactTitle(impact) : undefined}
              >
                <span
                  className="inline-block h-3 w-3 shrink-0 rounded-sm"
                  style={{
                    background:
                      COLORS[fieldColorIndex(s, colorById) % COLORS.length],
                  }}
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
    </section>
  );
}

export default function LayoutVisualizer({ mode = "edit" }: { mode?: Mode }) {
  const model = useStructStore((s) => s.currentModel);
  const versions = useStructStore((s) => s.versions);
  const baseVersionId = useStructStore((s) => s.baseVersionId);
  const targetVersionId = useStructStore((s) => s.targetVersionId);
  const previewVersionId = useStructStore((s) => s.previewVersionId);
  const setPreviewVersion = useStructStore((s) => s.setPreviewVersion);
  const [pxPerByte, setPxPerByte] = useState(28);

  // Edit sekmesinde bir snapshot önizleniyorsa onu SALT-OKUNUR göster;
  // currentModel'e (Live) dokunma. Bulunamazsa Live'a düş.
  const previewVersion = previewVersionId
    ? versions.find((v) => v.id === previewVersionId)
    : undefined;
  const editModelToShow = previewVersion?.model ?? model;

  const cmp = resolveComparison(versions, model, baseVersionId, targetVersionId);
  const isComparison = Boolean(
    mode === "compare" && cmp.fromModel && cmp.toModel && cmp.fromValue !== cmp.toValue
  );

  const currentLayout = computeLayout(editModelToShow);
  const currentSegments = toSegments(currentLayout);

  const fromLayout =
    isComparison && cmp.fromModel ? computeLayout(cmp.fromModel) : null;
  const toLayout =
    isComparison && cmp.toModel ? computeLayout(cmp.toModel) : null;
  const targetImpacts =
    isComparison && cmp.fromModel && cmp.toModel
      ? analyzeFieldImpacts(cmp.fromModel, cmp.toModel)
      : [];
  const targetImpactsById = new Map(
    targetImpacts.map((impact) => [impact.fieldId, impact])
  );
  const colorById =
    isComparison && cmp.fromModel && cmp.toModel
      ? buildColorById(cmp.fromModel, cmp.toModel)
      : undefined;

  const zoomControl = (
    <div className="flex items-center gap-2">
      <label className="text-xs text-muted" htmlFor={`zoom-${mode}`}>
        Zoom
      </label>
      <input
        id={`zoom-${mode}`}
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
  );

  if (mode === "compare") {
    if (!cmp.fromModel || !cmp.toModel) {
      return (
        <Panel title="Compared Layouts">
          <p className="text-sm text-muted">Save a version first to compare layouts.</p>
        </Panel>
      );
    }

    if (!isComparison || !fromLayout || !toLayout) {
      return (
        <Panel title="Compared Layouts" description={`${cmp.fromLabel} -> ${cmp.toLabel}`}>
          <p className="text-sm text-muted">Choose two different comparison targets.</p>
        </Panel>
      );
    }

    return (
      <div className="space-y-3">
        <div className="rounded-lg border border-border bg-surface p-3 shadow-sm">
          {zoomControl}
        </div>

        <div className="grid min-w-0 items-start gap-4 xl:grid-cols-2">
          <Panel
            title={cmp.fromLabel}
            description={`size ${fromLayout.totalSize} B / align ${fromLayout.alignment} B / padding ${fromLayout.totalPadding} B`}
          >
            <LayoutStrip
              layout={fromLayout}
              segments={toSegments(fromLayout)}
              pxPerByte={pxPerByte}
              colorById={colorById}
            />
          </Panel>

          <Panel
            title={cmp.toLabel}
            description={`size ${toLayout.totalSize} B / align ${toLayout.alignment} B / padding ${toLayout.totalPadding} B`}
          >
            <LayoutStrip
              layout={toLayout}
              segments={toSegments(toLayout)}
              pxPerByte={pxPerByte}
              impactsById={targetImpactsById}
              colorById={colorById}
            />
          </Panel>
        </div>
      </div>
    );
  }

  return (
    <Panel
      title={previewVersion ? `Memory Layout — ${previewVersion.label}` : "Memory Layout"}
      description={`size ${currentLayout.totalSize} B / align ${currentLayout.alignment} B / padding ${currentLayout.totalPadding} B`}
    >
      {previewVersion && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-accent/40 bg-accent/10 px-3 py-2 text-xs">
          <span className="min-w-0 text-muted">
            Previewing{" "}
            <span className="font-semibold text-foreground">
              {previewVersion.label}
            </span>{" "}
            (read-only) — your live edits are untouched.
          </span>
          <button
            type="button"
            onClick={() => setPreviewVersion(null)}
            className="shrink-0 rounded-md border border-accent/50 px-2 py-1 font-medium text-accent transition-colors hover:bg-accent/15"
          >
            Back to Live
          </button>
        </div>
      )}

      <div className="mb-3">
        {zoomControl}
      </div>

      <LayoutStrip
        layout={currentLayout}
        segments={currentSegments}
        pxPerByte={pxPerByte}
      />
    </Panel>
  );
}
