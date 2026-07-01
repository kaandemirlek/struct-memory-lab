// ============================================================================
// lib/ai/prompt.ts — LIVE-MODE PROMPT BUILDING (OpenAI)
// ============================================================================
// Turns a grounded chat AiRequest into OpenAI chat messages. The struct context
// is injected as a system message and marked authoritative: the model explains
// it in plain language for a non-expert and must not recompute the numbers.
// ============================================================================

import type { AiRequest } from "./types";

/** OpenAI chat message shape (superset of our user/assistant turns). */
export interface OpenAiMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

const SYSTEM_PROMPT =
  "You are the assistant inside a C++ struct visualizer and versioning tool. " +
  "You help developers — including non-experts — understand a struct's memory " +
  "layout, its versions, and the risks of changing it. Be concise, friendly, " +
  "and concrete; refer to fields by name. Rules: the struct context you are " +
  "given is already computed by a deterministic engine and is authoritative — " +
  "never recompute offsets, sizes, or padding, and never invent fields or " +
  "compatibility issues that aren't in the context. If a question falls outside " +
  "the provided struct, answer from general C++ knowledge and say so. No markdown headers or code fences.";

export function buildMessages(req: AiRequest): OpenAiMessage[] {
  switch (req.kind) {
    case "chat": {
      const context = JSON.stringify(req.payload.context, null, 2);
      const messages: OpenAiMessage[] = [
        {
          role: "system",
          content:
            `${SYSTEM_PROMPT}\n\nCurrent struct context (authoritative, do not recompute):\n${context}`,
        },
      ];
      for (const m of req.payload.messages) {
        messages.push({ role: m.role, content: m.content });
      }
      return messages;
    }
    default: {
      const _never: never = req.kind;
      return [{ role: "system", content: `${SYSTEM_PROMPT} (${_never})` }];
    }
  }
}
