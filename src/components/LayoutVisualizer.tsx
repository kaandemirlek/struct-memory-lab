"use client";

import { useEffect, useRef, useState } from "react";
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

// ---------------------------------------------------------------------------
// 32-byte satır ızgarası (bellek haritası). Her satır TAM 32 byte gösterir:
//   • struct 32B'tan küçükse kalan "unused" boş hücrelerle 32'ye tamamlanır,
//   • 32B'tan büyükse alt satırlara sarar; satır sınırını geçen alanlar bölünür
//     (devam parçası "↳" ile işaretlenir),
//   • her blokta alan adı + tipi + boyutu yazar.
// Salt-görsel: reorder soldaki Fields panelinde. Tıklama: struct → aç/kapat,
// unsigned alan → Status Bits editörüne odaklan.
// ---------------------------------------------------------------------------
const BYTES_PER_ROW = 32;

interface GridCell {
  kind: "field" | "padding" | "empty";
  offset: number; // mutlak başlangıç byte'ı
  size: number; // bu hücredeki byte (satıra göre kırpılmış)
  cont: boolean; // önceki satırdan devam eden (bölünmüş) parça mı?
  seg?: LayoutSegment; // yalnızca field için
}

// Segmentleri 32-byte satır sınırlarında keserek satır satır hücrelere böler.
function buildByteRows(layout: LayoutResult): GridCell[][] {
  const displaySize = Math.max(
    BYTES_PER_ROW,
    Math.ceil(layout.totalSize / BYTES_PER_ROW) * BYTES_PER_ROW
  );

  const source: Pick<GridCell, "kind" | "offset" | "size" | "seg">[] = toSegments(
    layout
  ).map((s) => ({
    kind: s.kind,
    offset: s.offset,
    size: s.size,
    seg: s.kind === "field" ? s : undefined,
  }));

  // Struct sonundan 32'nin katına kadarki alanı "unused" boş hücrelerle doldur.
  if (displaySize > layout.totalSize) {
    source.push({
      kind: "empty",
      offset: layout.totalSize,
      size: displaySize - layout.totalSize,
    });
  }

  const rows: GridCell[][] = [];
  for (const s of source) {
    let start = s.offset;
    const end = s.offset + s.size;
    let first = true;
    while (start < end) {
      const rowEnd = Math.floor(start / BYTES_PER_ROW) * BYTES_PER_ROW + BYTES_PER_ROW;
      const cellEnd = Math.min(end, rowEnd);
      const rowIndex = Math.floor(start / BYTES_PER_ROW);
      (rows[rowIndex] ??= []).push({
        kind: s.kind,
        offset: start,
        size: cellEnd - start,
        cont: !first,
        seg: s.seg,
      });
      start = cellEnd;
      first = false;
    }
  }

  return rows;
}

function PaddingCell({
  size,
  pxPerByte,
  cont,
}: {
  size: number;
  pxPerByte: number;
  cont?: boolean;
}) {
  return (
    <div
      style={{
        width: size * pxPerByte,
        backgroundImage:
          "repeating-linear-gradient(45deg, rgba(120,120,120,.30) 0 4px, transparent 4px 8px)",
      }}
      className="flex shrink-0 items-center justify-center border-r border-border text-[10px] text-muted last:border-r-0"
      title={`padding: ${size} wasted bytes`}
    >
      {cont ? "" : size}
    </div>
  );
}

// Tek bir alan hücresi (adı + tipi + boyutu; dar bloklarda kırpar).
function GridFieldCell({
  cell,
  pxPerByte,
  bg,
  open,
  onToggle,
}: {
  cell: GridCell;
  pxPerByte: number;
  bg: string;
  open: boolean;
  onToggle: () => void;
}) {
  const seg = cell.seg!;
  const expandable = seg.type === "struct" && !!seg.nested;
  const isBitField = !!seg.type && isUnsignedInt(seg.type);
  const displayName =
    seg.arrayIndex === undefined ? seg.name! : `${seg.name}[${seg.arrayIndex}]`;
  const typeText = seg.typeName ?? seg.type ?? "";

  // struct → aç/kapat · unsigned → Status Bits'e odakla + editörüne kaydır (her tıklamada).
  const handleClick = expandable
    ? onToggle
    : isBitField
      ? () => {
          useStructStore.getState().setFocusedBitField(seg.fieldId!);
          document
            .getElementById(`bits-${seg.fieldId}`)
            ?.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      : undefined;

  const title = `${displayName}: ${typeText} — offset ${cell.offset}, ${seg.size} bytes${
    expandable ? " (click: expand/collapse)" : isBitField ? " (click: Status Bits)" : ""
  }`;

  return (
    <div
      onClick={handleClick}
      style={{ width: cell.size * pxPerByte, background: bg }}
      className={`flex shrink-0 flex-col items-center justify-center gap-0.5 overflow-hidden border-r border-black/10 px-0.5 py-1 text-center leading-tight text-black last:border-r-0 ${
        handleClick ? "cursor-pointer" : ""
      }`}
      title={title}
    >
      <span className="w-full truncate px-0.5 text-[11px] font-semibold">
        {cell.cont && "↳ "}
        {displayName}
        {expandable && !cell.cont && <span className="ml-0.5">{open ? "▾" : "▸"}</span>}
      </span>
      <span className="w-full truncate px-0.5 font-mono text-[9px] opacity-80">{typeText}</span>
      <span className="w-full truncate px-0.5 text-[8px] opacity-60">{seg.size}B</span>
    </div>
  );
}

// Üst seviye bellek haritası: 32-byte satırlar (salt-görsel; reorder Fields panelinde).
function ByteGrid({
  layout,
  pxPerByte,
  colorMap,
}: {
  layout: LayoutResult;
  pxPerByte: number;
  colorMap: Record<string, string>;
}) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const rows = buildByteRows(layout);
  const rowWidth = BYTES_PER_ROW * pxPerByte;

  return (
    <div className="overflow-x-auto">
      <div className="w-max space-y-1">
        {rows.map((cells, ri) => (
          <div key={ri} className="flex items-stretch gap-2">
            {/* Sol oluk: satırın başlangıç offset'i (0, 32, 64, ...). */}
            <div className="w-8 shrink-0 self-center text-right font-mono text-[10px] tabular-nums text-muted">
              {ri * BYTES_PER_ROW}
            </div>
            <div
              className="flex h-16 overflow-hidden rounded-lg border border-border"
              style={{ width: rowWidth }}
            >
              {cells.map((c, ci) =>
                c.kind === "field" ? (
                  <GridFieldCell
                    key={ci}
                    cell={c}
                    pxPerByte={pxPerByte}
                    bg={colorMap[c.seg!.fieldId!]}
                    open={!!open[c.seg!.fieldId!]}
                    onToggle={() =>
                      setOpen((o) => ({ ...o, [c.seg!.fieldId!]: !o[c.seg!.fieldId!] }))
                    }
                  />
                ) : c.kind === "padding" ? (
                  <PaddingCell key={ci} size={c.size} pxPerByte={pxPerByte} cont={c.cont} />
                ) : (
                  <div
                    key={ci}
                    style={{ width: c.size * pxPerByte }}
                    className="flex shrink-0 items-center justify-center border-r border-border/40 text-[9px] text-muted/40 last:border-r-0"
                    title={`unused: ${c.size} byte (satırı 32'ye tamamlamak için)`}
                  >
                    ·
                  </div>
                )
              )}
            </div>
          </div>
        ))}
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
  // 32-byte ızgara: satır TAM ekran genişliğine sığar (sol oluk + boşluk pay edilir).
  // Çok dar ekranda min genişlikte tutulur; taşarsa yatay kaydırma devreye girer.
  const gridPxPerByte =
    containerW > 0 ? Math.max(14, Math.floor((containerW - 44) / BYTES_PER_ROW)) : 18;
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
            <ByteGrid layout={layout} pxPerByte={gridPxPerByte} colorMap={colorMap} />
          </div>

          <p className="mt-2 text-[11px] text-muted">
            {previewVersion ? "Read-only preview · " : ""}
            Each row is 32 bytes · reorder in the Fields panel
            {hasNested ? " · click a struct to expand its layout" : ""}.
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
