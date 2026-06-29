// LayoutVisualizer.tsx  ← PERSON A   (the app's signature visual: word-grid)
"use client";

import { useEffect, useState } from "react";
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
import { wrapIntoWords } from "@/engine/words";
import type { Field } from "@/types";
import Panel from "@/components/ui/Panel";

// Stable color palette for fields (chip index == colorIndex in field order).
const COLORS = ["#60a5fa", "#34d399", "#f472b6", "#fbbf24", "#a78bfa", "#fb7185"];
const colorAt = (i: number) => COLORS[i % COLORS.length];

const WORD_SIZES = [1, 2, 4, 8, 16];

// --- Draggable chip: drag to reorder a field (offsets/words reflow live) -----
function OrderChip({ field, index }: { field: Field; index: number }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: field.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    background: colorAt(index),
  };
  return (
    <button
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="flex shrink-0 cursor-grab touch-none items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-black active:cursor-grabbing"
      title={`${field.name} — sürükleyerek sırayı değiştir`}
    >
      <span className="opacity-60">⠿</span>
      {field.name}
    </button>
  );
}

export default function LayoutVisualizer() {
  const model = useStructStore((s) => s.currentModel);
  const reorderFields = useStructStore((s) => s.reorderFields);
  const layout = computeLayout(model);

  const [wordSize, setWordSize] = useState(8);
  const [cellPx, setCellPx] = useState(26);
  const rows = wrapIntoWords(layout, wordSize);

  // dnd-kit sadece mount sonrası (SSR hydration güvenliği).
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
    reorderFields(from, to);
  };

  return (
    <Panel
      title="Memory Layout"
      description={`size ${layout.totalSize} B · align ${layout.alignment} B · padding ${layout.totalPadding} B · word ${wordSize} B`}
    >
      {model.fields.length === 0 ? (
        <p className="text-sm text-muted">Add fields to see the memory layout.</p>
      ) : (
        <>
          {/* Controls: word size + cell zoom */}
          <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2">
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted">Word</span>
              {WORD_SIZES.map((w) => (
                <button
                  key={w}
                  onClick={() => setWordSize(w)}
                  className={`rounded px-2 py-0.5 text-xs ${
                    w === wordSize
                      ? "bg-accent text-white"
                      : "border border-border text-muted hover:text-foreground"
                  }`}
                >
                  {w}B
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted">Zoom</span>
              <input
                type="range"
                min={16}
                max={44}
                value={cellPx}
                onChange={(e) => setCellPx(Number(e.target.value))}
                className="accent-accent"
              />
            </div>
          </div>

          {/* Order strip: drag chips to reorder (watch fields jump across words). */}
          {mounted ? (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext
                items={model.fields.map((f) => f.id)}
                strategy={horizontalListSortingStrategy}
              >
                <div className="mb-3 flex flex-wrap items-center gap-1.5">
                  <span className="text-xs text-muted">Order:</span>
                  {model.fields.map((f, i) => (
                    <OrderChip key={f.id} field={f} index={i} />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          ) : (
            <div className="mb-3 h-7" />
          )}

          {/* Word grid: one row per W-byte word; fields span columns, padding hatched. */}
          <div className="space-y-1 overflow-x-auto">
            {rows.map((row) => (
              <div key={row.index} className="flex items-stretch gap-2">
                <div className="w-16 shrink-0 pt-1 text-right text-[10px] leading-tight text-muted">
                  <div className="font-medium text-foreground/70">W{row.index}</div>
                  <div>@{row.startByte}</div>
                </div>
                <div
                  className="grid rounded-md border border-border"
                  style={{
                    gridTemplateColumns: `repeat(${wordSize}, ${cellPx}px)`,
                    height: cellPx + 14,
                  }}
                >
                  {row.cells.map((cell, ci) => {
                    const col = cell.startByte - row.startByte + 1;
                    const common = {
                      gridColumn: `${col} / span ${cell.span}`,
                    } as const;
                    if (cell.kind === "padding") {
                      return (
                        <div
                          key={ci}
                          style={{
                            ...common,
                            backgroundImage:
                              "repeating-linear-gradient(45deg, rgba(120,120,120,.3) 0 4px, transparent 4px 8px)",
                          }}
                          className="flex items-center justify-center border-r border-border/60 text-[10px] text-muted"
                          title={`padding: ${cell.span} wasted bytes @${cell.startByte}`}
                        >
                          {cell.span > 1 ? cell.span : ""}
                        </div>
                      );
                    }
                    return (
                      <div
                        key={ci}
                        style={{ ...common, background: colorAt(cell.colorIndex ?? 0) }}
                        className="flex flex-col items-center justify-center overflow-hidden px-1 text-black"
                        title={`${cell.name}: ${cell.typeName} @${cell.startByte} (+${cell.span}B in W${row.index})`}
                      >
                        {cell.isStart && (
                          <span className="max-w-full truncate text-[11px] font-medium leading-tight">
                            {cell.name}
                          </span>
                        )}
                        {cell.isStart && cell.span > 1 && (
                          <span className="max-w-full truncate text-[9px] leading-tight opacity-70">
                            {cell.typeName}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Byte ruler inside a word (0..wordSize-1) */}
          <div className="mt-1 flex gap-2">
            <div className="w-16 shrink-0" />
            <div
              className="grid"
              style={{ gridTemplateColumns: `repeat(${wordSize}, ${cellPx}px)` }}
            >
              {Array.from({ length: wordSize }, (_, b) => (
                <div key={b} className="text-center text-[9px] text-muted">
                  {b}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </Panel>
  );
}
