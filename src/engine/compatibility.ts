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
  Field,
  Warning,
  WarningSeverity,
} from "@/types";
import { computeLayout } from "@/engine/layout";
import { alignFieldIds } from "@/engine/identity";

type Category = "signed" | "unsigned" | "float" | "bool" | "char" | "struct";

export type CompatibilityVerdict = "compatible" | "risky" | "breaking";

export interface CompatibilityReport {
  binaryCompatible: boolean;
  verdict: CompatibilityVerdict;
  warnings: Warning[];
  summary: WarningSummary;
  breakingChanges: Warning[];
  riskWarnings: Warning[];
  notes: Warning[];
}

export type FieldImpactKind =
  | "added"
  | "moved"
  | "resized"
  | "type-changed"
  | "padding-changed"
  | "downstream";

export interface FieldImpactBadge {
  kind: FieldImpactKind;
  severity: WarningSeverity;
  label: string;
  detail: string;
}

export interface FieldImpact {
  fieldId: string;
  badges: FieldImpactBadge[];
}

function categoryOf(field: Field): Category {
  if (field.type === "struct") return "struct";
  const type = field.type;
  if (type === "float" || type === "double") return "float";
  if (type === "bool") return "bool";
  if (type === "char") return "char";
  if (type === "size_t") return "unsigned"; // size_t işaretsizdir
  // int*_t vs uint*_t
  return type.startsWith("u") ? "unsigned" : "signed";
}

/** Tip imzası, dizi sözdizimi dahil: "uint8_t[16]" / "uint32_t" / "Vec3" (nested). */
function typeSig(field: Field): string {
  const base =
    field.type === "struct" ? field.nested?.name.trim() || "struct" : field.type;
  return field.arrayLength > 1 ? `${base}[${field.arrayLength}]` : base;
}

export const analyzeCompatibility: AnalyzeCompatibility = (
  a,
  b,
  layoutFn = computeLayout
) => {
  // Ayrı parse'lardan gelen modellerde id'ler kesişmez; isim fallback'iyle
  // hizala ki ortak alanlar "silindi" sanılmasın (bkz. engine/identity.ts).
  a = alignFieldIds(a, b);
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
  // Boyutlar layoutFn çıktısından okunur — böylece platform/pack ne olursa olsun
  // gerçek yerleşimle tutarlıdır (TYPE_INFO'ya ayrıca bakmaya gerek kalmaz).
  const aFieldsById = new Map(a.fields.map((f) => [f.id, f]));
  const bFieldsById = new Map(b.fields.map((f) => [f.id, f]));
  for (const [id, fa] of aFieldsById) {
    const fb = bFieldsById.get(id);
    if (!fb) continue; // silme yukarıda ele alındı
    if (fa.type === fb.type && fa.arrayLength === fb.arrayLength) continue;

    const sigA = typeSig(fa);
    const sigB = typeSig(fb);
    const sizeA = beforeById.get(id)?.size ?? 0;
    const sizeB = afterById.get(id)?.size ?? 0;

    if (sizeB < sizeA) {
      warnings.push({
        severity: "danger",
        message: `Field "${fb.name}" (${sigA} → ${sigB}) is smaller and may truncate data.`,
      });
    } else if (sizeB === sizeA && fa.type !== fb.type) {
      const catA = categoryOf(fa);
      const catB = categoryOf(fb);
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

  // Padding pattern changes are useful compatibility clues. computeLayout always
  // realigns fields, so these are notes rather than alignment violations.
  for (const [id, fa] of beforeById) {
    const fb = afterById.get(id);
    if (fb && fa.paddingBefore !== fb.paddingBefore) {
      warnings.push({
        severity: "info",
        message: `Padding before field "${fb.name}" changed from ${fa.paddingBefore} to ${fb.paddingBefore} bytes.`,
      });
    }
  }

  if (before.totalPadding !== after.totalPadding) {
    warnings.push({
      severity: "info",
      message: `Total padding changed from ${before.totalPadding} to ${after.totalPadding} bytes.`,
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

export function generateCompatibilityReport(
  a: Parameters<AnalyzeCompatibility>[0],
  b: Parameters<AnalyzeCompatibility>[1],
  layoutFn = computeLayout
): CompatibilityReport {
  const warnings = sortWarnings(analyzeCompatibility(a, b, layoutFn));
  const summary = summarizeWarnings(warnings);
  const verdict: CompatibilityVerdict =
    summary.danger > 0 ? "breaking" : summary.warning > 0 ? "risky" : "compatible";

  return {
    binaryCompatible: summary.danger === 0,
    verdict,
    warnings,
    summary,
    breakingChanges: warnings.filter((w) => w.severity === "danger"),
    riskWarnings: warnings.filter((w) => w.severity === "warning"),
    notes: warnings.filter((w) => w.severity === "info"),
  };
}

function addBadge(
  badges: FieldImpactBadge[],
  kind: FieldImpactKind,
  severity: WarningSeverity,
  label: string,
  detail: string
) {
  badges.push({ kind, severity, label, detail });
}

export function analyzeFieldImpacts(
  a: Parameters<AnalyzeCompatibility>[0],
  b: Parameters<AnalyzeCompatibility>[1],
  layoutFn = computeLayout
): FieldImpact[] {
  // Rozetler b'nin (after) id'leriyle anahtarlanır; hizalama base tarafında
  // yapıldığı için b'nin id'leri değişmez (bkz. engine/identity.ts).
  a = alignFieldIds(a, b);
  const before = layoutFn(a);
  const after = layoutFn(b);
  const beforeById = new Map(before.fields.map((f) => [f.fieldId, f]));
  const beforeFieldsById = new Map(a.fields.map((f) => [f.id, f]));
  const afterFieldsById = new Map(b.fields.map((f) => [f.id, f]));

  const laterCommonFieldMoved = (afterIndex: number) =>
    after.fields.slice(afterIndex + 1).some((f) => {
      const prev = beforeById.get(f.fieldId);
      return prev && prev.offset !== f.offset;
    });

  const impacts: FieldImpact[] = [];

  after.fields.forEach((fb, index) => {
    const beforeLayout = beforeById.get(fb.fieldId);
    const beforeField = beforeFieldsById.get(fb.fieldId);
    const afterField = afterFieldsById.get(fb.fieldId);
    const badges: FieldImpactBadge[] = [];

    if (!beforeLayout || !beforeField || !afterField) {
      addBadge(
        badges,
        "added",
        "info",
        "New",
        `Field "${fb.name}" does not exist in the compared base version.`
      );
    } else {
      if (beforeLayout.offset !== fb.offset) {
        addBadge(
          badges,
          "moved",
          "danger",
          `Moved ${beforeLayout.offset}->${fb.offset}`,
          `Field "${fb.name}" moved from offset ${beforeLayout.offset} to ${fb.offset}.`
        );
      }

      if (beforeLayout.size !== fb.size) {
        addBadge(
          badges,
          "resized",
          beforeLayout.size > fb.size ? "danger" : "info",
          `Size ${beforeLayout.size}->${fb.size}`,
          `Field "${fb.name}" size changed from ${beforeLayout.size} to ${fb.size} bytes.`
        );
      }

      if (
        beforeField.type !== afterField.type ||
        beforeField.arrayLength !== afterField.arrayLength
      ) {
        addBadge(
          badges,
          "type-changed",
          beforeLayout.size > fb.size ? "danger" : "warning",
          "Type",
          `Field "${fb.name}" type changed from ${typeSig(beforeField)} to ${typeSig(afterField)}.`
        );
      }

      if (beforeLayout.paddingBefore !== fb.paddingBefore) {
        addBadge(
          badges,
          "padding-changed",
          "info",
          `Pad ${beforeLayout.paddingBefore}->${fb.paddingBefore}`,
          `Padding before "${fb.name}" changed from ${beforeLayout.paddingBefore} to ${fb.paddingBefore} bytes.`
        );
      }
    }

    const oldEnd = beforeLayout ? beforeLayout.offset + beforeLayout.size : null;
    const newEnd = fb.offset + fb.size;
    if (badges.length > 0 && oldEnd !== newEnd && laterCommonFieldMoved(index)) {
      addBadge(
        badges,
        "downstream",
        "warning",
        "Affects later",
        `The byte range for "${fb.name}" changed, and later fields moved as a result.`
      );
    }

    if (badges.length > 0) impacts.push({ fieldId: fb.fieldId, badges });
  });

  return impacts;
}
