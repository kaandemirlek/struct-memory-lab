import { describe, it, expect } from "vitest";
import { computeLayout } from "@/engine/layout";
import { wrapIntoWords } from "@/engine/words";
import type { CppPrimitive, Field, StructModel } from "@/types";

let n = 0;
const field = (type: CppPrimitive, name = `f${n}`, arrayLength = 1): Field => ({
  id: `id${n++}`,
  name,
  type,
  arrayLength,
});
const struct = (...fields: Field[]): StructModel => ({ name: "T", fields });
const rows = (m: StructModel, w: number) => wrapIntoWords(computeLayout(m), w);

describe("wrapIntoWords", () => {
  it("Player'ı 8 byte'lık tek word'e sığdırır", () => {
    // id(0-3) alive(4) pad(5-7) health(8-15) → size 16, 2 word
    const r = rows(struct(field("uint32_t", "id"), field("bool", "alive"), field("double", "health")), 8);
    expect(r).toHaveLength(2);
    expect(r[0].cells.map((c) => c.name ?? c.kind)).toEqual(["id", "alive", "padding"]);
    expect(r[1].cells.map((c) => c.name ?? c.kind)).toEqual(["health"]);
  });

  it("word sınırını aşan alanı satırlara böler ve devamını isaretler", () => {
    // tek double, word=4 → 2 word'e yayılır
    const r = rows(struct(field("double", "d")), 4);
    expect(r).toHaveLength(2);
    expect(r[0].cells[0]).toMatchObject({ name: "d", span: 4, isStart: true });
    expect(r[1].cells[0]).toMatchObject({ name: "d", span: 4, isStart: false }); // devam parçası
  });

  it("her cell'in span toplamı = totalSize (değişmez)", () => {
    const m = struct(field("bool"), field("double"), field("uint16_t", "x", 3));
    const layout = computeLayout(m);
    const total = wrapIntoWords(layout, 8).flatMap((row) => row.cells).reduce((s, c) => s + c.span, 0);
    expect(total).toBe(layout.totalSize);
  });

  it("boş struct: tek boş word", () => {
    const r = rows(struct(), 8);
    expect(r).toHaveLength(1);
    expect(r[0].cells).toEqual([]);
  });

  it("word başlangıç offset'leri wordSize'ın katı", () => {
    const r = rows(struct(field("uint32_t"), field("uint32_t"), field("uint32_t"), field("uint32_t")), 8);
    expect(r.map((x) => x.startByte)).toEqual([0, 8]); // 16 byte / 8 = 2 word
  });
});
