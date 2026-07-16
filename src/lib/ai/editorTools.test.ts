import { describe, expect, it } from "vitest";
import { parseEditorToolCall } from "./editorTools";

describe("AI editor function calls", () => {
  it("converts a valid function call to a typed action", () => {
    expect(parseEditorToolCall({
      function: {
        name: "move_status_bit",
        arguments: JSON.stringify({
          fieldName: "telemetry.flags",
          bitName: "warning",
          wordIndex: 0,
          startBit: 5,
          width: 3,
        }),
      },
    })).toEqual({
      type: "move_bit_field",
      fieldName: "telemetry.flags",
      bitName: "warning",
      wordIndex: 0,
      startBit: 5,
      width: 3,
    });
  });

  it("rejects malformed or unknown function calls", () => {
    expect(parseEditorToolCall({ function: { name: "delete_everything", arguments: "{}" } }))
      .toBeNull();
    expect(parseEditorToolCall({ function: { name: "add_status_bit", arguments: "not-json" } }))
      .toBeNull();
    expect(parseEditorToolCall({
      function: {
        name: "add_status_bit",
        arguments: JSON.stringify({ fieldName: "id", name: "x" }),
      },
    })).toBeNull();
  });
});
