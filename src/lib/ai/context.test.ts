import { describe, expect, it } from "vitest";
import { buildStructContext } from "./context";
import type { StructModel } from "@/types";

describe("AI struct context", () => {
  it("includes nested fields with unambiguous dot-separated paths", () => {
    const model: StructModel = {
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
    const context = buildStructContext(model, [], {
      fromValue: "__current__",
      toValue: "__current__",
      fromLabel: "Live",
      toLabel: "Live",
      fromVersionId: undefined,
      toVersionId: undefined,
      fromModel: model,
      toModel: model,
    });
    expect(context.fields.map((field) => field.path)).toEqual([
      "telemetry",
      "telemetry.flags",
    ]);
  });
});
