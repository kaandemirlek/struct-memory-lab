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

import type { ComputeLayout, Field, Platform, StructModel } from "@/types";
import { DEFAULT_PLATFORM } from "@/types";
import { getTypeInfo } from "@/engine/platform";
import { computeLayout } from "@/engine/layout";

// Bir alanın hizalaması: nested struct ise kendi layout'undan, değilse tip
// tablosundan (platforma göre); #pragma pack varsa onunla sınırlanır.
function alignOf(f: Field, platform: Platform, pack?: number): number {
  let align = 1;
  if (f.type === "struct" && f.nested) align = computeLayout(f.nested, platform).alignment;
  else if (f.type !== "struct") align = getTypeInfo(platform)[f.type].align;
  return pack ? Math.min(align, pack) : align;
}

/** Alanları hizalamaya göre büyükten küçüğe dizer (eşitlikte özgün sıra korunur). */
export function optimizeStruct(
  model: StructModel,
  platform: Platform = DEFAULT_PLATFORM
): StructModel {
  const fields = model.fields
    .map((f, i) => ({ f, i })) // özgün index'i sakla (stabil sıralama için)
    .sort((a, b) => {
      const da = alignOf(a.f, platform, model.pack);
      const db = alignOf(b.f, platform, model.pack);
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
  layoutFn: ComputeLayout = computeLayout,
  platform: Platform = DEFAULT_PLATFORM
): OptimizationResult {
  const optimizedModel = optimizeStruct(model, platform);
  const currentSize = layoutFn(model, platform).totalSize;
  const optimizedSize = layoutFn(optimizedModel, platform).totalSize;

  return {
    optimizedModel,
    currentSize,
    optimizedSize,
    bytesSaved: currentSize - optimizedSize,
  };
}
