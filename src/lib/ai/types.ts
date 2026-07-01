// ============================================================================
// lib/ai/types.ts — AI ASSISTANT LAYER (shared request/response contract)
// ============================================================================
// The AI layer is an OPTIONAL, explanation-only assistant. It NEVER computes
// layout/offsets/padding — the deterministic engine in src/engine/* is the
// single source of truth. Every request carries an already-computed grounding
// snapshot; the model only puts those facts into plain language.
// ============================================================================

/** One conversation turn in the chat. */
export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

/** A field as the assistant sees it (already computed by the engine). */
export interface ContextField {
  name: string;
  type: string;
  arrayLength: number;
  offset: number;
  size: number;
  /** Padding bytes inserted before this field for alignment. */
  paddingBefore: number;
}

/** The active From→To comparison, when one is selected. */
export interface ContextComparison {
  fromLabel: string;
  toLabel: string;
  changes: { kind: string; detail: string }[];
  verdict: "compatible" | "risky" | "breaking";
  warnings: string[];
}

/**
 * Compact, always-fresh snapshot of deterministic engine state, handed to the
 * assistant as grounding so it can answer without recomputing anything.
 */
export interface StructContext {
  name: string;
  fields: ContextField[];
  totalSize: number;
  alignment: number;
  totalPadding: number;
  /** Saved versions, newest last. */
  versions: { label: string; fieldCount: number }[];
  /** Present only when two different targets are being compared. */
  comparison: ContextComparison | null;
}

/** Discriminated request union — grows one variant per AI feature. */
export type AiRequest = {
  kind: "chat";
  payload: {
    /** Conversation so far; the final entry is the new user question. */
    messages: ChatMessage[];
    context: StructContext;
  };
};

/** Which AI feature a request targets. */
export type AiKind = AiRequest["kind"];

/** Token usage + estimated price for a live call (absent in mock mode). */
export interface AiUsage {
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  /** Estimated cost in USD from token counts × configured rates. */
  estimatedCostUsd: number;
}

export interface AiResponse {
  /** Plain-language reply to show the user. */
  text: string;
  /** Whether this came from the live model or the deterministic mock. */
  mode: "mock" | "live";
  /** Present only for live responses. */
  usage?: AiUsage;
}
