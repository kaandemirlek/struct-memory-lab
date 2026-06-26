// FieldEditor.tsx  ← PERSON A
"use client";

import { useStructStore } from "@/store/useStructStore";
import { TYPE_INFO, type CppPrimitive } from "@/types";

const TYPES = Object.keys(TYPE_INFO) as CppPrimitive[];

export default function FieldEditor() {
  const model = useStructStore((s) => s.currentModel);
  const { updateField, removeField, addField, setStructName } = useStructStore();

  return (
    <section className="rounded-lg border border-black/10 dark:border-white/15 p-4">
      <h2 className="font-semibold mb-2">✏️ Field Editor (Person A)</h2>

      <input
        value={model.name}
        onChange={(e) => setStructName(e.target.value)}
        className="mb-3 font-mono rounded border border-black/10 dark:border-white/15 bg-transparent px-2 py-1"
      />

      <div className="space-y-1">
        {model.fields.map((f) => (
          <div key={f.id} className="flex gap-2 items-center">
            {/* TODO (PERSON A): dnd-kit ile sürükle-bırak sıralama ekle. */}
            <input
              value={f.name}
              onChange={(e) => updateField(f.id, { name: e.target.value })}
              className="flex-1 font-mono text-sm rounded border border-black/10 dark:border-white/15 bg-transparent px-2 py-1"
            />
            <select
              value={f.type}
              onChange={(e) =>
                updateField(f.id, { type: e.target.value as CppPrimitive })
              }
              className="font-mono text-sm rounded border border-black/10 dark:border-white/15 bg-transparent px-2 py-1"
            >
              {TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <button
              onClick={() => removeField(f.id)}
              className="text-red-500 px-2"
              aria-label="sil"
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      <button
        onClick={addField}
        className="mt-3 rounded border border-black/15 dark:border-white/20 px-3 py-1.5 text-sm"
      >
        + Alan ekle
      </button>
    </section>
  );
}
