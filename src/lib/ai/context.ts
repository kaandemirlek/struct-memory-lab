// ============================================================================
// lib/ai/context.ts — GROUNDING SNAPSHOT BUILDER
// ============================================================================
// Assembles the compact, always-fresh StructContext the assistant is grounded
// on. Everything here comes straight from the deterministic engine — the AI
// only ever reads these numbers, never recomputes them.
// ============================================================================

import { computeLayout } from "@/engine/layout";
import { diffVersions } from "@/engine/diff";
import { generateCompatibilityReport } from "@/engine/compatibility";
import type { ResolvedComparison } from "@/store/useStructStore";
import type { Field, Platform, StructModel, Version } from "@/types";
import { DEFAULT_PLATFORM } from "@/types";
import type { ContextBitField, ContextField, StructContext } from "./types";

/** Field.bitFields → grounding shape, with a human-readable bit range. */
function toContextBits(field: Field): ContextBitField[] | undefined {
  const bits = field.bitFields;
  if (!bits || bits.length === 0) return undefined;
  const isArray = field.arrayLength > 1;
  return bits.map((b) => {
    const end = b.startBit + b.width - 1;
    const range = b.width === 1 ? `bit ${b.startBit}` : `bits ${b.startBit}–${end}`;
    return {
      name: b.name,
      wordIndex: b.wordIndex,
      startBit: b.startBit,
      width: b.width,
      bitRange: isArray ? `word ${b.wordIndex}, ${range}` : range,
      kind: b.kind ?? (b.width === 1 ? "flag" : "uint"),
      meanings:
        b.meanings && b.meanings.length > 0
          ? b.meanings.map((m) => ({ value: m.value, label: m.label }))
          : undefined,
    };
  });
}

export function buildStructContext(
  model: StructModel,
  versions: Version[],
  cmp: ResolvedComparison,
  platform: Platform = DEFAULT_PLATFORM
): StructContext {
  const layout = computeLayout(model, platform);
  const collectFields = (current: StructModel, prefix = ""): ContextField[] => {
    const currentLayout = computeLayout(current, platform);
    return current.fields.flatMap((field, index) => {
      const fl = currentLayout.fields[index];
      const path = prefix ? `${prefix}.${field.name}` : field.name;
      const own: ContextField = {
        name: field.name,
        path,
        type: field.type,
        arrayLength: field.arrayLength,
        offset: fl.offset,
        size: fl.size,
        paddingBefore: fl.paddingBefore,
        bitFields: toContextBits(field),
      };
      return field.nested ? [own, ...collectFields(field.nested, path)] : [own];
    });
  };
  const fields = collectFields(model);

  let comparison: StructContext["comparison"] = null;
  if (cmp.fromModel && cmp.toModel && cmp.fromValue !== cmp.toValue) {
    const report = generateCompatibilityReport(cmp.fromModel, cmp.toModel, (m) =>
      computeLayout(m, platform)
    );
    comparison = {
      fromLabel: cmp.fromLabel,
      toLabel: cmp.toLabel,
      changes: diffVersions(cmp.fromModel, cmp.toModel).map((e) => ({
        kind: e.kind,
        detail: e.detail,
      })),
      verdict: report.verdict,
      warnings: report.warnings.map((w) => w.message),
    };
  }

  return {
    name: model.name,
    fields,
    totalSize: layout.totalSize,
    alignment: layout.alignment,
    totalPadding: layout.totalPadding,
    versions: versions.map((v) => ({
      label: v.label,
      fieldCount: v.model.fields.length,
    })),
    comparison,
  };
}
