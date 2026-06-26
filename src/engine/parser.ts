// ============================================================================
// parser.ts  ← PERSON A
// ============================================================================
// GÖREV: Yapıştırılan C++ struct metnini okuyup StructModel üret.
// Önce sabit genişlikli tiplerle başla (uint32_t, bool, float, double, ...).
//
// Örnek girdi:
//   struct Player {
//       uint32_t id;
//       bool alive;
//       double health;
//   };
// ============================================================================

import type { ParseCpp } from "@/types";
import { makeId } from "@/store/useStructStore";

export const parseCpp: ParseCpp = (code) => {
  // TODO (PERSON A): gerçek parse mantığını yaz.
  //  1. "struct <isim> { ... }" bloğunu yakala (regex iyi bir başlangıç).
  //  2. Her satırı "<tip> <isim>;" veya "<tip> <isim>[N];" olarak ayrıştır.
  //  3. Tipi CppPrimitive ile doğrula, dizi uzunluğunu çıkar.
  //  4. Her alana makeId("f") ile stabil bir id ver.
  //
  // Şimdilik boş bir iskelet döndürüyoruz ki uygulama çökmeden çalışsın.
  void code;
  return {
    name: "Parsed",
    fields: [
      { id: makeId("f"), name: "TODO_parseCpp", type: "int32_t", arrayLength: 1 },
    ],
  };
};
