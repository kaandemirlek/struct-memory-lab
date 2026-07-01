"use client";

import { useState } from "react";
import { useStructStore } from "@/store/useStructStore";
import { timeAgo } from "@/engine/versioning";
import Panel from "@/components/ui/Panel";
import Button from "@/components/ui/Button";
import { PencilIcon, TrashIcon } from "@/components/ui/icons";

type TargetOption = { value: string; label: string };

export default function AnnotationsPanel() {
  const model = useStructStore((s) => s.currentModel);
  const versions = useStructStore((s) => s.versions);
  const annotations = useStructStore((s) => s.annotations);
  const addAnnotation = useStructStore((s) => s.addAnnotation);
  const updateAnnotation = useStructStore((s) => s.updateAnnotation);
  const removeAnnotation = useStructStore((s) => s.removeAnnotation);

  const options: TargetOption[] = [
    ...model.fields.map((f) => ({ value: `field:${f.id}`, label: `Field: ${f.name}` })),
    ...versions.map((v) => ({ value: `version:${v.id}`, label: `Version: ${v.label}` })),
  ];

  const [target, setTarget] = useState(options[0]?.value ?? "");
  const [text, setText] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  const fieldName = (id: string) => model.fields.find((f) => f.id === id)?.name;
  const versionLabel = (id: string) => versions.find((v) => v.id === id)?.label;

  const labelFor = (a: (typeof annotations)[number]): string => {
    if (a.targetKind === "field") {
      const name = fieldName(a.targetId);
      return name ? `Field: ${name}` : "Field: (removed)";
    }
    const label = versionLabel(a.targetId);
    return label ? `Version: ${label}` : "Version: (removed)";
  };

  const submit = () => {
    const trimmed = text.trim();
    if (!trimmed || !target) return;
    const [kind, id] = target.split(":");
    if (kind !== "field" && kind !== "version") return;
    addAnnotation(kind, id, trimmed);
    setText("");
  };

  const commitEdit = () => {
    if (editingId) {
      const trimmed = draft.trim();
      if (trimmed) updateAnnotation(editingId, trimmed);
    }
    setEditingId(null);
  };

  return (
    <Panel
      title="Notes"
      description="Leave a note on a field or version — e.g. “don't move this, the serializer depends on the offset.”"
    >
      {options.length === 0 ? (
        <p className="text-sm text-muted">Add a field or save a version to attach notes.</p>
      ) : (
        <div className="mb-3 flex flex-col gap-2 sm:flex-row">
          <select
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            aria-label="Note target"
            className="rounded-lg border border-border bg-surface-muted px-2 py-1.5 text-sm outline-none focus:border-accent"
          >
            {options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
            }}
            placeholder="Write a note…"
            className="min-w-0 flex-1 rounded-lg border border-border bg-surface-muted px-3 py-1.5 text-sm outline-none focus:border-accent"
          />
          <Button variant="primary" size="sm" onClick={submit} disabled={!text.trim()}>
            Add note
          </Button>
        </div>
      )}

      {annotations.length === 0 ? (
        <p className="text-sm text-muted">No notes yet.</p>
      ) : (
        <ul className="space-y-2">
          {annotations.map((a) => {
            const orphan =
              (a.targetKind === "field" && !fieldName(a.targetId)) ||
              (a.targetKind === "version" && !versionLabel(a.targetId));
            const isEditing = editingId === a.id;

            return (
              <li key={a.id} className="rounded-lg border border-border bg-surface p-2.5">
                <div className="flex items-start justify-between gap-2">
                  <span
                    className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
                      orphan
                        ? "bg-surface-muted text-muted"
                        : "bg-accent/15 text-accent"
                    }`}
                  >
                    {labelFor(a)}
                  </span>
                  <span className="ml-auto shrink-0 text-[11px] text-muted">
                    {timeAgo(a.createdAt)}
                  </span>
                  <div className="flex shrink-0 items-center gap-0.5">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-muted hover:text-foreground"
                      aria-label="Edit note"
                      title="Edit"
                      onClick={() => {
                        setEditingId(a.id);
                        setDraft(a.text);
                      }}
                    >
                      <PencilIcon />
                    </Button>
                    <Button
                      variant="danger"
                      size="icon"
                      aria-label="Delete note"
                      title="Delete"
                      onClick={() => removeAnnotation(a.id)}
                    >
                      <TrashIcon />
                    </Button>
                  </div>
                </div>

                {isEditing ? (
                  <div className="mt-2 space-y-2">
                    <input
                      autoFocus
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") commitEdit();
                        if (e.key === "Escape") setEditingId(null);
                      }}
                      className="w-full rounded-md border border-border bg-surface-muted px-2 py-1.5 text-sm outline-none focus:border-accent"
                    />
                    <div className="flex justify-end gap-1">
                      <Button variant="primary" size="sm" onMouseDown={commitEdit}>
                        Save
                      </Button>
                      <Button variant="ghost" size="sm" onMouseDown={() => setEditingId(null)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="mt-1.5 break-words text-sm text-foreground">{a.text}</p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}
