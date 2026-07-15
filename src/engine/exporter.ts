// ============================================================================
// exporter.ts  ← PERSON B
// ============================================================================
// StructModel'i (1) geçerli, derlenebilir C++ .hpp metnine ve (2) yapılandırılmış
// JSON'a çevirir. C++ çıktısı nested struct'ları, bit anlamı yorumlarını ve
// (opsiyonel) ABI kilidi static_assert'lerini içerir; opsiyonel olarak alan
// başına offset/size yorumları eklenir.
//
// NOT: Kayıpsız (Status Bits dahil) geri yükleme JSON formatıyla yapılır;
// .hpp çıktısı insan/derleyici içindir, model verisi gömülmez.
// ============================================================================

import type { CppPrimitive, Field, Platform, StructModel } from "@/types";
import { DEFAULT_PLATFORM } from "@/types";
import { isUnsignedInt } from "@/engine/bitfields";
import { computeLayout } from "@/engine/layout";

/** C++ .hpp dışa aktarımı için seçenekler. */
export interface ExportCppOptions {
  /** Alan başına offset/size yorumları + sizeof özeti ekle (varsayılan: true). */
  comments?: boolean;
  /** sizeof/offsetof static_assert blokları (ABI kilidi) ekle (varsayılan: true). */
  asserts?: boolean;
  /** Offset/size yorumları ve static_assert'ler bu platforma göre hesaplanır. */
  platform?: Platform;
}

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

/** Girintisiz alan deklarasyonu: "Vec3 position;" / "uint8_t name[16];" */
function declOf(field: Field): string {
  const suffix = field.arrayLength > 1 ? `[${field.arrayLength}]` : "";
  return `${fieldTypeName(field)} ${field.name}${suffix};`;
}

/** Tek bir alanı girintili C++ satırına çevirir. */
function formatField(field: Field): string {
  return `${INDENT}${declOf(field)}`;
}

const padComment = (n: number) =>
  `${INDENT}// ${n} ${n === 1 ? "byte" : "bytes"} padding`;

/**
 * Bir alanın bit tanımlarını insan-okur yorum satırlarına çevirir:
 *
 *   // --- status bit meanings ---
 *   // bit 0    -> meaning: alive (flag), 0=DEAD, 1=ALIVE
 *   // bits 1-3 -> meaning: mode (enum)
 *
 * Dizi alanlarında satır başına word indeksi eklenir ("word 2, bit 0 -> ...").
 * Yalnızca unsigned integer alanlarda (dolu bitFields) çalışır; diğerlerini atlar.
 */
function formatBitComments(model: StructModel): string[] {
  const lines: string[] = [];

  for (const field of model.fields) {
    const bits = field.bitFields;
    if (!bits || bits.length === 0) continue;
    if (!isUnsignedInt(field.type)) continue; // bit alanları yalnızca unsigned int'te anlamlı

    const isArray = field.arrayLength > 1;
    const sorted = [...bits].sort(
      (a, b) => a.wordIndex - b.wordIndex || a.startBit - b.startBit
    );

    // Önce sol etiketleri üret ("bit 0" / "bits 1-5" / "word 2, bit 0"),
    // sonra hizalı biçimde "-> meaning: ..." ekle (okunabilirlik için).
    const rows = sorted.map((b) => {
      const range =
        b.width === 1
          ? `bit ${b.startBit}`
          : `bits ${b.startBit}-${b.startBit + b.width - 1}`;
      const label = isArray ? `word ${b.wordIndex}, ${range}` : range;

      const kind = b.kind ?? (b.width === 1 ? "flag" : "uint");
      let meaning = `${b.name} (${kind})`;
      if (b.meanings && b.meanings.length > 0) {
        meaning += `, ${b.meanings.map((m) => `${m.value}=${m.label}`).join(", ")}`;
      }
      return { label, meaning };
    });

    const width = Math.max(...rows.map((r) => r.label.length));
    lines.push(`// --- ${field.name} bit meanings ---`);
    for (const r of rows) {
      lines.push(`// ${r.label.padEnd(width)} -> meaning: ${r.meaning}`);
    }
  }

  return lines;
}

/**
 * Bir struct için bellek yerleşimini ABI kilidi olarak dondurur:
 *   static_assert(sizeof(X) == N, ...) + her alan için offsetof kontrolü.
 * Header'ı kullanan derleyici beklenen yerleşimden saparsa DERLEME PATLAR.
 */
function formatStaticAsserts(model: StructModel, platform: Platform): string[] {
  const name = model.name.trim() || "Struct";
  const layout = computeLayout(model, platform);
  if (layout.fields.length === 0) return [];

  const lines = [`// --- ${name} memory layout verification (ABI lock) ---`];
  lines.push(
    `static_assert(sizeof(${name}) == ${layout.totalSize}, "sizeof(${name}) does not match the expected layout");`
  );
  for (const f of layout.fields) {
    lines.push(
      `static_assert(offsetof(${name}, ${f.name}) == ${f.offset}, "${name}.${f.name} moved to a different offset");`
    );
  }
  return lines;
}

/** Herhangi bir struct (nested dahil) alan içeriyorsa offsetof → <cstddef> gerekir. */
function needsCstddef(model: StructModel, nested: StructModel[]): boolean {
  return [model, ...nested].some((s) => s.fields.length > 0);
}

/** Bir struct'ın gövdesini ("struct X { ... };") satır satır üretir. */
function formatStruct(model: StructModel, withComments: boolean, platform: Platform): string[] {
  const name = model.name.trim() || "Struct";
  const lines = [`struct ${name} {`];

  if (model.fields.length === 0) {
    lines.push(`${INDENT}// (no fields)`);
    lines.push("};");
    return lines;
  }

  if (withComments) {
    const layout = computeLayout(model, platform);
    const decls = model.fields.map(declOf);
    const width = Math.max(...decls.map((d) => d.length));

    model.fields.forEach((field, i) => {
      const fl = layout.fields[i];
      if (fl.paddingBefore > 0) lines.push(padComment(fl.paddingBefore));
      lines.push(
        `${INDENT}${decls[i].padEnd(width)}  // offset ${fl.offset}, size ${fl.size}`
      );
    });

    const last = layout.fields[layout.fields.length - 1];
    const trailing = layout.totalSize - (last.offset + last.size);
    if (trailing > 0) lines.push(padComment(trailing));
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

export function exportCpp(model: StructModel, options: ExportCppOptions = {}): string {
  const withComments = options.comments ?? true;
  const withAsserts = options.asserts ?? true;
  const platform = options.platform ?? DEFAULT_PLATFORM;
  const out: string[] = ["#pragma once"];

  // Nested tanımları önden topla (include kararları ve tanım sırası için gerekli).
  const nestedDefs: StructModel[] = [];
  collectNested(model, nestedDefs, new Set());

  const includes: string[] = [];
  if (needsCstdint(model)) includes.push("#include <cstdint>");
  // offsetof yalnızca static_assert'lerde kullanılır.
  if (withAsserts && needsCstddef(model, nestedDefs)) includes.push("#include <cstddef>");
  if (includes.length > 0) out.push("", ...includes);

  // Bir struct tanımını, (opsiyonel) yerleşim doğrulamasını ve bit yorumlarını ekler.
  // #pragma pack yalnızca tanımı sarar (static_assert'ler pack'ten etkilenmez).
  const pushStruct = (m: StructModel): void => {
    if (m.pack) out.push("", `#pragma pack(push, ${m.pack})`);
    out.push(m.pack ? "" : "", ...formatStruct(m, withComments, platform));
    if (m.pack) out.push("#pragma pack(pop)");
    if (withAsserts) {
      const asserts = formatStaticAsserts(m, platform);
      if (asserts.length > 0) out.push("", ...asserts);
    }
    const bitComments = formatBitComments(m);
    if (bitComments.length > 0) out.push("", ...bitComments);
  };

  // Önce nested struct tanımları (kullanılmadan önce tanımlanmalı), sonra ana struct.
  for (const def of nestedDefs) pushStruct(def);
  pushStruct(model);

  if (withComments) {
    const layout = computeLayout(model, platform);
    out.push(
      "",
      `// sizeof = ${layout.totalSize} bytes, alignment = ${layout.alignment} bytes, padding = ${layout.totalPadding} bytes (${platform})`
    );
  }

  return out.join("\n") + "\n";
}

/** Modeli + hesaplanmış layout metadata'sını yapılandırılmış JSON olarak verir. */
export function exportModelJson(model: StructModel, platform: Platform = DEFAULT_PLATFORM): string {
  const layout = computeLayout(model, platform);
  return JSON.stringify(
    {
      format: "struct-memory-lab",
      version: 1,
      platform,
      struct: model,
      layout: {
        totalSize: layout.totalSize,
        alignment: layout.alignment,
        totalPadding: layout.totalPadding,
        fields: layout.fields.map((f) => ({
          name: f.name,
          type: f.type,
          offset: f.offset,
          size: f.size,
          paddingBefore: f.paddingBefore,
        })),
      },
    },
    null,
    2
  );
}
