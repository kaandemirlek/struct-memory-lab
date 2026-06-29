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

/** Struct herhangi bir *_t tipi kullanıyorsa <cstdint> eklememiz gerekir. */
function needsCstdint(model: StructModel): boolean {
  return model.fields.some((f) => CSTDINT_TYPES.has(f.type));
}

/** Tek bir alanı C++ satırına çevirir:  "    uint8_t name[16];" */
function formatField(field: Field): string {
  // arrayLength yalnızca 1'den büyükse dizi sözdizimi yaz.
  const suffix = field.arrayLength > 1 ? `[${field.arrayLength}]` : "";
  return `${INDENT}${field.type} ${field.name}${suffix};`;
}

export const exportCpp: ExportCpp = (model) => {
  const structName = model.name.trim() || "Struct"; // boş isimde geçerli C++ üret
  const lines: string[] = ["#pragma once"];

  if (needsCstdint(model)) {
    lines.push("", "#include <cstdint>");
  }

  lines.push("", `struct ${structName} {`);

  if (model.fields.length === 0) {
    lines.push(`${INDENT}// (alan yok)`);
  } else {
    for (const field of model.fields) {
      lines.push(formatField(field));
    }
  }

  lines.push("};");

  // Dosyalar tek bir sondaki yeni satırla biter (POSIX konvansiyonu).
  return lines.join("\n") + "\n";
};
