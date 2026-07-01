import { describe, it, expect } from "vitest";
import { highlightCpp } from "@/engine/highlight";

describe("highlightCpp", () => {
  it("preserves the exact text when tokens are joined back", () => {
    const code = "struct P {\n    uint32_t id; // x\n};";
    const joined = highlightCpp(code)
      .map((t) => t.value)
      .join("");
    expect(joined).toBe(code);
  });

  it("classifies keywords, types, numbers, and comments", () => {
    const tokens = highlightCpp("struct uint8_t name[16]; // c");
    const kindOf = (v: string) => tokens.find((t) => t.value === v)?.kind;
    expect(kindOf("struct")).toBe("keyword");
    expect(kindOf("uint8_t")).toBe("type");
    expect(kindOf("16")).toBe("number");
    expect(tokens.some((t) => t.kind === "comment" && t.value.includes("// c"))).toBe(true);
    expect(kindOf("name")).toBe("plain");
  });
});
