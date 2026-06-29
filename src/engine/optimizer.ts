// ============================================================================
// optimizer.ts  ← PERSON B
// ============================================================================
// GÖREV: Alanları yeniden sıralayarak padding'i (boşa giden byte) azaltan bir
// öneri üret. Standart-layout struct'larda alanları hizalama (alignment) azalan
// sırada dizmek padding'i en aza indirir (büyük hizalamalılar başa).
//
// Saf ve deterministik. Boyut ölçümü için computeLayout kullanır; çağıran
// isterse kendi layout fonksiyonunu geçebilir (test için).
// ============================================================================

import type { ComputeLayout, StructModel } from "@/types";
import { TYPE_INFO } from "@/types";
import { computeLayout } from "@/engine/layout";

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

function totalBytes(type: StructModel["fields"][number]["type"], arrayLength: number): number {
  return TYPE_INFO[type].size * Math.max(1, arrayLength);
}

export function optimizeLayout(
  model: StructModel,
  layoutFn: ComputeLayout = computeLayout
): OptimizationResult {
  // Hizalama azalan; eşitlikte boyut azalan (deterministik). Array.sort kararlı.
  const sorted = [...model.fields].sort((a, b) => {
    const alignDelta = TYPE_INFO[b.type].align - TYPE_INFO[a.type].align;
    if (alignDelta !== 0) return alignDelta;
    return (
      totalBytes(b.type, b.arrayLength) - totalBytes(a.type, a.arrayLength)
    );
  });

  const optimizedModel: StructModel = { ...model, fields: sorted };
  const currentSize = layoutFn(model).totalSize;
  const optimizedSize = layoutFn(optimizedModel).totalSize;

  return {
    optimizedModel,
    currentSize,
    optimizedSize,
    bytesSaved: currentSize - optimizedSize,
  };
}
