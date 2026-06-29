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

// "unsigned int score[4]" → tip (çok kelimeli olabilir), isim, opsiyonel dizi.
// Grup 1 non-greedy → grup 2 her zaman son tanımlayıcıyı (alan adını) yakalar.
const FIELD_RE = /^([A-Za-z_][\w\s]*?)\s+([A-Za-z_]\w*)\s*(?:\[\s*(\d+)\s*\])?$/;

// Yaygın C++ tip yazımlarını kanonik sabit-genişlikli tipe eşler.
// Not: long ve arkadaşları platforma bağlı (LP64'te 8, Windows LLP64'te 4 byte);
// burada 64-bit Unix modelini varsayıyoruz — demo'da bilinçli bir kapsam kararı.
const ALIASES: Record<string, CppPrimitive> = {
  "signed char": "int8_t",
  "unsigned char": "uint8_t",
  short: "int16_t",
  "short int": "int16_t",
  "unsigned short": "uint16_t",
  "unsigned short int": "uint16_t",
  int: "int32_t",
  signed: "int32_t",
  "signed int": "int32_t",
  unsigned: "uint32_t",
  "unsigned int": "uint32_t",
  long: "int64_t",
  "long int": "int64_t",
  "unsigned long": "uint64_t",
  "unsigned long int": "uint64_t",
  "long long": "int64_t",
  "unsigned long long": "uint64_t",
};

// Ham tip metnini kanonik CppPrimitive'e çevirir; tanınmazsa null.
function resolveType(raw: string): CppPrimitive | null {
  const norm = raw.trim().replace(/\s+/g, " ");
  if (isPrimitive(norm)) return norm; // zaten kanonik (uint32_t, double, ...)
  return ALIASES[norm] ?? null;
}

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
    const [, rawType, fieldName, len] = m;
    const type = resolveType(rawType);
    if (!type) {
      throw new Error(`Bilinmeyen tip: "${rawType.trim()}"  (alan: ${fieldName})`);
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
