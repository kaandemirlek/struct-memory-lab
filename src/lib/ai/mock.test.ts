import { describe, it, expect } from "vitest";
import { mockChatReply } from "./mock";
import type { StructContext } from "./types";

const ctx: StructContext = {
  name: "Player",
  fields: [
    { name: "id", type: "uint32_t", arrayLength: 1, offset: 0, size: 4, paddingBefore: 0 },
    { name: "health", type: "double", arrayLength: 1, offset: 8, size: 8, paddingBefore: 4 },
  ],
  totalSize: 16,
  alignment: 8,
  totalPadding: 4,
  versions: [],
  comparison: null,
};

describe("mockChatReply — struct data intents (unchanged)", () => {
  it("answers size questions from the context", () => {
    expect(mockChatReply(ctx, "how big is this struct?")).toContain("16 bytes");
  });

  it("answers padding questions", () => {
    expect(mockChatReply(ctx, "why is there padding?").toLowerCase()).toContain("padding");
  });

  it('"what changed" stays a data question, not a how-to', () => {
    // Should describe the (absent) comparison, not the "how to compare" guide.
    expect(mockChatReply(ctx, "what changed in the latest version?")).toMatch(
      /no comparison|no differences|from /i
    );
  });
});

describe("mockChatReply — app how-to intents (new)", () => {
  it("explains how to add a nested struct", () => {
    const a = mockChatReply(ctx, "how can I add a nested struct?");
    expect(a).toMatch(/type dropdown/i);
    expect(a).toMatch(/struct/i);
  });

  it("explains how to compare versions", () => {
    const a = mockChatReply(ctx, "how do I compare two versions?");
    expect(a).toMatch(/Compare Versions/i);
    expect(a).toMatch(/From|To/);
  });

  it("locates the import control", () => {
    expect(mockChatReply(ctx, "where is the import button?")).toMatch(/Import/);
  });

  it("locates the export control", () => {
    expect(mockChatReply(ctx, "how do I export a header?")).toMatch(/Export/);
  });

  it("gives an overview for 'what does this do'", () => {
    expect(mockChatReply(ctx, "what does this do?")).toMatch(/Struct Memory Lab/);
  });

  it("explains platform switching", () => {
    expect(mockChatReply(ctx, "how do I change the platform to Windows?")).toMatch(
      /platform dropdown/i
    );
  });
});

describe("mockChatReply — Status Bits grounding", () => {
  const bitCtx: StructContext = {
    ...ctx,
    fields: [
      {
        name: "id",
        type: "uint32_t",
        arrayLength: 1,
        offset: 0,
        size: 4,
        paddingBefore: 0,
        bitFields: [
          {
            name: "region",
            wordIndex: 0,
            startBit: 16,
            width: 4,
            bitRange: "bits 16–19",
            kind: "uint",
          },
        ],
      },
    ],
  };

  it("answers which bit stands for what from the context", () => {
    const a = mockChatReply(bitCtx, "what does id's 16th bit stand for?");
    expect(a).toMatch(/region/);
    expect(a).toMatch(/16/);
  });

  it("guides the user when no status bits are defined", () => {
    expect(mockChatReply(ctx, "are there any status bits?")).toMatch(/Status Bits panel/i);
  });
});
