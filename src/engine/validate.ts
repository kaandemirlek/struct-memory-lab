// ============================================================================
// validate.ts  ← PERSON A
// ============================================================================
// currentModel'deki alan adlarını kontrol eder ve insan-dostu uyarılar üretir:
//   • boş ad
//   • geçersiz C++ tanımlayıcı (harf/_ ile başlamalı, sonra harf/rakam/_)
//   • yinelenen ad
//
// Saf fonksiyon → test edilebilir. UI bu listeyi gösterir (engelleme yok, uyarı).
// ============================================================================

import type { StructModel } from "@/types";

const IDENTIFIER = /^[A-Za-z_]\w*$/;

export function validateModel(model: StructModel): string[] {
  const issues: string[] = [];
  const counts = new Map<string, number>();

  for (const f of model.fields) {
    const name = f.name.trim();
    if (!name) {
      issues.push("Boş alan adı var.");
    } else if (!IDENTIFIER.test(name)) {
      issues.push(`Geçersiz alan adı: "${f.name}" (harf veya _ ile başlamalı).`);
    }
    if (name) counts.set(name, (counts.get(name) ?? 0) + 1);
  }

  for (const [name, count] of counts) {
    if (count > 1) issues.push(`Yinelenen alan adı: "${name}" (${count} kez).`);
  }

  // Aynı mesaj birden çok kez çıkmasın.
  return [...new Set(issues)];
}
