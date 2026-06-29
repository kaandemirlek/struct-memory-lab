import { describe, it, expect } from "vitest";
import { validateModel } from "@/engine/validate";
import type { CppPrimitive, Field, StructModel } from "@/types";

let n = 0;
const field = (name: string, type: CppPrimitive = "uint32_t"): Field => ({
  id: `id${n++}`,
  name,
  type,
  arrayLength: 1,
});
const struct = (...fields: Field[]): StructModel => ({ name: "T", fields });

describe("validateModel", () => {
  it("geçerli modelde uyarı yok", () => {
    expect(validateModel(struct(field("id"), field("health")))).toEqual([]);
  });

  it("boş adı yakalar", () => {
    expect(validateModel(struct(field("  ")))).toContainEqual(expect.stringMatching(/Boş/));
  });

  it("geçersiz tanımlayıcıyı yakalar", () => {
    const issues = validateModel(struct(field("2cool")));
    expect(issues).toContainEqual(expect.stringMatching(/Geçersiz/));
  });

  it("yinelenen adı yakalar (kaç kez olduğuyla)", () => {
    const issues = validateModel(struct(field("x"), field("x"), field("x")));
    expect(issues).toContainEqual(expect.stringMatching(/Yinelenen.*x.*3/));
  });

  it("aynı uyarıyı tekrarlamaz", () => {
    const issues = validateModel(struct(field(""), field("")));
    expect(issues.filter((i) => /Boş/.test(i))).toHaveLength(1);
  });
});
