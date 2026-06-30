import { describe, it, expect } from "vitest";
import {
  bitsPerWord,
  isUnsignedInt,
  bitWarningsForField,
  analyzeBitWarnings,
} from "@/engine/bitfields";
import type { BitField, CppPrimitive, Field, StructModel } from "@/types";

let n = 0;
const bf = (name: string, wordIndex: number, startBit: number, width: number): BitField => ({
  id: `b${n++}`,
  name,
  wordIndex,
  startBit,
  width,
});

const word = (
  type: CppPrimitive,
  arrayLength: number,
  bitFields: BitField[]
): Field => ({ id: `f${n++}`, name: "statusWords", type, arrayLength, bitFields });

describe("bitsPerWord / isUnsignedInt", () => {
  it("bitsPerWord = byte × 8", () => {
    expect(bitsPerWord(word("uint8_t", 1, []))).toBe(8);
    expect(bitsPerWord(word("uint32_t", 1, []))).toBe(32);
    expect(bitsPerWord(word("uint64_t", 1, []))).toBe(64);
  });

  it("isUnsignedInt yalnızca uint*_t için true", () => {
    expect(isUnsignedInt("uint32_t")).toBe(true);
    expect(isUnsignedInt("int32_t")).toBe(false);
    expect(isUnsignedInt("double")).toBe(false);
    expect(isUnsignedInt("struct")).toBe(false);
  });
});

describe("bitWarningsForField", () => {
  it("geçerli yerleşimde uyarı yok", () => {
    const f = word("uint32_t", 3, [
      bf("irCameraFail", 0, 0, 1),
      bf("laserFail", 0, 1, 1),
      bf("operationMode", 0, 4, 3),
    ]);
    expect(bitWarningsForField(f)).toEqual([]);
  });

  it("aynı word'de çakışmayı yakalar (overlap)", () => {
    const f = word("uint32_t", 1, [bf("a", 0, 0, 4), bf("b", 0, 2, 2)]);
    expect(bitWarningsForField(f)).toContainEqual(
      expect.objectContaining({ severity: "danger", message: expect.stringMatching(/Overlap/) })
    );
  });

  it("farklı word'lerde çakışma sayılmaz", () => {
    const f = word("uint32_t", 2, [bf("a", 0, 0, 4), bf("b", 1, 0, 4)]);
    expect(bitWarningsForField(f)).toEqual([]);
  });

  it("word out of bounds yakalanır", () => {
    const f = word("uint32_t", 2, [bf("a", 5, 0, 1)]);
    expect(bitWarningsForField(f)).toContainEqual(
      expect.objectContaining({ message: expect.stringMatching(/Out of bounds.*word/) })
    );
  });

  it("word sınırını aşma (boundary crossing) yakalanır", () => {
    const f = word("uint32_t", 1, [bf("wide", 0, 30, 4)]); // 30..33 > 32
    expect(bitWarningsForField(f)).toContainEqual(
      expect.objectContaining({ message: expect.stringMatching(/boundary/i) })
    );
  });

  it("unsigned olmayan tipte bit alanı → uyarı", () => {
    const f: Field = {
      id: "x",
      name: "v",
      type: "int32_t",
      arrayLength: 1,
      bitFields: [bf("a", 0, 0, 1)],
    };
    expect(bitWarningsForField(f)).toContainEqual(
      expect.objectContaining({ severity: "warning" })
    );
  });

  it("bit alanı olmayan alanda uyarı yok", () => {
    expect(bitWarningsForField(word("uint32_t", 1, []))).toEqual([]);
  });
});

describe("analyzeBitWarnings (model)", () => {
  it("tüm alanların uyarılarını toplar", () => {
    const model: StructModel = {
      name: "StatusPacket",
      fields: [
        word("uint32_t", 1, [bf("ok", 0, 0, 1)]),
        word("uint32_t", 1, [bf("a", 0, 0, 4), bf("b", 0, 1, 1)]), // overlap
      ],
    };
    expect(analyzeBitWarnings(model).length).toBeGreaterThan(0);
  });
});
