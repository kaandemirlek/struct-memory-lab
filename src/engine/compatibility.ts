// ============================================================================
// compatibility.ts  ← PERSON B
// ============================================================================
// GÖREV: İki versiyon arası TEHLİKELİ değişiklikleri tespit et → Warning[].
//   • Ortak bir alanın offset'i kaydıysa            → danger (binary kırar)
//   • Bir alan tamamen silindiyse                    → danger
//   • Toplam boyut (sizeof) değiştiyse               → warning
//   • Struct hizalaması (alignment) değiştiyse       → warning
//
// A'nın gerçek computeLayout'u hazır olduğu için artık mock yerine onu
// kullanıyoruz (planlanan "tek satırlık import değişimi").
// Çağıran isterse 3. argümanla kendi layout fonksiyonunu geçebilir.
// ============================================================================

import type { AnalyzeCompatibility, Warning } from "@/types";
import { computeLayout } from "@/engine/layout";

export const analyzeCompatibility: AnalyzeCompatibility = (
  a,
  b,
  layoutFn = computeLayout
) => {
  const warnings: Warning[] = [];
  const before = layoutFn(a);
  const after = layoutFn(b);

  const beforeById = new Map(before.fields.map((f) => [f.fieldId, f]));
  const afterById = new Map(after.fields.map((f) => [f.fieldId, f]));

  // Ortak alanlarda offset kayması — serileştirme/binary okuyucuları kırar.
  for (const [id, fa] of beforeById) {
    const fb = afterById.get(id);
    if (fb && fa.offset !== fb.offset) {
      warnings.push({
        severity: "danger",
        message: `Field "${fb.name}" moved from offset ${fa.offset} to ${fb.offset}.`,
      });
    }
  }

  // Silinen alanlar — o alanı okuyan kod kırılır.
  for (const [id, fa] of beforeById) {
    if (!afterById.has(id)) {
      warnings.push({
        severity: "danger",
        message: `Field "${fa.name}" was removed.`,
      });
    }
  }

  // Toplam boyut değişimi — dosya/buffer boyutu varsayımlarını bozar.
  if (before.totalSize !== after.totalSize) {
    warnings.push({
      severity: "warning",
      message: `Struct size changed from ${before.totalSize} to ${after.totalSize} bytes.`,
    });
  }

  // Hizalama değişimi — dizilerde/ABI'de hizalama sorunlarına yol açabilir.
  if (before.alignment !== after.alignment) {
    warnings.push({
      severity: "warning",
      message: `Struct alignment changed from ${before.alignment} to ${after.alignment} bytes.`,
    });
  }

  return warnings;
};
