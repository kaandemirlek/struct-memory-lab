import { describe, it, expect } from "vitest";
import { optimizeLayout, optimizeStruct } from "@/engine/optimizer";
import { computeLayout } from "@/engine/layout";
import {
  TYPE_INFO,
  type ComputeLayout,
  type CppPrimitive,
  type Field,
  type StructModel,
} from "@/types";

describe("optimizeLayout (sizes + savings)", () => {
  const alignUp = (value: number, align: number) => Math.ceil(value / align) * align;

  // An alignment-aware layout (with padding) so we can verify real byte savings.
  const realLayout: ComputeLayout = (model) => {
    let offset = 0;
    let alignment = 1;
    const fields = model.fields.map((f) => {
      // nested struct'lar bu mock'ta kullanılmıyor; sadece tip güvenliği için guard.
      const info = f.type === "struct" ? { size: 0, align: 1 } : TYPE_INFO[f.type];
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

describe("optimizeStruct (reordering)", () => {
  let n = 0;
  const field = (type: CppPrimitive, name = `f${n}`): Field => ({
    id: `id${n++}`,
    name,
    type,
    arrayLength: 1,
  });
  const struct = (...fields: Field[]): StructModel => ({ name: "T", fields });
  const names = (m: StructModel) => m.fields.map((f) => f.name);

  it("alanları hizalamaya göre büyükten küçüğe dizer", () => {
    const m = struct(field("bool", "a"), field("double", "b"), field("uint16_t", "c"));
    expect(names(optimizeStruct(m))).toEqual(["b", "c", "a"]); // 8, 2, 1
  });

  it("padding'i azaltır (asıl amaç)", () => {
    const m = struct(field("bool"), field("double"), field("bool"));
    const before = computeLayout(m).totalPadding; // 14
    const after = computeLayout(optimizeStruct(m)).totalPadding; // 6
    expect(after).toBeLessThan(before);
  });

  it("aynı hizalamadakilerin sırasını korur (stabil)", () => {
    const m = struct(field("uint32_t", "x"), field("uint32_t", "y"), field("uint32_t", "z"));
    expect(names(optimizeStruct(m))).toEqual(["x", "y", "z"]);
  });

  it("özgün modeli mutasyona uğratmaz", () => {
    const m = struct(field("bool", "a"), field("double", "b"));
    optimizeStruct(m);
    expect(names(m)).toEqual(["a", "b"]); // değişmedi
  });

  it("hiçbir alanı kaybetmez/eklemez", () => {
    const m = struct(field("bool"), field("double"), field("uint16_t"), field("char"));
    expect(optimizeStruct(m).fields).toHaveLength(4);
  });
});
