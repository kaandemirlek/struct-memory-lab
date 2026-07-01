import { describe, it, expect } from "vitest";
import { computeLayout } from "@/engine/layout";
import { toSegments } from "@/engine/segments";
import type { CppPrimitive, Field, StructModel } from "@/types";

let n = 0;
const field = (type: CppPrimitive, name = `f${n}`, arrayLength = 1): Field => ({
  id: `id${n++}`,
  name,
  type,
  arrayLength,
});
const struct = (...fields: Field[]): StructModel => ({ name: "T", fields });
const seg = (m: StructModel) => toSegments(computeLayout(m));

describe("toSegments", () => {
  it("Player: padding'i ayrı gri bloğa çevirir", () => {
    const s = seg(struct(field("uint32_t", "id"), field("bool", "alive"), field("double", "health")));
    expect(s.map((x) => x.kind)).toEqual(["field", "field", "padding", "field"]);
    // gri blok 5. byte'tan başlar, 3 byte
    expect(s[2]).toMatchObject({ kind: "padding", offset: 5, size: 3 });
    expect(s[3]).toMatchObject({ kind: "field", name: "health", offset: 8, size: 8 });
  });

  it("tail padding'i sona ekler", () => {
    const s = seg(struct(field("uint32_t"), field("bool")));
    // id(0,4) + alive(4,1) → used 5, totalSize 8 → tail padding (5,3)
    expect(s[s.length - 1]).toMatchObject({ kind: "padding", offset: 5, size: 3 });
  });

  it("alanlara kararlı, artan renk indeksi verir", () => {
    const s = seg(struct(field("uint32_t"), field("uint32_t"), field("uint32_t")));
    expect(s.filter((x) => x.kind === "field").map((x) => x.colorIndex)).toEqual([0, 1, 2]);
  });

  it("primitive diziyi ayrı, indekslenmiş eleman segmentlerine böler", () => {
    const s = seg(struct(field("uint16_t", "samples", 3)));
    expect(s).toHaveLength(3);
    expect(s.map((x) => ({
      name: x.name,
      arrayIndex: x.arrayIndex,
      offset: x.offset,
      size: x.size,
      colorIndex: x.colorIndex,
    }))).toEqual([
      { name: "samples", arrayIndex: 0, offset: 0, size: 2, colorIndex: 0 },
      { name: "samples", arrayIndex: 1, offset: 2, size: 2, colorIndex: 0 },
      { name: "samples", arrayIndex: 2, offset: 4, size: 2, colorIndex: 0 },
    ]);
  });

  it("değişmez: segment boyutları toplamı = totalSize", () => {
    const m = struct(field("bool"), field("double"), field("uint16_t", "x", 3));
    const layout = computeLayout(m);
    const total = toSegments(layout).reduce((sum, x) => sum + x.size, 0);
    expect(total).toBe(layout.totalSize);
  });

  it("boş struct: segment yok", () => {
    expect(seg(struct())).toEqual([]);
  });
});
