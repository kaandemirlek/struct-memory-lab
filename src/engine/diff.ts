// ============================================================================
// diff.ts  ← PERSON B
// ============================================================================
// GÖREV: İki StructModel'i karşılaştır → değişiklik listesi (DiffEntry[]).
//   added / removed / type-changed / renamed / reordered
//
// İPUCU: Alanları field.id üzerinden eşleştir (isim değişse bile takip edilir).
//        a'da olup b'de olmayan → removed; b'de olup a'da olmayan → added; vb.
// ============================================================================

import type { DiffVersions } from "@/types";

export const diffVersions: DiffVersions = (a, b) => {
  // TODO (PERSON B): gerçek diff mantığını yaz.
  void a;
  void b;
  return [];
};
