// ============================================================================
// optimizer.ts
// ============================================================================
// Alanları yeniden sıralayarak padding'i (boşa giden byte) en aza indirir.
//
// Sezgi: padding, küçük hizalamalı bir alandan sonra büyük hizalamalı bir alan
// geldiğinde oluşur. Bunu önlemenin yolu: alanları HİZALAMAYA GÖRE BÜYÜKTEN
// KÜÇÜĞE dizmek. Saf ve deterministik → test edilebilir; veriyi mutasyona
// uğratmaz.
//
//   • optimizeStruct (Person A) — yeniden sıralanmış StructModel döndürür.
//   • optimizeLayout (Person B) — optimizeStruct'ı boyut/kazanç bilgisiyle sarar
//     (Optimize panelinde "şu kadar byte kazanırsın" göstermek için).
// ============================================================================

import type { ComputeLayout, StructModel } from "@/types";
import { TYPE_INFO } from "@/types";
import { computeLayout } from "@/engine/layout";

/** Alanları hizalamaya göre büyükten küçüğe dizer (eşitlikte özgün sıra korunur). */
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

export interface OptimizationResult {
  /** Önerilen, yeniden sıralanmış model. */
  optimizedModel: StructModel;
  /** Mevcut sıralamanın sizeof'u. */
  currentSize: number;
  /** Önerilen sıralamanın sizeof'u. */
  optimizedSize: number;
  /** Kazanılan byte (currentSize - optimizedSize, >= 0). */
  bytesSaved: number;
}

/** optimizeStruct sonucunu boyut bilgisiyle sarar. layoutFn test için enjekte edilebilir. */
export function optimizeLayout(
  model: StructModel,
  layoutFn: ComputeLayout = computeLayout
): OptimizationResult {
  const optimizedModel = optimizeStruct(model);
  const currentSize = layoutFn(model).totalSize;
  const optimizedSize = layoutFn(optimizedModel).totalSize;

  return {
    optimizedModel,
    currentSize,
    optimizedSize,
    bytesSaved: currentSize - optimizedSize,
  };
}
