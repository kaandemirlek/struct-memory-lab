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

  if (needsCstdint(model)) {
    out.push("", "#include <cstdint>");
  }

  // Önce nested struct tanımları (kullanılmadan önce tanımlanmalı), sonra ana struct.
  const nestedDefs: StructModel[] = [];
  collectNested(model, nestedDefs, new Set());
  for (const def of nestedDefs) out.push("", ...formatStruct(def));
  out.push("", ...formatStruct(model));

  // Dosyalar tek bir sondaki yeni satırla biter (POSIX konvansiyonu).
  return out.join("\n") + "\n";
};
