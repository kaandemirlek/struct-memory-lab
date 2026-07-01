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

import type { ParseCpp, Field, CppPrimitive, StructModel } from "@/types";
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

// Bir struct'ı taze id'lerle derin kopyalar (nested referansların id'leri
// üst modelde çakışmasın diye). Özyinelemeli.
function cloneWithFreshIds(model: StructModel): StructModel {
  return {
    name: model.name,
    fields: model.fields.map((f) => ({
      ...f,
      id: makeId("f"),
      nested: f.nested ? cloneWithFreshIds(f.nested) : undefined,
    })),
  };
}

// Bir struct gövdesini alanlara ayrıştırır. Bir alanın tipi; önce primitive/alias,
// olmazsa daha önce TANIMLANMIŞ bir struct adı (registry) olarak çözülür → nested.
function parseBody(body: string, registry: Map<string, StructModel>): Field[] {
  const fields: Field[] = [];
  for (const raw of body.split(";")) {
    const decl = raw.trim();
    if (!decl) continue; // boş parça (örn. son ';' sonrası)

    const m = decl.match(FIELD_RE);
    if (!m) {
      throw new Error(`Alan çözümlenemedi: "${decl}"  (beklenen: "tip isim;" )`);
    }
    const [, rawType, fieldName, len] = m;
    const arrayLength = len ? parseInt(len, 10) : 1;

    const prim = resolveType(rawType);
    if (prim) {
      fields.push({ id: makeId("f"), name: fieldName, type: prim, arrayLength });
      continue;
    }

    // Primitive değil → tanımlı bir struct adı mı? (nested)
    const norm = rawType.trim().replace(/\s+/g, " ");
    const known = registry.get(norm);
    if (known) {
      fields.push({
        id: makeId("f"),
        name: fieldName,
        type: "struct",
        arrayLength,
        nested: cloneWithFreshIds(known),
      });
      continue;
    }

    throw new Error(`Bilinmeyen tip: "${norm}"  (alan: ${fieldName})`);
  }
  return fields;
}

export const parseCpp: ParseCpp = (code) => {
  const clean = stripComments(code);

  // Tüm "struct <isim> { <gövde> }" bloklarını sırayla işle. Bir struct yalnızca
  // KENDİNDEN ÖNCE tanımlanmış struct'lara referans verebilir (C++ "define before use").
  const blockRe = /struct\s+([A-Za-z_]\w*)\s*\{([\s\S]*?)\}/g;
  const registry = new Map<string, StructModel>();
  let last: StructModel | null = null;

  for (const block of clean.matchAll(blockRe)) {
    const [, name, body] = block;
    const model: StructModel = { name, fields: parseBody(body, registry) };
    registry.set(name, model);
    last = model; // son tanımlanan struct = ana model (bağımlılıklar önce gelir)
  }

  if (!last) {
    throw new Error('Geçerli bir struct bulunamadı. Örnek: "struct Ad { ... };"');
  }
  return last;
};
