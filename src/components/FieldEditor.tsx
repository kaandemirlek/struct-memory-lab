// FieldEditor.tsx  ← PERSON A
"use client";

import { useStructStore } from "@/store/useStructStore";
import { TYPE_INFO, type CppPrimitive } from "@/types";
import Panel from "@/components/ui/Panel";
import Button from "@/components/ui/Button";

const TYPES = Object.keys(TYPE_INFO) as CppPrimitive[];

export default function FieldEditor() {
  const model = useStructStore((s) => s.currentModel);
  const { updateField, removeField, addField, setStructName } = useStructStore();

  return (
    <Panel
      title="Fields"
      description="Edit the struct name, its fields and their types."
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
          className="w-full rounded-lg border border-border bg-surface-muted px-3 py-1.5 font-mono text-sm outline-none focus:border-accent"
        />
      </label>

      {model.fields.length === 0 ? (
        <p className="text-sm text-muted">No fields yet. Add one to get started.</p>
      ) : (
        <div className="space-y-2">
          {model.fields.map((f) => (
            <div key={f.id} className="flex items-center gap-2">
              <input
                value={f.name}
                onChange={(e) => updateField(f.id, { name: e.target.value })}
                className="min-w-0 flex-1 rounded-lg border border-border bg-surface-muted px-3 py-1.5 font-mono text-sm outline-none focus:border-accent"
              />
              <select
                value={f.type}
                onChange={(e) =>
                  updateField(f.id, { type: e.target.value as CppPrimitive })
                }
                className="rounded-lg border border-border bg-surface-muted px-2 py-1.5 font-mono text-sm outline-none focus:border-accent"
              >
                {TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <button
                onClick={() => removeField(f.id)}
                aria-label={`Remove ${f.name}`}
                className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted transition-colors hover:bg-danger/10 hover:text-danger"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}
