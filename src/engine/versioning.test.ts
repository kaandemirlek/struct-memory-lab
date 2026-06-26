import { describe, it, expect } from "vitest";
import { modelsEqual, summarizeVersion } from "@/engine/versioning";
import type { StructModel, Version } from "@/types";

const model = (fields: StructModel["fields"]): StructModel => ({
  name: "Player",
  fields,
});

const version = (label: string, m: StructModel): Version => ({
  id: label,
  label,
  model: m,
  createdAt: "2026-01-01T00:00:00.000Z",
});

describe("modelsEqual", () => {
  it("is true for structurally identical models", () => {
    const a = model([{ id: "1", name: "id", type: "uint32_t", arrayLength: 1 }]);
    const b = model([{ id: "1", name: "id", type: "uint32_t", arrayLength: 1 }]);
    expect(modelsEqual(a, b)).toBe(true);
  });

  it("is false when a field type differs", () => {
    const a = model([{ id: "1", name: "id", type: "uint32_t", arrayLength: 1 }]);
    const b = model([{ id: "1", name: "id", type: "uint16_t", arrayLength: 1 }]);
    expect(modelsEqual(a, b)).toBe(false);
  });
});

describe("summarizeVersion", () => {
  it("uses the singular noun for a single field", () => {
    const v = version("v1", model([{ id: "1", name: "id", type: "bool", arrayLength: 1 }]));
    expect(summarizeVersion(v)).toBe("v1 — 1 field");
  });

  it("uses the plural noun for multiple fields", () => {
    const v = version(
      "v2",
      model([
        { id: "1", name: "id", type: "bool", arrayLength: 1 },
        { id: "2", name: "x", type: "float", arrayLength: 1 },
      ])
    );
    expect(summarizeVersion(v)).toBe("v2 — 2 fields");
  });
});
