import { describe, it, expect } from "vitest";
import { optimizeLayout } from "@/engine/optimizer";
import { TYPE_INFO, type ComputeLayout, type Field, type StructModel } from "@/types";

const alignUp = (value: number, align: number) => Math.ceil(value / align) * align;

// An alignment-aware layout (with padding) so we can verify real byte savings.
const realLayout: ComputeLayout = (model) => {
  let offset = 0;
  let alignment = 1;
  const fields = model.fields.map((f) => {
    const info = TYPE_INFO[f.type];
    const size = info.size * Math.max(1, f.arrayLength);
    const aligned = alignUp(offset, info.align);
    const entry = {
      fieldId: f.id,
      name: f.name,
      type: f.type,
      offset: aligned,
      size,
      paddingBefore: aligned - offset,
    };
    offset = aligned + size;
    alignment = Math.max(alignment, info.align);
    return entry;
  });
  const totalSize = alignUp(offset, alignment);
  const used = fields.reduce((s, f) => s + f.size, 0);
  return { fields, totalSize, alignment, totalPadding: totalSize - used };
};

const f = (
  id: string,
  name: string,
  type: Field["type"],
  arrayLength = 1
): Field => ({ id, name, type, arrayLength });
const struct = (fields: Field[]): StructModel => ({ name: "S", fields });

describe("optimizeLayout", () => {
  it("orders fields by alignment descending", () => {
    const model = struct([
      f("1", "a", "bool"),
      f("2", "b", "double"),
      f("3", "c", "bool"),
      f("4", "d", "double"),
    ]);
    const result = optimizeLayout(model, realLayout);
    expect(result.optimizedModel.fields.map((x) => x.name)).toEqual([
      "b",
      "d",
      "a",
      "c",
    ]);
  });

  it("reports the bytes saved by reordering", () => {
    const model = struct([
      f("1", "a", "bool"),
      f("2", "b", "double"),
      f("3", "c", "bool"),
      f("4", "d", "double"),
    ]);
    const result = optimizeLayout(model, realLayout);
    expect(result.currentSize).toBe(32);
    expect(result.optimizedSize).toBe(24);
    expect(result.bytesSaved).toBe(8);
  });

  it("reports no savings for an already-optimal struct", () => {
    const model = struct([f("1", "b", "double"), f("2", "a", "bool")]);
    const result = optimizeLayout(model, realLayout);
    expect(result.bytesSaved).toBe(0);
  });

  it("does not mutate the original model", () => {
    const model = struct([f("1", "a", "bool"), f("2", "b", "double")]);
    optimizeLayout(model, realLayout);
    expect(model.fields.map((x) => x.name)).toEqual(["a", "b"]);
  });
});
