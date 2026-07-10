import { describe, it, expect } from "vitest";
import {
  analyzeFieldImpacts,
  analyzeCompatibility,
  generateCompatibilityReport,
  sortWarnings,
  summarizeWarnings,
} from "@/engine/compatibility";
import {
  TYPE_INFO,
  type ComputeLayout,
  type Field,
  type StructModel,
  type Warning,
} from "@/types";

// A deterministic, injectable layout: pack fields sequentially with no padding.
// This keeps these tests about Person B's analysis logic only — independent of
// Person A's real computeLayout.
const packLayout: ComputeLayout = (model) => {
  let offset = 0;
  let alignment = 1;
  const fields = model.fields.map((f) => {
    // nested struct'lar bu mock'ta kullanılmıyor; sadece tip güvenliği için guard.
    const info = f.type === "struct" ? { size: 0, align: 1 } : TYPE_INFO[f.type];
    const size = info.size * Math.max(1, f.arrayLength);
    const entry = {
      fieldId: f.id,
      name: f.name,
      type: f.type,
      offset,
      size,
      paddingBefore: 0,
    };
    offset += size;
    alignment = Math.max(alignment, info.align);
    return entry;
  });
  return { fields, totalSize: offset, alignment, totalPadding: 0 };
};

const f = (
  id: string,
  name: string,
  type: Field["type"],
  arrayLength = 1
): Field => ({
  id,
  name,
  type,
  arrayLength,
});
const struct = (fields: Field[]): StructModel => ({ name: "S", fields });

describe("analyzeCompatibility", () => {
  it("returns no warnings for identical models", () => {
    const a = struct([f("1", "id", "uint32_t")]);
    expect(analyzeCompatibility(a, a, packLayout)).toEqual([]);
  });

  it("flags a shifted field offset as danger", () => {
    const a = struct([f("1", "id", "uint32_t"), f("2", "health", "float")]);
    // Insert a new leading field, pushing id and health forward.
    const b = struct([
      f("3", "flag", "uint8_t"),
      f("1", "id", "uint32_t"),
      f("2", "health", "float"),
    ]);
    const warnings = analyzeCompatibility(a, b, packLayout);
    expect(warnings).toContainEqual({
      severity: "danger",
      message: 'Field "id" moved from offset 0 to 1.',
    });
  });

  it("flags a removed field as danger", () => {
    const a = struct([f("1", "id", "uint32_t"), f("2", "health", "float")]);
    const b = struct([f("1", "id", "uint32_t")]);
    const warnings = analyzeCompatibility(a, b, packLayout);
    expect(warnings).toContainEqual({
      severity: "danger",
      message: 'Field "health" was removed.',
    });
  });

  it("flags size and alignment changes as warnings", () => {
    const a = struct([f("1", "id", "uint32_t")]); // size 4, align 4
    const b = struct([f("1", "id", "uint64_t")]); // size 8, align 8
    const warnings = analyzeCompatibility(a, b, packLayout);
    expect(warnings).toContainEqual({
      severity: "warning",
      message: "Struct size changed from 4 to 8 bytes.",
    });
    expect(warnings).toContainEqual({
      severity: "warning",
      message: "Struct alignment changed from 4 to 8 bytes.",
    });
    // The field stayed at offset 0, so there must be no offset-shift danger.
    expect(warnings.every((w) => w.severity !== "danger")).toBe(true);
  });

  it("flags a shrinking type as a truncation danger", () => {
    const a = struct([f("1", "id", "uint32_t")]);
    const b = struct([f("1", "id", "uint16_t")]);
    const warnings = analyzeCompatibility(a, b, packLayout);
    expect(warnings).toContainEqual({
      severity: "danger",
      message: 'Field "id" (uint32_t → uint16_t) is smaller and may truncate data.',
    });
  });

  it("flags a signedness change as a warning", () => {
    const a = struct([f("1", "n", "int32_t")]);
    const b = struct([f("1", "n", "uint32_t")]);
    const warnings = analyzeCompatibility(a, b, packLayout);
    expect(warnings).toContainEqual({
      severity: "warning",
      message: 'Field "n" changed signedness (int32_t → uint32_t).',
    });
    // Same size and offset: no danger, no size/alignment warning.
    expect(warnings.every((w) => w.severity !== "danger")).toBe(true);
  });

  it("flags an int<->float reinterpretation as a warning", () => {
    const a = struct([f("1", "x", "uint32_t")]);
    const b = struct([f("1", "x", "float")]);
    const warnings = analyzeCompatibility(a, b, packLayout);
    expect(warnings).toContainEqual({
      severity: "warning",
      message: 'Field "x" reinterprets bytes (uint32_t → float).',
    });
  });

  it("reports a widening type change as info", () => {
    const a = struct([f("1", "x", "uint16_t")]);
    const b = struct([f("1", "x", "uint32_t")]);
    const warnings = analyzeCompatibility(a, b, packLayout);
    expect(warnings).toContainEqual({
      severity: "info",
      message: 'Field "x" (uint16_t → uint32_t) is larger.',
    });
  });
  it("notes padding pattern changes with the real layout", () => {
    const a = struct([f("1", "alive", "bool"), f("2", "score", "uint32_t")]);
    const b = struct([f("1", "alive", "bool"), f("2", "score", "uint64_t")]);
    const warnings = analyzeCompatibility(a, b);

    expect(warnings).toContainEqual({
      severity: "info",
      message: 'Padding before field "score" changed from 3 to 7 bytes.',
    });
    expect(warnings).toContainEqual({
      severity: "info",
      message: "Total padding changed from 3 to 7 bytes.",
    });
  });

  // İki ayrı parse (örn. CLI'da iki .hpp) aynı alanlara KESİŞMEYEN id'ler verir;
  // isim fallback'i sayesinde ortak alanlar "silindi" sanılmamalı.
  it("does not flag unchanged fields as removed across two separate parses", () => {
    const a = struct([f("a1", "id", "uint32_t"), f("a2", "alive", "bool")]);
    const b = struct([
      f("b1", "id", "uint32_t"),
      f("b2", "alive", "bool"),
      f("b3", "score", "int64_t"), // sona eklendi — mevcut offset'ler değişmez
    ]);
    const warnings = analyzeCompatibility(a, b, packLayout);
    expect(warnings.filter((w) => w.severity === "danger")).toEqual([]);
    expect(warnings).toContainEqual({
      severity: "warning",
      message: "Struct size changed from 5 to 13 bytes.",
    });
  });
});

describe("generateCompatibilityReport", () => {
  it("marks offset shifts as breaking binary compatibility", () => {
    const a = struct([f("1", "id", "uint32_t"), f("2", "health", "float")]);
    const b = struct([
      f("3", "flag", "uint8_t"),
      f("1", "id", "uint32_t"),
      f("2", "health", "float"),
    ]);

    const report = generateCompatibilityReport(a, b, packLayout);

    expect(report.binaryCompatible).toBe(false);
    expect(report.verdict).toBe("breaking");
    expect(report.breakingChanges).toContainEqual({
      severity: "danger",
      message: 'Field "id" moved from offset 0 to 1.',
    });
  });

  it("keeps binary compatibility true when only warnings are present", () => {
    const a = struct([f("1", "n", "int32_t")]);
    const b = struct([f("1", "n", "uint32_t")]);

    const report = generateCompatibilityReport(a, b, packLayout);

    expect(report.binaryCompatible).toBe(true);
    expect(report.verdict).toBe("risky");
    expect(report.riskWarnings).toHaveLength(1);
    expect(report.riskWarnings[0]).toMatchObject({ severity: "warning" });
    expect(report.riskWarnings[0].message).toContain("changed signedness");
  });
});

describe("analyzeFieldImpacts", () => {
  it("creates badges for added, moved, resized, typed, and downstream fields", () => {
    const a = struct([f("1", "id", "uint32_t"), f("2", "health", "float")]);
    const b = struct([
      f("3", "flag", "uint8_t"),
      f("1", "id", "uint32_t"),
      f("2", "health", "double"),
    ]);

    const byId = new Map(
      analyzeFieldImpacts(a, b, packLayout).map((impact) => [
        impact.fieldId,
        impact.badges.map((badge) => badge.kind),
      ])
    );

    expect(byId.get("3")).toContain("added");
    expect(byId.get("3")).toContain("downstream");
    expect(byId.get("1")).toContain("moved");
    expect(byId.get("2")).toContain("moved");
    expect(byId.get("2")).toContain("resized");
    expect(byId.get("2")).toContain("type-changed");
  });
});

describe("sortWarnings / summarizeWarnings", () => {
  const sample: Warning[] = [
    { severity: "info", message: "i" },
    { severity: "danger", message: "d1" },
    { severity: "warning", message: "w" },
    { severity: "danger", message: "d2" },
  ];

  it("sorts danger first, then warning, then info (stable within a level)", () => {
    expect(sortWarnings(sample).map((w) => w.message)).toEqual([
      "d1",
      "d2",
      "w",
      "i",
    ]);
  });

  it("does not mutate the input array", () => {
    const copy = [...sample];
    sortWarnings(sample);
    expect(sample).toEqual(copy);
  });

  it("counts warnings by severity", () => {
    expect(summarizeWarnings(sample)).toEqual({
      danger: 2,
      warning: 1,
      info: 1,
      total: 4,
    });
  });

  it("summarizes an empty list as all zero", () => {
    expect(summarizeWarnings([])).toEqual({
      danger: 0,
      warning: 0,
      info: 0,
      total: 0,
    });
  });
});
