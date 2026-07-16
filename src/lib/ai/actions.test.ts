import { describe, expect, it } from "vitest";
import { interpretAiAction, validateAiAction } from "./actions";
import type { StructContext } from "./types";
import type { StructModel } from "@/types";

const context: StructContext = {
  name: "Player",
  fields: [
    {
      name: "id",
      type: "uint32_t",
      arrayLength: 1,
      offset: 0,
      size: 4,
      paddingBefore: 0,
    },
  ],
  totalSize: 4,
  alignment: 4,
  totalPadding: 0,
  versions: [],
  comparison: null,
};

const editableContext: StructContext = {
  ...context,
  fields: [{
    ...context.fields[0],
    bitFields: [{
      name: "mode",
      wordIndex: 0,
      startBit: 1,
      width: 3,
      bitRange: "bits 1–3",
      kind: "enum",
      meanings: [{ value: 0, label: "OFF" }],
    }],
  }],
};

describe("AI editor actions", () => {
  it("parses a Turkish inclusive bit range into an add proposal", () => {
    const result = interpretAiAction(
      context,
      "id fieldında, 10-12. bitler arasında status_25 oluştur"
    );
    expect(result).toMatchObject({
      matched: true,
      action: {
        type: "add_bit_field",
        fieldName: "id",
        name: "status_25",
        startBit: 10,
        width: 3,
        kind: "uint",
      },
    });
  });

  it("rejects ranges outside the field and overlapping current bits", () => {
    expect(interpretAiAction(context, "id alanında 31-33 bitler arasında bad oluştur"))
      .toMatchObject({ matched: true, error: expect.stringContaining("outside") });

    const occupied: StructContext = {
      ...context,
      fields: [{
        ...context.fields[0],
        bitFields: [{ name: "old", wordIndex: 0, startBit: 11, width: 2, bitRange: "bits 11–12", kind: "uint" }],
      }],
    };
    expect(interpretAiAction(occupied, "id alanında 10-12 bitler arasında next oluştur"))
      .toMatchObject({ matched: true, error: expect.stringContaining("overlap") });
  });

  it("revalidates an action against the current model before Apply", () => {
    const model: StructModel = {
      name: "Player",
      fields: [{ id: "id", name: "id", type: "uint32_t", arrayLength: 1 }],
    };
    expect(validateAiAction(model, {
      type: "add_bit_field",
      fieldName: "id",
      name: "status_25",
      wordIndex: 0,
      startBit: 10,
      width: 3,
      kind: "uint",
    })).toBeNull();
  });

  it("proposes rename, move, remove and meaning actions", () => {
    expect(interpretAiAction(
      editableContext,
      "id alanındaki mode bitini operation_mode olarak yeniden adlandır"
    )).toMatchObject({
      action: { type: "rename_bit_field", bitName: "mode", newName: "operation_mode" },
    });

    expect(interpretAiAction(
      editableContext,
      "id alanındaki mode bitini 5-7 bitlerine taşı"
    )).toMatchObject({
      action: { type: "move_bit_field", bitName: "mode", startBit: 5, width: 3 },
    });

    expect(interpretAiAction(editableContext, "id alanındaki mode bitini sil"))
      .toMatchObject({ action: { type: "remove_bit_field", bitName: "mode" } });

    expect(interpretAiAction(
      editableContext,
      "id alanındaki mode için 0=IDLE, 1=RUN anlamlarını ekle"
    )).toMatchObject({
      action: {
        type: "set_bit_meanings",
        meanings: [{ value: 0, label: "IDLE" }, { value: 1, label: "RUN" }],
      },
    });
  });

  it("targets an explicit array word when adding a Status Bit", () => {
    const arrayContext: StructContext = {
      ...context,
      fields: [{ ...context.fields[0], name: "statusWords", arrayLength: 3, size: 12 }],
    };
    expect(interpretAiAction(
      arrayContext,
      "statusWords alanında word 2, 4-6 bitler arasında fault oluştur"
    )).toMatchObject({
      action: { type: "add_bit_field", wordIndex: 2, startBit: 4, width: 3, name: "fault" },
    });
  });

  it("targets a nested field by its dot-separated path", () => {
    const nestedContext: StructContext = {
      ...context,
      fields: [{
        name: "flags",
        path: "telemetry.flags",
        type: "uint16_t",
        arrayLength: 1,
        offset: 0,
        size: 2,
        paddingBefore: 0,
      }],
    };
    expect(interpretAiAction(
      nestedContext,
      "telemetry.flags alanında 2-3 bitler arasında warning oluştur"
    )).toMatchObject({
      action: { fieldName: "telemetry.flags", name: "warning", startBit: 2, width: 2 },
    });

    const nestedModel: StructModel = {
      name: "Root",
      fields: [{
        id: "telemetry",
        name: "telemetry",
        type: "struct",
        arrayLength: 1,
        nested: {
          name: "Telemetry",
          fields: [{ id: "flags", name: "flags", type: "uint16_t", arrayLength: 1 }],
        },
      }],
    };
    expect(validateAiAction(nestedModel, {
      type: "add_bit_field",
      fieldName: "telemetry.flags",
      name: "warning",
      wordIndex: 0,
      startBit: 2,
      width: 2,
      kind: "uint",
    })).toBeNull();
  });
});
