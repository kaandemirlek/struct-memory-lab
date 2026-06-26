import { describe, it, expect } from "vitest";
import { analyzeCompatibility } from "@/engine/compatibility";
import { TYPE_INFO, type ComputeLayout, type Field, type StructModel } from "@/types";

// A deterministic, injectable layout: pack fields sequentially with no padding.
// This keeps these tests about Person B's analysis logic only — independent of
// Person A's real computeLayout.
const packLayout: ComputeLayout = (model) => {
  let offset = 0;
  let alignment = 1;
  const fields = model.fields.map((f) => {
    const info = TYPE_INFO[f.type];
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

const f = (id: string, name: string, type: Field["type"]): Field => ({
  id,
  name,
  type,
  arrayLength: 1,
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
});
