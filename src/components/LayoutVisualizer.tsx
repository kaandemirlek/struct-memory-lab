"use client";

import { Fragment, useCallback, useRef, useState, useSyncExternalStore } from "react";
import {
  DndContext,
  DragOverlay,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { EXAMPLE_MODEL, resolveComparison, useStructStore } from "@/store/useStructStore";
import { computeLayout } from "@/engine/layout";
import { toSegments, type LayoutSegment } from "@/engine/segments";
import { analyzeFieldImpacts, type FieldImpact } from "@/engine/compatibility";
import { alignFieldIds } from "@/engine/identity";
import { PLATFORMS } from "@/engine/platform";
import { isUnsignedInt } from "@/engine/bitfields";
import type {
  FieldLayout,
  LayoutResult,
  Platform,
  StructModel,
  WarningSeverity,
} from "@/types";
import Panel from "@/components/ui/Panel";
import Button from "@/components/ui/Button";
import { ChevronRightIcon } from "@/components/ui/icons";
import { FIELD_COLORS } from "@/lib/fieldColors";
import { HATCH } from "@/lib/layoutStyles";

type Mode = "edit" | "compare";

// Mount tespiti (SSR/hydration güvenli): sunucuda false, istemcide true.
// dnd-kit id'leri yalnızca mount sonrası üretilir → hydration uyuşmazlığını önler.
const subscribeToNothing = () => () => {};

// Stable color palette for fields. Daha çok renk = kimlik-bazlı sabit renklerde
// iki bloğun aynı renge düşme olasılığı azalır (kararlılık bozulmadan).
const COLORS = FIELD_COLORS;

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
  view = "strip",
  rowBytes = 8,
  selectedId = null,
  expandedNestedIds,
  onSelect,
}: {
  label?: string;
  layout: LayoutResult;
  segments: LayoutSegment[];
  pxPerByte: number;
  impactsById?: Map<string, FieldImpact>;
  colorById?: Map<string, number>;
  view?: "strip" | "rows";
  rowBytes?: number;
  /** Seçili alan iki versiyonda da vurgulanır; kalanlar soluklaşır. */
  selectedId?: string | null;
  expandedNestedIds?: ReadonlySet<string>;
  onSelect?: (fieldId: string) => void;
}) {
  if (segments.length === 0) {
    return <p className="text-sm text-muted">Add fields to see the memory layout.</p>;
  }

  // Rows görünümü için id → renk haritası (WrappedBand sözleşmesi).
  const wrapColorMap = colorById
    ? Object.fromEntries(
        [...colorById].map(([id, i]) => [id, COLORS[i % COLORS.length]])
      )
    : undefined;

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

      {view === "rows" ? (
        <WrappedBand
          layout={layout}
          rowBytes={rowBytes}
          colorMap={wrapColorMap}
          impactsById={impactsById}
          selectedId={selectedId}
          expandedNestedIds={expandedNestedIds}
          onSelect={onSelect}
        />
      ) : (
      <div className="overflow-x-auto">
        <div
          className="flex h-32 w-max overflow-hidden rounded-lg border border-border"
          aria-label="Memory layout strip"
        >
          {segments.map((s, i) => {
            const impact = s.fieldId ? impactsById?.get(s.fieldId) : undefined;
            const severity = impact ? strongestSeverity(impact) : undefined;
            const dimmed = selectedId !== null && s.fieldId !== selectedId;
            const expandable = s.type === "struct" && !!s.nested && !!s.fieldId;
            const expanded = expandable && expandedNestedIds?.has(s.fieldId!);
            const title =
              s.kind === "field"
                ? [
                    `${s.name}: offset ${s.offset}, ${s.size} bytes`,
                    impact ? impactTitle(impact) : "",
                    expandable
                      ? `(click: ${expanded ? "collapse" : "expand"} inner comparison)`
                      : onSelect
                        ? "(click: highlight in both versions)"
                        : "",
                  ]
                    .filter(Boolean)
                    .join("\n")
                : `padding: ${s.size} wasted bytes`;

            return s.kind === "field" ? (
              <div
                key={i}
                onClick={onSelect && s.fieldId ? () => onSelect(s.fieldId!) : undefined}
                style={{
                  width: s.size * pxPerByte,
                  background: COLORS[fieldColorIndex(s, colorById) % COLORS.length],
                }}
                className={`relative flex shrink-0 flex-col items-center justify-center overflow-hidden border-r border-black/10 text-xs text-field-ink last:border-r-0 ${
                  severity ? RING_STYLES[severity] : ""
                } ${onSelect ? "cursor-pointer" : ""} ${
                  dimmed
                    ? "opacity-30"
                    : selectedId !== null
                      ? "outline outline-2 -outline-offset-2 outline-accent"
                      : ""
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
                <span className="flex max-w-full items-center truncate px-1 font-medium">
                  <span className="truncate">{s.name}</span>
                  {expandable && <BlockChevron open={!!expanded} />}
                </span>
                <span className="max-w-full truncate px-1 font-mono text-[10px] leading-tight opacity-80">
                  {s.typeName ?? s.type}
                </span>
                <span className="text-[9px] opacity-60">{s.size}B</span>
              </div>
            ) : (
              <div
                key={i}
                style={{
                  width: s.size * pxPerByte,
                  backgroundImage: HATCH,
                }}
                className={`flex shrink-0 items-center justify-center border-r border-border text-[10px] text-muted last:border-r-0 ${
                  selectedId !== null ? "opacity-30" : ""
                }`}
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
      )}

      <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1">
        {segments
          .filter((s) => s.kind === "field")
          .map((s, i) => {
            const impact = s.fieldId ? impactsById?.get(s.fieldId) : undefined;
            const expandable = s.type === "struct" && !!s.nested && !!s.fieldId;
            return (
              <span
                key={i}
                onClick={onSelect && s.fieldId ? () => onSelect(s.fieldId!) : undefined}
                className={`flex min-w-0 flex-wrap items-center gap-1 text-[11px] ${
                  onSelect ? "cursor-pointer" : ""
                } ${
                  selectedId !== null
                    ? s.fieldId === selectedId
                      ? "font-semibold"
                      : "opacity-40"
                    : ""
                }`}
                title={impact ? impactTitle(impact) : undefined}
              >
                <span
                  className="inline-block h-3 w-3 shrink-0 rounded-sm"
                  style={{
                    background:
                      COLORS[fieldColorIndex(s, colorById) % COLORS.length],
                  }}
                />
                <span className="flex min-w-0 items-center truncate">
                  <span className="truncate">{s.name}</span>
                  {expandable && (
                    <BlockChevron open={!!expandedNestedIds?.has(s.fieldId!)} />
                  )}
                </span>
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

// Blok içi aç/kapat oku — metin glifleri (▾/▸) yerine Panel ile aynı SVG dili.
function BlockChevron({ open }: { open: boolean }) {
  return (
    <ChevronRightIcon
      width={10}
      height={10}
      strokeWidth={3}
      className={`ml-0.5 inline-block shrink-0 transition-transform ${open ? "rotate-90" : ""}`}
      aria-hidden
    />
  );
}

// Strip ↔ Rows görünüm seçici (edit ve compare modları aynı kontrolü paylaşır).
function ViewToggle({
  view,
  onView,
  rowBytes,
  onRowBytes,
}: {
  view: "strip" | "rows";
  onView: (v: "strip" | "rows") => void;
  rowBytes: number;
  onRowBytes: (n: number) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="inline-flex rounded-lg border border-border bg-surface p-0.5">
        {(["strip", "rows"] as const).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => onView(v)}
            aria-pressed={view === v}
            className={`rounded-md px-2 py-1 text-xs font-medium transition-colors ${
              view === v
                ? "bg-accent text-accent-foreground"
                : "text-muted hover:bg-surface-muted hover:text-foreground"
            }`}
          >
            {v === "strip" ? "Strip" : "Rows"}
          </button>
        ))}
      </div>
      {view === "rows" && (
        <select
          value={rowBytes}
          onChange={(e) => onRowBytes(Number(e.target.value))}
          aria-label="Bytes per row"
          className="rounded-lg border border-border bg-surface-muted px-2 py-1 text-xs outline-none focus:border-accent"
        >
          {[8, 16, 32].map((n) => (
            <option key={n} value={n}>
              {n} B/row
            </option>
          ))}
        </select>
      )}
    </div>
  );
}

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
                  backgroundImage: HATCH,
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
              className={`flex shrink-0 flex-col items-center justify-center overflow-hidden border-r border-black/10 text-xs text-field-ink last:border-r-0 ${expandable ? "cursor-pointer" : ""}`}
              title={`${displayName}: ${s.typeName ?? s.type} — offset ${s.offset}, ${s.size} bytes`}
            >
              <span className="flex max-w-full items-center truncate px-1 font-medium">
                <span className="truncate">{displayName}</span>
                {expandable && <BlockChevron open={!!isOpen} />}
              </span>
              {/* Veri tipi (ör. uint32_t / Vec3). */}
              <span className="max-w-full truncate px-1 font-mono text-[10px] leading-tight opacity-80">
                {s.typeName ?? s.type}
              </span>
              <span className="max-w-full truncate px-1 text-[9px] leading-tight opacity-60">
                {s.size}B
              </span>
            </div>
          );
        })}
      </div>

      {/* Offset cetveli — canlı (sortable) görünümdeki ile aynı düzen; önizleme
          ve nested iç yerleşimlerde de byte offset'leri görünsün. */}
      <div className="mt-1 flex w-max">
        {segments.map((s, i) =>
          s.kind === "padding" ? (
            <div key={i} style={{ width: s.size * pxPerByte }} className="shrink-0" />
          ) : (
            <div
              key={i}
              style={{ width: s.size * pxPerByte }}
              className="shrink-0 text-[10px] text-muted"
            >
              {s.offset}
            </div>
          )
        )}
        <span className="pl-0.5 text-[10px] text-muted">{layout.totalSize}</span>
      </div>

      {segments
        .filter((s) => s.kind === "field" && s.type === "struct" && s.nested && open[s.offset])
        .map((s, i) => (
          <div key={i} className="mt-3 border-l-2 border-accent/40 pl-3">
            <div className="mb-1 text-xs text-muted">
              <BlockChevron open /> {s.name}: {s.typeName} — inner layout ({s.nested!.totalSize} B)
            </div>
            <Band layout={s.nested!} pxPerByte={pxPerByte} />
          </div>
        ))}
    </div>
  );
}

// ============================================================================
// Satır görünümü (hex-dump tarzı): bellek, sabit genişlikte satırlara sarılır.
// Satır sınırını aşan alanlar parçalara bölünür → sürükleme burada anlamsız,
// görünüm salt-okunurdur (yeniden sıralamak için Strip görünümü kullanılır).
// ============================================================================

type RowChunk = {
  seg: LayoutSegment;
  size: number; // bu satıra düşen byte sayısı
  isStart: boolean; // segmentin ilk parçası (etiket burada gösterilir)
};

function buildRows(
  segments: LayoutSegment[],
  totalSize: number,
  rowBytes: number
): RowChunk[][] {
  const rows: RowChunk[][] = [];
  for (let rowStart = 0; rowStart < totalSize; rowStart += rowBytes) {
    const rowEnd = Math.min(rowStart + rowBytes, totalSize);
    const chunks: RowChunk[] = [];
    for (const seg of segments) {
      const start = Math.max(seg.offset, rowStart);
      const end = Math.min(seg.offset + seg.size, rowEnd);
      if (end > start) {
        chunks.push({ seg, size: end - start, isStart: start === seg.offset });
      }
    }
    rows.push(chunks);
  }
  return rows;
}

// Satır görünümünde tek bir alan parçası: sürüklenebilir VE bırakma hedefi.
// Sıralama semantiği Strip ile aynıdır (alan A, alan B'nin sırasına taşınır);
// yalnızca sürükleme yüzeyi farklıdır — parça satırlar arasında bölünmüş olabilir.
function RowFieldChunk({
  dragId,
  fieldId,
  activeFieldId,
  style,
  className,
  title,
  onClick,
  children,
}: {
  dragId: string;
  fieldId: string;
  activeFieldId: string | null;
  style: React.CSSProperties;
  className: string;
  title: string;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  const { setNodeRef: setDragRef, attributes, listeners } = useDraggable({
    id: dragId,
    data: { fieldId },
  });
  const { setNodeRef: setDropRef, isOver, active } = useDroppable({
    id: `drop:${dragId}`,
    data: { fieldId },
  });
  const setRefs = (el: HTMLElement | null) => {
    setDragRef(el);
    setDropRef(el);
  };
  // Sürüklenen alanın TÜM parçaları soluklaşır; başka alanın parçası üzerine
  // gelinince hedef parça vurgulanır (bırakınca o alanın sırasına geçilir).
  const isSource = activeFieldId === fieldId;
  const isTarget = isOver && active?.data.current?.fieldId !== fieldId;
  return (
    <div
      ref={setRefs}
      {...attributes}
      {...listeners}
      onClick={onClick}
      data-drag-chunk={dragId}
      style={style}
      className={`${className} cursor-grab active:cursor-grabbing ${
        isSource ? "opacity-50" : ""
      } ${isTarget ? "ring-2 ring-inset ring-accent" : ""}`}
      title={title}
    >
      {children}
    </div>
  );
}

function WrappedBand({
  layout,
  rowBytes,
  colorMap,
  onReorder,
  impactsById,
  collapsedUnchangedIds,
  selectedId = null,
  expandedNestedIds,
  onSelect,
}: {
  layout: LayoutResult;
  rowBytes: number;
  /** Canlı görünümde id-bazlı renkler; verilmezse segmentin colorIndex'i kullanılır. */
  colorMap?: Record<string, string>;
  /** Verilirse parçalar sürüklenebilir olur: alan, bırakılan alanın sırasına taşınır. */
  onReorder?: (fromFieldId: string, toFieldId: string) => void;
  /** Compare modunda alan bazlı etki rozetleri (severity halkası + "!" işareti). */
  impactsById?: Map<string, FieldImpact>;
  /** Verilirse yalnızca değişen alan içeren satırları gösterir. */
  collapsedUnchangedIds?: Set<string>;
  /** Compare modunda seçili alan: iki tarafta da vurgulanır, kalanlar soluklaşır. */
  selectedId?: string | null;
  expandedNestedIds?: ReadonlySet<string>;
  onSelect?: (fieldId: string) => void;
}) {
  const segments = toSegments(layout);
  const rows = buildRows(segments, layout.totalSize, rowBytes);
  const changedRanges = collapsedUnchangedIds
    ? layout.fields
        .filter((fl) => !collapsedUnchangedIds.has(fl.fieldId))
        .map((fl, index, changedFields) => {
          const isLastField = fl.fieldId === layout.fields.at(-1)?.fieldId;
          return {
            start: fl.offset - fl.paddingBefore,
            end:
              isLastField && index === changedFields.length - 1
                ? layout.totalSize
                : fl.offset + fl.size,
          };
        })
    : [];
  const visibleRows = rows
    .map((chunks, ri) => ({ chunks, offset: ri * rowBytes }))
    .filter(
      ({ offset }) =>
        !collapsedUnchangedIds ||
        changedRanges.some(
          (range) =>
            range.end > offset && range.start < Math.min(offset + rowBytes, layout.totalSize)
        )
    );
  const pct = (bytes: number) => `${(bytes / rowBytes) * 100}%`;
  // Sürükleme sırasında kaynak alan: parçaları soluklaştırmak + imleci takip eden
  // overlay'de bloğun BİREBİR kopyasını (renk/boyut/etiket) çizmek için.
  const [activeField, setActiveField] = useState<{
    id: string;
    name: string;
    typeName: string;
    color: string;
    w: number;
    h: number;
  } | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  const handleDragStart = (e: DragStartEvent) => {
    const fieldId = e.active.data.current?.fieldId as string | undefined;
    if (!fieldId) return;
    const seg = segments.find((s) => s.fieldId === fieldId);
    // Tutulan parçanın gerçek görünümünü yakala → overlay aynı blok gibi görünsün.
    const el = document.querySelector<HTMLElement>(`[data-drag-chunk="${e.active.id}"]`);
    const rect = el?.getBoundingClientRect();
    setActiveField({
      id: fieldId,
      name: seg?.name ?? "",
      typeName: seg?.typeName ?? String(seg?.type ?? ""),
      color: el ? getComputedStyle(el).backgroundColor : "var(--accent)",
      w: rect?.width ?? 96,
      h: rect?.height ?? 48,
    });
  };

  const handleDragEnd = (e: DragEndEvent) => {
    setActiveField(null);
    const from = e.active.data.current?.fieldId as string | undefined;
    const to = e.over?.data.current?.fieldId as string | undefined;
    if (onReorder && from && to && from !== to) onReorder(from, to);
  };

  const colorOf = (seg: LayoutSegment) =>
    (seg.fieldId && colorMap?.[seg.fieldId]) ||
    COLORS[(seg.colorIndex ?? 0) % COLORS.length];

  const body = (
    <div
      className="space-y-1"
      aria-label={collapsedUnchangedIds ? "Changed rows" : "Memory layout rows"}
    >
      {visibleRows.map(({ chunks, offset }) => (
        <div key={offset} className="flex items-center gap-2">
          {/* Satır başı offset'i (hex-dump adres sütunu gibi). */}
          <span className="w-9 shrink-0 text-right font-mono text-[10px] tabular-nums text-muted">
            {offset}
          </span>
          <div className="flex h-12 min-w-0 flex-1 overflow-hidden rounded-md border border-border">
            {chunks.map((c, ci) => {
              const s = c.seg;
              if (s.kind === "padding") {
                return (
                  <div
                    key={ci}
                     style={{ width: pct(c.size), backgroundImage: HATCH }}
                     className={`flex shrink-0 items-center justify-center border-r border-border text-[9px] text-muted last:border-r-0 ${
                       selectedId ? "opacity-30" : ""
                     }`}
                     title={`padding: ${s.size} wasted bytes`}
                     aria-label={`Padding: ${s.size} bytes at offset ${s.offset}`}
                   >
                     {c.isStart ? s.size : ""}
                   </div>
                 );
               }
              const isCollapsed =
                !!s.fieldId && collapsedUnchangedIds?.has(s.fieldId);
              if (isCollapsed) {
                return (
                  <div
                    key={ci}
                    style={{ width: pct(c.size), backgroundImage: HATCH }}
                    className="flex shrink-0 items-center justify-center overflow-hidden border-r border-border px-1 text-[9px] text-muted last:border-r-0"
                    title={`${s.name}: unchanged at offset ${s.offset}, ${s.size} bytes`}
                  >
                    {c.isStart ? "unchanged" : ""}
                  </div>
                );
              }
              const displayName =
                s.arrayIndex === undefined ? s.name : `${s.name}[${s.arrayIndex}]`;
              const isBits = s.type !== undefined && isUnsignedInt(s.type);
              const expandable = s.type === "struct" && !!s.nested && !!s.fieldId;
              const expanded = expandable && expandedNestedIds?.has(s.fieldId!);
              const impact = s.fieldId ? impactsById?.get(s.fieldId) : undefined;
              const severity = impact ? strongestSeverity(impact) : undefined;
              // Seçim varken: seçili alan aksan konturu alır, kalan her şey soluklaşır.
              const dimmed = selectedId !== null && s.fieldId !== selectedId;
              // Compare modunda tıklama = seç/vurgula · canlı modda unsigned alan → Status Bits.
              // Ekran KAYMAZ: odaklanan alanın editörü Status Bits listesinin en üstüne alınır.
              const handleClick =
                onSelect && s.fieldId
                  ? () => onSelect(s.fieldId!)
                  : isBits && s.fieldId
                    ? () => useStructStore.getState().setFocusedBitField(s.fieldId!)
                    : undefined;
              const chunkStyle = { width: pct(c.size), background: colorOf(s) };
              const chunkClass = `relative flex shrink-0 flex-col items-center justify-center overflow-hidden border-r border-black/10 text-xs text-field-ink last:border-r-0 ${
                handleClick ? "cursor-pointer" : ""
              } ${severity ? RING_STYLES[severity] : ""} ${
                dimmed
                  ? "opacity-30"
                  : selectedId !== null
                    ? "outline outline-2 -outline-offset-2 outline-accent"
                    : ""
              }`;
              const chunkTitle = [
                `${displayName}: ${s.typeName ?? s.type} — offset ${s.offset}, ${s.size} bytes`,
                onReorder ? "(drag: reorder)" : "",
                impact ? impactTitle(impact) : "",
                expandable
                  ? `(click: ${expanded ? "collapse" : "expand"} inner comparison)`
                  : onSelect
                    ? "(click: highlight in both versions)"
                    : isBits
                      ? "(click: Status Bits)"
                      : "",
              ]
                .filter(Boolean)
                .join("\n");
              const content = (
                <>
                  {impact && severity && c.isStart && (
                    <span
                      className={`absolute right-0.5 top-0.5 rounded border bg-white/90 px-1 text-[9px] font-bold leading-3 ${BADGE_STYLES[severity]}`}
                      title={impactTitle(impact)}
                    >
                      !
                    </span>
                  )}
                  {c.isStart ? (
                    <>
                      <span className="max-w-full truncate px-1 font-medium">
                        <span className="flex max-w-full items-center truncate">
                          <span className="truncate">{displayName}</span>
                          {expandable && <BlockChevron open={!!expanded} />}
                        </span>
                      </span>
                      <span className="max-w-full truncate px-1 font-mono text-[9px] leading-tight opacity-70">
                        {s.typeName ?? s.type}
                      </span>
                    </>
                  ) : (
                    // Önceki satırdan devam eden parça: etiket soluk tekrarlanır.
                    <span className="max-w-full truncate px-1 font-medium opacity-45">
                      {displayName}
                    </span>
                  )}
                </>
              );

              // Salt-okunur / compare yolu: düz div. Canlı yol: sürüklenebilir parça.
              if (!onReorder || !s.fieldId) {
                return (
                  <div
                    key={ci}
                    onClick={handleClick}
                    style={chunkStyle}
                    className={chunkClass}
                    title={chunkTitle}
                  >
                    {content}
                  </div>
                );
              }
              return (
                <RowFieldChunk
                  key={ci}
                  dragId={`${s.fieldId}:${offset}:${ci}`}
                  fieldId={s.fieldId}
                  activeFieldId={activeField?.id ?? null}
                  style={chunkStyle}
                  className={chunkClass}
                  title={chunkTitle}
                  onClick={handleClick}
                >
                  {content}
                </RowFieldChunk>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );

  if (!onReorder) return body;
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveField(null)}
    >
      {body}
      {/* İmleci takip eden kopya: tutulan parça, Strip'teki blok görünümüyle taşınır. */}
      <DragOverlay dropAnimation={null}>
        {activeField ? (
          <div
            style={{ width: activeField.w, height: activeField.h, background: activeField.color }}
            // Strip'teki sürüklenen blokla aynı soluklaşma (%50) → iki görünüm tutarlı.
            className="flex cursor-grabbing flex-col items-center justify-center overflow-hidden rounded-md text-xs text-field-ink opacity-50 shadow-lg ring-1 ring-black/20"
          >
            <span className="max-w-full truncate px-1 font-medium">{activeField.name}</span>
            <span className="max-w-full truncate px-1 font-mono text-[9px] leading-tight opacity-70">
              {activeField.typeName}
            </span>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

// ============================================================================
// Collapsed compare (deneysel): yalnızca DEĞİŞEN alanları göster. İki versiyonda
// da byte-özdeş (aynı offset/boyut/tip/ad/dizi) ardışık alan dizileri tek bir
// "gap" hücresine sıkışır. GÜVENLİK: yalnızca offset'i AYNI kalan alanlar gizlenir
// — yer değiştiren/kayan (reorder ya da aşağı kayma) hiçbir alan gizlenmez, çünkü
// bunlar tam da görülmesi gereken (binary kıran) değişikliklerdir.
// ============================================================================

/** İki layout'ta byte-özdeş kalan alan id'leri (offset/boyut/tip/ad/dizi aynı). */
function layoutsIdentical(a: LayoutResult, b: LayoutResult): boolean {
  if (
    a.totalSize !== b.totalSize ||
    a.alignment !== b.alignment ||
    a.totalPadding !== b.totalPadding ||
    a.fields.length !== b.fields.length
  ) {
    return false;
  }

  const bById = new Map(b.fields.map((field) => [field.fieldId, field]));
  return a.fields.every((fa) => {
    const fb = bById.get(fa.fieldId);
    if (!fb) return false;
    const nestedIdentical =
      fa.nested && fb.nested
        ? layoutsIdentical(fa.nested, fb.nested)
        : !fa.nested && !fb.nested;
    return (
      fa.offset === fb.offset &&
      fa.size === fb.size &&
      fa.paddingBefore === fb.paddingBefore &&
      fa.name === fb.name &&
      fa.type === fb.type &&
      (fa.typeName ?? "") === (fb.typeName ?? "") &&
      (fa.arrayLength ?? 1) === (fb.arrayLength ?? 1) &&
      nestedIdentical
    );
  });
}

function computeUnchangedIds(
  from: LayoutResult,
  to: LayoutResult
): Set<string> {
  const toById = new Map(to.fields.map((f) => [f.fieldId, f]));
  const unchanged = new Set<string>();
  for (const fa of from.fields) {
    const fb = toById.get(fa.fieldId);
    if (
      fb &&
      fa.offset === fb.offset &&
      fa.size === fb.size &&
      fa.paddingBefore === fb.paddingBefore &&
      fa.name === fb.name &&
      fa.type === fb.type &&
      (fa.typeName ?? "") === (fb.typeName ?? "") &&
      (fa.arrayLength ?? 1) === (fb.arrayLength ?? 1) &&
      (fa.nested && fb.nested
        ? layoutsIdentical(fa.nested, fb.nested)
        : !fa.nested && !fb.nested)
    ) {
      unchanged.add(fa.fieldId);
    }
  }
  return unchanged;
}

function findLayoutField(layout: LayoutResult, fieldId: string): FieldLayout | undefined {
  for (const field of layout.fields) {
    if (field.fieldId === fieldId) return field;
    if (field.nested) {
      const nested = findLayoutField(field.nested, fieldId);
      if (nested) return nested;
    }
  }
  return undefined;
}

type CollapsedItem =
  | { kind: "gap"; offset: number; bytes: number; fields: number }
  | { kind: "padding"; offset: number; bytes: number }
  | { kind: "field"; fl: FieldLayout };

// Layout'u, değişmeyen ardışık alanları "gap"e indirgeyen görüntü öğelerine çevir.
// Padding ayrı tutulur: hem değişen padding miktarı görünür kalır hem de
// değişen alanlar normal şeritle aynı fiziksel byte ölçeğini kullanabilir.
function buildCollapsedItems(
  layout: LayoutResult,
  unchangedIds: Set<string>
): CollapsedItem[] {
  const items: CollapsedItem[] = [];
  let gapOffset = 0;
  let gapBytes = 0;
  let gapFields = 0;
  const flushGap = () => {
    if (gapBytes > 0) {
      items.push({ kind: "gap", offset: gapOffset, bytes: gapBytes, fields: gapFields });
      gapBytes = 0;
      gapFields = 0;
    }
  };

  for (const fl of layout.fields) {
    if (fl.paddingBefore > 0) {
      flushGap();
      items.push({
        kind: "padding",
        offset: fl.offset - fl.paddingBefore,
        bytes: fl.paddingBefore,
      });
    }
    if (unchangedIds.has(fl.fieldId)) {
      if (gapBytes === 0) gapOffset = fl.offset;
      gapBytes += fl.size;
      gapFields += 1;
    } else {
      flushGap();
      items.push({ kind: "field", fl });
    }
  }
  flushGap();
  // Tail padding de normal şeritteki gibi ayrı, taralı bir hücredir.
  const last = layout.fields[layout.fields.length - 1];
  const tail = last ? layout.totalSize - (last.offset + last.size) : layout.totalSize;
  if (tail > 0) {
    items.push({
      kind: "padding",
      offset: layout.totalSize - tail,
      bytes: tail,
    });
  }
  return items;
}

const collapsedItemWidth = (item: CollapsedItem, pxPerByte: number) =>
  item.kind === "gap"
    ? 56
    : item.kind === "padding"
      ? item.bytes * pxPerByte
      : item.fl.size * pxPerByte;

function CollapsedStrip({
  layout,
  pxPerByte,
  unchangedIds,
  impactsById,
  colorById,
  selectedId = null,
  expandedNestedIds,
  onSelect,
}: {
  layout: LayoutResult;
  pxPerByte: number;
  unchangedIds: Set<string>;
  impactsById?: Map<string, FieldImpact>;
  colorById?: Map<string, number>;
  selectedId?: string | null;
  expandedNestedIds?: ReadonlySet<string>;
  onSelect?: (fieldId: string) => void;
}) {
  const items = buildCollapsedItems(layout, unchangedIds);

  return (
    <div className="overflow-x-auto">
      <div
        className="flex h-32 w-max items-stretch overflow-hidden rounded-lg border border-border"
        aria-label="Changed regions strip"
      >
        {items.map((it, i) => {
          if (it.kind === "gap") {
            const title = `${it.fields} unchanged ${it.fields === 1 ? "field" : "fields"} · bytes ${it.offset}–${it.offset + it.bytes - 1} (identical in both versions)`;
            return (
              <div
                key={i}
                style={{ backgroundImage: HATCH }}
                className="flex w-14 shrink-0 flex-col items-center justify-center gap-0.5 border-r border-border px-1 text-center text-muted last:border-r-0"
                title={title}
              >
                <span className="text-[9px] leading-none">unchanged</span>
                <span className="font-mono text-[10px] leading-none tabular-nums">
                  {it.bytes} B
                </span>
                <span className="text-[9px] leading-none opacity-70">@{it.offset}</span>
              </div>
            );
          }
          if (it.kind === "padding") {
            return (
              <div
                key={i}
                style={{
                  width: collapsedItemWidth(it, pxPerByte),
                  backgroundImage: HATCH,
                }}
                className="flex shrink-0 flex-col items-center justify-center overflow-hidden border-r border-border text-[10px] text-muted last:border-r-0"
                title={`padding: ${it.bytes} wasted bytes at offset ${it.offset}`}
                aria-label={`Padding: ${it.bytes} bytes at offset ${it.offset}`}
              >
                <span className="truncate px-0.5">{it.bytes}</span>
              </div>
            );
          }
          const fl = it.fl;
          const impact = impactsById?.get(fl.fieldId);
          const severity = impact ? strongestSeverity(impact) : undefined;
          const dimmed = selectedId !== null && fl.fieldId !== selectedId;
          const colorIndex = colorById?.get(fl.fieldId) ?? 0;
          const expandable = fl.type === "struct" && !!fl.nested;
          const expanded = expandable && expandedNestedIds?.has(fl.fieldId);
          return (
            <div
              key={i}
              onClick={onSelect ? () => onSelect(fl.fieldId) : undefined}
              style={{
                width: collapsedItemWidth(it, pxPerByte),
                background: COLORS[colorIndex % COLORS.length],
              }}
              className={`relative flex shrink-0 flex-col items-center justify-center overflow-hidden border-r border-black/10 text-xs text-field-ink last:border-r-0 ${
                onSelect ? "cursor-pointer" : ""
              } ${severity ? RING_STYLES[severity] : ""} ${
                dimmed
                  ? "opacity-30"
                  : selectedId !== null
                    ? "outline outline-2 -outline-offset-2 outline-accent"
                    : ""
              }`}
              title={[
                `${fieldLabel(fl)}: ${fl.typeName ?? fl.type} — offset ${fl.offset}, ${fl.size} bytes (${fl.size * 8} bits)`,
                impact ? impactTitle(impact) : "",
                expandable
                  ? `(click: ${expanded ? "collapse" : "expand"} inner comparison)`
                  : onSelect
                    ? "(click: highlight in both versions)"
                    : "",
              ]
                .filter(Boolean)
                .join("\n")}
            >
              {impact && severity && (
                <span
                  className={`absolute right-0.5 top-0.5 rounded border bg-white/90 px-1 text-[9px] font-bold leading-3 ${BADGE_STYLES[severity]}`}
                >
                  !
                </span>
              )}
              <span className="flex max-w-full items-center truncate px-1 font-medium">
                <span className="truncate">{fieldLabel(fl)}</span>
                {expandable && <BlockChevron open={!!expanded} />}
              </span>
              <span className="max-w-full truncate px-1 font-mono text-[9px] leading-tight opacity-70">
                {fl.typeName ?? fl.type}
              </span>
              <span className="max-w-full truncate px-1 text-[9px] leading-tight opacity-60">
                {fl.size}B · {fl.size * 8} bits
              </span>
              <span className="text-[9px] leading-tight opacity-60">@{fl.offset}</span>
            </div>
          );
        })}
      </div>

      {/* Sıkıştırılmış gap'ler piksel ölçeğinde değil; bu cetvel gerçek byte
          adreslerini korur ve normal Strip'te görünen offset bilgisini geri getirir. */}
      <div className="mt-1 flex w-max" aria-label="Byte offsets">
        {items.map((it, i) => {
          const offset =
            it.kind === "field" ? it.fl.offset : it.offset;
          return (
            <div
              key={i}
              style={{ width: collapsedItemWidth(it, pxPerByte) }}
              className="shrink-0 overflow-hidden text-[10px] tabular-nums text-muted"
            >
              {offset}
            </div>
          );
        })}
        <span className="pl-0.5 text-[10px] text-muted">{layout.totalSize}</span>
      </div>
    </div>
  );
}

function ChangedRegionsLayout({
  layout,
  pxPerByte,
  unchangedIds,
  impactsById,
  colorById,
  view,
  rowBytes,
  selectedId,
  expandedNestedIds,
  onSelect,
}: {
  layout: LayoutResult;
  pxPerByte: number;
  unchangedIds: Set<string>;
  impactsById?: Map<string, FieldImpact>;
  colorById: Map<string, number>;
  view: "strip" | "rows";
  rowBytes: number;
  selectedId: string | null;
  expandedNestedIds?: ReadonlySet<string>;
  onSelect: (fieldId: string) => void;
}) {
  const changedFields = layout.fields.filter((fl) => !unchangedIds.has(fl.fieldId));
  if (changedFields.length === 0) {
    return (
      <p className="text-sm text-muted">
        No field-level changes on this side — every field is byte-identical.
      </p>
    );
  }

  const wrapColorMap = Object.fromEntries(
    [...colorById].map(([id, i]) => [id, COLORS[i % COLORS.length]])
  );

  return (
    <section className="min-w-0">
      {view === "rows" ? (
        <WrappedBand
          layout={layout}
          rowBytes={rowBytes}
          colorMap={wrapColorMap}
          impactsById={impactsById}
          collapsedUnchangedIds={unchangedIds}
          selectedId={selectedId}
          expandedNestedIds={expandedNestedIds}
          onSelect={onSelect}
        />
      ) : (
        <CollapsedStrip
          layout={layout}
          pxPerByte={pxPerByte}
          unchangedIds={unchangedIds}
          impactsById={impactsById}
          colorById={colorById}
          selectedId={selectedId}
          expandedNestedIds={expandedNestedIds}
          onSelect={onSelect}
        />
      )}

      <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1">
        {changedFields.map((fl) => {
          const impact = impactsById?.get(fl.fieldId);
          const dimmed = selectedId !== null && fl.fieldId !== selectedId;
          const expandable = fl.type === "struct" && !!fl.nested;
          return (
            <span
              key={fl.fieldId}
              onClick={() => onSelect(fl.fieldId)}
              className={`flex min-w-0 cursor-pointer flex-wrap items-center gap-1 text-[11px] ${
                dimmed ? "opacity-40" : selectedId === fl.fieldId ? "font-semibold" : ""
              }`}
              title={impact ? impactTitle(impact) : undefined}
            >
              <span
                className="inline-block h-3 w-3 shrink-0 rounded-sm"
                style={{
                  background: COLORS[(colorById.get(fl.fieldId) ?? 0) % COLORS.length],
                }}
              />
              <span className="flex min-w-0 items-center truncate">
                <span className="truncate">{fieldLabel(fl)}</span>
                {expandable && (
                  <BlockChevron open={!!expandedNestedIds?.has(fl.fieldId)} />
                )}
              </span>
              <span className="text-muted">
                @{fl.offset}/{fl.size}B · {fl.size * 8} bits
              </span>
              {impact && <ImpactBadges impact={impact} />}
            </span>
          );
        })}
      </div>
    </section>
  );
}

function NestedComparisons({
  fromModel,
  toModel,
  fromLayout,
  toLayout,
  fromLabel,
  toLabel,
  pathPrefix = "",
  platform,
  platformLabel,
  containerW,
  view,
  rowBytes,
  collapseUnchanged,
  selectedId,
  expandedNestedIds,
  onSelect,
}: {
  fromModel?: StructModel;
  toModel?: StructModel;
  fromLayout?: LayoutResult;
  toLayout?: LayoutResult;
  fromLabel: string;
  toLabel: string;
  pathPrefix?: string;
  platform: Platform;
  platformLabel: string;
  containerW: number;
  view: "strip" | "rows";
  rowBytes: number;
  collapseUnchanged: boolean;
  selectedId: string | null;
  expandedNestedIds: ReadonlySet<string>;
  onSelect: (fieldId: string) => void;
}) {
  const fromFieldsById = new Map(fromModel?.fields.map((field) => [field.id, field]));
  const toFieldsById = new Map(toModel?.fields.map((field) => [field.id, field]));
  const fromLayoutsById = new Map(
    fromLayout?.fields.map((field) => [field.fieldId, field])
  );
  const toLayoutsById = new Map(toLayout?.fields.map((field) => [field.fieldId, field]));
  const fieldIds = [
    ...new Set([
      ...(fromModel?.fields.map((field) => field.id) ?? []),
      ...(toModel?.fields.map((field) => field.id) ?? []),
    ]),
  ];

  return (
    <>
      {fieldIds.map((fieldId) => {
        if (!expandedNestedIds.has(fieldId)) return null;

        const fromField = fromFieldsById.get(fieldId);
        const toField = toFieldsById.get(fieldId);
        const fromFieldLayout = fromLayoutsById.get(fieldId);
        const toFieldLayout = toLayoutsById.get(fieldId);
        const rawFromNested = fromField?.type === "struct" ? fromField.nested : undefined;
        const toNested = toField?.type === "struct" ? toField.nested : undefined;
        if (!rawFromNested && !toNested) return null;

        const alignedFromNested =
          rawFromNested && toNested
            ? alignFieldIds(rawFromNested, toNested)
            : rawFromNested;
        const innerFromLayout = alignedFromNested
          ? computeLayout(alignedFromNested, platform)
          : fromFieldLayout?.nested;
        const innerToLayout = toNested
          ? computeLayout(toNested, platform)
          : toFieldLayout?.nested;
        const innerSelectedId =
          selectedId &&
          (innerFromLayout?.fields.some((field) => field.fieldId === selectedId) ||
            innerToLayout?.fields.some((field) => field.fieldId === selectedId))
            ? selectedId
            : null;
        const displayName = toField?.name ?? fromField?.name ?? "struct";
        const path = pathPrefix ? `${pathPrefix}.${displayName}` : displayName;
        const emptyFrom: StructModel = {
          name: alignedFromNested?.name ?? toNested?.name ?? "struct",
          fields: [],
        };
        const emptyTo: StructModel = {
          name: toNested?.name ?? alignedFromNested?.name ?? "struct",
          fields: [],
        };
        const fromForCompare = alignedFromNested ?? emptyFrom;
        const toForCompare = toNested ?? emptyTo;
        const innerImpacts = analyzeFieldImpacts(fromForCompare, toForCompare, (model) =>
          computeLayout(model, platform)
        );
        const impactsById = new Map(
          innerImpacts.map((impact) => [impact.fieldId, impact])
        );
        const colorById = buildColorById(fromForCompare, toForCompare);
        const unchangedIds =
          innerFromLayout && innerToLayout
            ? computeUnchangedIds(innerFromLayout, innerToLayout)
            : new Set<string>();
        const maxInnerSize = Math.max(
          innerFromLayout?.totalSize ?? 0,
          innerToLayout?.totalSize ?? 0
        );
        const pxPerByte =
          maxInnerSize > 0 && containerW > 0
            ? Math.max(4, Math.min(48, Math.floor((containerW - 68) / maxInnerSize)))
            : 12;
        const sizeChange = `${innerFromLayout?.totalSize ?? "not present"} B → ${
          innerToLayout?.totalSize ?? "not present"
        } B`;

        const renderSide = (
          label: string,
          layout: LayoutResult | undefined,
          impacts?: Map<string, FieldImpact>
        ) => (
          <section className="rounded-lg border border-border bg-surface p-3">
            <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
              <h4 className="text-xs font-semibold text-foreground">{label}</h4>
              {layout && (
                <span className="text-[11px] tabular-nums text-muted">
                  {layout.totalSize} B / align {layout.alignment} B / pad{" "}
                  {layout.totalPadding} B
                </span>
              )}
            </div>
            {!layout ? (
              <p className="text-sm text-muted">This nested struct is not present.</p>
            ) : collapseUnchanged ? (
              <ChangedRegionsLayout
                layout={layout}
                pxPerByte={pxPerByte}
                unchangedIds={unchangedIds}
                impactsById={impacts}
                colorById={colorById}
                view={view}
                rowBytes={rowBytes}
                selectedId={innerSelectedId}
                expandedNestedIds={expandedNestedIds}
                onSelect={onSelect}
              />
            ) : (
              <LayoutStrip
                layout={layout}
                segments={toSegments(layout)}
                pxPerByte={pxPerByte}
                impactsById={impacts}
                colorById={colorById}
                view={view}
                rowBytes={rowBytes}
                selectedId={innerSelectedId}
                expandedNestedIds={expandedNestedIds}
                onSelect={onSelect}
              />
            )}
          </section>
        );

        return (
          <div
            key={fieldId}
            className="space-y-3 rounded-xl border border-accent/30 bg-accent/5 p-3"
            aria-label={`Nested comparison: ${path}`}
          >
            <button
              type="button"
              className="flex w-full flex-wrap items-center gap-x-2 gap-y-1 text-left"
              onClick={() => onSelect(fieldId)}
              aria-expanded
            >
              <BlockChevron open />
              <span className="font-semibold text-foreground">{path}</span>
              <span className="text-xs text-muted">
                inner layout · {sizeChange} · {platformLabel}
              </span>
            </button>

            {renderSide(fromLabel, innerFromLayout)}
            {renderSide(toLabel, innerToLayout, impactsById)}

            <NestedComparisons
              fromModel={alignedFromNested}
              toModel={toNested}
              fromLayout={innerFromLayout}
              toLayout={innerToLayout}
              fromLabel={fromLabel}
              toLabel={toLabel}
              pathPrefix={path}
              platform={platform}
              platformLabel={platformLabel}
              containerW={containerW}
              view={view}
              rowBytes={rowBytes}
              collapseUnchanged={collapseUnchanged}
              selectedId={selectedId}
              expandedNestedIds={expandedNestedIds}
              onSelect={onSelect}
            />
          </div>
        );
      })}
    </>
  );
}

// Bir alan bloğunun ortak türetmeleri (sortable ve statik sürüm paylaşır).
function fieldBlockParts(fl: FieldLayout, onToggle: () => void) {
  const arrayLength = Math.max(1, fl.arrayLength ?? 1);
  const elementSize = fl.elementSize ?? fl.size / arrayLength;
  const expandable = fl.type === "struct" && !!fl.nested;
  const isBitField = isUnsignedInt(fl.type);

  // struct → aç/kapat · unsigned → o alanı Status Bits'te odakla. Ekran KAYMAZ:
  // BitFieldPanel odaklanan alanın editörünü listenin EN ÜSTÜNE alır ve paneli açar.
  const handleClick = expandable
    ? onToggle
    : isBitField
      ? () => useStructStore.getState().setFocusedBitField(fl.fieldId)
      : undefined;

  const title = `${fieldLabel(fl)}: ${fl.typeName ?? fl.type} — offset ${fl.offset}, ${fl.size} bytes (drag: reorder${expandable ? " · click: expand/collapse" : isBitField ? " · click: Status Bits" : ""})`;
  return { arrayLength, elementSize, expandable, isBitField, handleClick, title };
}

// Bloğun iç hücreleri (dizi ise birden çok). Sortable ve statik sürüm ortak kullanır.
function FieldCells({
  fl,
  pxPerByte,
  bg,
  arrayLength,
  elementSize,
  expandable,
  isBitField,
  open,
}: {
  fl: FieldLayout;
  pxPerByte: number;
  bg: string;
  arrayLength: number;
  elementSize: number;
  expandable: boolean;
  isBitField: boolean;
  open: boolean;
}) {
  return (
    <>
      {Array.from({ length: arrayLength }).map((_, ai) => (
        <div
          key={ai}
          style={{ width: elementSize * pxPerByte, background: bg }}
          className="relative flex h-16 shrink-0 flex-col items-center justify-center overflow-hidden border-r border-black/10 text-xs text-field-ink"
        >
          {/* Görünür ipucu: unsigned alanlar tıklanınca Status Bits editörüne gider. */}
          {isBitField && ai === 0 && (
            <span className="pointer-events-none absolute right-0.5 top-0.5 rounded bg-black/15 px-1 text-[8px] font-semibold leading-3 opacity-0 transition-opacity group-hover:opacity-100">
              bits
            </span>
          )}
          <span className="flex max-w-full items-center truncate px-1 font-medium">
            <span className="truncate">
              {fl.name}
              {arrayLength > 1 ? `[${ai}]` : ""}
            </span>
            {expandable && ai === 0 && <BlockChevron open={open} />}
          </span>
          {/* Alanın veri tipi (ör. uint32_t / Vec3) — kullanıcı doğrudan görsün. */}
          <span className="max-w-full truncate px-1 font-mono text-[10px] leading-tight opacity-80">
            {fl.typeName ?? fl.type}
          </span>
          <span className="max-w-full truncate px-1 text-[9px] leading-tight opacity-60">
            {elementSize}B
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
  const { arrayLength, elementSize, expandable, isBitField, handleClick, title } =
    fieldBlockParts(fl, onToggle);

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
      className="group flex shrink-0 cursor-grab active:cursor-grabbing"
      title={title}
    >
      <FieldCells
        fl={fl}
        pxPerByte={pxPerByte}
        bg={bg}
        arrayLength={arrayLength}
        elementSize={elementSize}
        expandable={expandable}
        isBitField={isBitField}
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
  const { arrayLength, elementSize, expandable, isBitField, handleClick, title } =
    fieldBlockParts(fl, onToggle);
  return (
    <div onClick={handleClick} className="group flex shrink-0 cursor-grab" title={title}>
      <FieldCells
        fl={fl}
        pxPerByte={pxPerByte}
        bg={bg}
        arrayLength={arrayLength}
        elementSize={elementSize}
        expandable={expandable}
        isBitField={isBitField}
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
        backgroundImage: HATCH,
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
  // (FieldEditor ile aynı hydration-guard deseni.)
  const mounted = useSyncExternalStore(subscribeToNothing, () => true, () => false);

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
              <BlockChevron open /> {fieldLabel(fl)}: {fl.typeName} — inner layout ({fl.nested!.totalSize} B,
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
  const addField = useStructStore((s) => s.addField);
  const setModel = useStructStore((s) => s.setModel);
  const reorderFields = useStructStore((s) => s.reorderFields);
  const platform = useStructStore((s) => s.platform);
  // Yerleşim sayılarının HANGİ platforma ait olduğu panel başlığında görünsün —
  // yoksa platform değişimi bazı struct'larda hiçbir görünür fark yaratmaz.
  const platformLabel = PLATFORMS.find((p) => p.id === platform)?.label ?? platform;

  // Her iki modda da yerleşim, kabın genişliğine otomatik ölçeklenir. Callback
  // ref kullanılır çünkü ölçülen div sekmeye göre farklı bir elemandır (edit ↔
  // compare) ve koşullu render'da mount-anı effect'i yeni elemanı yakalayamaz.
  const [byteLimit, setByteLimit] = useState<number | "">("");
  // Yerleşim görünümü: tek şerit (etkileşimli) ya da sabit genişlikte satırlar
  // (hex-dump tarzı, salt-okunur). Satır genişliği byte cinsinden seçilir.
  const [view, setView] = useState<"strip" | "rows">("strip");
  const [rowBytes, setRowBytes] = useState(8);
  // Compare modu: bir alana tıklayınca AYNI alan iki versiyonda da vurgulanır
  // (id'ler alignFieldIds ile hizalandığından iki tarafta da bulunur).
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  // Nested struct blokları iki tarafta birlikte açılır. Set, birden fazla iç içe
  // seviyenin (örn. transform.position) aynı anda açık kalmasını sağlar.
  const [expandedCompareStructIds, setExpandedCompareStructIds] = useState<Set<string>>(
    () => new Set()
  );
  // Compare modu (deneysel): değişmeyen alan dizilerini gizle → dev struct'larda
  // iki versiyon da aynı anda görünür kalsın (bkz. CollapsedStrip).
  const [collapseUnchanged, setCollapseUnchanged] = useState(false);
  const [containerW, setContainerW] = useState(0);
  const resizeObserver = useRef<ResizeObserver | null>(null);
  const containerRef = useCallback((el: HTMLDivElement | null) => {
    resizeObserver.current?.disconnect();
    resizeObserver.current = null;
    if (!el) return;
    const ro = new ResizeObserver((entries) =>
      setContainerW(entries[0].contentRect.width)
    );
    ro.observe(el);
    resizeObserver.current = ro;
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

    // İki ayrı import'tan gelen aynı isimli alanlar aynı rengi/eşleşmeyi alsın
    // diye From tarafının id'leri To tarafına hizalanır (bkz. engine/identity.ts).
    const alignedFromModel = alignFieldIds(cmp.fromModel, cmp.toModel);
    const fromLayout = computeLayout(alignedFromModel, platform);
    const toLayout = computeLayout(cmp.toModel, platform);

    if (!isComparison) {
      return (
        <Panel title="Compared Layouts" description={`${cmp.fromLabel} -> ${cmp.toLabel}`}>
          <p className="text-sm text-muted">Choose two different comparison targets.</p>
        </Panel>
      );
    }

    const targetImpacts = analyzeFieldImpacts(cmp.fromModel, cmp.toModel, (m) =>
      computeLayout(m, platform)
    );
    const targetImpactsById = new Map(
      targetImpacts.map((impact) => [impact.fieldId, impact])
    );
    const colorById = buildColorById(alignedFromModel, cmp.toModel);

    // İki şerit AYNI ölçeği paylaşır (büyük olana göre sığdır) — böylece aynı
    // byte genişliği iki panelde de aynı piksel genişliğinde görünür.
    // 34px: Panel'in p-4 padding'i (2×16) + kenarlıklar.
    const maxTotalSize = Math.max(fromLayout.totalSize, toLayout.totalSize);
    const comparePxPerByte =
      maxTotalSize > 0 && containerW > 0
        ? Math.max(4, Math.min(48, Math.floor((containerW - 34) / maxTotalSize)))
        : 12;

    // Seçili alan iki modelden de kalktıysa (versiyon değişimi vb.) vurguyu
    // yok say — yoksa "her şey soluk, hiçbir şey seçili" görünürdü.
    const selectionActive =
      selectedFieldId !== null &&
      (!!findLayoutField(fromLayout, selectedFieldId) ||
        !!findLayoutField(toLayout, selectedFieldId));
    const compareSelectedId = selectionActive ? selectedFieldId : null;
    const topSelectedId =
      compareSelectedId &&
      (fromLayout.fields.some((field) => field.fieldId === compareSelectedId) ||
        toLayout.fields.some((field) => field.fieldId === compareSelectedId))
        ? compareSelectedId
        : null;
    const toggleSelected = (id: string) => {
      const isNestedStruct =
        !!findLayoutField(fromLayout, id)?.nested || !!findLayoutField(toLayout, id)?.nested;
      if (isNestedStruct) {
        setExpandedCompareStructIds((current) => {
          const next = new Set(current);
          if (next.has(id)) next.delete(id);
          else next.add(id);
          return next;
        });
      }
      setSelectedFieldId((prev) => (prev === id ? null : id));
    };

    // Collapsed (deneysel) görünüm için: iki tarafta byte-özdeş alanlar.
    const unchangedIds = computeUnchangedIds(fromLayout, toLayout);
    const hiddenCount = collapseUnchanged
      ? fromLayout.fields.filter((f) => unchangedIds.has(f.fieldId)).length
      : 0;

    return (
      <div ref={containerRef} className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <ViewToggle
            view={view}
            onView={setView}
            rowBytes={rowBytes}
            onRowBytes={setRowBytes}
          />
          {/* Deneysel: değişmeyen alanları gizle → dev struct'lar aynı anda sığar. */}
          <label className="flex cursor-pointer items-center gap-1.5 text-[11px] text-muted">
            <input
              type="checkbox"
              checked={collapseUnchanged}
              onChange={(e) => setCollapseUnchanged(e.target.checked)}
              className="accent-accent"
            />
            Only changed regions
            <span className="rounded bg-surface-muted px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide">
              beta
            </span>
          </label>
          <span className="text-[11px] text-muted">
            {compareSelectedId
              ? "Click the highlighted field again to clear."
              : collapseUnchanged
                ? `${hiddenCount} unchanged ${hiddenCount === 1 ? "field" : "fields"} hidden — click a change to highlight it in both.`
                : "Tip: click a field to highlight it in both versions."}
          </span>
        </div>

        <Panel
          title={cmp.fromLabel}
          description={`size ${fromLayout.totalSize} B / align ${fromLayout.alignment} B / padding ${fromLayout.totalPadding} B · ${platformLabel}`}
        >
          {collapseUnchanged ? (
            <ChangedRegionsLayout
              layout={fromLayout}
              pxPerByte={comparePxPerByte}
              unchangedIds={unchangedIds}
              colorById={colorById}
              view={view}
              rowBytes={rowBytes}
              selectedId={topSelectedId}
              expandedNestedIds={expandedCompareStructIds}
              onSelect={toggleSelected}
            />
          ) : (
            <LayoutStrip
              layout={fromLayout}
              segments={toSegments(fromLayout)}
              pxPerByte={comparePxPerByte}
              colorById={colorById}
              view={view}
              rowBytes={rowBytes}
              selectedId={topSelectedId}
              expandedNestedIds={expandedCompareStructIds}
              onSelect={toggleSelected}
            />
          )}
        </Panel>

        <Panel
          title={cmp.toLabel}
          description={`size ${toLayout.totalSize} B / align ${toLayout.alignment} B / padding ${toLayout.totalPadding} B · ${platformLabel}`}
        >
          {collapseUnchanged ? (
            <ChangedRegionsLayout
              layout={toLayout}
              pxPerByte={comparePxPerByte}
              unchangedIds={unchangedIds}
              impactsById={targetImpactsById}
              colorById={colorById}
              view={view}
              rowBytes={rowBytes}
              selectedId={topSelectedId}
              expandedNestedIds={expandedCompareStructIds}
              onSelect={toggleSelected}
            />
          ) : (
            <LayoutStrip
              layout={toLayout}
              segments={toSegments(toLayout)}
              pxPerByte={comparePxPerByte}
              impactsById={targetImpactsById}
              colorById={colorById}
              view={view}
              rowBytes={rowBytes}
              selectedId={topSelectedId}
              expandedNestedIds={expandedCompareStructIds}
              onSelect={toggleSelected}
            />
          )}
        </Panel>

        <NestedComparisons
          fromModel={alignedFromModel}
          toModel={cmp.toModel}
          fromLayout={fromLayout}
          toLayout={toLayout}
          fromLabel={cmp.fromLabel}
          toLabel={cmp.toLabel}
          platform={platform}
          platformLabel={platformLabel}
          containerW={containerW}
          view={view}
          rowBytes={rowBytes}
          collapseUnchanged={collapseUnchanged}
          selectedId={compareSelectedId}
          expandedNestedIds={expandedCompareStructIds}
          onSelect={toggleSelected}
        />
      </div>
    );
  }

  // ---- Edit mode (interactive map + read-only snapshot preview) ----
  const layout = computeLayout(editModelToShow, platform);
  const hasNested = layout.fields.some((f) => f.type === "struct" && f.nested);
  const hasBits = layout.fields.some((f) => isUnsignedInt(f.type));
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
      description={`size ${layout.totalSize} B · align ${layout.alignment} B · padding ${layout.totalPadding} B · ${platformLabel}`}
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
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border px-4 py-10 text-center">
          <p className="text-sm font-medium">This struct has no fields yet</p>
          <p className="max-w-xs text-xs text-muted">
            Add a field to see its memory layout, or load the example struct to explore
            what the tool can do.
          </p>
          {previewVersion ? (
            <Button variant="secondary" size="sm" onClick={() => setPreviewVersion(null)}>
              Back to Live
            </Button>
          ) : (
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Button variant="primary" size="sm" onClick={() => addField()}>
                Add field
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setModel(EXAMPLE_MODEL)}>
                Load example
              </Button>
            </div>
          )}
        </div>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-2">
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

            {/* Görünüm seçimi: Strip (etkileşimli şerit) ↔ Rows (satırlara sarılmış). */}
            <div className="ml-auto">
              <ViewToggle
                view={view}
                onView={setView}
                rowBytes={rowBytes}
                onRowBytes={setRowBytes}
              />
            </div>
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
            {view === "rows" ? (
              // Satır görünümünde renkler: canlıda id-bazlı harita (Strip ile aynı),
              // önizlemede segment colorIndex'i (Band ile aynı) → mod değişince
              // hiçbir alanın rengi değişmez. Canlıda parçalar sürüklenerek alan
              // sırası değiştirilebilir (Strip'teki reorder ile aynı semantik).
              <WrappedBand
                layout={layout}
                rowBytes={rowBytes}
                colorMap={previewVersion ? undefined : colorMap}
                onReorder={
                  previewVersion
                    ? undefined
                    : (fromId, toId) => {
                        const fields = useStructStore.getState().currentModel.fields;
                        const from = fields.findIndex((f) => f.id === fromId);
                        const to = fields.findIndex((f) => f.id === toId);
                        if (from >= 0 && to >= 0) reorderFields(from, to);
                      }
                }
              />
            ) : previewVersion ? (
              <Band layout={layout} pxPerByte={autoPxPerByte} />
            ) : (
              <SortableBand layout={layout} pxPerByte={autoPxPerByte} colorMap={colorMap} />
            )}
          </div>

          <p className="mt-2 text-[11px] text-muted">
            {view === "rows"
              ? previewVersion
                ? "Read-only preview."
                : `Tip: drag a block onto another field to reorder${hasBits ? " · click an unsigned field to edit its Status Bits" : ""}.`
              : previewVersion
                ? hasNested
                  ? "Read-only preview · click a struct to expand its layout."
                  : "Read-only preview."
                : `Tip: drag fields to reorder${hasNested ? " · click a struct to expand its layout" : ""}${hasBits ? " · click an unsigned field to edit its Status Bits" : ""}.`}
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
