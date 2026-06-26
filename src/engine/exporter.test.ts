import { describe, it, expect } from "vitest";
import { exportCpp } from "@/engine/exporter";
import type { StructModel } from "@/types";

const struct = (name: string, fields: StructModel["fields"]): StructModel => ({
  name,
  fields,
});

describe("exportCpp", () => {
  it("emits a compilable header with #include <cstdint> when a *_t type is used", () => {
    const model = struct("Player", [
      { id: "1", name: "id", type: "uint32_t", arrayLength: 1 },
      { id: "2", name: "alive", type: "bool", arrayLength: 1 },
    ]);

    expect(exportCpp(model)).toBe(
      `#pragma once

#include <cstdint>

struct Player {
    uint32_t id;
    bool alive;
};
`
    );
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
    expect(out).toContain("// (alan yok)");
  });

  it("falls back to a valid name when the struct name is blank", () => {
    const out = exportCpp(struct("   ", []));
    expect(out).toContain("struct Struct {");
  });
});
