// ============================================================================
// parser.ts  ← PERSON A
// ============================================================================
// Yapıştırılan C++ struct metnini StructModel'e çevirir (computeLayout'un
// beslendiği yapı). Kaynak TEK geçişte, bildirim sırasıyla taranır (C++
// "define before use" kuralıyla uyumlu): #pragma pack, enum, typedef/using
// ve struct blokları sırayla işlenir.
//
// Kapsam:
//   • sabit genişlikli tipler + platforma göre "long" ailesi (bkz. platform.ts)
//   • tekil ve dizi alanlar, nested struct'lar
//   • #pragma pack(N) / pack(push, N) / pack(pop) / pack()
//   • yerel C++ bit alanları:  uint32_t flags : 3;  (yaklaşık model — ardışık
//     aynı tipli bildirimler tek fiziksel alana/word dizisine gruplanır)
//   • enum / enum class (alttaki tipe eşlenir; isimler kaybolur — yaklaşıklık)
//   • typedef / using tip takma adları (primitive ya da tanımlı struct)
//
// Desteklenmeyen: pointer, template, alignas, birden çok bildirimci (int a, b;).
// Hata durumunda anlaşılır bir Error fırlatır; ImportBox bunu yakalayıp gösterir.
// ============================================================================

import type {
  BitField,
  ParseCpp,
  Field,
  CppPrimitive,
  StructModel,
} from "@/types";
import { TYPE_INFO } from "@/types";
import { makeId } from "@/store/useStructStore";
import { EMBED_MARKER } from "@/engine/embed";

// Bir string geçerli bir CppPrimitive mi? (TYPE_INFO'yu güvenlik kapısı yapıyoruz.)
const isPrimitive = (t: string): t is CppPrimitive => t in TYPE_INFO;

// Yaygın C++ tip yazımları → kanonik tip. PLATFORMDAN BAĞIMSIZDIR: long ve
// unsigned long artık birer primitive olduğu için (isPrimitive true) burada
// yer almazlar — boyutları layout anında platforma göre çözülür. Yalnızca
// çok-kelimeli varyantlar (long int, signed long) kanonik ada eşlenir.
// "long long" ise HER platformda 8 byte olduğu için sabit int64_t'ye gider.
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
  "long int": "long",
  "signed long": "long",
  "signed long int": "long",
  "unsigned long int": "unsigned long",
  "long long": "int64_t",
  "long long int": "int64_t",
  "unsigned long long": "uint64_t",
  "unsigned long long int": "uint64_t",
};

// // satır yorumlarını ve /* ... */ blok yorumlarını siler.
const stripComments = (s: string): string =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

// "unsigned int score[4]" → tip (çok kelimeli olabilir), isim, opsiyonel dizi.
// Grup 1 non-greedy → grup 2 her zaman son tanımlayıcıyı (alan adını) yakalar.
const FIELD_RE = /^([A-Za-z_][\w\s]*?)\s+([A-Za-z_]\w*)\s*(?:\[\s*(\d+)\s*\])?$/;

// "uint32_t flags : 3" / "uint32_t : 5" (isimsiz dolgu) → tip, isim?, genişlik.
const BITFIELD_RE = /^([A-Za-z_][\w\s]*?)(?:\s+([A-Za-z_]\w*))?\s*:\s*(\d+)$/;

// Tek geçişli tarayıcı: pragma | enum | typedef | using | struct — belge sırasında.
const DIRECTIVE_RE = new RegExp(
  [
    /#pragma\s+pack\s*\(\s*([^)]*?)\s*\)/.source, //                       1: pack argümanları
    /enum\s+(?:class\s+|struct\s+)?([A-Za-z_]\w*)\s*(?::\s*([^{;]+?))?\s*\{[^}]*\}/.source, // 2: ad, 3: alt tip
    /typedef\s+([A-Za-z_][\w\s]*?)\s+([A-Za-z_]\w*)\s*;/.source, //        4: hedef, 5: ad
    /using\s+([A-Za-z_]\w*)\s*=\s*([A-Za-z_][\w\s]*?)\s*;/.source, //      6: ad, 7: hedef
    /struct\s+([A-Za-z_]\w*)\s*\{([\s\S]*?)\}/.source, //                  8: ad, 9: gövde
  ].join("|"),
  "g"
);

const VALID_PACKS = new Set([1, 2, 4, 8, 16]);

// Bir parse çalışmasının kayıtları: typedef/using/enum + tanımlı struct'lar.
// (Sabit ALIASES tablosu global — çalışmaya özel değil.)
interface ParseContext {
  named: Map<string, CppPrimitive>; // typedef/using/enum → kanonik primitive
  structs: Map<string, StructModel>; // struct adı (ve struct typedef'leri) → model
}

// Ham tip metnini normalize eder: fazla boşluk, const ve "struct " öneki atılır.
function normalizeTypeText(raw: string): string {
  return raw
    .replace(/\bconst\b/g, "")
    .replace(/^\s*struct\s+/, "")
    .trim()
    .replace(/\s+/g, " ");
}

// Ham tip metnini kanonik CppPrimitive'e çevirir; tanınmazsa null.
function resolvePrimitive(raw: string, ctx: ParseContext): CppPrimitive | null {
  const norm = normalizeTypeText(raw);
  if (isPrimitive(norm)) return norm; // zaten kanonik (uint32_t, long, double, ...)
  return ALIASES[norm] ?? ctx.named.get(norm) ?? null;
}

// Bir struct'ı taze id'lerle derin kopyalar (nested referansların id'leri
// üst modelde çakışmasın diye). Özyinelemeli.
function cloneWithFreshIds(model: StructModel): StructModel {
  return {
    ...model,
    fields: model.fields.map((f) => ({
      ...f,
      id: makeId("f"),
      nested: f.nested ? cloneWithFreshIds(f.nested) : undefined,
    })),
  };
}

// ---------------------------------------------------------------------------
// Yerel C++ bit alanı gruplama.
// Ardışık, AYNI konteyner tipli bit bildirimleri tek fiziksel alana toplanır;
// word'e sığmayanlar bir sonraki word'e taşar (alan gerekirse diziye dönüşür).
// Bu, derleyicilerin birim-tabanlı yerleşiminin yaklaşık bir modelidir.
// ---------------------------------------------------------------------------

// Bit konteyneri: işaretli/karakter tipler aynı boyutlu unsigned'a eşlenir
// (fiziksel yerleşim aynı; işaret bilgisi BitField.kind = "int" ile korunur).
const BIT_CONTAINER: Partial<Record<CppPrimitive, { container: CppPrimitive; signed: boolean }>> = {
  bool: { container: "uint8_t", signed: false },
  char: { container: "uint8_t", signed: false },
  int8_t: { container: "uint8_t", signed: true },
  uint8_t: { container: "uint8_t", signed: false },
  int16_t: { container: "uint16_t", signed: true },
  uint16_t: { container: "uint16_t", signed: false },
  int32_t: { container: "uint32_t", signed: true },
  uint32_t: { container: "uint32_t", signed: false },
  int64_t: { container: "uint64_t", signed: true },
  uint64_t: { container: "uint64_t", signed: false },
  // long bit alanları nadirdir; word genişliği platforma bağlı olduğundan
  // LP64 varsayımıyla 64-bit konteynere eşlenir (yaklaşık).
  long: { container: "uint64_t", signed: true },
  "unsigned long": { container: "uint64_t", signed: false },
};

interface BitGroup {
  container: CppPrimitive;
  /** İlk isimli bilirimden türetilen fiziksel alan adı ("flags_bits"). */
  name: string | null;
  bits: BitField[];
  /** Grup içinde bir sonraki boş bitin MUTLAK konumu (word'ler arası akar). */
  cursor: number;
}

function flushBitGroup(group: BitGroup | null, fields: Field[]): null {
  if (!group) return null;
  const bpw = TYPE_INFO[group.container].size * 8;
  const words = Math.max(1, Math.ceil(group.cursor / bpw));
  fields.push({
    id: makeId("f"),
    name: group.name ?? "bits",
    type: group.container,
    arrayLength: words,
    bitFields: group.bits.length > 0 ? group.bits : undefined,
  });
  return null;
}

// ---------------------------------------------------------------------------
// Struct gövdesi → Field[]
// ---------------------------------------------------------------------------
function parseBody(body: string, ctx: ParseContext): Field[] {
  const fields: Field[] = [];
  let group: BitGroup | null = null;

  for (const raw of body.split(";")) {
    const decl = raw.trim();
    if (!decl) continue; // boş parça (örn. son ';' sonrası)

    // --- normal alan (tip isim [dizi]) ---
    const m = decl.match(FIELD_RE);
    if (m) {
      const [, rawType, fieldName, len] = m;
      const arrayLength = len ? parseInt(len, 10) : 1;

      const prim = resolvePrimitive(rawType, ctx);
      if (prim) {
        group = flushBitGroup(group, fields);
        fields.push({ id: makeId("f"), name: fieldName, type: prim, arrayLength });
        continue;
      }

      // Primitive değil → tanımlı bir struct adı mı? (nested)
      const norm = normalizeTypeText(rawType);
      const known = ctx.structs.get(norm);
      if (known) {
        group = flushBitGroup(group, fields);
        fields.push({
          id: makeId("f"),
          name: fieldName,
          type: "struct",
          arrayLength,
          nested: cloneWithFreshIds(known),
        });
        continue;
      }

      throw new Error(`Unknown type: "${norm}"  (field: ${fieldName})`);
    }

    // --- yerel bit alanı (tip isim : genişlik) ---
    const bm = decl.match(BITFIELD_RE);
    if (bm) {
      let rawType: string = bm[1];
      let bitName: string | undefined = bm[2];
      const widthStr = bm[3];
      // "unsigned int : 3" gibi durumlarda regex "int"i isim sanabilir;
      // tip+isim birlikte çözülüyorsa aslında isimsiz bir bildirimdir.
      if (bitName && resolvePrimitive(`${rawType} ${bitName}`, ctx)) {
        rawType = `${rawType} ${bitName}`;
        bitName = undefined;
      }

      const prim = resolvePrimitive(rawType, ctx);
      const info = prim ? BIT_CONTAINER[prim] : undefined;
      if (!prim || !info) {
        throw new Error(
          `Bit-field base type must be an integer type: "${decl}"`
        );
      }

      const width = parseInt(widthStr, 10);
      const bpw = TYPE_INFO[info.container].size * 8;
      if (width > bpw) {
        throw new Error(
          `Bit-field "${bitName ?? decl}" is ${width} bits, wider than its ${bpw}-bit type.`
        );
      }

      // Farklı konteyner tipine geçiş yeni bir fiziksel alan başlatır.
      if (group && group.container !== info.container) {
        group = flushBitGroup(group, fields);
      }
      if (!group) {
        group = { container: info.container, name: null, bits: [], cursor: 0 };
      }

      if (width === 0) {
        // "uint32_t : 0" → bir sonraki word sınırına geç (C++ kuralı).
        group.cursor = Math.ceil(group.cursor / bpw) * bpw || bpw;
        continue;
      }

      // Word sınırını aşacaksa bir sonraki word'den başlat (birim modeli).
      if ((group.cursor % bpw) + width > bpw) {
        group.cursor = Math.ceil(group.cursor / bpw) * bpw;
      }

      if (bitName) {
        if (!group.name) group.name = `${bitName}_bits`;
        group.bits.push({
          id: makeId("bit"),
          name: bitName,
          wordIndex: Math.floor(group.cursor / bpw),
          startBit: group.cursor % bpw,
          width,
          kind: info.signed ? "int" : width === 1 ? "flag" : "uint",
        });
      }
      // İsimsiz bildirim = dolgu bitleri; kayıt açmadan yalnızca yer tüketir.
      group.cursor += width;
      continue;
    }

    throw new Error(`Could not parse field: "${decl}"  (expected: "type name;")`);
  }

  flushBitGroup(group, fields);
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

// #pragma pack argümanlarını mevcut duruma uygular; yeni pack değerini döndürür.
function applyPackDirective(
  args: string,
  pack: number | undefined,
  stack: (number | undefined)[]
): number | undefined {
  const parts = args.split(",").map((s) => s.trim()).filter(Boolean);
  if (parts.length === 0) return undefined; // #pragma pack() → sıfırla
  if (parts[0] === "push") {
    stack.push(pack);
    if (parts.length === 1) return pack; // pack(push) → değer değişmez
    return parsePackValue(parts[1]);
  }
  if (parts[0] === "pop") {
    return stack.length > 0 ? stack.pop() : undefined;
  }
  return parsePackValue(parts[0]);
}

function parsePackValue(s: string): number {
  const n = Number(s);
  if (!VALID_PACKS.has(n)) {
    throw new Error(`Unsupported #pragma pack value: "${s}" (expected 1, 2, 4, 8 or 16).`);
  }
  return n;
}

export const parseCpp: ParseCpp = (code) => {
  // Bu araçtan export edilen header'da gömülü model satırı varsa onu KAYIPSIZ
  // döndür (Status Bits, bit anlamları dahil). Elle yazılmış header'larda yok.
  const embedded = extractEmbeddedModel(code);
  if (embedded) return embedded;

  const clean = stripComments(code);
  const ctx: ParseContext = {
    named: new Map(),
    structs: new Map(),
  };

  let pack: number | undefined;
  const packStack: (number | undefined)[] = [];
  let last: StructModel | null = null;

  // Tüm bildirimleri belge sırasıyla işle. Bir bildirim yalnızca KENDİNDEN
  // ÖNCE tanımlanmış tiplere referans verebilir (C++ "define before use").
  for (const d of clean.matchAll(DIRECTIVE_RE)) {
    const [, packArgs, enumName, enumBase, tdTarget, tdName, usName, usTarget, structName, structBody] = d;

    if (packArgs !== undefined) {
      pack = applyPackDirective(packArgs, pack, packStack);
    } else if (enumName !== undefined) {
      // enum → alttaki tamsayı tipine eşlenir (":" yoksa int). Değer adları
      // modele taşınmaz — bilinçli bir yaklaşıklık.
      const base = enumBase ? resolvePrimitive(enumBase, ctx) : "int32_t";
      if (!base) throw new Error(`Unknown enum base type: "${enumBase!.trim()}"  (enum: ${enumName})`);
      ctx.named.set(enumName, base);
    } else if (tdName !== undefined || usName !== undefined) {
      const aliasName = (tdName ?? usName)!;
      const target = (tdTarget ?? usTarget)!;
      const prim = resolvePrimitive(target, ctx);
      if (prim) {
        ctx.named.set(aliasName, prim);
      } else {
        const s = ctx.structs.get(normalizeTypeText(target));
        if (!s) throw new Error(`Unknown type in typedef/using: "${normalizeTypeText(target)}"  (alias: ${aliasName})`);
        ctx.structs.set(aliasName, s);
      }
    } else if (structName !== undefined) {
      const model: StructModel = { name: structName, fields: parseBody(structBody, ctx) };
      if (pack !== undefined) model.pack = pack;
      ctx.structs.set(structName, model);
      last = model; // son tanımlanan struct = ana model (bağımlılıklar önce gelir)
    }
  }

  if (!last) {
    throw new Error('No valid struct found. Example: "struct Name { ... };"');
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
  throw new Error(`Unknown type: "${String(raw)}"  (field: ${fieldName})`);
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
    if (!f.nested) throw new Error(`Field "${name}" has type "struct" but no nested definition.`);
    field.nested = normalizeModel(f.nested);
  }
  if (Array.isArray(f.bitFields) && f.bitFields.length > 0) {
    field.bitFields = f.bitFields.map(normalizeBitField);
  }
  return field;
}

function normalizeModel(m: Partial<StructModel>): StructModel {
  if (!m || typeof m !== "object" || !Array.isArray(m.fields)) {
    throw new Error('Not a valid struct JSON (expected: { "name", "fields": [...] }).');
  }
  const model: StructModel = {
    name: typeof m.name === "string" ? m.name : "Struct",
    fields: m.fields.map(normalizeField),
  };
  const pack = Number(m.pack);
  if (VALID_PACKS.has(pack)) model.pack = pack;
  return model;
}

/**
 * struct-memory-lab JSON'unu (exportModelJson çıktısı) StructModel'e çevirir.
 * Hem tam export objesini ({ format, struct, layout }) hem de ham StructModel'i
 * ({ name, fields }) kabul eder. bitFields / meanings / nested / pack korunur.
 */
export function parseModelJson(text: string): StructModel {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("Invalid JSON.");
  }
  const obj = (data ?? {}) as Record<string, unknown>;
  // Tam export objesi ise .struct'ı al; değilse ham modelin kendisi.
  const raw = obj && typeof obj === "object" && "struct" in obj ? obj.struct : obj;
  return normalizeModel(raw as Partial<StructModel>);
}
