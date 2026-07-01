// FieldEditor.tsx
"use client";

import { useState, useSyncExternalStore } from "react";
import {
  DndContext,
  DragOverlay,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useStructStore } from "@/store/useStructStore";
import { validateStruct } from "@/engine/validation";
import { TYPE_INFO, type CppPrimitive, type Field } from "@/types";
import Panel from "@/components/ui/Panel";
import Button from "@/components/ui/Button";

const TYPES = Object.keys(TYPE_INFO) as CppPrimitive[];

const inputClass =
  "min-w-0 rounded-lg border border-border bg-surface-muted px-2 py-1.5 font-mono text-sm outline-none focus:border-accent";
const subscribeToNothing = () => () => {};

// Drag handle dots (SVG, not font-dependent).
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

// Row content (name + type + remove) — shared by static and sortable rows.
function FieldRowInner({ field }: { field: Field }) {
  const { updateField, removeField } = useStructStore();
  return (
    <>
      <input
        value={field.name}
        onChange={(e) => updateField(field.id, { name: e.target.value })}
        className={`flex-1 ${inputClass}`}
      />
      <select
        value={field.type}
        onChange={(e) => {
          const v = e.target.value as CppPrimitive | "struct";
          if (v === "struct") return; // nested zaten struct; dropdown'dan "struct"a geçiş yok
          // primitive'e dönüşte iç içe struct verisini temizle (layout/export tutarlı kalsın)
          updateField(field.id, { type: v, nested: undefined });
        }}
        className={inputClass}
      >
        {/* Nested alan: gerçek tipi ("struct") seçili gösterilemediği için struct adını
            (Vec3) bir option olarak ekle; böylece "bool" yerine doğru tip görünür. */}
        {field.type === "struct" && (
          <option value="struct">{field.nested?.name || "struct"}</option>
        )}
        {TYPES.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>
      <label className="flex items-center gap-1">
        <span className="text-xs text-muted">×</span>
        <input
          type="number"
          min={1}
          max={1024}
          value={field.arrayLength}
          onChange={(e) =>
            updateField(field.id, {
              arrayLength: Math.max(
                1,
                Math.min(1024, Math.floor(Number(e.target.value) || 1))
              ),
            })
          }
          aria-label={`Array length for ${field.name}`}
          title="Array length"
          className={`w-16 text-center ${inputClass}`}
        />
      </label>
      <button
        onClick={() => removeField(field.id)}
        aria-label={`Remove ${field.name}`}
        className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted transition-colors hover:bg-danger/10 hover:text-danger"
      >
        ×
      </button>
    </>
  );
}

// Sortable row (useSortable — client only, inside DndContext).
function SortableFieldRow({ field }: { field: Field }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: field.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-2">
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab touch-none px-1 text-muted hover:text-foreground active:cursor-grabbing"
        aria-label="Drag to reorder"
      >
        <GripIcon />
      </button>
      <FieldRowInner field={field} />
    </div>
  );
}

// Static row (server + pre-mount; no useSortable → hydration-safe).
function StaticFieldRow({ field }: { field: Field }) {
  return (
    <div className="flex items-center gap-2">
      <span className="px-1 text-muted/50" aria-hidden>
        <GripIcon />
      </span>
      <FieldRowInner field={field} />
    </div>
  );
}

export default function FieldEditor() {
  const model = useStructStore((s) => s.currentModel);
  const { addField, setStructName, reorderFields } = useStructStore();
  const issues = validateStruct(model);

  // dnd-kit causes a hydration mismatch on the server → render only after mount.
  const mounted = useSyncExternalStore(subscribeToNothing, () => true, () => false);

  const [activeId, setActiveId] = useState<string | null>(null);
  const activeField = model.fields.find((f) => f.id === activeId) ?? null;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id));

  const handleDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = model.fields.findIndex((f) => f.id === active.id);
    const newIndex = model.fields.findIndex((f) => f.id === over.id);
    reorderFields(oldIndex, newIndex);
  };

  return (
    <Panel
      title="Fields"
      description="Edit the struct name and fields. Drag the handle to reorder."
      actions={
        <Button variant="secondary" onClick={addField}>
          Add field
        </Button>
      }
    >
      <label className="mb-3 block">
        <span className="mb-1 block text-xs text-muted">Struct name</span>
        <input
          value={model.name}
          onChange={(e) => setStructName(e.target.value)}
          className={`w-full ${inputClass}`}
        />
      </label>

      {model.fields.length === 0 ? (
        <p className="text-sm text-muted">No fields yet. Add one to get started.</p>
      ) : !mounted ? (
        <div className="space-y-2">
          {model.fields.map((f) => (
            <StaticFieldRow key={f.id} field={f} />
          ))}
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={() => setActiveId(null)}
        >
          <SortableContext
            items={model.fields.map((f) => f.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2">
              {model.fields.map((f) => (
                <SortableFieldRow key={f.id} field={f} />
              ))}
            </div>
          </SortableContext>

          <DragOverlay>
            {activeField ? (
              <div className="flex items-center gap-2 rounded-lg border border-border bg-surface px-2 py-1.5 shadow-lg">
                <span className="text-muted">
                  <GripIcon />
                </span>
                <span className="flex-1 font-mono text-sm">{activeField.name}</span>
                <span className="font-mono text-xs text-muted">{activeField.type}</span>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      {issues.length > 0 && (
        <ul className="mt-3 space-y-1" role="alert">
          {issues.map((issue, i) => (
            <li key={i} className="break-words text-xs text-danger">
              {issue.message}
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
