// ============================================================================
// bitfields.ts  ← Person A / shared   (Faz 1: saf mantık, test edilebilir)
// ============================================================================
// Status word / telemetri alanları için bit seviyesinde semantik yorum.
// ÖNEMLİ: bu katman fiziksel yerleşimi (computeLayout) DEĞİŞTİRMEZ; sadece
// integer byte'larının bit bazında ne anlama geldiğini tanımlar.
//
// Burada yalnızca SAF analiz var (engellemez, uyarı üretir):
//   • Overlap            — aynı word'de iki bit alanı çakışıyor
//   • Out of bounds (word)— wordIndex dizi/word sayısının dışında
//   • Out of bounds (bit) — startBit word genişliğinin dışında
//   • Word boundary       — startBit + width word sınırını aşıyor
// Versiyon bazlı (taşındı / anlam değişti) uyarıları Person B'nin
// compatibility'sinde ele alınacak (Faz 4).
// ============================================================================

import type { BitFieldKind, CppPrimitive, Field, StructModel, Warning } from "@/types";
import { TYPE_INFO } from "@/types";

/** Bir bit-tipi seçilince önerilen varsayılan genişlik (kullanıcı sonra kırpar). */
export function defaultWidthForKind(kind: BitFieldKind): number {
  switch (kind) {
    case "flag":
      return 1;
    case "enum":
      return 2;
    default:
      return 4; // uint / int
  }
}

const UNSIGNED_INTS = new Set<CppPrimitive>([
  "uint8_t",
  "uint16_t",
  "uint32_t",
  "uint64_t",
]);

/** Bit alanları yalnızca unsigned integer tiplerde anlamlıdır. */
export function isUnsignedInt(type: Field["type"]): boolean {
  return type !== "struct" && UNSIGNED_INTS.has(type);
}

/** Bir alanın tek bir word'ünün bit genişliği (uint32_t → 32). struct → 0. */
export function bitsPerWord(field: Field): number {
  if (field.type === "struct") return 0;
  return TYPE_INFO[field.type].size * 8;
}

/** Alandaki word sayısı (tekil = 1, dizi = arrayLength). */
export function wordCount(field: Field): number {
  return Math.max(1, field.arrayLength);
}

/** Tek bir alanın bit alanları için uyarılar (saf). */
export function bitWarningsForField(field: Field): Warning[] {
  const bits = field.bitFields;
  if (!bits || bits.length === 0) return [];

  if (!isUnsignedInt(field.type)) {
    return [
      {
        severity: "warning",
        message: `"${field.name}": bit fields are only meaningful on unsigned integer types (currently ${field.type}).`,
      },
    ];
  }

  const out: Warning[] = [];
  const bpw = bitsPerWord(field);
  const words = wordCount(field);

  // Sınır kontrolleri (her bit alanı için).
  for (const b of bits) {
    if (b.width < 1) {
      out.push({ severity: "danger", message: `"${b.name}": bit width must be at least 1.` });
    }
    if (b.wordIndex < 0 || b.wordIndex >= words) {
      out.push({
        severity: "danger",
        message: `Out of bounds: "${b.name}" uses word ${b.wordIndex} but only words 0..${words - 1} exist.`,
      });
    }
    if (b.startBit < 0 || b.startBit >= bpw) {
      out.push({
        severity: "danger",
        message: `Out of bounds: "${b.name}" starts at bit ${b.startBit} but the word is ${bpw} bits wide.`,
      });
    } else if (b.width >= 1 && b.startBit + b.width > bpw) {
      out.push({
        severity: "danger",
        message: `Word boundary crossing: "${b.name}" spans bits ${b.startBit}..${b.startBit + b.width - 1} but the word is ${bpw} bits.`,
      });
    }
  }

  // Değer anlamları (meanings) bit alanının genişlik + tipine sığıyor mu?
  //   uint/enum/flag → 0..2^w-1 ;  int (signed, ikinin tümleyeni) → -2^(w-1)..2^(w-1)-1
  for (const b of bits) {
    if (!b.meanings || b.meanings.length === 0) continue;
    if (b.width < 1 || b.width > 30) continue; // Math.pow taşmasına karşı makul sınır
    const kind = b.kind ?? (b.width === 1 ? "flag" : "uint");
    let min = 0;
    let max = Math.pow(2, b.width) - 1;
    if (kind === "int") {
      min = -Math.pow(2, b.width - 1);
      max = Math.pow(2, b.width - 1) - 1;
    }
    for (const m of b.meanings) {
      if (m.value < min || m.value > max) {
        out.push({
          severity: "warning",
          message: `"${b.name}": value ${m.value} (${m.label}) does not fit a ${b.width}-bit ${kind} field (allowed ${min}..${max}).`,
        });
      }
    }
  }

  // Çakışma (overlap) — aynı word içindeki bit aralıkları kesişiyor mu.
  for (let i = 0; i < bits.length; i++) {
    for (let j = i + 1; j < bits.length; j++) {
      const a = bits[i];
      const c = bits[j];
      if (a.wordIndex !== c.wordIndex) continue;
      const aEnd = a.startBit + a.width;
      const cEnd = c.startBit + c.width;
      if (a.startBit < cEnd && c.startBit < aEnd) {
        out.push({
          severity: "danger",
          message: `Overlap: "${a.name}" and "${c.name}" use the same bits in word ${a.wordIndex}.`,
        });
      }
    }
  }

  return out;
}

/** Modeldeki tüm alanların bit alanı uyarıları (nested struct'lara özyinelemeli iner). */
export function analyzeBitWarnings(model: StructModel): Warning[] {
  return model.fields.flatMap((f) => [
    ...bitWarningsForField(f),
    ...(f.type === "struct" && f.nested ? analyzeBitWarnings(f.nested) : []),
  ]);
}
