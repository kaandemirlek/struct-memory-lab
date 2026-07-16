// ============================================================================
// lib/ai/prompt.ts — LIVE-MODE PROMPT BUILDING (OpenAI)
// ============================================================================
// Turns a grounded chat AiRequest into OpenAI chat messages. The struct context
// is injected as a system message and marked authoritative: the model explains
// it in plain language for a non-expert and must not recompute the numbers.
// ============================================================================

import type { AiRequest } from "./types";
import { APP_GUIDE } from "./appGuide";

/** OpenAI chat message shape (superset of our user/assistant turns). */
export interface OpenAiMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

const SYSTEM_PROMPT =
  "You are the assistant inside a C++ struct visualizer and versioning tool. " +
  "You help developers — including non-experts — with two things: (1) understanding " +
  "a struct's memory layout, its versions, and the risks of changing it, and (2) using " +
  "this app itself — what each feature does, where the controls are, and how to do things " +
  "(e.g. add a nested struct, compare versions, import/export). Answer BOTH kinds of question. " +
  "Be concise, friendly, and concrete; refer to fields by name and to controls by their real " +
  "labels. Rules: the struct context you are given is already computed by a deterministic engine " +
  "and is authoritative — never recompute offsets, sizes, or padding, and never invent fields or " +
  "compatibility issues that aren't in the context. For how-to and \"where is…\" questions, use the " +
  "app guide below; don't invent buttons or features that aren't in it. If a question falls outside " +
  "both the struct and the app, answer from general C++ knowledge and say so. When the user asks to edit " +
  "Status Bits, call exactly one provided editor function instead of claiming the change was applied. " +
  "The app validates it and asks the user to Apply or Cancel. No markdown headers or code fences.";

export function buildMessages(req: AiRequest): OpenAiMessage[] {
  switch (req.kind) {
    case "chat": {
      const context = JSON.stringify(req.payload.context, null, 2);
      const messages: OpenAiMessage[] = [
        {
          role: "system",
          content:
            `${SYSTEM_PROMPT}\n\n${APP_GUIDE}\n\nCurrent struct context (authoritative, do not recompute):\n${context}`,
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
