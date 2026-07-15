// ============================================================================
// identity.ts — alan kimliği uzlaştırma (id eşleşmesi + isim fallback'i)
// ============================================================================
// diff/compatibility alanları field.id ile eşleştirir. Bu, uygulama İÇİNDE
// yapılan düzenlemelerde doğru çalışır (rename'de bile id sabit kalır). Ama iki
// AYRI parse'tan gelen modellerde (CLI'da iki .hpp dosyası, ya da UI'da üst üste
// iki header import'u) parseCpp her seferinde TAZE id üretir → id kesişimi boş
// kalır ve her alan yanlışlıkla "removed + added" olarak raporlanırdı.
//
// alignFieldIds bunu düzeltir: base'in target'ta id ile eşleşmeyen alanlarına,
// target'taki AYNI İSİMLİ (ve kendisi de id ile eşleşmemiş) alanın id'sini verir.
// id eşleşmesi her zaman önceliklidir; isim fallback'i yalnızca artakalanlara
// uygulanır ve birebirdir (bir target alanı en fazla bir base alanıyla eşleşir).
//
// Yön önemli: TARGET'ın id'leri asla değişmez. UI (rozetler, renkler) katmanı
// sonuçları target modelin id'leriyle anahtarladığı için hizalama hep base
// tarafında yapılır.
//
// Sınır: isim eşleştirmesi rename'i ayırt edemez — iki ayrı parse arasında
// yeniden adlandırılan alan "removed + added" görünür (düz metinden daha
// iyisi bilinemez).
// ============================================================================

import type { Field, StructModel } from "@/types";

/**
 * base'in alan id'lerini target'a hizalar: id ile eşleşenler olduğu gibi kalır,
 * eşleşmeyenler target'taki tekil isim eşine göre target'ın id'sini alır.
 * Girdileri mutasyona uğratmaz; hizalanacak bir şey yoksa base'i aynen döndürür.
 */
export function alignFieldIds(base: StructModel, target: StructModel): StructModel {
  const baseIds = new Set(base.fields.map((f) => f.id));
  const targetIds = new Set(target.fields.map((f) => f.id));
  const targetById = new Map(target.fields.map((f) => [f.id, f]));

  // target'ta id ile eşleşmemiş alanlar, isme göre (yalnızca TEKİL isimler —
  // yinelenen isimlerde hangi alanın kastedildiği belirsizdir, dokunma).
  const candidatesByName = new Map<string, Field>();
  const ambiguous = new Set<string>();
  for (const ft of target.fields) {
    if (baseIds.has(ft.id)) continue; // zaten id ile eşleşiyor
    if (ambiguous.has(ft.name)) continue;
    if (candidatesByName.has(ft.name)) {
      candidatesByName.delete(ft.name);
      ambiguous.add(ft.name);
    } else {
      candidatesByName.set(ft.name, ft);
    }
  }

  let changed = false;
  const fields = base.fields.map((fb) => {
    // id eşleşmesi her zaman öncelikli; yoksa tekil isim fallback'i kullanılır.
    const idMatch = targetIds.has(fb.id) ? targetById.get(fb.id) : undefined;
    const nameMatch = idMatch ? undefined : candidatesByName.get(fb.name);
    const match = idMatch ?? nameMatch;
    if (!match) return fb;
    if (nameMatch) candidatesByName.delete(fb.name); // birebir eşleşme

    let next = fb;
    if (fb.id !== match.id) {
      next = { ...next, id: match.id };
      changed = true;
    }

    // Nested struct'lar da ayrı parse'larda taze id'ler alır. Eşleşen parent'ın
    // iç modelini aynı kuralla özyinelemeli hizala ki position.z gibi yollar
    // removed+added gürültüsü üretmeden gerçek değişikliği gösterebilsin.
    if (fb.type === "struct" && match.type === "struct" && fb.nested && match.nested) {
      const nested = alignFieldIds(fb.nested, match.nested);
      if (nested !== fb.nested) {
        next = { ...next, nested };
        changed = true;
      }
    }

    return next;
  });

  return changed ? { ...base, fields } : base;
}
