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

import type { ComputeLayout, Field, StructModel } from "@/types";
import { TYPE_INFO } from "@/types";
import { computeLayout } from "@/engine/layout";

// Bir alanın hizalaması: nested struct ise kendi layout'undan, değilse TYPE_INFO'dan.
function alignOf(f: Field): number {
  if (f.type === "struct" && f.nested) return computeLayout(f.nested).alignment;
  if (f.type !== "struct") return TYPE_INFO[f.type].align;
  return 1;
}

/** Alanları hizalamaya göre büyükten küçüğe dizer (eşitlikte özgün sıra korunur). */
export function optimizeStruct(model: StructModel): StructModel {
  const fields = model.fields
    .map((f, i) => ({ f, i })) // özgün index'i sakla (stabil sıralama için)
    .sort((a, b) => {
      const da = alignOf(a.f);
      const db = alignOf(b.f);
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
