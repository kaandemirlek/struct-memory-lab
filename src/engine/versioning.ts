// ============================================================================
// versioning.ts  ← PERSON B
// ============================================================================
// Versiyon mantığının çekirdeği (snapshot saklama) ortak store'da yaşıyor:
//   store/useStructStore.ts → saveVersion / loadVersion / versions
//
// Bu dosya, store'dan bağımsız test edilebilen SAF yardımcılar içindir.
// Örn: iki versiyonun aynı olup olmadığını kontrol, etiket biçimleme, vb.
// ============================================================================

import type { StructModel, Version } from "@/types";

/** İki modelin alan bazında aynı olup olmadığı (saf, test edilebilir). */
export function modelsEqual(a: StructModel, b: StructModel): boolean {
  // TODO (PERSON B): gerekirse daha akıllı karşılaştırma yaz.
  return JSON.stringify(a) === JSON.stringify(b);
}

/** Bir versiyonu kısa, okunur biçimde özetler (panelde göstermek için). */
export function summarizeVersion(v: Version): string {
  const count = v.model.fields.length;
  return `${v.label} — ${count} ${count === 1 ? "field" : "fields"}`;
}
