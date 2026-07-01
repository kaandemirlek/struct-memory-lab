// LayoutVisualizer.tsx   (the app's signature visual)
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
import { useStructStore } from "@/store/useStructStore";
import { computeLayout } from "@/engine/layout";
import { toSegments } from "@/engine/segments";
import { isUnsignedInt } from "@/engine/bitfields";
import type { FieldLayout, LayoutResult } from "@/types";
import Panel from "@/components/ui/Panel";

// Stable color palette for fields.
const COLORS = ["#60a5fa", "#34d399", "#f472b6", "#fbbf24", "#a78bfa", "#fb7185"];

// Alan kimliğinden stabil bir palet indeksi (reorder'da renk mümkün olduğunca sabit).
function colorIndexForId(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  return Math.abs(hash) % COLORS.length;
}

/**
 * Alanlara renk ata: temel renk kimlikten (stabil) gelir, ama YAN YANA iki blok
 * aynı renge düşerse ikinciyi bir sonraki renge kaydır → komşular her zaman farklı.
 * (6 renkten fazla alanda uzak bloklar tekrar edebilir; kritik olan bitişik ayrımı.)
 */
function assignFieldColors(fields: { fieldId: string }[]): Record<string, string> {
  const map: Record<string, string> = {};
  let prev = -1;
  for (const f of fields) {
    let idx = colorIndexForId(f.fieldId);
    if (idx === prev) idx = (idx + 1) % COLORS.length; // komşuyla çakışmayı boz
    map[f.fieldId] = COLORS[idx];
    prev = idx;
  }
  return map;
}

const fieldLabel = (fl: FieldLayout) =>
  (fl.arrayLength ?? 1) > 1 ? `${fl.name}[${fl.arrayLength}]` : fl.name;

// ----------------------------------------------------------------------------
// Salt-okunur özyinelemeli band (nested struct iç yerleşimi için; reorder yok).
// ----------------------------------------------------------------------------
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
          const displayName = s.arrayIndex === undefined ? s.name : `${s.name}[${s.arrayIndex}]`;
          return (
            <div
              key={i}
              onClick={expandable ? () => setOpen((o) => ({ ...o, [s.offset]: !o[s.offset] })) : undefined}
              style={{ width: s.size * pxPerByte, background: COLORS[s.colorIndex! % COLORS.length] }}
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
              ▾ {s.name}: {s.typeName} — iç yerleşim ({s.nested!.totalSize} B)
            </div>
            <Band layout={s.nested!} pxPerByte={pxPerByte} />
          </div>
        ))}
    </div>
  );
}

// ----------------------------------------------------------------------------
// Sürüklenebilir tek bir alan bloğu (dizi ise birden çok hücre içerir).
// ----------------------------------------------------------------------------
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
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: fl.fieldId,
  });
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
      title={`${fieldLabel(fl)}: ${fl.typeName ?? fl.type} — offset ${fl.offset}, ${fl.size} bytes (sürükle: sırala${expandable ? " · tıkla: aç/kapat" : isBitField ? " · tıkla: Status Bits" : ""})`}
    >
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

// ----------------------------------------------------------------------------
// Üst seviye band: alanlar dnd-kit ile sürüklenip yeniden sıralanabilir.
// ----------------------------------------------------------------------------
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

  return (
    <div className="overflow-x-auto">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={layout.fields.map((f) => f.fieldId)} strategy={horizontalListSortingStrategy}>
          <div className="flex h-16 w-max overflow-hidden rounded-lg border border-border">
            {layout.fields.map((fl) => (
              <Fragment key={fl.fieldId}>
                {fl.paddingBefore > 0 && <PaddingCell size={fl.paddingBefore} pxPerByte={pxPerByte} />}
                <FieldBlock
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
        </SortableContext>
      </DndContext>

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
              ▾ {fieldLabel(fl)}: {fl.typeName} — iç yerleşim ({fl.nested!.totalSize} B, align{" "}
              {fl.nested!.alignment} B)
            </div>
            <Band layout={fl.nested!} pxPerByte={pxPerByte} />
          </div>
        ))}
    </div>
  );
}

export default function LayoutVisualizer() {
  const model = useStructStore((s) => s.currentModel);
  const layout = computeLayout(model);
  const hasNested = layout.fields.some((f) => f.type === "struct" && f.nested);

  // Bandı kapsayıcı genişliğine göre otomatik ölçekle (zoom çubuğu yok).
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerW, setContainerW] = useState(0);
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => setContainerW(entries[0].contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const pxPerByte =
    layout.totalSize > 0 && containerW > 0
      ? Math.max(4, Math.min(48, Math.floor(containerW / layout.totalSize)))
      : 28;

  // Alan renkleri: kimlikten stabil, komşular garanti farklı (tek kaynak: band + legend).
  const colorMap = assignFieldColors(layout.fields);

  // Opsiyonel byte bütçesi: aşılırsa uyarı.
  const [byteLimit, setByteLimit] = useState<number | "">("");
  const overLimit =
    typeof byteLimit === "number" && byteLimit > 0 && layout.totalSize > byteLimit;

  return (
    <Panel
      title="Memory Layout"
      description={`size ${layout.totalSize} B · align ${layout.alignment} B · padding ${layout.totalPadding} B`}
    >
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
                setByteLimit(e.target.value === "" ? "" : Math.max(0, Number(e.target.value) || 0))
              }
              placeholder="opsiyonel"
              className="w-24 rounded-lg border border-border bg-surface-muted px-2 py-1 text-xs outline-none focus:border-accent"
            />
            <span className="text-xs text-muted">aşılırsa uyarı verir</span>
          </div>

          {overLimit && (
            <div
              className="mb-3 rounded-lg border border-danger/30 bg-danger/10 p-2 text-xs text-danger"
              role="alert"
            >
              ⚠ Struct {layout.totalSize} B — {byteLimit} B sınırını{" "}
              {layout.totalSize - (byteLimit as number)} B aşıyor.
            </div>
          )}

          <div ref={containerRef}>
            <SortableBand layout={layout} pxPerByte={pxPerByte} colorMap={colorMap} />
          </div>

          <p className="mt-2 text-[11px] text-muted">
            İpucu: alanları sürükleyip sırala{hasNested ? " · struct'lara tıklayıp iç yerleşimi aç" : ""}.
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
