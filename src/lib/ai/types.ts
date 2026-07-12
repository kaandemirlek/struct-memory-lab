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

/** A semantic bit range defined on an unsigned-integer field (Status Bits). */
export interface ContextBitField {
  name: string;
  /** Which word/array element (0 for a single field). */
  wordIndex: number;
  startBit: number;
  width: number;
  /** Human-readable range, e.g. "bit 16" or "bits 16–19" (with "word N" for arrays). */
  bitRange: string;
  /** flag | uint | int | enum. */
  kind: string;
  /** Value → label meanings, e.g. [{value:0,label:"OK"},{value:1,label:"FAIL"}]. */
  meanings?: { value: number; label: string }[];
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
  /** Status Bits defined on this field (only for unsigned-integer fields). */
  bitFields?: ContextBitField[];
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

export interface AiResponse {
  /** Plain-language reply to show the user. */
  text: string;
  /** Whether this came from the live model or the deterministic mock. */
  mode: "mock" | "live";
}
