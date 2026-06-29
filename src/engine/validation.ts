// ============================================================================
// validation.ts  ← PERSON B (paylaşılan saf yardımcı)
// ============================================================================
// GÖREV: Bir StructModel'in geçerli C++'a dönüşüp dönüşemeyeceğini kontrol et.
//   • struct adı boş / geçersiz identifier mı?
//   • alan adı boş / geçersiz identifier mı?
//   • yinelenen alan adı var mı?
//   • dizi uzunluğu geçerli (>= 1 tamsayı) mı?
//
// Saf ve deterministik → kolayca test edilir. Hem export (B) hem de ileride
// FieldEditor (A) bu fonksiyonu kullanarak inline hata gösterebilir.
// ============================================================================

import type { StructModel } from "@/types";

export interface ValidationIssue {
  /** İlgili alanın id'si (alan bazlı hatalarda). Genel hatalarda boş. */
  fieldId?: string;
  message: string;
}

// Geçerli bir C++ identifier: harf/alt çizgi ile başlar, harf/rakam/alt çizgi devam.
const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;

export function validateStruct(model: StructModel): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // Struct adı
  const structName = model.name.trim();
  if (!structName) {
    issues.push({ message: "Struct name is required." });
  } else if (!IDENTIFIER.test(structName)) {
    issues.push({
      message: `Struct name "${model.name}" is not a valid C++ identifier.`,
    });
  }

  // Alanlar
  const nameCounts = new Map<string, number>();
  for (const field of model.fields) {
    const fieldName = field.name.trim();

    if (!fieldName) {
      issues.push({ fieldId: field.id, message: "Field name is required." });
    } else if (!IDENTIFIER.test(fieldName)) {
      issues.push({
        fieldId: field.id,
        message: `Field name "${field.name}" is not a valid C++ identifier.`,
      });
      nameCounts.set(fieldName, (nameCounts.get(fieldName) ?? 0) + 1);
    } else {
      nameCounts.set(fieldName, (nameCounts.get(fieldName) ?? 0) + 1);
    }

    if (!Number.isInteger(field.arrayLength) || field.arrayLength < 1) {
      issues.push({
        fieldId: field.id,
        message: `Field "${field.name}" has an invalid array length.`,
      });
    }
  }

  // Yinelenen alan adları
  for (const [name, count] of nameCounts) {
    if (count > 1) {
      issues.push({ message: `Duplicate field name "${name}".` });
    }
  }

  return issues;
}
