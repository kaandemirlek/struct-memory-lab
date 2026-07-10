import { describe, it, expect } from "vitest";
import { alignFieldIds } from "@/engine/identity";
import type { Field, StructModel } from "@/types";

const f = (
  id: string,
  name: string,
  type: Field["type"] = "uint32_t",
  arrayLength = 1
): Field => ({ id, name, type, arrayLength });

const struct = (fields: Field[]): StructModel => ({ name: "S", fields });

describe("alignFieldIds", () => {
  it("returns base unchanged when all ids already match", () => {
    const base = struct([f("1", "id"), f("2", "hp")]);
    const target = struct([f("1", "id"), f("2", "hp")]);
    expect(alignFieldIds(base, target)).toBe(base); // aynı referans — kopya yok
  });

  it("adopts target ids by name when no ids overlap (two separate parses)", () => {
    const base = struct([f("a1", "id"), f("a2", "alive", "bool")]);
    const target = struct([f("b1", "id"), f("b2", "alive", "bool")]);
    const aligned = alignFieldIds(base, target);
    expect(aligned.fields.map((x) => x.id)).toEqual(["b1", "b2"]);
    // girdiler mutasyona uğramaz
    expect(base.fields.map((x) => x.id)).toEqual(["a1", "a2"]);
  });

  it("prefers id matches over name matches", () => {
    // "1" her iki tarafta da var ama isimleri farklı (uygulama içi rename):
    // id eşleşmesi kazanmalı, isim fallback'i bu alanlara dokunmamalı.
    const base = struct([f("1", "health", "float")]);
    const target = struct([f("1", "hp", "float"), f("2", "health", "float")]);
    const aligned = alignFieldIds(base, target);
    expect(aligned.fields[0].id).toBe("1");
  });

  it("leaves unmatched base fields alone (real removals stay removals)", () => {
    const base = struct([f("a1", "id"), f("a2", "legacy")]);
    const target = struct([f("b1", "id")]);
    const aligned = alignFieldIds(base, target);
    expect(aligned.fields.map((x) => x.id)).toEqual(["b1", "a2"]);
  });

  it("skips ambiguous duplicate names in the target", () => {
    const base = struct([f("a1", "dup")]);
    const target = struct([f("b1", "dup"), f("b2", "dup")]);
    const aligned = alignFieldIds(base, target);
    expect(aligned.fields[0].id).toBe("a1"); // belirsiz → dokunma
  });

  it("pairs each target field at most once", () => {
    // base'te aynı isimli iki alan (geçersiz ama düzenleme sırasında mümkün):
    // target'taki tek eş yalnızca ilkine verilmeli.
    const base = struct([f("a1", "dup"), f("a2", "dup")]);
    const target = struct([f("b1", "dup")]);
    const aligned = alignFieldIds(base, target);
    expect(aligned.fields.map((x) => x.id)).toEqual(["b1", "a2"]);
  });
});
