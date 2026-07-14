// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, act, fireEvent } from "@testing-library/react";
import LayoutVisualizer from "@/components/LayoutVisualizer";
import { useStructStore } from "@/store/useStructStore";
import type { Platform, StructModel } from "@/types";

// char + long + size_t → the three ABIs give three different sizes, which makes
// this a good regression guard for the platform-reactive layout.
const model: StructModel = {
  name: "S",
  fields: [
    { id: "f1", name: "tag", type: "char", arrayLength: 1 },
    { id: "f2", name: "id", type: "long", arrayLength: 1 },
    { id: "f3", name: "count", type: "size_t", arrayLength: 1 },
  ],
};

const setup = (platform: Platform = "linux64") =>
  useStructStore.setState({
    currentModel: model,
    versions: [],
    past: [],
    future: [],
    previewVersionId: null,
    baseVersionId: null,
    targetVersionId: null,
    platform,
  });

afterEach(cleanup);

describe("<LayoutVisualizer mode='edit' />", () => {
  beforeEach(() => setup("linux64"));

  it("renders the computed size/alignment summary and field names", () => {
    render(<LayoutVisualizer mode="edit" />);
    expect(screen.getByText(/size 24 B · align 8 B/)).toBeTruthy();
    // Field labels appear in the interactive band.
    expect(screen.getAllByText("tag").length).toBeGreaterThan(0);
    expect(screen.getAllByText("count").length).toBeGreaterThan(0);
  });

  it("recomputes live when the platform changes (no re-import)", () => {
    render(<LayoutVisualizer mode="edit" />);
    expect(screen.getByText(/size 24 B/)).toBeTruthy();

    act(() => useStructStore.getState().setPlatform("win64"));
    expect(screen.getByText(/size 16 B/)).toBeTruthy();

    act(() => useStructStore.getState().setPlatform("x86-32"));
    expect(screen.getByText(/size 12 B/)).toBeTruthy();
  });
});

describe("<LayoutVisualizer mode='compare' /> changed regions", () => {
  const before: StructModel = {
    name: "Packet",
    fields: [
      { id: "f1", name: "tag", type: "uint8_t", arrayLength: 1 },
      { id: "f2", name: "status", type: "uint32_t", arrayLength: 1 },
      { id: "f3", name: "tail", type: "uint8_t", arrayLength: 1 },
    ],
  };

  const after: StructModel = {
    name: "Packet",
    fields: [
      { id: "f1", name: "tag", type: "uint8_t", arrayLength: 1 },
      { id: "f2", name: "status", type: "uint64_t", arrayLength: 1 },
      { id: "f3", name: "tail", type: "uint8_t", arrayLength: 1 },
    ],
  };

  beforeEach(() =>
    useStructStore.setState({
      currentModel: after,
      versions: [
        {
          id: "v1",
          label: "v1",
          model: before,
          createdAt: "2026-07-14T00:00:00.000Z",
        },
      ],
      past: [],
      future: [],
      previewVersionId: null,
      baseVersionId: "v1",
      targetVersionId: null,
      platform: "linux64",
    })
  );

  it("keeps Strip/Rows available and preserves strip scale, offsets, bits, and padding", () => {
    render(<LayoutVisualizer mode="compare" />);

    const normalStrips = screen.getAllByLabelText("Memory layout strip");
    expect(normalStrips).toHaveLength(2);
    expect(normalStrips.every((strip) => strip.classList.contains("h-32"))).toBe(true);

    const normalStatusWidths = [
      (document.querySelector('[title^="status: offset 4, 4 bytes"]') as HTMLElement)
        .style.width,
      (document.querySelector('[title^="status: offset 8, 8 bytes"]') as HTMLElement)
        .style.width,
    ];

    fireEvent.click(screen.getByRole("checkbox", { name: /only changed regions/i }));

    expect(screen.getByRole("button", { name: "Strip" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Rows" })).toBeTruthy();

    const changedStrips = screen.getAllByLabelText("Changed regions strip");
    expect(changedStrips).toHaveLength(2);
    expect(changedStrips.every((strip) => strip.classList.contains("h-32"))).toBe(true);
    expect(screen.getAllByLabelText("Byte offsets")).toHaveLength(2);

    const changedStatusWidths = [
      (document.querySelector(
        '[title^="status: uint32_t — offset 4, 4 bytes"]'
      ) as HTMLElement).style.width,
      (document.querySelector(
        '[title^="status: uint64_t — offset 8, 8 bytes"]'
      ) as HTMLElement).style.width,
    ];
    expect(changedStatusWidths).toEqual(normalStatusWidths);

    expect(screen.getAllByText(/32 bits/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/64 bits/).length).toBeGreaterThan(0);
    expect(screen.getAllByLabelText(/^Padding:/).length).toBeGreaterThan(0);
  });

  it("shows only rows containing changes while retaining real row offsets and padding", () => {
    render(<LayoutVisualizer mode="compare" />);
    fireEvent.click(screen.getByRole("checkbox", { name: /only changed regions/i }));
    fireEvent.click(screen.getByRole("button", { name: "Rows" }));

    expect(screen.getByLabelText("Bytes per row")).toBeTruthy();
    expect(screen.getAllByLabelText("Changed rows")).toHaveLength(2);
    expect(screen.getAllByLabelText(/^Padding:/).length).toBeGreaterThan(0);
    expect(screen.getAllByText("8").length).toBeGreaterThan(0);
    expect(screen.getAllByText("16").length).toBeGreaterThan(0);
  });
});

describe("<LayoutVisualizer mode='compare' /> nested structs", () => {
  const position = (includeZ: boolean): StructModel => ({
    name: "Vec",
    fields: [
      { id: "x", name: "x", type: "float", arrayLength: 1 },
      { id: "y", name: "y", type: "float", arrayLength: 1 },
      ...(includeZ
        ? [{ id: "z", name: "z", type: "float" as const, arrayLength: 1 }]
        : []),
    ],
  });

  const before: StructModel = {
    name: "Player",
    fields: [
      {
        id: "position",
        name: "position",
        type: "struct",
        arrayLength: 1,
        nested: position(false),
      },
    ],
  };

  const after: StructModel = {
    name: "Player",
    fields: [
      {
        id: "position",
        name: "position",
        type: "struct",
        arrayLength: 1,
        nested: position(true),
      },
    ],
  };

  beforeEach(() =>
    useStructStore.setState({
      currentModel: after,
      versions: [
        {
          id: "v1",
          label: "v1",
          model: before,
          createdAt: "2026-07-14T00:00:00.000Z",
        },
      ],
      past: [],
      future: [],
      previewVersionId: null,
      baseVersionId: "v1",
      targetVersionId: null,
      platform: "linux64",
    })
  );

  it("expands an inner From/To comparison and shows the added field", () => {
    render(<LayoutVisualizer mode="compare" />);

    const positionBlock = document.querySelector(
      '[title^="position: offset 0, 8 bytes"]'
    );
    expect(positionBlock).toBeTruthy();
    fireEvent.click(positionBlock!);

    expect(screen.getByLabelText("Nested comparison: position")).toBeTruthy();
    expect(screen.getByText(/inner layout · 8 B → 12 B/)).toBeTruthy();
    expect(screen.getAllByText("z").length).toBeGreaterThan(0);
    expect(screen.getByText("New")).toBeTruthy();

    fireEvent.click(screen.getByRole("checkbox", { name: /only changed regions/i }));

    // The parent remains a changed region because its nested layout differs.
    expect(
      document.querySelector('[title^="position: Vec — offset 0, 8 bytes"]')
    ).toBeTruthy();
    // x/y collapse away inside the expanded comparison; z remains explicit.
    expect(screen.getByText(/No field-level changes on this side/)).toBeTruthy();
    expect(screen.getAllByText("z").length).toBeGreaterThan(0);
    expect(screen.queryByText("x")).toBeNull();
    expect(screen.queryByText("y")).toBeNull();
  });
});
