// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import FieldEditor from "@/components/FieldEditor";
import { useStructStore } from "@/store/useStructStore";
import type { StructModel } from "@/types";

const setModel = (model: StructModel) =>
  useStructStore.setState({
    currentModel: model,
    versions: [],
    past: [],
    future: [],
    previewVersionId: null,
    platform: "linux64",
  });

const flat: StructModel = {
  name: "Player",
  fields: [
    { id: "f1", name: "id", type: "uint32_t", arrayLength: 1 },
    { id: "f2", name: "alive", type: "bool", arrayLength: 1 },
  ],
};

const nested: StructModel = {
  name: "Player",
  fields: [
    { id: "f1", name: "id", type: "uint32_t", arrayLength: 1 },
    {
      id: "f2",
      name: "position",
      type: "struct",
      arrayLength: 1,
      nested: {
        name: "Vec3",
        fields: [{ id: "nx", name: "x", type: "float", arrayLength: 1 }],
      },
    },
  ],
};

afterEach(cleanup);

describe("<FieldEditor />", () => {
  beforeEach(() => setModel(flat));

  it("renders a row per field from the store", () => {
    render(<FieldEditor />);
    expect(screen.getByLabelText("Name for id")).toHaveProperty("value", "id");
    expect(screen.getByLabelText("Name for alive")).toHaveProperty("value", "alive");
  });

  it('appends a field when "Add field" is clicked', () => {
    render(<FieldEditor />);
    fireEvent.click(screen.getByRole("button", { name: "Add field" }));
    const fields = useStructStore.getState().currentModel.fields;
    expect(fields).toHaveLength(3);
    expect(fields[2].name).toBe("newField");
    expect(screen.getByLabelText("Name for newField")).toBeTruthy();
  });

  it("editing a field name flows back into the store", () => {
    render(<FieldEditor />);
    fireEvent.change(screen.getByLabelText("Name for id"), {
      target: { value: "playerId" },
    });
    expect(useStructStore.getState().currentModel.fields[0].name).toBe("playerId");
  });

  it("renders an editable nested struct and edits reach the store", () => {
    setModel(nested);
    render(<FieldEditor />);
    // Nested struct name + inner field both render.
    expect(screen.getByLabelText("Struct name for position")).toHaveProperty(
      "value",
      "Vec3"
    );
    const innerX = screen.getByLabelText("Name for x");
    expect(innerX).toBeTruthy();

    fireEvent.change(innerX, { target: { value: "px" } });
    const inner = useStructStore.getState().currentModel.fields[1].nested!.fields;
    expect(inner[0].name).toBe("px");
  });
});
