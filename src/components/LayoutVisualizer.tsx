"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { resolveComparison, useStructStore } from "@/store/useStructStore";
import { computeLayout } from "@/engine/layout";
import { toSegments, type LayoutSegment } from "@/engine/segments";
import { analyzeFieldImpacts, type FieldImpact } from "@/engine/compatibility";
import { isUnsignedInt } from "@/engine/bitfields";
import type {
  FieldLayout,
  LayoutResult,
  StructModel,
  WarningSeverity,
} from "@/types";
import Panel from "@/components/ui/Panel";

type Mode = "edit" | "compare";

// Stable color palette for fields. Daha çok renk = kimlik-bazlı sabit renklerde
// iki bloğun aynı renge düşme olasılığı azalır (kararlılık bozulmadan).
const COLORS = [
  "#60a5fa", // blue
  "#34d399", // emerald
  "#f472b6", // pink
  "#fbbf24", // amber
  "#a78bfa", // violet
  "#fb7185", // rose
  "#22d3ee", // cyan
  "#a3e635", // lime
  "#fb923c", // orange
  "#e879f9", // fuchsia
];

// ============================================================================
// Compare-mode helpers (side-by-side From/To layouts with change impacts).
// ============================================================================

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

// ============================================================================
// Edit-mode helpers (interactive map: drag-reorder, nested expand, bit-fields).
// ============================================================================

/**
 * Alanlara renk ata: her alan, KİMLİK KÜMESİNDEKİ sıralı sırasına (sorted rank)
 * göre paletten renk alır. Atama görsel sıraya bağlı DEĞİL → alanları reorder
 * etmek bir bloğun rengini DEĞİŞTİRMEZ. Ayrıca palet kadar (≤10) alanda renkler
 * BENZERSİZDİR, yani bloklar birbirine karışmaz. (Alan ekley/çıkarınca sıralama
 * kayabilir; kritik olan reorder kararlılığı korunur.)
 */
function assignFieldColors(fields: { fieldId: string }[]): Record<string, string> {
  const rankById = new Map<string, number>();
  fields
    .map((f) => f.fieldId)
    .sort()
    .forEach((id, i) => rankById.set(id, i));

  const map: Record<string, string> = {};
  for (const f of fields) {
    map[f.fieldId] = COLORS[(rankById.get(f.fieldId) ?? 0) % COLORS.length];
  }
  return map;
}

const fieldLabel = (fl: FieldLayout) =>
  (fl.arrayLength ?? 1) > 1 ? `${fl.name}[${fl.arrayLength}]` : fl.name;

// Salt-okunur özyinelemeli band (nested struct iç yerleşimi + önizleme için; reorder yok).
function Band({ layout, pxPerByte }: { layout: LayoutResult; pxPerByte: number }) {
  const segments = toSegments(layout);
  const [open, setOpen] = useState<Record<number, boolean>>({});

  return (
    <div className="overflow-x-auto">
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
          const displayName =
            s.arrayIndex === undefined ? s.name : `${s.name}[${s.arrayIndex}]`;
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
              className={`flex shrink-0 flex-col items-center justify-center overflow-hidden border-r border-black/10 text-xs text-black last:border-r-0 ${expandable ? "cursor-pointer" : ""}`}
              title={`${displayName}: ${s.typeName ?? s.type} — offset ${s.offset}, ${s.size} bytes`}
            >
              <span className="max-w-full truncate px-1 font-medium">
                {displayName}
                {expandable && <span className="ml-0.5">{isOpen ? "▾" : "▸"}</span>}
              </span>
              <span className="max-w-full truncate px-1 opacity-70">
                {s.type === "struct" ? s.typeName : `${s.size}B`}
              </span>
            </div>
          );
        })}
      </div>
      {segments
        .filter((s) => s.kind === "field" && s.type === "struct" && s.nested && open[s.offset])
        .map((s, i) => (
          <div key={i} className="mt-3 border-l-2 border-accent/40 pl-3">
            <div className="mb-1 text-xs text-muted">
              ▾ {s.name}: {s.typeName} — inner layout ({s.nested!.totalSize} B)
            </div>
            <Band layout={s.nested!} pxPerByte={pxPerByte} />
          </div>
        ))}
    </div>
  );
}

// Bir alan bloğunun ortak türetmeleri (sortable ve statik sürüm paylaşır).
function fieldBlockParts(fl: FieldLayout, onToggle: () => void) {
  const arrayLength = Math.max(1, fl.arrayLength ?? 1);
  const elementSize = fl.elementSize ?? fl.size / arrayLength;
  const expandable = fl.type === "struct" && !!fl.nested;
  const isBitField = isUnsignedInt(fl.type);

  // struct → aç/kapat · unsigned → Status Bits editörüne kaydır.
  const handleClick = expandable
    ? onToggle
    : isBitField
      ? () =>
          document
            .getElementById(`bits-${fl.fieldId}`)
            ?.scrollIntoView({ behavior: "smooth", block: "center" })
      : undefined;

  const title = `${fieldLabel(fl)}: ${fl.typeName ?? fl.type} — offset ${fl.offset}, ${fl.size} bytes (drag: reorder${expandable ? " · click: expand/collapse" : isBitField ? " · click: Status Bits" : ""})`;
  return { arrayLength, elementSize, expandable, handleClick, title };
}

// Bloğun iç hücreleri (dizi ise birden çok). Sortable ve statik sürüm ortak kullanır.
function FieldCells({
  fl,
  pxPerByte,
  bg,
  arrayLength,
  elementSize,
  expandable,
  open,
}: {
  fl: FieldLayout;
  pxPerByte: number;
  bg: string;
  arrayLength: number;
  elementSize: number;
  expandable: boolean;
  open: boolean;
}) {
  return (
    <>
      {Array.from({ length: arrayLength }).map((_, ai) => (
        <div
          key={ai}
          style={{ width: elementSize * pxPerByte, background: bg }}
          className="flex h-16 shrink-0 flex-col items-center justify-center overflow-hidden border-r border-black/10 text-xs text-black"
        >
          <span className="max-w-full truncate px-1 font-medium">
            {fl.name}
            {arrayLength > 1 ? `[${ai}]` : ""}
            {expandable && ai === 0 && <span className="ml-0.5">{open ? "▾" : "▸"}</span>}
          </span>
          <span className="max-w-full truncate px-1 opacity-70">
            {fl.type === "struct" ? fl.typeName : `${elementSize}B`}
          </span>
        </div>
      ))}
    </>
  );
}

// Sürüklenebilir alan bloğu (yalnızca mount SONRASI render edilir → dnd-kit id'leri SSR'ı bozmaz).
function FieldBlock({
  fl,
  pxPerByte,
  open,
  onToggle,
  bg,
}: {
  fl: FieldLayout;
  pxPerByte: number;
  open: boolean;
  onToggle: () => void;
  bg: string;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: fl.fieldId });
  const { arrayLength, elementSize, expandable, handleClick, title } = fieldBlockParts(fl, onToggle);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={handleClick}
      className="flex shrink-0 cursor-grab active:cursor-grabbing"
      title={title}
    >
      <FieldCells
        fl={fl}
        pxPerByte={pxPerByte}
        bg={bg}
        arrayLength={arrayLength}
        elementSize={elementSize}
        expandable={expandable}
        open={open}
      />
    </div>
  );
}

// Statik alan bloğu (SSR + ilk istemci render'ı; dnd yok → hydration güvenli, aynı görünür).
function StaticFieldBlock({
  fl,
  pxPerByte,
  open,
  onToggle,
  bg,
}: {
  fl: FieldLayout;
  pxPerByte: number;
  open: boolean;
  onToggle: () => void;
  bg: string;
}) {
  const { arrayLength, elementSize, expandable, handleClick, title } = fieldBlockParts(fl, onToggle);
  return (
    <div onClick={handleClick} className="flex shrink-0 cursor-grab" title={title}>
      <FieldCells
        fl={fl}
        pxPerByte={pxPerByte}
        bg={bg}
        arrayLength={arrayLength}
        elementSize={elementSize}
        expandable={expandable}
        open={open}
      />
    </div>
  );
}

function PaddingCell({ size, pxPerByte }: { size: number; pxPerByte: number }) {
  return (
    <div
      style={{
        width: size * pxPerByte,
        backgroundImage:
          "repeating-linear-gradient(45deg, rgba(120,120,120,.30) 0 4px, transparent 4px 8px)",
      }}
      className="flex h-16 shrink-0 items-center justify-center border-r border-border text-[10px] text-muted"
      title={`padding: ${size} wasted bytes`}
    >
      {size}
    </div>
  );
}

// Üst seviye band: alanlar dnd-kit ile sürüklenip yeniden sıralanabilir.
function SortableBand({
  layout,
  pxPerByte,
  colorMap,
}: {
  layout: LayoutResult;
  pxPerByte: number;
  colorMap: Record<string, string>;
}) {
  const model = useStructStore((s) => s.currentModel);
  const reorderFields = useStructStore((s) => s.reorderFields);
  const [open, setOpen] = useState<Record<string, boolean>>({});

  // dnd-kit SSR'da benzersiz erişilebilirlik id'leri üretir (DndDescribedBy-N) →
  // sunucu/istemci uyuşmazlığı. Mount'tan önce statik, sonra sürüklenebilir render et.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = model.fields.findIndex((f) => f.id === active.id);
    const to = model.fields.findIndex((f) => f.id === over.id);
    if (from >= 0 && to >= 0) reorderFields(from, to);
  };

  const last = layout.fields[layout.fields.length - 1];
  const tail = last ? layout.totalSize - (last.offset + last.size) : 0;

  // Mount durumuna göre sortable ya da statik blok (ikisi de aynı prop imzası + görünüm).
  const Block = mounted ? FieldBlock : StaticFieldBlock;
  const band = (
    <div className="flex h-16 w-max overflow-hidden rounded-lg border border-border">
      {layout.fields.map((fl) => (
        <Fragment key={fl.fieldId}>
          {fl.paddingBefore > 0 && (
            <PaddingCell size={fl.paddingBefore} pxPerByte={pxPerByte} />
          )}
          <Block
            fl={fl}
            pxPerByte={pxPerByte}
            open={!!open[fl.fieldId]}
            onToggle={() => setOpen((o) => ({ ...o, [fl.fieldId]: !o[fl.fieldId] }))}
            bg={colorMap[fl.fieldId]}
          />
        </Fragment>
      ))}
      {tail > 0 && <PaddingCell size={tail} pxPerByte={pxPerByte} />}
    </div>
  );

  return (
    <div className="overflow-x-auto">
      {mounted ? (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext
            items={layout.fields.map((f) => f.fieldId)}
            strategy={horizontalListSortingStrategy}
          >
            {band}
          </SortableContext>
        </DndContext>
      ) : (
        band
      )}

      {/* Offset cetveli (band ile aynı genişlikler). */}
      <div className="mt-1 flex w-max">
        {layout.fields.map((fl) => (
          <Fragment key={fl.fieldId}>
            {fl.paddingBefore > 0 && (
              <div style={{ width: fl.paddingBefore * pxPerByte }} className="shrink-0" />
            )}
            <div
              style={{ width: fl.size * pxPerByte }}
              className="shrink-0 text-[10px] text-muted"
            >
              {fl.offset}
            </div>
          </Fragment>
        ))}
        <span className="pl-0.5 text-[10px] text-muted">{layout.totalSize}</span>
      </div>

      {/* Açılan nested struct'ların iç yerleşimi. */}
      {layout.fields
        .filter((fl) => fl.type === "struct" && fl.nested && open[fl.fieldId])
        .map((fl) => (
          <div key={fl.fieldId} className="mt-3 border-l-2 border-accent/40 pl-3">
            <div className="mb-1 text-xs text-muted">
              ▾ {fieldLabel(fl)}: {fl.typeName} — inner layout ({fl.nested!.totalSize} B,
              align {fl.nested!.alignment} B)
            </div>
            <Band layout={fl.nested!} pxPerByte={pxPerByte} />
          </div>
        ))}
    </div>
  );
}

export default function LayoutVisualizer({ mode = "edit" }: { mode?: Mode }) {
  const model = useStructStore((s) => s.currentModel);
  const versions = useStructStore((s) => s.versions);
  const baseVersionId = useStructStore((s) => s.baseVersionId);
  const targetVersionId = useStructStore((s) => s.targetVersionId);
  const previewVersionId = useStructStore((s) => s.previewVersionId);
  const setPreviewVersion = useStructStore((s) => s.setPreviewVersion);

  // Compare mode: manual zoom. Edit mode: auto-scale to the container width.
  const [pxPerByte, setPxPerByte] = useState(28);
  const [byteLimit, setByteLimit] = useState<number | "">("");
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerW, setContainerW] = useState(0);
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) =>
      setContainerW(entries[0].contentRect.width)
    );
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

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

  // ---- Compare mode ----
  if (mode === "compare") {
    if (!cmp.fromModel || !cmp.toModel) {
      return (
        <Panel title="Compared Layouts">
          <p className="text-sm text-muted">Save a version first to compare layouts.</p>
        </Panel>
      );
    }

    const fromLayout = computeLayout(cmp.fromModel);
    const toLayout = computeLayout(cmp.toModel);

    if (!isComparison) {
      return (
        <Panel title="Compared Layouts" description={`${cmp.fromLabel} -> ${cmp.toLabel}`}>
          <p className="text-sm text-muted">Choose two different comparison targets.</p>
        </Panel>
      );
    }

    const targetImpacts = analyzeFieldImpacts(cmp.fromModel, cmp.toModel);
    const targetImpactsById = new Map(
      targetImpacts.map((impact) => [impact.fieldId, impact])
    );
    const colorById = buildColorById(cmp.fromModel, cmp.toModel);

    return (
      <div className="space-y-3">
        <div className="rounded-lg border border-border bg-surface p-3 shadow-sm">
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted" htmlFor="zoom-compare">
              Zoom
            </label>
            <input
              id="zoom-compare"
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

  // ---- Edit mode (interactive map + read-only snapshot preview) ----
  const layout = computeLayout(editModelToShow);
  const hasNested = layout.fields.some((f) => f.type === "struct" && f.nested);
  const autoPxPerByte =
    layout.totalSize > 0 && containerW > 0
      ? Math.max(4, Math.min(48, Math.floor(containerW / layout.totalSize)))
      : 28;
  const colorMap = assignFieldColors(layout.fields);
  const overLimit =
    typeof byteLimit === "number" && byteLimit > 0 && layout.totalSize > byteLimit;

  return (
    <Panel
      title={previewVersion ? `Memory Layout — ${previewVersion.label}` : "Memory Layout"}
      description={`size ${layout.totalSize} B · align ${layout.alignment} B · padding ${layout.totalPadding} B`}
    >
      {previewVersion && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-accent/40 bg-accent/10 px-3 py-2 text-xs">
          <span className="min-w-0 text-muted">
            Previewing{" "}
            <span className="font-semibold text-foreground">{previewVersion.label}</span>{" "}
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

      {layout.fields.length === 0 ? (
        <p className="text-sm text-muted">Add fields to see the memory layout.</p>
      ) : (
        <>
          <div className="mb-3 flex items-center gap-2">
            <label className="text-xs text-muted" htmlFor="byte-limit">
              Byte limit
            </label>
            <input
              id="byte-limit"
              type="number"
              min={0}
              value={byteLimit}
              onChange={(e) =>
                setByteLimit(
                  e.target.value === "" ? "" : Math.max(0, Number(e.target.value) || 0)
                )
              }
              placeholder="optional"
              className="w-24 rounded-lg border border-border bg-surface-muted px-2 py-1 text-xs outline-none focus:border-accent"
            />
            <span className="text-xs text-muted">warns if exceeded</span>
          </div>

          {overLimit && (
            <div
              className="mb-3 rounded-lg border border-danger/30 bg-danger/10 p-2 text-xs text-danger"
              role="alert"
            >
              Struct is {layout.totalSize} B — exceeds the {byteLimit} B limit by{" "}
              {layout.totalSize - (byteLimit as number)} B.
            </div>
          )}

          <div ref={containerRef}>
            {previewVersion ? (
              <Band layout={layout} pxPerByte={autoPxPerByte} />
            ) : (
              <SortableBand layout={layout} pxPerByte={autoPxPerByte} colorMap={colorMap} />
            )}
          </div>

          <p className="mt-2 text-[11px] text-muted">
            {previewVersion
              ? hasNested
                ? "Read-only preview · click a struct to expand its layout."
                : "Read-only preview."
              : `Tip: drag fields to reorder${hasNested ? " · click a struct to expand its layout" : ""}.`}
          </p>

          {/* Legend (alan başına bir giriş). */}
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
            {layout.fields.map((fl) => (
              <span key={fl.fieldId} className="flex items-center gap-1 text-[11px]">
                <span
                  className="inline-block h-3 w-3 rounded-sm"
                  style={{ background: colorMap[fl.fieldId] }}
                />
                {fieldLabel(fl)}
                {fl.type === "struct" && <span className="text-muted">:{fl.typeName}</span>}
                <span className="text-muted">
                  @{fl.offset}·{fl.size}B
                </span>
              </span>
            ))}
          </div>
        </>
      )}
    </Panel>
  );
}
