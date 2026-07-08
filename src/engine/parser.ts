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

import type { BitField, ParseCpp, Field, CppPrimitive, StructModel } from "@/types";
import { TYPE_INFO } from "@/types";
import { makeId } from "@/store/useStructStore";
import { EMBED_MARKER } from "@/engine/embed";

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

// Header'a gömülü "// struct-memory-lab-model:{...}" satırını (varsa) çözer.
// Bozuk/eksik veri → null (çağıran normal C++ parse'a düşer).
function extractEmbeddedModel(code: string): StructModel | null {
  for (const line of code.split(/\r?\n/)) {
    const t = line.trimStart();
    if (!t.startsWith(EMBED_MARKER)) continue;
    try {
      return normalizeModel(JSON.parse(t.slice(EMBED_MARKER.length).trim()) as Partial<StructModel>);
    } catch {
      return null;
    }
  }
  return null;
}

export const parseCpp: ParseCpp = (code) => {
  // Bu araçtan export edilen header'da gömülü model satırı varsa onu KAYIPSIZ
  // döndür (Status Bits, bit anlamları dahil). Elle yazılmış header'larda yok.
  const embedded = extractEmbeddedModel(code);
  if (embedded) return embedded;

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

// ============================================================================
// JSON import — exportModelJson çıktısını KAYIPSIZ geri yükler.
// C++ .hpp round-trip'i bit-alanı SEMANTİĞİNİ (isim/anlam/kind) taşıyamaz; bu
// yüzden status bits'in de birebir dönmesi için JSON formatı kullanılır.
// ============================================================================

// Ham (untrusted) tip değerini doğrular; geçersizse anlaşılır hata verir.
function coerceFieldType(raw: unknown, fieldName: string): Field["type"] {
  if (raw === "struct") return "struct";
  if (typeof raw === "string" && raw in TYPE_INFO) return raw as CppPrimitive;
  throw new Error(`Bilinmeyen tip: "${String(raw)}"  (alan: ${fieldName})`);
}

function normalizeBitField(b: Partial<BitField>): BitField {
  const bit: BitField = {
    id: typeof b.id === "string" && b.id ? b.id : makeId("bit"),
    name: typeof b.name === "string" ? b.name : "bit",
    wordIndex: Math.max(0, Math.floor(Number(b.wordIndex) || 0)),
    startBit: Math.max(0, Math.floor(Number(b.startBit) || 0)),
    width: Math.max(1, Math.floor(Number(b.width) || 1)),
  };
  if (b.kind) bit.kind = b.kind;
  if (Array.isArray(b.meanings)) {
    bit.meanings = b.meanings.map((m) => ({
      value: Math.floor(Number(m?.value) || 0),
      label: typeof m?.label === "string" ? m.label : "",
    }));
  }
  return bit;
}

function normalizeField(f: Partial<Field>): Field {
  const name = typeof f.name === "string" ? f.name : "field";
  const type = coerceFieldType(f.type, name);
  const field: Field = {
    id: typeof f.id === "string" && f.id ? f.id : makeId("f"),
    name,
    type,
    arrayLength: Math.max(1, Math.floor(Number(f.arrayLength) || 1)),
  };
  if (type === "struct") {
    if (!f.nested) throw new Error(`"${name}" struct ama nested tanımı yok.`);
    field.nested = normalizeModel(f.nested);
  }
  if (Array.isArray(f.bitFields) && f.bitFields.length > 0) {
    field.bitFields = f.bitFields.map(normalizeBitField);
  }
  return field;
}

function normalizeModel(m: Partial<StructModel>): StructModel {
  if (!m || typeof m !== "object" || !Array.isArray(m.fields)) {
    throw new Error('Geçerli bir struct JSON\'u değil (beklenen: { "name", "fields": [...] }).');
  }
  return {
    name: typeof m.name === "string" ? m.name : "Struct",
    fields: m.fields.map(normalizeField),
  };
}

/**
 * struct-memory-lab JSON'unu (exportModelJson çıktısı) StructModel'e çevirir.
 * Hem tam export objesini ({ format, struct, layout }) hem de ham StructModel'i
 * ({ name, fields }) kabul eder. bitFields / meanings / nested korunur.
 */
export function parseModelJson(text: string): StructModel {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("Geçersiz JSON.");
  }
  const obj = (data ?? {}) as Record<string, unknown>;
  // Tam export objesi ise .struct'ı al; değilse ham modelin kendisi.
  const raw = obj && typeof obj === "object" && "struct" in obj ? obj.struct : obj;
  return normalizeModel(raw as Partial<StructModel>);
}
