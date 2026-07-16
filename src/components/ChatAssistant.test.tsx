// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import ChatAssistant from "./ChatAssistant";
import { useStructStore } from "@/store/useStructStore";

beforeEach(() => {
  Object.defineProperty(HTMLElement.prototype, "scrollTo", {
    configurable: true,
    value: vi.fn(),
  });
  useStructStore.setState({
    currentModel: {
      name: "Player",
      fields: [{ id: "field_id", name: "id", type: "uint32_t", arrayLength: 1 }],
    },
    versions: [],
    past: [],
    future: [],
  });
  vi.stubGlobal("fetch", vi.fn(async () =>
    new Response(JSON.stringify({
      text: 'I can add "status_25" to "id" on bits 10–12.',
      mode: "mock",
      action: {
        type: "add_bit_field",
        fieldName: "id",
        name: "status_25",
        wordIndex: 0,
        startBit: 10,
        width: 3,
        kind: "uint",
      },
    }), { status: 200, headers: { "Content-Type": "application/json" } })
  ));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("<ChatAssistant /> editor actions", () => {
  it("waits for Apply before adding the proposed Status Bit", async () => {
    render(<ChatAssistant />);
    fireEvent.click(screen.getByRole("button", { name: "Ask the assistant" }));
    fireEvent.change(screen.getByPlaceholderText("Ask about this struct…"), {
      target: { value: "id fieldında, 10-12. bitler arasında status_25 oluştur" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));

    const apply = await screen.findByRole("button", { name: "Apply" });
    expect(useStructStore.getState().currentModel.fields[0].bitFields).toBeUndefined();

    fireEvent.click(apply);
    expect(useStructStore.getState().currentModel.fields[0].bitFields).toMatchObject([
      { name: "status_25", startBit: 10, width: 3, kind: "uint" },
    ]);
    expect(screen.getByText("Applied.")).toBeTruthy();
  });
});
