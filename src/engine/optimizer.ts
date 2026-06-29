// ============================================================================
// optimizer.ts  ← PERSON A   (stretch hedef)
// ============================================================================
// Alanları yeniden sıralayarak padding'i en aza indirir.
//
// Sezgi: padding, küçük hizalamalı bir alandan sonra büyük hizalamalı bir alan
// geldiğinde oluşur (büyük olan hizalı offset'e zıplar, araya boşluk girer).
// Bunu önlemenin yolu: alanları HİZALAMAYA GÖRE BÜYÜKTEN KÜÇÜĞE dizmek.
// Böylece her alan, bir öncekinin bittiği yere (çoğunlukla) tam oturur.
//
// Saf ve deterministik → test edilebilir. Veriyi mutasyona uğratmaz.
// ============================================================================

import type { StructModel } from "@/types";
import { TYPE_INFO } from "@/types";

export function optimizeStruct(model: StructModel): StructModel {
  const fields = model.fields
    .map((f, i) => ({ f, i })) // özgün index'i sakla (stabil sıralama için)
    .sort((a, b) => {
      const da = TYPE_INFO[a.f.type].align;
      const db = TYPE_INFO[b.f.type].align;
      if (da !== db) return db - da; // hizalama büyükten küçüğe
      return a.i - b.i; // eşitlikte özgün sırayı koru (stabil)
    })
    .map((x) => x.f);

  return { ...model, fields };
}
