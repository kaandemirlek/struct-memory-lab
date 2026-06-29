import { describe, it, expect } from "vitest";
import { optimizeStruct } from "@/engine/optimizer";
import { computeLayout } from "@/engine/layout";
import type { CppPrimitive, Field, StructModel } from "@/types";

let n = 0;
const field = (type: CppPrimitive, name = `f${n}`): Field => ({
  id: `id${n++}`,
  name,
  type,
  arrayLength: 1,
});
const struct = (...fields: Field[]): StructModel => ({ name: "T", fields });
const names = (m: StructModel) => m.fields.map((f) => f.name);

describe("optimizeStruct", () => {
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
