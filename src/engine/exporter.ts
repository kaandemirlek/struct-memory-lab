// ============================================================================
// exporter.ts  ← PERSON B
// ============================================================================
// GÖREV: StructModel'i tekrar GEÇERLİ, derlenebilir bir C++ .hpp metnine çevir.
// (A'nın parser'ının tersi.)
//
// Beklenen çıktı:
//   #pragma once
//
//   #include <cstdint>
//
//   struct Player {
//       uint32_t id;
//       bool alive;
//       double health;
//   };
//
// Dizi alanlar için:  uint8_t name[16];
// ============================================================================

import type { CppPrimitive, ExportCpp, Field, StructModel } from "@/types";
import { bitsPerWord, isUnsignedInt } from "@/engine/bitfields";
import { computeLayout } from "@/engine/layout";

/** 4 boşluk girinti (C++ konvansiyonu). */
const INDENT = "    ";

/**
 * Sabit genişlikli tamsayı tipleri <cstdint> başlığını gerektirir.
 * bool / char / float / double bu başlığa ihtiyaç duymaz.
 */
const CSTDINT_TYPES: ReadonlySet<CppPrimitive> = new Set<CppPrimitive>([
  "int8_t",
  "uint8_t",
  "int16_t",
  "uint16_t",
  "int32_t",
  "uint32_t",
  "int64_t",
  "uint64_t",
]);

/** Struct (nested dahil) herhangi bir *_t tipi kullanıyorsa <cstdint> gerekir. */
function needsCstdint(model: StructModel): boolean {
  return model.fields.some((f) =>
    f.type === "struct"
      ? f.nested
        ? needsCstdint(f.nested)
        : false
      : CSTDINT_TYPES.has(f.type)
  );
}

/** Bir alanın C++ tip adı: nested ise iç struct'ın adı, değilse primitive. */
function fieldTypeName(field: Field): string {
  if (field.type === "struct") return field.nested?.name.trim() || "Struct";
  return field.type;
}

/** Tek bir alanı C++ satırına çevirir:  "    Vec3 position;" / "    uint8_t name[16];" */
function formatField(field: Field): string {
  const suffix = field.arrayLength > 1 ? `[${field.arrayLength}]` : "";
  return `${INDENT}${fieldTypeName(field)} ${field.name}${suffix};`;
}

/** Bir adı geçerli, büyük harfli C makro tanımlayıcısına çevirir. */
function macroIdent(s: string): string {
  return (s.trim() || "X").replace(/[^A-Za-z0-9_]/g, "_").toUpperCase();
}

/**
 * width bit uzunluğundaki "hepsi 1" maskesinin hex gösterimi (0x öneki olmadan).
 * BigInt kullanmadan (ES hedefi düşük) nibble nibble kurulur; uint64_t (64 bit) güvenli.
 *   width 1 → "1", 3 → "7", 4 → "F", 8 → "FF", 64 → 16 tane F.
 */
function onesMaskHex(width: number): string {
  if (width <= 0) return "0";
  const fullNibbles = Math.floor(width / 4);
  const remBits = width % 4;
  const lead = remBits > 0 ? ((1 << remBits) - 1).toString(16) : "";
  return (lead + "f".repeat(fullNibbles)).toUpperCase();
}

/**
 * Bir alanın bit tanımlarını taşınabilir #define MASK/SHIFT makrolarına çevirir.
 * C bitfield DEĞİL — bit yerleşimi derleyiciye/ABI'ye bağımlı olmasın diye açık
 * maske makroları kullanılır:  (statusWord & FOO_MASK) >> FOO_SHIFT.
 * Yalnızca unsigned integer alanlarda (dolu bitFields) çalışır; diğerlerini atlar.
 */
function formatBitMacros(model: StructModel): string[] {
  const structPrefix = macroIdent(model.name);
  const lines: string[] = [];

  for (const field of model.fields) {
    const bits = field.bitFields;
    if (!bits || bits.length === 0) continue;
    if (!isUnsignedInt(field.type)) continue; // bit alanları yalnızca unsigned int'te anlamlı

    const bpw = bitsPerWord(field); // 32/64 → literal suffix'i belirler
    const suffix = bpw > 32 ? "ull" : "u"; // 64-bit word'de maske ULL olmalı
    const isArray = field.arrayLength > 1;

    lines.push(`// --- ${field.name} bit alanları (mask makroları) ---`);

    for (const b of bits) {
      const base = `${structPrefix}_${macroIdent(field.name)}_${macroIdent(b.name)}`;
      const maskHex = "0x" + onesMaskHex(b.width);

      // Yorum: kind + (dizi ise word) + değer anlamları.
      const kind = b.kind ?? (b.width === 1 ? "flag" : "uint");
      const parts: string[] = [kind];
      if (isArray) parts.push(`word ${b.wordIndex}`);
      if (b.meanings && b.meanings.length > 0) {
        parts.push(b.meanings.map((m) => `${m.value}=${m.label}`).join(", "));
      }
      const comment = `  // ${parts.join(", ")}`;

      lines.push(`#define ${base}_SHIFT ${b.startBit}u`);
      lines.push(`#define ${base}_MASK (${maskHex}${suffix} << ${b.startBit})${comment}`);
    }
  }

  return lines;
}

/**
 * Bir struct için bellek yerleşimini ABI kilidi olarak dondurur:
 *   static_assert(sizeof(X) == N, ...) + her alan için offsetof kontrolü.
 * Layout aracın kendi computeLayout'undan gelir → header'ı kullanan her derleyici
 * beklenen yerleşimden saparsa (alan eklendi/çıktı/sıra değişti) DERLEME PATLAR.
 * static_assert derleme-zamanı; çalışma-zamanı maliyeti yoktur.
 */
function formatStaticAsserts(model: StructModel): string[] {
  const name = model.name.trim() || "Struct";
  const layout = computeLayout(model);
  if (layout.fields.length === 0) return []; // alan yoksa doğrulanacak bir şey yok

  const lines = [`// --- ${name} bellek yerleşimi doğrulaması (ABI kilidi) ---`];
  lines.push(
    `static_assert(sizeof(${name}) == ${layout.totalSize}, "sizeof(${name}) beklenenden farkli");`
  );
  for (const f of layout.fields) {
    lines.push(
      `static_assert(offsetof(${name}, ${f.name}) == ${f.offset}, "${name}.${f.name} offset kaymis");`
    );
  }
  return lines;
}

/** Herhangi bir struct (nested dahil) alan içeriyorsa offsetof → <cstddef> gerekir. */
function needsCstddef(model: StructModel, nested: StructModel[]): boolean {
  return [model, ...nested].some((s) => s.fields.length > 0);
}

/** Bir struct'ın gövdesini ("struct X { ... };") satır satır üretir. */
function formatStruct(model: StructModel): string[] {
  const name = model.name.trim() || "Struct";
  const lines = [`struct ${name} {`];
  if (model.fields.length === 0) {
    lines.push(`${INDENT}// (alan yok)`);
  } else {
    for (const field of model.fields) lines.push(formatField(field));
  }
  lines.push("};");
  return lines;
}

/** Nested struct tanımlarını toplar (bağımlılıklar önce, isim bazında tekil). */
function collectNested(
  model: StructModel,
  acc: StructModel[],
  seen: Set<string>
): void {
  for (const f of model.fields) {
    if (f.type === "struct" && f.nested) {
      collectNested(f.nested, acc, seen); // önce iç bağımlılıklar
      const name = f.nested.name.trim() || "Struct";
      if (!seen.has(name)) {
        seen.add(name);
        acc.push(f.nested);
      }
    }
  }
}

export const exportCpp: ExportCpp = (model) => {
  const out: string[] = ["#pragma once"];

  // Nested tanımları önden topla (include kararları ve tanım sırası için gerekli).
  const nestedDefs: StructModel[] = [];
  collectNested(model, nestedDefs, new Set());

  const includes: string[] = [];
  if (needsCstdint(model)) includes.push("#include <cstdint>");
  if (needsCstddef(model, nestedDefs)) includes.push("#include <cstddef>"); // offsetof için
  if (includes.length > 0) out.push("", ...includes);

  // Bir struct tanımını, yerleşim doğrulamasını ve (varsa) bit makrolarını ekler.
  const pushStruct = (m: StructModel): void => {
    out.push("", ...formatStruct(m));
    const asserts = formatStaticAsserts(m);
    if (asserts.length > 0) out.push("", ...asserts);
    const macros = formatBitMacros(m);
    if (macros.length > 0) out.push("", ...macros);
  };

  // Önce nested struct tanımları (kullanılmadan önce tanımlanmalı), sonra ana struct.
  for (const def of nestedDefs) pushStruct(def);
  pushStruct(model);

  // Dosyalar tek bir sondaki yeni satırla biter (POSIX konvansiyonu).
  return out.join("\n") + "\n";
};
