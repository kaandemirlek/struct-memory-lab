// ============================================================================
// exporter.ts  ← PERSON B
// ============================================================================
// GÖREV: StructModel'i tekrar geçerli bir C++ .hpp metnine çevir.
// (A'nın parser'ının tersi — modeli derinlemesine öğreneceksin.)
//
// Beklenen çıktı:
//   struct Player {
//       uint32_t id;
//       bool alive;
//       double health;
//   };
// Dizi alanlar için:  uint8_t name[16];
// ============================================================================

import type { ExportCpp } from "@/types";

export const exportCpp: ExportCpp = (model) => {
  // TODO (PERSON B): gerçek üretimi yaz (girinti, dizi sözdizimi, vb.).
  const lines = model.fields.map((f) => {
    const arr = f.arrayLength > 1 ? `[${f.arrayLength}]` : "";
    return `    ${f.type} ${f.name}${arr};`;
  });
  return `struct ${model.name} {\n${lines.join("\n")}\n};\n`;
};
