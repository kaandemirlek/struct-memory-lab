"use client";

import { useState } from "react";
import {
  fieldTypeLabel,
  useStructStore,
  type Annotation,
} from "@/store/useStructStore";
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
  // Hedef listesi model/versiyonlarla birlikte değişir (import, Load example,
  // restore → alan id'leri yenilenir). State'te kalan eski bir id, select'te
  // ilk seçenek seçiliymiş GİBİ görünür ama submit var olmayan hedefe yazar
  // ("(removed)" notu). Geçersizleşen seçim ilk geçerli seçeneğe düşürülür.
  const effectiveTarget = options.some((o) => o.value === target)
    ? target
    : options[0]?.value ?? "";
  const [text, setText] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  const fieldName = (id: string) => model.fields.find((f) => f.id === id)?.name;
  const versionLabel = (id: string) => versions.find((v) => v.id === id)?.label;

  const labelFor = (a: Annotation): string => {
    if (a.targetKind === "field") {
      const name = fieldName(a.targetId);
      return name ? `Field: ${name}` : "Field: (removed)";
    }
    const label = versionLabel(a.targetId);
    return label ? `Version: ${label}` : "Version: (removed)";
  };

  // Not yazıldıktan sonra alanda ne değişti? (boş dizi = değişiklik yok).
  // Notlar kısıt gibidir ("bunu taşıma") — kısıt ihlal edilince not eskimiş
  // görünmek yerine uyarıya dönüşür.
  const fieldChanges = (a: Annotation): string[] => {
    if (a.targetKind !== "field" || !a.fieldSnapshot) return [];
    const index = model.fields.findIndex((f) => f.id === a.targetId);
    if (index < 0) return []; // silinen hedef zaten "(removed)" olarak işaretli
    const field = model.fields[index];
    const snap = a.fieldSnapshot;
    const changes: string[] = [];
    if (field.name !== snap.name) changes.push(`renamed ${snap.name} → ${field.name}`);
    const typeLabel = fieldTypeLabel(field);
    if (typeLabel !== snap.typeLabel) changes.push(`type ${snap.typeLabel} → ${typeLabel}`);
    const arrayLength = Math.max(1, field.arrayLength ?? 1);
    if (arrayLength !== snap.arrayLength)
      changes.push(`array ×${snap.arrayLength} → ×${arrayLength}`);
    if (index !== snap.index) changes.push(`moved #${snap.index + 1} → #${index + 1}`);
    return changes;
  };

  const changedCount = annotations.filter((a) => fieldChanges(a).length > 0).length;

  const submit = () => {
    const trimmed = text.trim();
    if (!trimmed || !effectiveTarget) return;
    // Yalnızca İLK iki nokta ayırıcıdır — id'nin kendisi bölünmesin.
    const sep = effectiveTarget.indexOf(":");
    const kind = effectiveTarget.slice(0, sep);
    const id = effectiveTarget.slice(sep + 1);
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
      collapsible
      defaultOpen={false}
      summary={
        <span className="text-muted">
          {annotations.length === 0
            ? "no notes"
            : `${annotations.length} ${annotations.length === 1 ? "note" : "notes"}`}
          {changedCount > 0 && (
            <span className="text-warning"> · {changedCount} changed since noted</span>
          )}
        </span>
      }
    >
      <p className="mb-3 text-xs text-muted">
        Leave a note on a field or version — e.g. “don&apos;t move this, the
        serializer depends on the offset.”
      </p>
      {options.length === 0 ? (
        <p className="text-sm text-muted">Add a field or save a version to attach notes.</p>
      ) : (
        <div className="mb-3 flex flex-col gap-2 sm:flex-row">
          <select
            value={effectiveTarget}
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
            const changes = fieldChanges(a);
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

                {changes.length > 0 && (
                  <p className="mt-1.5 rounded-md border border-warning/30 bg-warning/10 px-2 py-1 text-[11px] text-warning">
                    Field changed since this note: {changes.join(" · ")}
                  </p>
                )}

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
