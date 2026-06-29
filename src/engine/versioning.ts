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

/** ISO timestamp'i kısa göreli biçime çevirir: "just now", "5m ago", "3h ago", "2d ago". */
export function timeAgo(iso: string, now: Date = new Date()): string {
  const seconds = Math.max(
    0,
    Math.floor((now.getTime() - new Date(iso).getTime()) / 1000)
  );
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
