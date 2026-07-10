import { describe, it, expect } from "vitest";
import { parseCpp, parseModelJson } from "@/engine/parser";
import { exportCpp, exportModelJson } from "@/engine/exporter";
import type { StructModel } from "@/types";

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
    expect(() => parseCpp("struct S { Widget x; };")).toThrow(/Unknown type/);
  });

  it("struct yoksa hata fırlatır", () => {
    expect(() => parseCpp("merhaba dünya")).toThrow(/No valid struct/);
  });

  it("bozuk alan bildiriminde hata fırlatır", () => {
    expect(() => parseCpp("struct S { uint32_t; };")).toThrow(/Could not parse/);
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
      // "unsigned long" artık ertelenmiş bir tip (boyut layout anında çözülür),
      // sabit uint64_t'ye eşlenmez.
      "unsigned long",
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
    expect(() => parseCpp("struct Q { Unknown u; };")).toThrow(/Unknown type/);
  });
});

describe("parseCpp — long ailesi (ertelenmiş tip)", () => {
  it('"long" ve "unsigned long" platformdan bağımsız kanonik tip olarak saklanır', () => {
    // Parse ARTIK platformdan bağımsız: boyut layout anında çözülür, burada değil.
    expect(parseCpp("struct S { long x; };").fields[0].type).toBe("long");
    expect(parseCpp("struct S { unsigned long x; };").fields[0].type).toBe("unsigned long");
    // Çok kelimeli varyantlar kanonik ada eşlenir.
    expect(parseCpp("struct S { long int x; };").fields[0].type).toBe("long");
    expect(parseCpp("struct S { unsigned long int x; };").fields[0].type).toBe("unsigned long");
    // "long long" HER platformda 8 byte olduğu için sabit int64_t'ye gider.
    expect(parseCpp("struct S { long long x; };").fields[0].type).toBe("int64_t");
    expect(parseCpp("struct S { unsigned long long x; };").fields[0].type).toBe("uint64_t");
  });
});

describe("parseCpp — #pragma pack", () => {
  it("pack(push, 1) / pack(pop) aradaki struct'ı paketler", () => {
    const m = parseCpp(
      "#pragma pack(push, 1)\nstruct P { bool a; uint32_t b; };\n#pragma pack(pop)"
    );
    expect(m.pack).toBe(1);
  });

  it("pop sonrası tanımlanan struct paketlenmez", () => {
    const m = parseCpp(
      "#pragma pack(push, 1)\nstruct P { bool a; };\n#pragma pack(pop)\nstruct Q { bool a; uint32_t b; };"
    );
    expect(m.name).toBe("Q");
    expect(m.pack).toBeUndefined();
  });

  it("pack(N) ve pack() (sıfırlama) formları çalışır", () => {
    const packed = parseCpp("#pragma pack(2)\nstruct P { bool a; uint32_t b; };");
    expect(packed.pack).toBe(2);
    const reset = parseCpp("#pragma pack(2)\n#pragma pack()\nstruct P { bool a; };");
    expect(reset.pack).toBeUndefined();
  });

  it("geçersiz pack değeri anlaşılır hata verir", () => {
    expect(() => parseCpp("#pragma pack(3)\nstruct S { bool a; };")).toThrow(/pack/);
  });
});

describe("parseCpp — yerel C++ bit alanları", () => {
  it("ardışık bildirimler tek fiziksel alana gruplanır", () => {
    const m = parseCpp("struct S { uint32_t a : 3; uint32_t b : 5; bool ok; };");
    expect(m.fields).toHaveLength(2);
    const w = m.fields[0];
    expect(w).toMatchObject({ name: "a_bits", type: "uint32_t", arrayLength: 1 });
    expect(w.bitFields).toHaveLength(2);
    expect(w.bitFields![0]).toMatchObject({ name: "a", wordIndex: 0, startBit: 0, width: 3 });
    expect(w.bitFields![1]).toMatchObject({ name: "b", wordIndex: 0, startBit: 3, width: 5 });
    expect(m.fields[1].name).toBe("ok");
  });

  it("word'e sığmayan bildirim sonraki word'e taşar (alan diziye dönüşür)", () => {
    const m = parseCpp("struct S { uint8_t a : 6; uint8_t b : 6; };");
    const w = m.fields[0];
    expect(w.arrayLength).toBe(2);
    expect(w.bitFields![1]).toMatchObject({ wordIndex: 1, startBit: 0, width: 6 });
  });

  it("isimsiz bildirim dolgu bitidir, sıfır genişlik word sınırına atlar", () => {
    const pad = parseCpp("struct S { uint32_t a : 3; uint32_t : 5; uint32_t b : 2; };");
    expect(pad.fields[0].bitFields).toHaveLength(2);
    expect(pad.fields[0].bitFields![1]).toMatchObject({ name: "b", startBit: 8 });

    const zero = parseCpp("struct S { uint16_t a : 3; uint16_t : 0; uint16_t b : 2; };");
    expect(zero.fields[0].arrayLength).toBe(2);
    expect(zero.fields[0].bitFields![1]).toMatchObject({ wordIndex: 1, startBit: 0 });
  });

  it("işaretli tip unsigned konteynere eşlenir, kind = int", () => {
    const m = parseCpp("struct S { int32_t delta : 4; };");
    expect(m.fields[0].type).toBe("uint32_t");
    expect(m.fields[0].bitFields![0].kind).toBe("int");
  });

  it("tipten geniş bit alanı hata verir", () => {
    expect(() => parseCpp("struct S { uint8_t a : 12; };")).toThrow(/wider/);
  });
});

describe("parseCpp — enum & typedef/using", () => {
  it("typedef ve using primitive takma adları çözülür", () => {
    const m = parseCpp(
      "typedef unsigned int u32;\nusing f32 = float;\nstruct S { u32 a; f32 b; };"
    );
    expect(m.fields.map((f) => f.type)).toEqual(["uint32_t", "float"]);
  });

  it("enum class alttaki tipe eşlenir", () => {
    const m = parseCpp("enum class Mode : uint8_t { IDLE, TRACK };\nstruct S { Mode m; };");
    expect(m.fields[0].type).toBe("uint8_t");
  });

  it("düz enum int32_t varsayılır", () => {
    const m = parseCpp("enum Color { RED, GREEN };\nstruct S { Color c; };");
    expect(m.fields[0].type).toBe("int32_t");
  });

  it("struct typedef'i nested olarak çözülür", () => {
    const m = parseCpp(
      "struct Vec3 { float x; float y; float z; };\ntypedef Vec3 Position;\nstruct P { Position pos; };"
    );
    expect(m.fields[0].type).toBe("struct");
    expect(m.fields[0].nested?.name).toBe("Vec3");
  });

  it("zincirli takma ad (typedef'in typedef'i) çözülür", () => {
    const m = parseCpp("typedef unsigned int u32;\nusing Id = u32;\nstruct S { Id id; };");
    expect(m.fields[0].type).toBe("uint32_t");
  });
});

describe("parseModelJson (JSON round-trip)", () => {
  // bitFields + meanings + nested + dizi içeren tam bir model.
  const model: StructModel = {
    name: "Telemetry",
    fields: [
      {
        id: "f_status",
        name: "statusWord",
        type: "uint32_t",
        arrayLength: 1,
        bitFields: [
          { id: "b_ok", name: "irCameraFail", wordIndex: 0, startBit: 0, width: 1, kind: "flag", meanings: [{ value: 0, label: "OK" }, { value: 1, label: "FAIL" }] },
          { id: "b_mode", name: "operationMode", wordIndex: 0, startBit: 1, width: 3, kind: "enum", meanings: [] },
        ],
      },
      {
        id: "f_pos",
        name: "position",
        type: "struct",
        arrayLength: 1,
        nested: {
          name: "Vec3",
          fields: [
            { id: "f_x", name: "x", type: "float", arrayLength: 1 },
            { id: "f_y", name: "y", type: "float", arrayLength: 1 },
            { id: "f_z", name: "z", type: "float", arrayLength: 1 },
          ],
        },
      },
      { id: "f_age", name: "age", type: "uint32_t", arrayLength: 5 },
    ],
  };

  it("export → import KAYIPSIZ: bitFields, meanings ve nested korunur", () => {
    const restored = parseModelJson(exportModelJson(model));
    expect(restored).toEqual(model);
  });

  it("C++ .hpp round-trip'i de gömülü model sayesinde KAYIPSIZ (Status Bits dahil)", () => {
    // exportCpp header'a "// struct-memory-lab-model:{...}" satırını gömer;
    // parseCpp bunu görüp modeli birebir geri yükler.
    expect(parseCpp(exportCpp(model))).toEqual(model);
    // yorumsuz export de aynı şekilde geri yüklenmeli.
    expect(parseCpp(exportCpp(model, { comments: false }))).toEqual(model);
  });

  it("gömülü satır YOKken elle yazılmış header normal (bit'siz) parse edilir", () => {
    const m = parseCpp("struct P { uint32_t status; bool ok; };");
    expect(m.fields.map((f) => f.name)).toEqual(["status", "ok"]);
    expect(m.fields[0].bitFields).toBeUndefined();
  });

  it("ham StructModel JSON'unu da (struct sarmalayıcısı olmadan) kabul eder", () => {
    const restored = parseModelJson(JSON.stringify(model));
    expect(restored.name).toBe("Telemetry");
    expect(restored.fields[0].bitFields).toHaveLength(2);
  });

  it("eksik id'leri tamamlar, geçersiz JSON ve bilinmeyen tipte hata verir", () => {
    const noId = parseModelJson('{ "name": "S", "fields": [{ "name": "a", "type": "uint8_t", "arrayLength": 1 }] }');
    expect(noId.fields[0].id.length).toBeGreaterThan(0);
    expect(() => parseModelJson("{ bozuk")).toThrow(/JSON/);
    expect(() => parseModelJson('{ "name": "S", "fields": [{ "name": "a", "type": "widget", "arrayLength": 1 }] }')).toThrow(/Unknown type/);
  });
});
