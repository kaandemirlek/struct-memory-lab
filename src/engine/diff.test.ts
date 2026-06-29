import { describe, it, expect } from "vitest";
import { diffVersions } from "@/engine/diff";
import type { Field, StructModel } from "@/types";

const f = (
  id: string,
  name: string,
  type: Field["type"],
  arrayLength = 1
): Field => ({ id, name, type, arrayLength });

const struct = (fields: Field[]): StructModel => ({ name: "S", fields });

describe("diffVersions", () => {
  it("reports no changes for identical models", () => {
    const a = struct([f("1", "id", "uint32_t")]);
    const b = struct([f("1", "id", "uint32_t")]);
    expect(diffVersions(a, b)).toEqual([]);
  });

  it("detects an added field", () => {
    const a = struct([f("1", "id", "uint32_t")]);
    const b = struct([f("1", "id", "uint32_t"), f("2", "mana", "uint32_t")]);
    expect(diffVersions(a, b)).toContainEqual({
      kind: "added",
      fieldName: "mana",
      detail: "mana: uint32_t",
    });
  });

  it("detects a removed field", () => {
    const a = struct([f("1", "id", "uint32_t"), f("2", "mana", "uint32_t")]);
    const b = struct([f("1", "id", "uint32_t")]);
    expect(diffVersions(a, b)).toContainEqual({
      kind: "removed",
      fieldName: "mana",
      detail: "mana: uint32_t",
    });
  });

  it("detects a rename via stable id (not add+remove)", () => {
    const a = struct([f("1", "health", "float")]);
    const b = struct([f("1", "hp", "float")]);
    expect(diffVersions(a, b)).toEqual([
      { kind: "renamed", fieldName: "hp", detail: "health → hp" },
    ]);
  });

  it("detects a type change", () => {
    const a = struct([f("1", "health", "float")]);
    const b = struct([f("1", "health", "double")]);
    expect(diffVersions(a, b)).toContainEqual({
      kind: "type-changed",
      fieldName: "health",
      detail: "health: float → double",
    });
  });

  it("treats an array length change as a type change", () => {
    const a = struct([f("1", "name", "uint8_t", 8)]);
    const b = struct([f("1", "name", "uint8_t", 16)]);
    expect(diffVersions(a, b)).toContainEqual({
      kind: "type-changed",
      fieldName: "name",
      detail: "name: uint8_t[8] → uint8_t[16]",
    });
  });

  it("detects reordering of common fields", () => {
    const a = struct([f("1", "a", "int32_t"), f("2", "b", "int32_t")]);
    const b = struct([f("2", "b", "int32_t"), f("1", "a", "int32_t")]);
    expect(diffVersions(a, b)).toContainEqual({
      kind: "reordered",
      fieldName: "",
      detail: "Field order changed",
    });
  });
});
