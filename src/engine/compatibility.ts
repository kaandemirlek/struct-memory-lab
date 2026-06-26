// ============================================================================
// compatibility.ts  ← PERSON B   (⚠️ A'nın computeLayout'una bağlı)
// ============================================================================
// GÖREV: İki versiyon arası TEHLİKELİ değişiklikleri tespit et → Warning[].
// Örnek: "health alanı offset 8 → 16'ya kaydı", "boyut 12 → 16 oldu".
//
// BAĞIMLILIK: offset'lerin kaydığını görmek için computeLayout gerekir.
//   • A'nın gerçek versiyonu gelene kadar layout.mock'tan gelen sahte
//     fonksiyonu kullan (aşağıdaki import'a bak).
//   • A'nınki bittiğinde import'u "@/engine/layout" olarak değiştir — tek satır.
// ============================================================================

import type { AnalyzeCompatibility } from "@/types";

// 🔁 GEÇİCİ: A'nın computeLayout'u gelene kadar mock kullan.
// A bitirince şununla değiştir:  import { computeLayout } from "@/engine/layout";
import { computeLayout } from "@/engine/layout.mock";

export const analyzeCompatibility: AnalyzeCompatibility = (
  a,
  b,
  layoutFn = computeLayout // çağıran isterse gerçek fonksiyonu geçebilir
) => {
  // TODO (PERSON B): gerçek uyumluluk analizini yaz.
  //  1. layoutFn(a) ve layoutFn(b) hesapla.
  //  2. Ortak alanların offset'lerini karşılaştır → kaymış olanlar danger.
  //  3. totalSize değiştiyse uyar.
  void a;
  void b;
  void layoutFn;
  return [];
};
