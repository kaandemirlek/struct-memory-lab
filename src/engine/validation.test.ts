import { describe, it, expect } from "vitest";
import { validateStruct } from "@/engine/validation";
import type { Field, StructModel } from "@/types";

const f = (
  id: string,
  name: string,
  type: Field["type"] = "int32_t",
  arrayLength = 1
): Field => ({ id, name, type, arrayLength });

const struct = (name: string, fields: Field[]): StructModel => ({ name, fields });

describe("validateStruct", () => {
  it("returns no issues for a valid struct", () => {
    const model = struct("Player", [f("1", "id", "uint32_t"), f("2", "hp", "float")]);
    expect(validateStruct(model)).toEqual([]);
  });

  it("flags a blank struct name", () => {
    const issues = validateStruct(struct("  ", [f("1", "id")]));
    expect(issues).toContainEqual({ message: "Struct name is required." });
  });

  it("flags an invalid struct identifier", () => {
    const issues = validateStruct(struct("3Player", [f("1", "id")]));
    expect(issues.some((i) => i.message.includes("not a valid C++ identifier"))).toBe(
      true
    );
  });

  it("flags a blank field name with its field id", () => {
    const issues = validateStruct(struct("S", [f("1", "")]));
    expect(issues).toContainEqual({ fieldId: "1", message: "Field name is required." });
  });

  it("flags an invalid field identifier", () => {
    const issues = validateStruct(struct("S", [f("1", "my field")]));
    expect(issues).toContainEqual({
      fieldId: "1",
      message: 'Field name "my field" is not a valid C++ identifier.',
    });
  });

  it("flags duplicate field names once", () => {
    const issues = validateStruct(
      struct("S", [f("1", "x"), f("2", "x"), f("3", "y")])
    );
    expect(issues.filter((i) => i.message === 'Duplicate field name "x".')).toHaveLength(
      1
    );
  });

  it("flags an invalid array length", () => {
    const issues = validateStruct(struct("S", [f("1", "buf", "uint8_t", 0)]));
    expect(issues).toContainEqual({
      fieldId: "1",
      message: 'Field "buf" has an invalid array length.',
    });
  });
});
