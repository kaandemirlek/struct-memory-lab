// ============================================================================
// layout.ts  ← PERSON A   (⚠️ B'nin compatibility'si buna bağlı — ÖNCE bunu bitir)
// ============================================================================
// GÖREV: StructModel için bellek yerleşimini hesapla.
//   • Her alanın offset'i
//   • Hizalama (alignment) için eklenen padding
//   • toplam boyut (sizeof) ve toplam padding
//
// C++ kuralları (standart-layout, paketlenmemiş):
//   1. Bir alan, kendi alignment'ının katı olan offset'e yerleşir.
//      Gerekirse öncesine padding eklenir.
//   2. Struct'ın alignment'ı = alanların en büyük alignment'ı.
//   3. Toplam boyut, struct alignment'ının katına yukarı yuvarlanır
//      (sondaki "tail padding").
//
// Bu fonksiyon DETERMİNİSTİK olmalı → birim testi yazmak çok kolay.
// ============================================================================

import type { ComputeLayout, FieldLayout } from "@/types";
import { TYPE_INFO } from "@/types";

const alignUp = (value: number, align: number): number =>
  Math.ceil(value / align) * align;

export const computeLayout: ComputeLayout = (model) => {
  // TODO (PERSON A): aşağıdaki naif iskeleti gerçek kurallara göre tamamla
  // ve birim testlerle doğrula. Şu hali çoğu basit durumda çalışır ama
  // testlerle sağlamlaştır (boş struct, dizi alanlar, vb.).
  const fields: FieldLayout[] = [];
  let offset = 0;
  let maxAlign = 1;

  for (const f of model.fields) {
    const info = TYPE_INFO[f.type];
    const size = info.size * Math.max(1, f.arrayLength);
    const aligned = alignUp(offset, info.align);
    const paddingBefore = aligned - offset;

    fields.push({
      fieldId: f.id,
      name: f.name,
      type: f.type,
      offset: aligned,
      size,
      paddingBefore,
    });

    offset = aligned + size;
    maxAlign = Math.max(maxAlign, info.align);
  }

  const totalSize = alignUp(offset, maxAlign);
  const totalPadding =
    totalSize - fields.reduce((sum, f) => sum + (f.size), 0);

  return { fields, totalSize, alignment: maxAlign, totalPadding };
};
