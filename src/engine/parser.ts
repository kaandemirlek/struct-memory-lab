// ============================================================================
// parser.ts  ← PERSON A
// ============================================================================
// Yapıştırılan C++ struct metnini StructModel'e çevirir (computeLayout'un
// beslendiği yapı). 3 katman: (1) bloğu bul, (2) gövdeyi alanlara böl,
// (3) her alanı tip+isim+[dizi]'ye ayrıştır.
//
// Hata durumunda anlaşılır bir Error fırlatır; ImportBox bunu yakalayıp gösterir.
// Kapsam: sabit genişlikli tipler (TYPE_INFO), tekil ve dizi alanlar.
//   Desteklenmeyen: pointer, nested struct, bit-field, #pragma pack.
// ============================================================================

import type { ParseCpp, Field, CppPrimitive } from "@/types";
import { TYPE_INFO } from "@/types";
import { makeId } from "@/store/useStructStore";

// Bir string geçerli bir CppPrimitive mi? (TYPE_INFO'yu güvenlik kapısı yapıyoruz.)
const isPrimitive = (t: string): t is CppPrimitive => t in TYPE_INFO; 

// // satır yorumlarını ve /* ... */ blok yorumlarını siler.
const stripComments = (s: string): string =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

// "uint8_t name[16]" → tip, isim, opsiyonel dizi uzunluğu
const FIELD_RE = /^([A-Za-z_]\w*)\s+([A-Za-z_]\w*)\s*(?:\[\s*(\d+)\s*\])?$/;

export const parseCpp: ParseCpp = (code) => {
  const clean = stripComments(code);

  // Katman 1: struct <isim> { <gövde> }
  const block = clean.match(/struct\s+([A-Za-z_]\w*)\s*\{([\s\S]*?)\}/);
  if (!block) {
    throw new Error('Geçerli bir struct bulunamadı. Örnek: "struct Ad { ... };"');
  }
  const [, name, body] = block;

  // Katman 2 + 3: gövdeyi ';' ile böl, her parçayı ayrıştır.
  const fields: Field[] = [];
  for (const raw of body.split(";")) {
    const decl = raw.trim();
    if (!decl) continue; // boş parça (örn. son ';' sonrası)

    const m = decl.match(FIELD_RE);
    if (!m) {
      throw new Error(`Alan çözümlenemedi: "${decl}"  (beklenen: "tip isim;" )`);
    }
    const [, type, fieldName, len] = m;
    if (!isPrimitive(type)) {
      throw new Error(`Bilinmeyen tip: "${type}"  (alan: ${fieldName})`);
    }

    fields.push({
      id: makeId("f"),
      name: fieldName,
      type,
      arrayLength: len ? parseInt(len, 10) : 1,
    });
  }

  return { name, fields };
};
