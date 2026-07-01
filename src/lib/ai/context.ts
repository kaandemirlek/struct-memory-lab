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
import type { StructModel, Version } from "@/types";
import type { ContextField, StructContext } from "./types";

export function buildStructContext(
  model: StructModel,
  versions: Version[],
  cmp: ResolvedComparison
): StructContext {
  const layout = computeLayout(model);
  const arrayLenById = new Map(model.fields.map((f) => [f.id, f.arrayLength]));

  const fields: ContextField[] = layout.fields.map((fl) => ({
    name: fl.name,
    type: fl.type,
    arrayLength: arrayLenById.get(fl.fieldId) ?? 1,
    offset: fl.offset,
    size: fl.size,
    paddingBefore: fl.paddingBefore,
  }));

  let comparison: StructContext["comparison"] = null;
  if (cmp.fromModel && cmp.toModel && cmp.fromValue !== cmp.toValue) {
    const report = generateCompatibilityReport(cmp.fromModel, cmp.toModel);
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
