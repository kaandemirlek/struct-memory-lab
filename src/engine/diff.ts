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

/** Alanın tip imzası, dizi sözdizimi dahil:  "uint8_t[16]" ya da "uint32_t". */
function typeSignature(field: Field): string {
  return field.arrayLength > 1 ? `${field.type}[${field.arrayLength}]` : field.type;
}

export const diffVersions: DiffVersions = (a, b) => {
  const entries: DiffEntry[] = [];
  const byIdA = new Map(a.fields.map((f) => [f.id, f]));
  const byIdB = new Map(b.fields.map((f) => [f.id, f]));

  // Silinenler: a'da var, b'de yok.
  for (const fa of a.fields) {
    if (!byIdB.has(fa.id)) {
      entries.push({
        kind: "removed",
        fieldName: fa.name,
        detail: `${fa.name}: ${typeSignature(fa)}`,
      });
    }
  }

  // Eklenenler, yeniden adlandırılanlar, tip değişenler: b üzerinden gez.
  for (const fb of b.fields) {
    const fa = byIdA.get(fb.id);

    if (!fa) {
      entries.push({
        kind: "added",
        fieldName: fb.name,
        detail: `${fb.name}: ${typeSignature(fb)}`,
      });
      continue;
    }

    if (fa.name !== fb.name) {
      entries.push({
        kind: "renamed",
        fieldName: fb.name,
        detail: `${fa.name} → ${fb.name}`,
      });
    }

    if (fa.type !== fb.type || fa.arrayLength !== fb.arrayLength) {
      entries.push({
        kind: "type-changed",
        fieldName: fb.name,
        detail: `${fb.name}: ${typeSignature(fa)} → ${typeSignature(fb)}`,
      });
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
      fieldName: "",
      detail: "Field order changed",
    });
  }

  return entries;
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
