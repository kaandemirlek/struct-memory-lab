// ============================================================================
// compatibility.ts  ← PERSON B
// ============================================================================
// GÖREV: İki versiyon arası TEHLİKELİ değişiklikleri tespit et → Warning[].
//
// Yapısal (layout) kuralları:
//   • Ortak bir alanın offset'i kaydıysa            → danger (binary kırar)
//   • Bir alan tamamen silindiyse                    → danger
//   • Toplam boyut (sizeof) değiştiyse               → warning
//   • Struct hizalaması (alignment) değiştiyse       → warning
//
// Alan-bazlı tip kuralları (aynı id'li ortak alanlar):
//   • Tip/dizi küçüldü (truncation)                  → danger (veri kaybı)
//   • Aynı boyut, float<->tamsayı reinterpret        → warning (bitler değişir)
//   • Aynı boyut, signed<->unsigned                  → warning (işaret değişir)
//   • Tip büyüdü (widening)                          → info
//
// A'nın gerçek computeLayout'unu kullanır; çağıran isterse 3. argümanla kendi
// layout fonksiyonunu geçebilir.
// ============================================================================

import type {
  AnalyzeCompatibility,
  CppPrimitive,
  Warning,
  WarningSeverity,
} from "@/types";
import { TYPE_INFO } from "@/types";
import { computeLayout } from "@/engine/layout";

type Category = "signed" | "unsigned" | "float" | "bool" | "char";

function categoryOf(type: CppPrimitive): Category {
  if (type === "float" || type === "double") return "float";
  if (type === "bool") return "bool";
  if (type === "char") return "char";
  // int*_t vs uint*_t
  return type.startsWith("u") ? "unsigned" : "signed";
}

/** Tip imzası, dizi sözdizimi dahil: "uint8_t[16]" ya da "uint32_t". */
function typeSig(type: CppPrimitive, arrayLength: number): string {
  return arrayLength > 1 ? `${type}[${arrayLength}]` : type;
}

/** Alanın toplam byte boyutu (dizi dahil). */
function byteSize(type: CppPrimitive, arrayLength: number): number {
  return TYPE_INFO[type].size * Math.max(1, arrayLength);
}

export const analyzeCompatibility: AnalyzeCompatibility = (
  a,
  b,
  layoutFn = computeLayout
) => {
  const warnings: Warning[] = [];
  const before = layoutFn(a);
  const after = layoutFn(b);

  const beforeById = new Map(before.fields.map((f) => [f.fieldId, f]));
  const afterById = new Map(after.fields.map((f) => [f.fieldId, f]));

  // Ortak alanlarda offset kayması — serileştirme/binary okuyucuları kırar.
  for (const [id, fa] of beforeById) {
    const fb = afterById.get(id);
    if (fb && fa.offset !== fb.offset) {
      warnings.push({
        severity: "danger",
        message: `Field "${fb.name}" moved from offset ${fa.offset} to ${fb.offset}.`,
      });
    }
  }

  // Silinen alanlar — o alanı okuyan kod kırılır.
  for (const [id, fa] of beforeById) {
    if (!afterById.has(id)) {
      warnings.push({
        severity: "danger",
        message: `Field "${fa.name}" was removed.`,
      });
    }
  }

  // Alan-bazlı tip/boyut değişimleri (truncation / reinterpret / signedness / widening).
  const aFieldsById = new Map(a.fields.map((f) => [f.id, f]));
  const bFieldsById = new Map(b.fields.map((f) => [f.id, f]));
  for (const [id, fa] of aFieldsById) {
    const fb = bFieldsById.get(id);
    if (!fb) continue; // silme yukarıda ele alındı
    if (fa.type === fb.type && fa.arrayLength === fb.arrayLength) continue;

    const sigA = typeSig(fa.type, fa.arrayLength);
    const sigB = typeSig(fb.type, fb.arrayLength);
    const sizeA = byteSize(fa.type, fa.arrayLength);
    const sizeB = byteSize(fb.type, fb.arrayLength);

    if (sizeB < sizeA) {
      warnings.push({
        severity: "danger",
        message: `Field "${fb.name}" (${sigA} → ${sigB}) is smaller and may truncate data.`,
      });
    } else if (sizeB === sizeA && fa.type !== fb.type) {
      const catA = categoryOf(fa.type);
      const catB = categoryOf(fb.type);
      if (catA !== catB && (catA === "float" || catB === "float")) {
        warnings.push({
          severity: "warning",
          message: `Field "${fb.name}" reinterprets bytes (${sigA} → ${sigB}).`,
        });
      } else if (
        (catA === "signed" && catB === "unsigned") ||
        (catA === "unsigned" && catB === "signed")
      ) {
        warnings.push({
          severity: "warning",
          message: `Field "${fb.name}" changed signedness (${sigA} → ${sigB}).`,
        });
      } else {
        warnings.push({
          severity: "info",
          message: `Field "${fb.name}" changed type (${sigA} → ${sigB}).`,
        });
      }
    } else if (sizeB > sizeA) {
      warnings.push({
        severity: "info",
        message: `Field "${fb.name}" (${sigA} → ${sigB}) is larger.`,
      });
    }
  }

  // Toplam boyut değişimi — dosya/buffer boyutu varsayımlarını bozar.
  if (before.totalSize !== after.totalSize) {
    warnings.push({
      severity: "warning",
      message: `Struct size changed from ${before.totalSize} to ${after.totalSize} bytes.`,
    });
  }

  // Hizalama değişimi — dizilerde/ABI'de hizalama sorunlarına yol açabilir.
  if (before.alignment !== after.alignment) {
    warnings.push({
      severity: "warning",
      message: `Struct alignment changed from ${before.alignment} to ${after.alignment} bytes.`,
    });
  }

  return warnings;
};

// ----------------------------------------------------------------------------
// Uyarı özetleme / sıralama — paneli "bakışta okunur" yapmak için.
// ----------------------------------------------------------------------------

/** En tehlikeliden en zararsıza doğru sıralama anahtarı. */
export const SEVERITY_ORDER: Record<WarningSeverity, number> = {
  danger: 0,
  warning: 1,
  info: 2,
};

/** Uyarıları önem sırasına göre sıralar (danger → warning → info). Kararlı. */
export function sortWarnings(warnings: Warning[]): Warning[] {
  return [...warnings].sort(
    (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]
  );
}

export interface WarningSummary {
  danger: number;
  warning: number;
  info: number;
  total: number;
}

/** Uyarıları önem derecesine göre sayar (üstteki tek satırlık "verdict" için). */
export function summarizeWarnings(warnings: Warning[]): WarningSummary {
  const summary: WarningSummary = {
    danger: 0,
    warning: 0,
    info: 0,
    total: warnings.length,
  };
  for (const w of warnings) summary[w.severity]++;
  return summary;
}
