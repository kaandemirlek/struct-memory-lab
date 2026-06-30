import { describe, it, expect } from "vitest";
import { exportCpp, exportModelJson } from "@/engine/exporter";
import type { StructModel } from "@/types";

const struct = (name: string, fields: StructModel["fields"]): StructModel => ({
  name,
  fields,
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
