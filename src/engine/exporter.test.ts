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
#include <cstddef>

struct Player {
    uint32_t id;
    bool alive;
};

// --- Player bellek yerleşimi doğrulaması (ABI kilidi) ---
static_assert(sizeof(Player) == 8, "sizeof(Player) beklenenden farkli");
static_assert(offsetof(Player, id) == 0, "Player.id offset kaymis");
static_assert(offsetof(Player, alive) == 4, "Player.alive offset kaymis");
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

  describe("bit-field mask macros", () => {
    it("emits SHIFT/MASK #defines for a flag bit", () => {
      const model = struct("SensorStatus", [
        {
          id: "1",
          name: "statusWord",
          type: "uint32_t",
          arrayLength: 1,
          bitFields: [
            {
              id: "b1",
              name: "irCameraFail",
              wordIndex: 0,
              startBit: 0,
              width: 1,
              kind: "flag",
              meanings: [
                { value: 0, label: "OK" },
                { value: 1, label: "FAIL" },
              ],
            },
          ],
        },
      ]);

      const out = exportCpp(model);
      expect(out).toContain("// --- statusWord bit alanları (mask makroları) ---");
      expect(out).toContain("#define SENSORSTATUS_STATUSWORD_IRCAMERAFAIL_SHIFT 0u");
      expect(out).toContain(
        "#define SENSORSTATUS_STATUSWORD_IRCAMERAFAIL_MASK (0x1u << 0)  // flag, 0=OK, 1=FAIL"
      );
    });

    it("computes a multi-bit mask and defaults kind to uint", () => {
      const model = struct("Ctrl", [
        {
          id: "1",
          name: "reg",
          type: "uint16_t",
          arrayLength: 1,
          bitFields: [
            { id: "b1", name: "mode", wordIndex: 0, startBit: 4, width: 3 },
          ],
        },
      ]);

      const out = exportCpp(model);
      // width 3 → (1<<3)-1 = 0x7
      expect(out).toContain("#define CTRL_REG_MODE_SHIFT 4u");
      expect(out).toContain("#define CTRL_REG_MODE_MASK (0x7u << 4)  // uint");
    });

    it("uses ull suffix for 64-bit words and BigInt-safe wide masks", () => {
      const model = struct("Big", [
        {
          id: "1",
          name: "flags",
          type: "uint64_t",
          arrayLength: 1,
          bitFields: [
            { id: "b1", name: "hi", wordIndex: 0, startBit: 40, width: 8, kind: "uint" },
          ],
        },
      ]);

      const out = exportCpp(model);
      // width 8 → 0xFF, 64-bit word → ull suffix
      expect(out).toContain("#define BIG_FLAGS_HI_MASK (0xFFull << 40)  // uint");
    });

    it("annotates the word index for array (multi-word) fields", () => {
      const model = struct("Telemetry", [
        {
          id: "1",
          name: "words",
          type: "uint32_t",
          arrayLength: 4,
          bitFields: [
            { id: "b1", name: "ready", wordIndex: 2, startBit: 5, width: 1, kind: "flag" },
          ],
        },
      ]);

      const out = exportCpp(model);
      expect(out).toContain(
        "#define TELEMETRY_WORDS_READY_MASK (0x1u << 5)  // flag, word 2"
      );
    });

    it("skips bit fields on non-unsigned types (no macros emitted)", () => {
      const model = struct("Bad", [
        {
          id: "1",
          name: "signedReg",
          type: "int32_t",
          arrayLength: 1,
          bitFields: [{ id: "b1", name: "x", wordIndex: 0, startBit: 0, width: 1 }],
        },
      ]);

      const out = exportCpp(model);
      expect(out).not.toContain("_MASK");
      expect(out).not.toContain("mask makroları");
    });
  });

  describe("static_assert layout locks", () => {
    it("emits sizeof + offsetof asserts and includes <cstddef>", () => {
      const model = struct("SensorStatus", [
        { id: "1", name: "statusWord", type: "uint32_t", arrayLength: 1 },
        { id: "2", name: "health", type: "double", arrayLength: 1 },
      ]);

      const out = exportCpp(model);
      expect(out).toContain("#include <cstddef>");
      expect(out).toContain(
        'static_assert(sizeof(SensorStatus) == 16, "sizeof(SensorStatus) beklenenden farkli");'
      );
      expect(out).toContain(
        'static_assert(offsetof(SensorStatus, statusWord) == 0, "SensorStatus.statusWord offset kaymis");'
      );
      // uint32_t + double → health 8'e hizalanır (4 byte padding).
      expect(out).toContain(
        'static_assert(offsetof(SensorStatus, health) == 8, "SensorStatus.health offset kaymis");'
      );
    });

    it("omits asserts and <cstddef> for an empty struct", () => {
      const out = exportCpp(struct("Empty", []));
      expect(out).not.toContain("static_assert");
      expect(out).not.toContain("#include <cstddef>");
    });

    it("emits a separate assert block per nested struct", () => {
      const model = struct("Outer", [
        {
          id: "1",
          name: "pos",
          type: "struct",
          arrayLength: 1,
          nested: struct("Vec3", [
            { id: "a", name: "x", type: "float", arrayLength: 1 },
            { id: "b", name: "y", type: "float", arrayLength: 1 },
            { id: "c", name: "z", type: "float", arrayLength: 1 },
          ]),
        },
      ]);

      const out = exportCpp(model);
      expect(out).toContain("static_assert(sizeof(Vec3) == 12");
      expect(out).toContain("static_assert(offsetof(Vec3, z) == 8");
      expect(out).toContain("static_assert(offsetof(Outer, pos) == 0");
    });
  });
});
