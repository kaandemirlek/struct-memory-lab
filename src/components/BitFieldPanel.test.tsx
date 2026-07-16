// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import BitFieldPanel from "./BitFieldPanel";
import { useStructStore } from "@/store/useStructStore";

afterEach(cleanup);

describe("<BitFieldPanel /> block deletion", () => {
  it("deletes a Status Bit from its block without confirmation", () => {
    useStructStore.setState({
      currentModel: {
        name: "Packet",
        fields: [{
          id: "flags",
          name: "flags",
          type: "uint16_t",
          arrayLength: 1,
          bitFields: [{
            id: "warning",
            name: "warning",
            wordIndex: 0,
            startBit: 2,
            width: 2,
            kind: "uint",
          }],
        }],
      },
      past: [],
      future: [],
      focusedBitFieldId: null,
    });

    render(<BitFieldPanel />);
    fireEvent.click(screen.getByText("Status Bits"));
    fireEvent.click(screen.getByRole("button", { name: "Delete Status Bit warning" }));

    expect(useStructStore.getState().currentModel.fields[0].bitFields).toEqual([]);
    useStructStore.getState().undo();
    expect(useStructStore.getState().currentModel.fields[0].bitFields?.[0].name).toBe("warning");
  });
});
