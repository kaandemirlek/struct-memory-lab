// FieldEditor.tsx  ← PERSON A
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
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useStructStore } from "@/store/useStructStore";
import { TYPE_INFO, type CppPrimitive, type Field } from "@/types";

const TYPES = Object.keys(TYPE_INFO) as CppPrimitive[];

// Garantili görünen sürükleme ikonu (font'a bağlı değil).
function GripIcon() {
  return (
    <svg width="12" height="16" viewBox="0 0 12 16" fill="currentColor" aria-hidden>
      <circle cx="3" cy="3" r="1.4" />
      <circle cx="9" cy="3" r="1.4" />
      <circle cx="3" cy="8" r="1.4" />
      <circle cx="9" cy="8" r="1.4" />
      <circle cx="3" cy="13" r="1.4" />
      <circle cx="9" cy="13" r="1.4" />
    </svg>
  );
}

// --- Satırın içeriği (input + tip + sil) — hem statik hem sürüklenebilir satır kullanır.
function FieldRowInner({ field }: { field: Field }) {
  const { updateField, removeField } = useStructStore();
  return (
    <>
      <input
        value={field.name}
        onChange={(e) => updateField(field.id, { name: e.target.value })}
        className="flex-1 font-mono text-sm rounded border border-black/10 dark:border-white/15 bg-transparent px-2 py-1"
      />
      <select
        value={field.type}
        onChange={(e) => updateField(field.id, { type: e.target.value as CppPrimitive })}
        className="font-mono text-sm rounded border border-black/10 dark:border-white/15 bg-transparent px-2 py-1"
      >
        {TYPES.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>
      <button onClick={() => removeField(field.id)} className="text-red-500 px-2" aria-label="sil">
        ✕
      </button>
    </>
  );
}

// --- Sürüklenebilir satır (useSortable — yalnızca client'ta, DndContext içinde) -----
function SortableFieldRow({ field }: { field: Field }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: field.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="flex gap-2 items-center">
      {/* Sürükleme tutamacı — listeners SADECE burada, böylece input'lar tıklanır. */}
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing touch-none px-1 opacity-60 hover:opacity-100"
        aria-label="sürükle"
      >
        <GripIcon />
      </button>
      <FieldRowInner field={field} />
    </div>
  );
}

// --- Statik satır (sunucu + mount öncesi; useSortable YOK → hydration güvenli) ------
function StaticFieldRow({ field }: { field: Field }) {
  return (
    <div className="flex gap-2 items-center">
      <span className="px-1 opacity-40" aria-hidden>
        <GripIcon />
      </span>
      <FieldRowInner field={field} />
    </div>
  );
}

export default function FieldEditor() {
  const model = useStructStore((s) => s.currentModel);
  const { addField, setStructName, reorderFields } = useStructStore();

  // dnd-kit sunucuda hydration uyuşmazlığı yaratır → sadece mount sonrası render et.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = model.fields.findIndex((f) => f.id === active.id);
    const newIndex = model.fields.findIndex((f) => f.id === over.id);
    reorderFields(oldIndex, newIndex);
  };

  return (
    <section className="rounded-lg border border-black/10 dark:border-white/15 p-4">
      <h2 className="font-semibold mb-2">✏️ Field Editor (Person A)</h2>

      <input
        value={model.name}
        onChange={(e) => setStructName(e.target.value)}
        className="mb-3 font-mono rounded border border-black/10 dark:border-white/15 bg-transparent px-2 py-1"
      />

      {!mounted ? (
        // Sunucu + ilk render: statik satırlar (sürükleme JS yüklenince gelir).
        <div className="space-y-1">
          {model.fields.map((f) => (
            <StaticFieldRow key={f.id} field={f} />
          ))}
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext
            items={model.fields.map((f) => f.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-1">
              {model.fields.map((f) => (
                <SortableFieldRow key={f.id} field={f} />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <button
        onClick={addField}
        className="mt-3 rounded border border-black/15 dark:border-white/20 px-3 py-1.5 text-sm"
      >
        + Alan ekle
      </button>
    </section>
  );
}
