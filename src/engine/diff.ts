// ============================================================================
// diff.ts  ← PERSON B
// ============================================================================
// GÖREV: İki StructModel'i karşılaştır → değişiklik listesi (DiffEntry[]).
//   added / removed / type-changed / renamed / reordered
//
// Alanları field.id üzerinden eşleştiririz; böylece isim değişse bile aynı alan
// takip edilir (rename, add+remove olarak görünmez).
//   a = eski (önceki versiyon), b = yeni (güncel model)
// ============================================================================

import type { DiffEntry, DiffKind, DiffVersions, Field, StructModel } from "@/types";
import { alignFieldIds } from "@/engine/identity";

/** Alanın tip imzası, dizi sözdizimi dahil:  "uint8_t[16]" / "uint32_t" / "Vec3" (nested). */
function typeSignature(field: Field): string {
  const base =
    field.type === "struct" ? field.nested?.name.trim() || "struct" : field.type;
  return field.arrayLength > 1 ? `${base}[${field.arrayLength}]` : base;
}

function diffStruct(a: StructModel, b: StructModel, prefix = ""): DiffEntry[] {
  const entries: DiffEntry[] = [];
  const byIdA = new Map(a.fields.map((f) => [f.id, f]));
  const byIdB = new Map(b.fields.map((f) => [f.id, f]));
  const path = (name: string) => (prefix ? `${prefix}.${name}` : name);

  // Silinenler: a'da var, b'de yok.
  for (const fa of a.fields) {
    if (!byIdB.has(fa.id)) {
      const fieldPath = path(fa.name);
      entries.push({
        kind: "removed",
        fieldName: fieldPath,
        detail: `${fieldPath}: ${typeSignature(fa)}`,
      });
    }
  }

  // Eklenenler, yeniden adlandırılanlar, tip değişenler: b üzerinden gez.
  for (const fb of b.fields) {
    const fa = byIdA.get(fb.id);
    const fieldPath = path(fb.name);

    if (!fa) {
      entries.push({
        kind: "added",
        fieldName: fieldPath,
        detail: `${fieldPath}: ${typeSignature(fb)}`,
      });
      continue;
    }

    if (fa.name !== fb.name) {
      entries.push({
        kind: "renamed",
        fieldName: fieldPath,
        detail: `${path(fa.name)} → ${fieldPath}`,
      });
    }

    if (typeSignature(fa) !== typeSignature(fb)) {
      entries.push({
        kind: "type-changed",
        fieldName: fieldPath,
        detail: `${fieldPath}: ${typeSignature(fa)} → ${typeSignature(fb)}`,
      });
    }

    if (fa.type === "struct" && fb.type === "struct" && fa.nested && fb.nested) {
      entries.push(...diffStruct(fa.nested, fb.nested, fieldPath));
    }
  }

  // Yeniden sıralama: iki versiyonda da bulunan alanların sırası değiştiyse.
  const commonA = a.fields.filter((f) => byIdB.has(f.id)).map((f) => f.id);
  const commonB = b.fields.filter((f) => byIdA.has(f.id)).map((f) => f.id);
  const reordered =
    commonA.length > 1 && commonA.some((id, i) => id !== commonB[i]);
  if (reordered) {
    entries.push({
      kind: "reordered",
      fieldName: prefix,
      detail: prefix ? `${prefix}: field order changed` : "Field order changed",
    });
  }

  return entries;
}

export const diffVersions: DiffVersions = (a, b) => {
  // İki ayrı parse'tan gelen modellerde id'ler kesişmez (nested alanlar dahil);
  // isim fallback'iyle hizala ki alanlar "removed + added" görünmesin.
  a = alignFieldIds(a, b);
  return diffStruct(a, b);
};

// ----------------------------------------------------------------------------
// Bir diff'i kompakt sayılara indirger (versiyon kartlarında "+2 −1 ~1" için).
// ----------------------------------------------------------------------------
export interface DiffSummary {
  added: number;
  removed: number;
  /** type-changed + renamed (alan "değişti"). */
  changed: number;
  reordered: number;
}

export function summarizeDiff(entries: DiffEntry[]): DiffSummary {
  const summary: DiffSummary = { added: 0, removed: 0, changed: 0, reordered: 0 };
  for (const e of entries) {
    if (e.kind === "added") summary.added++;
    else if (e.kind === "removed") summary.removed++;
    else if (e.kind === "reordered") summary.reordered++;
    else summary.changed++; // type-changed + renamed
  }
  return summary;
}

const REPORT_LABEL: Record<DiffKind, string> = {
  added: "Added",
  removed: "Removed",
  "type-changed": "Type",
  renamed: "Renamed",
  reordered: "Reordered",
};

/** İki versiyon arasındaki farkı paylaşılabilir Markdown raporu olarak üretir. */
export function diffReport(
  a: StructModel,
  b: StructModel,
  fromLabel: string,
  toLabel: string
): string {
  const entries = diffVersions(a, b);
  const lines = [`# Struct changes: ${fromLabel} → ${toLabel}`, ""];

  if (entries.length === 0) {
    lines.push("No changes.");
    return lines.join("\n") + "\n";
  }

  const s = summarizeDiff(entries);
  const parts: string[] = [];
  if (s.added) parts.push(`${s.added} added`);
  if (s.removed) parts.push(`${s.removed} removed`);
  if (s.changed) parts.push(`${s.changed} changed`);
  if (s.reordered) parts.push("reordered");

  lines.push(
    `**${entries.length} change${entries.length === 1 ? "" : "s"}** — ${parts.join(", ")}`,
    ""
  );
  for (const e of entries) {
    lines.push(`- **${REPORT_LABEL[e.kind]}** ${e.detail}`);
  }
  return lines.join("\n") + "\n";
}
