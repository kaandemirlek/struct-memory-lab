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
import { makeId, useStructStore } from "@/store/useStructStore";
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

// Dizi uzunluğu input'u: klavye/numpad ile elle (çok haneli) yazmaya izin verir.
// Kontrollü sayıyı her tuşta kırpmak yerine yerel bir taslak tutar → alanı
// boşaltıp yeniden yazabilirsin; 1..1024 normalize etme blur'da yapılır. Ok
// tuşları (spinner) da çalışmaya devam eder.
function ArrayLengthInput({ field }: { field: Field }) {
  const updateField = useStructStore((s) => s.updateField);
  const [draft, setDraft] = useState(String(field.arrayLength));
  const [syncedLen, setSyncedLen] = useState(field.arrayLength);

  // Dış kaynaklı değişimi (undo/redo, reorder, import) taslağa yansıt — effect
  // KULLANMADAN, render sırasında; böylece elle yazım kesintiye uğramaz.
  if (field.arrayLength !== syncedLen) {
    setSyncedLen(field.arrayLength);
    setDraft(String(field.arrayLength));
  }

  return (
    <input
      type="number"
      inputMode="numeric"
      min={1}
      max={1024}
      value={draft}
      onChange={(e) => {
        const raw = e.target.value;
        setDraft(raw); // ham değer (boş/aşamalı olabilir) → elle yazmaya izin ver
        const n = Math.floor(Number(raw));
        if (raw !== "" && n >= 1 && n <= 1024) {
          setSyncedLen(n);
          updateField(field.id, { arrayLength: n });
        }
      }}
      onBlur={() => {
        const n = Math.max(1, Math.min(1024, Math.floor(Number(draft) || 1)));
        setDraft(String(n));
        setSyncedLen(n);
        if (n !== field.arrayLength) updateField(field.id, { arrayLength: n });
      }}
      aria-label={`Array length for ${field.name}`}
      title="Array length"
      className={`w-12 text-center ${inputClass}`}
    />
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
        aria-label={`Name for ${field.name}`}
        className={`flex-1 ${inputClass}`}
      />
      <select
        value={field.type}
        onChange={(e) => {
          const v = e.target.value as CppPrimitive | "struct";
          if (v === "struct") {
            if (field.type === "struct") return; // zaten struct — no-op
            // Primitive → yeni nested struct: tek alanla başlat, aşağıdaki
            // NestedStructEditor ile düzenlenir.
            updateField(field.id, {
              type: "struct",
              nested: {
                name: "NewStruct",
                fields: [{ id: makeId("f"), name: "value", type: "int32_t", arrayLength: 1 }],
              },
            });
            return;
          }
          // primitive'e dönüşte iç içe struct verisini temizle (layout/export tutarlı kalsın)
          updateField(field.id, { type: v, nested: undefined });
        }}
        aria-label={`Type for ${field.name}`}
        className={`w-[92px] shrink-0 ${inputClass}`}
      >
        {/* Nested alan: gerçek tipi ("struct") seçili gösterilemediği için struct adını
            (Vec3) bir option olarak ekle; böylece "bool" yerine doğru tip görünür. */}
        <option value="struct">
          {field.type === "struct" ? field.nested?.name || "struct" : "struct…"}
        </option>
        {TYPES.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>
      <label className="flex shrink-0 items-center gap-1">
        <span className="text-xs text-muted">×</span>
        <ArrayLengthInput field={field} />
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

// Nested struct'ın iç düzenleyicisi: struct adı + alan satırları (özyinelemeli).
// updateField/removeField/addField ağacın her seviyesinde çalıştığı için
// satır içeriği FieldRowInner ile paylaşılır. İç alanlar sürüklenemez
// (reorder yalnızca üst seviyede) — bilinçli kapsam kararı.
function NestedStructEditor({ field }: { field: Field }) {
  const { addField, updateField } = useStructStore();
  if (field.type !== "struct" || !field.nested) return null;
  const nested = field.nested;

  return (
    <div className="ml-7 mt-2 space-y-2 border-l-2 border-accent/30 pl-3">
      <div className="flex items-center gap-2">
        <span className="shrink-0 text-xs text-muted">struct</span>
        <input
          value={nested.name}
          onChange={(e) =>
            updateField(field.id, { nested: { ...nested, name: e.target.value } })
          }
          aria-label={`Struct name for ${field.name}`}
          className={`w-36 min-w-0 ${inputClass}`}
        />
        <button
          type="button"
          onClick={() => addField(field.id)}
          className="ml-auto shrink-0 text-xs font-medium text-accent hover:underline"
        >
          + Add field
        </button>
      </div>

      {nested.fields.map((f) => (
        <div key={f.id}>
          <div className="flex items-center gap-2">
            <FieldRowInner field={f} />
          </div>
          <NestedStructEditor field={f} />
        </div>
      ))}
    </div>
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
    <div ref={setNodeRef} style={style}>
      <div className="flex items-center gap-2">
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
      <NestedStructEditor field={field} />
    </div>
  );
}

// Static row (server + pre-mount; no useSortable → hydration-safe).
function StaticFieldRow({ field }: { field: Field }) {
  return (
    <div>
      <div className="flex items-center gap-2">
        <span className="px-1 text-muted/50" aria-hidden>
          <GripIcon />
        </span>
        <FieldRowInner field={field} />
      </div>
      <NestedStructEditor field={field} />
    </div>
  );
}

// collapseAction: WorkspaceShell'in verdiği "sidebar'a daralt" düğmesi
// (VersionPanel'deki desenle aynı — panel başlığının sağına yerleşir).
export default function FieldEditor({
  collapseAction,
}: {
  collapseAction?: React.ReactNode;
}) {
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
        <>
          <Button variant="secondary" onClick={() => addField()}>
            Add field
          </Button>
          {collapseAction}
        </>
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
