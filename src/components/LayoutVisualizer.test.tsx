// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, act } from "@testing-library/react";
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
