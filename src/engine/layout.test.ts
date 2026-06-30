import { describe, it, expect } from "vitest";
import { computeLayout, alignUp } from "@/engine/layout";
import type { CppPrimitive, Field, StructModel } from "@/types";

// Test'lerde alan üretmeyi kolaylaştıran küçük yardımcı.
//vitest, describe, it, expect fonksiyonlarını import ediyoruz. computeLayout ve alignUp fonksiyonlarını layout.ts'den import ediyoruz. CppPrimitive, Field ve StructModel tiplerini types.ts'den import ediyoruz.

let n = 0;
const field = (type: CppPrimitive, name = `f${n}`, arrayLength = 1): Field => ({
  id: `id${n++}`,
  name,
  type,
  arrayLength,
});
const struct = (...fields: Field[]): StructModel => ({ name: "T", fields });

// Sadece offset'leri okumayı kolaylaştıran yardımcı.
const offsets = (m: StructModel) => computeLayout(m).fields.map((f) => f.offset);

describe("alignUp", () => {
  it("bir sonraki kata yuvarlar, zaten hizalıysa dokunmaz", () => {
    expect(alignUp(0, 8)).toBe(0);
    expect(alignUp(5, 8)).toBe(8);
    expect(alignUp(8, 8)).toBe(8);
    expect(alignUp(9, 8)).toBe(16);
    expect(alignUp(13, 4)).toBe(16);
  });
});

describe("computeLayout", () => {
  it("Player: padding ve tail padding'i doğru hesaplar", () => {
    const m = struct(
      field("uint32_t", "id"), //field fonksiyonu (helper) ile field objesi oluşturuyoruz
      field("bool", "alive"),
      field("double", "health")
    );
    const r = computeLayout(m);

    expect(offsets(m)).toEqual([0, 4, 8]); // health 5→8'e kaydı
    expect(r.fields[2].paddingBefore).toBe(3); // 5,6,7 boşa
    expect(r.totalSize).toBe(16);
    expect(r.alignment).toBe(8); // en büyük: double
    expect(r.totalPadding).toBe(3);
  });

  it("aynı boyutlu alanlar: hiç padding olmaz", () => {
    const m = struct(field("uint32_t"), field("uint32_t"), field("uint32_t"));
    const r = computeLayout(m);
    expect(offsets(m)).toEqual([0, 4, 8]);
    expect(r.totalSize).toBe(12);
    expect(r.totalPadding).toBe(0);
    expect(r.alignment).toBe(4);
  });

  it("alan SIRASI padding miktarını değiştirir (kötü sıralama)", () => {
    // bool, double, bool → çok israf
    const bad = struct(field("bool"), field("double"), field("bool"));
    const r = computeLayout(bad);
    expect(offsets(bad)).toEqual([0, 8, 16]); // double 1→8 (7 pad), son bool @16
    expect(r.totalSize).toBe(24); // 17 → align 8 → 24
    expect(r.totalPadding).toBe(14); // 24 - (1+8+1)
  });

  it("iyi sıralama (büyükten küçüğe) israfı azaltır", () => {
    const good = struct(field("double"), field("bool"), field("bool"));
    const r = computeLayout(good);
    expect(offsets(good)).toEqual([0, 8, 9]); // ara padding yok
    expect(r.totalSize).toBe(16); // 10 → align 8 → 16
    expect(r.totalPadding).toBe(6); // hepsi tail padding
  });

  it("tail padding: son alan struct align'ına yuvarlar", () => {
    const m = struct(field("uint32_t"), field("bool"));
    const r = computeLayout(m);
    expect(r.totalSize).toBe(8); // 5 → align 4 → 8
    expect(r.totalPadding).toBe(3);
  });

  it("dizi alanı: boyut = eleman × uzunluk, hizalama = eleman hizalaması", () => {
    const m = struct(field("uint8_t", "name", 10), field("uint32_t", "score"));
    const r = computeLayout(m);
    expect(r.fields[0].size).toBe(10); // 10 × 1B
    expect(r.fields[0].arrayLength).toBe(10);
    expect(r.fields[0].elementSize).toBe(1);
    expect(offsets(m)).toEqual([0, 12]); // score 10→12 (uint32 align 4)
    expect(r.fields[1].paddingBefore).toBe(2);
    expect(r.totalSize).toBe(16);
    expect(r.alignment).toBe(4);
  });

  it("struct hizalaması = en büyük alan hizalaması", () => {
    expect(computeLayout(struct(field("bool"), field("int64_t"))).alignment).toBe(8);
    expect(computeLayout(struct(field("bool"), field("int16_t"))).alignment).toBe(2);
  });

  it("boş struct: boyut 0, hizalama 1", () => {
    const r = computeLayout(struct());
    expect(r.totalSize).toBe(0);
    expect(r.alignment).toBe(1);
    expect(r.fields).toEqual([]);
  });
});

describe("computeLayout — nested struct", () => {
  const vec3: StructModel = {
    name: "Vec3",
    fields: [
      { id: "x", name: "x", type: "float", arrayLength: 1 },
      { id: "y", name: "y", type: "float", arrayLength: 1 },
      { id: "z", name: "z", type: "float", arrayLength: 1 },
    ],
  };

  it("nested alanın boyutu/hizalaması iç layout'tan (özyineleme) gelir", () => {
    const m: StructModel = {
      name: "Player",
      fields: [
        { id: "id", name: "id", type: "uint32_t", arrayLength: 1 },
        { id: "pos", name: "pos", type: "struct", arrayLength: 1, nested: vec3 },
        { id: "alive", name: "alive", type: "bool", arrayLength: 1 },
      ],
    };
    const r = computeLayout(m);
    expect(r.fields.map((f) => f.offset)).toEqual([0, 4, 16]);
    expect(r.fields[1].size).toBe(12); // Vec3 = 3 × float
    expect(r.fields[1].typeName).toBe("Vec3"); // gösterim etiketi
    expect(r.totalSize).toBe(20); // 17 → align 4 → 20
    expect(r.alignment).toBe(4);
  });

  it("struct dizisi: eleman boyutu = nested totalSize", () => {
    const m: StructModel = {
      name: "Path",
      fields: [{ id: "pts", name: "pts", type: "struct", arrayLength: 3, nested: vec3 }],
    };
    const r = computeLayout(m);
    expect(r.fields[0].size).toBe(36); // 12 × 3
    expect(r.fields[0].arrayLength).toBe(3);
    expect(r.fields[0].elementSize).toBe(12);
    expect(r.totalSize).toBe(36);
  });
});
