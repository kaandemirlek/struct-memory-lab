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

import type { DiffEntry, DiffVersions, Field } from "@/types";

/** Alanın tip imzası, dizi sözdizimi dahil:  "uint8_t[16]" / "uint32_t" / "Vec3" (nested). */
function typeSignature(field: Field): string {
  const base =
    field.type === "struct" ? field.nested?.name.trim() || "struct" : field.type;
  return field.arrayLength > 1 ? `${base}[${field.arrayLength}]` : base;
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
