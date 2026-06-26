// ============================================================================
// layout.mock.ts  ← PERSON B'nin geçici güvenlik ağı
// ============================================================================
// A'nın gerçek computeLayout'u gelene kadar B'nin çalışabilmesi için
// sözleşmeye (LayoutResult) uygun sahte bir çıktı döndürür.
//
// A'nınki bitince compatibility.ts içindeki import'u
//   "@/engine/layout"  yapıp bu dosyayı silebilirsin.
// ============================================================================

import type { ComputeLayout } from "@/types";
import { TYPE_INFO } from "@/types";

export const computeLayout: ComputeLayout = (model) => {
  // Çok kaba ama sözleşmeye uygun: padding'i yok say, alanları sırayla diz.
  let offset = 0;
  const fields = model.fields.map((f) => {
    const size = TYPE_INFO[f.type].size * Math.max(1, f.arrayLength);
    const entry = {
      fieldId: f.id,
      name: f.name,
      type: f.type,
      offset,
      size,
      paddingBefore: 0,
    };
    offset += size;
    return entry;
  });
  return { fields, totalSize: offset, alignment: 8, totalPadding: 0 };
};
