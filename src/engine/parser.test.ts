import { describe, it, expect } from "vitest";
import { parseCpp } from "@/engine/parser";

describe("parseCpp", () => {
  it("Player struct'ını isim ve alanlarıyla çözümler", () => {
    const m = parseCpp(`struct Player {
      uint32_t id;
      bool alive;
      double health;
    };`);

    expect(m.name).toBe("Player");
    expect(m.fields.map((f) => f.name)).toEqual(["id", "alive", "health"]);
    expect(m.fields.map((f) => f.type)).toEqual(["uint32_t", "bool", "double"]);
    expect(m.fields.every((f) => f.arrayLength === 1)).toBe(true);
    expect(m.fields.every((f) => f.id.length > 0)).toBe(true); // her alanın id'si var
  });

  it("dizi alanını ([N]) doğru okur", () => {
    const m = parseCpp(`struct S { uint8_t name[16]; uint32_t score; };`);
    expect(m.fields[0]).toMatchObject({ name: "name", type: "uint8_t", arrayLength: 16 });
    expect(m.fields[1].arrayLength).toBe(1);
  });

  it("yorumları (// ve /* */) yok sayar", () => {
    const m = parseCpp(`
      // oyuncu durumu
      struct P {
        uint32_t id;   // benzersiz kimlik
        /* sağlık
           puanı */
        double health;
      };`);
    expect(m.fields.map((f) => f.name)).toEqual(["id", "health"]);
  });

  it("dağınık boşluk/girinti ile çalışır", () => {
    const m = parseCpp("struct   Messy{uint16_t   a;bool b;}");
    expect(m.name).toBe("Messy");
    expect(m.fields.map((f) => f.name)).toEqual(["a", "b"]);
  });

  it("alansız (boş) struct'ı kabul eder", () => {
    const m = parseCpp("struct Empty { };");
    expect(m.name).toBe("Empty");
    expect(m.fields).toEqual([]);
  });

  it("bilinmeyen tipte anlaşılır hata fırlatır", () => {
    expect(() => parseCpp("struct S { Widget x; };")).toThrow(/Bilinmeyen tip/);
  });

  it("struct yoksa hata fırlatır", () => {
    expect(() => parseCpp("merhaba dünya")).toThrow(/struct bulunamadı/);
  });

  it("bozuk alan bildiriminde hata fırlatır", () => {
    expect(() => parseCpp("struct S { uint32_t; };")).toThrow(/çözümlenemedi/);
  });

  it("parse → computeLayout zinciri tutarlı (round-trip his)", () => {
    // parser'ın ürettiği model, layout için geçerli olmalı.
    const m = parseCpp("struct S { uint32_t id; bool alive; double health; };");
    expect(m.fields).toHaveLength(3);
  });

  it("yaygın C++ tiplerini kanonik tiplere çevirir (alias)", () => {
    const m = parseCpp(`struct S {
      int a;
      unsigned int b;
      short c;
      unsigned long d;
      char e;
    };`);
    expect(m.fields.map((f) => f.type)).toEqual([
      "int32_t",
      "uint32_t",
      "int16_t",
      "uint64_t",
      "char",
    ]);
  });

  it("çok kelimeli tip + dizi birlikte çalışır", () => {
    const m = parseCpp("struct S { unsigned int scores[8]; };");
    expect(m.fields[0]).toMatchObject({ name: "scores", type: "uint32_t", arrayLength: 8 });
  });

  it("nested struct'ı isimli referansla çözer (son struct = ana model)", () => {
    const m = parseCpp(`
      struct Vec3 { float x; float y; float z; };
      struct Player { uint32_t id; Vec3 pos; bool alive; };
    `);
    expect(m.name).toBe("Player");
    expect(m.fields.map((f) => f.type)).toEqual(["uint32_t", "struct", "bool"]);
    expect(m.fields[1].nested?.name).toBe("Vec3");
    expect(m.fields[1].nested?.fields).toHaveLength(3);
  });

  it("struct dizisi referansı ([N]) çalışır", () => {
    const m = parseCpp("struct P { float v; }; struct Q { P items[4]; };");
    expect(m.fields[0]).toMatchObject({ type: "struct", arrayLength: 4 });
    expect(m.fields[0].nested?.name).toBe("P");
  });

  it("tanımsız struct tipinde hata fırlatır", () => {
    expect(() => parseCpp("struct Q { Unknown u; };")).toThrow(/Bilinmeyen tip/);
  });
});
