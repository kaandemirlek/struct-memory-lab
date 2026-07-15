import { describe, it, expect } from "vitest";
import { exportCpp, exportModelJson } from "@/engine/exporter";
import type { StructModel } from "@/types";

const struct = (name: string, fields: StructModel["fields"]): StructModel => ({
  name,
  fields,
});

describe("exportCpp — platform & pack", () => {
  it("packed struct #pragma pack ile sarılır ve yerleşim ona göre hesaplanır", () => {
    const model: StructModel = {
      ...struct("P", [
        { id: "1", name: "a", type: "bool", arrayLength: 1 },
        { id: "2", name: "b", type: "uint32_t", arrayLength: 1 },
      ]),
      pack: 1,
    };
    const out = exportCpp(model);
    expect(out).toContain("#pragma pack(push, 1)");
    expect(out).toContain("#pragma pack(pop)");
    expect(out).toContain("sizeof(P) == 5");
  });

  it("static_assert'ler seçilen platforma göre üretilir", () => {
    const model = struct("S", [
      { id: "1", name: "a", type: "bool", arrayLength: 1 },
      { id: "2", name: "b", type: "double", arrayLength: 1 },
    ]);
    expect(exportCpp(model)).toContain("sizeof(S) == 16"); // linux64: double @8
    expect(exportCpp(model, { platform: "x86-32" })).toContain("sizeof(S) == 12"); // double @4
  });
});

describe("exportCpp", () => {
  it("emits a compilable header with includes and per-field offset/size comments", () => {
    const model = struct("Player", [
      { id: "1", name: "id", type: "uint32_t", arrayLength: 1 },
      { id: "2", name: "alive", type: "bool", arrayLength: 1 },
    ]);
    const out = exportCpp(model);
    expect(out).toContain("#pragma once");
    expect(out).toContain("#include <cstdint>");
    expect(out).toContain("struct Player {");
    expect(out).toMatch(/uint32_t id;\s+\/\/ offset 0, size 4/);
    expect(out).toMatch(/bool alive;\s+\/\/ offset 4, size 1/);
    expect(out).toContain(
      "// sizeof = 8 bytes, alignment = 4 bytes, padding = 3 bytes"
    );
  });

  it("notes padding bytes as comments", () => {
    const model = struct("P", [
      { id: "1", name: "a", type: "bool", arrayLength: 1 },
      { id: "2", name: "b", type: "double", arrayLength: 1 },
    ]);
    // bool@0 (1B), 7 bytes padding, double@8 (8B)
    expect(exportCpp(model)).toContain("// 7 bytes padding");
  });

  it("omits all comments when { comments: false }", () => {
    const model = struct("Player", [
      { id: "1", name: "id", type: "uint32_t", arrayLength: 1 },
      { id: "2", name: "alive", type: "bool", arrayLength: 1 },
    ]);
    const out = exportCpp(model, { comments: false });
    expect(out).toContain("uint32_t id;");
    expect(out).not.toContain("// offset");
    expect(out).not.toContain("padding");
    expect(out).not.toContain("// sizeof");
  });

  it("includes <cstddef> (not <cstdint>) when size_t is used", () => {
    const model = struct("Buffer", [
      { id: "1", name: "count", type: "size_t", arrayLength: 1 },
    ]);
    const out = exportCpp(model);
    expect(out).toContain("#include <cstddef>");
    expect(out).not.toContain("#include <cstdint>");
    expect(out).toContain("size_t count;");
  });

  it("includes both <cstdint> and <cstddef> when both kinds are used", () => {
    const model = struct("Mixed", [
      { id: "1", name: "id", type: "uint32_t", arrayLength: 1 },
      { id: "2", name: "len", type: "size_t", arrayLength: 1 },
    ]);
    const out = exportCpp(model);
    expect(out).toContain("#include <cstdint>");
    expect(out).toContain("#include <cstddef>");
  });

  it("omits <cstdint> when no fixed-width integer types are present", () => {
    const model = struct("Vec", [
      { id: "1", name: "x", type: "float", arrayLength: 1 },
      { id: "2", name: "y", type: "double", arrayLength: 1 },
    ]);

    const out = exportCpp(model);
    expect(out).not.toContain("#include <cstdint>");
    expect(out).toContain("float x;");
  });

  it("renders array syntax for fields with arrayLength > 1", () => {
    const model = struct("Buffer", [
      { id: "1", name: "name", type: "uint8_t", arrayLength: 16 },
    ]);

    expect(exportCpp(model)).toContain("uint8_t name[16];");
  });

  it("handles an empty struct with a placeholder comment", () => {
    const out = exportCpp(struct("Empty", []));
    expect(out).toContain("struct Empty {");
    expect(out).toContain("// (no fields)");
  });

  it("falls back to a valid name when the struct name is blank", () => {
    const out = exportCpp(struct("   ", []));
    expect(out).toContain("struct Struct {");
  });
});

describe("exportModelJson", () => {
  it("includes the struct, types, and layout metadata", () => {
    const model = struct("Player", [
      { id: "1", name: "id", type: "uint32_t", arrayLength: 1 },
    ]);
    const json = JSON.parse(exportModelJson(model));
    expect(json.struct.name).toBe("Player");
    expect(json.struct.fields[0]).toMatchObject({ name: "id", type: "uint32_t" });
    expect(json.layout.totalSize).toBe(4);
    expect(json.layout.alignment).toBe(4);
    expect(json.layout.fields[0]).toMatchObject({ name: "id", offset: 0, size: 4 });
  });
});

describe("exportCpp — nested structs & bit-fields (merged features)", () => {
  it("emits nested struct definitions before the parent, with static_asserts", () => {
    const model = struct("Player", [
      { id: "1", name: "id", type: "uint32_t", arrayLength: 1 },
      {
        id: "2",
        name: "position",
        type: "struct",
        arrayLength: 1,
        nested: {
          name: "Vec3",
          fields: [
            { id: "3", name: "x", type: "float", arrayLength: 1 },
            { id: "4", name: "y", type: "float", arrayLength: 1 },
          ],
        },
      },
    ]);
    const out = exportCpp(model);
    expect(out).toContain("struct Vec3 {");
    expect(out.indexOf("struct Vec3 {")).toBeLessThan(out.indexOf("struct Player {"));
    expect(out).toContain("Vec3 position;");
    expect(out).toContain("static_assert(sizeof(Player)");
  });

  it("emits human-readable bit meaning comments (not macros)", () => {
    const model = struct("Player", [
      {
        id: "1",
        name: "status",
        type: "uint32_t",
        arrayLength: 1,
        bitFields: [
          {
            id: "b1",
            name: "alive",
            wordIndex: 0,
            startBit: 0,
            width: 1,
            kind: "flag",
            meanings: [
              { value: 0, label: "DEAD" },
              { value: 1, label: "ALIVE" },
            ],
          },
          { id: "b2", name: "mode", wordIndex: 0, startBit: 1, width: 3, kind: "enum", meanings: [] },
        ],
      },
    ]);
    const out = exportCpp(model);
    expect(out).toContain("// --- status bit meanings ---");
    expect(out).toMatch(/\/\/ bit 0\s+-> meaning: alive \(flag\), 0=DEAD, 1=ALIVE/);
    expect(out).toMatch(/\/\/ bits 1-3\s+-> meaning: mode \(enum\)/);
    expect(out).not.toContain("#define");
  });

  it("array status words prefix each line with the word index", () => {
    const model = struct("T", [
      {
        id: "1",
        name: "statusWords",
        type: "uint32_t",
        arrayLength: 3,
        bitFields: [
          { id: "b1", name: "irFail", wordIndex: 2, startBit: 4, width: 1, kind: "flag", meanings: [] },
        ],
      },
    ]);
    expect(exportCpp(model)).toMatch(/\/\/ word 2, bit 4\s+-> meaning: irFail \(flag\)/);
  });
});

describe("exportCpp — asserts toggle & no embedded model", () => {
  const model = struct("Player", [
    { id: "1", name: "id", type: "uint32_t", arrayLength: 1 },
  ]);

  it("{ asserts: false } omits static_asserts and the <cstddef> include", () => {
    const out = exportCpp(model, { asserts: false });
    expect(out).not.toContain("static_assert");
    expect(out).not.toContain("#include <cstddef>"); // offsetof gerekmiyor
    expect(out).toContain("struct Player {");
  });

  it("asserts are included by default", () => {
    expect(exportCpp(model)).toContain("static_assert(sizeof(Player)");
  });

  it("no longer embeds the machine-readable model line (JSON is the lossless path)", () => {
    expect(exportCpp(model)).not.toContain("struct-memory-lab-model:");
  });
});
