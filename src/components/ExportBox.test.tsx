// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import ExportBox from "@/components/ExportBox";
import { useStructStore } from "@/store/useStructStore";
import type { StructModel } from "@/types";

const model: StructModel = {
  name: "Player",
  fields: [
    { id: "f1", name: "id", type: "uint32_t", arrayLength: 1 },
    { id: "f2", name: "health", type: "double", arrayLength: 1 },
  ],
};

beforeEach(() =>
  useStructStore.setState({ currentModel: model, platform: "linux64" })
);
afterEach(cleanup);

describe("<ExportBox />", () => {
  it("opens a dialog and renders a compilable C++ header for the struct", async () => {
    render(<ExportBox />);
    fireEvent.click(screen.getByRole("button", { name: /Export/ }));

    // Modal portals to <body> after a mount tick — wait for it.
    const dialog = await screen.findByRole("dialog");
    const text = dialog.textContent ?? "";
    expect(text).toContain("#pragma once");
    expect(text).toContain("struct Player {");
    expect(text).toContain("static_assert(sizeof(Player) == 16");
    expect(text).toContain("Includes one compact metadata comment for a lossless re-import.");

    fireEvent.click(screen.getByRole("checkbox", { name: "Lossless re-import" }));
    expect(dialog.textContent).toContain(
      "Exports a clean C++ header; app-specific metadata will not be restored."
    );
    expect(dialog.textContent).not.toContain("SML-META:v1:");

    fireEvent.click(screen.getByRole("button", { name: "JSON" }));
    expect(dialog.textContent).toContain(
      "Preserves the complete editable model for a lossless re-import."
    );
  });
});
