// ============================================================================
// app/api/ai/route.ts — AI ASSISTANT ROUTE HANDLER (server-only)
// ============================================================================
// POST { kind, payload } -> { text, mode }.
//
// Modes:
//   • mock (DEFAULT) — returns a deterministic, engine-grounded explanation.
//     No network, no key: works on the locked-down company machine.
//   • live — only when AI_MODE=live AND OPENAI_API_KEY is set. Calls OpenAI
//     over fetch (no SDK dependency). ANY failure (e.g. the corporate proxy
//     blocking the request) falls back to the mock, so the feature degrades
//     gracefully and never breaks the app.
//
// The API key stays server-side and is never shipped to the browser.
// ============================================================================

import { renderMock } from "@/lib/ai/mock";
import {
  describeAiAction,
  interpretAiAction,
  validateContextAiAction,
} from "@/lib/ai/actions";
import { EDITOR_TOOLS, parseEditorToolCall } from "@/lib/ai/editorTools";
import { buildMessages } from "@/lib/ai/prompt";
import type { AiAction, AiRequest, AiResponse } from "@/lib/ai/types";

// Route Handlers aren't cached for POST; make the intent explicit anyway.
export const dynamic = "force-dynamic";

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";

function isLive(): boolean {
  return process.env.AI_MODE === "live" && Boolean(process.env.OPENAI_API_KEY);
}

async function callOpenAI(req: AiRequest): Promise<{ text: string; action?: AiAction }> {
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  const res = await fetch(OPENAI_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model,
      messages: buildMessages(req),
      tools: EDITOR_TOOLS,
      tool_choice: "auto",
      temperature: 0.3,
      max_tokens: 500,
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`OpenAI responded ${res.status}${detail ? `: ${detail.slice(0, 300)}` : ""}`);
  }
  const data = await res.json();
  const message = data?.choices?.[0]?.message;
  const action = parseEditorToolCall(message?.tool_calls?.[0]);
  if (action) {
    const error = validateContextAiAction(req.payload.context, action);
    return error ? { text: error } : { text: describeAiAction(action), action };
  }
  const text = message?.content?.trim();
  if (!text) throw new Error("OpenAI returned no content or valid editor action");
  return { text };
}

function isValidRequest(body: unknown): body is AiRequest {
  if (typeof body !== "object" || body === null) return false;
  const b = body as { kind?: unknown; payload?: unknown };
  if (b.kind !== "chat") return false;
  const payload = b.payload as { messages?: unknown; context?: unknown } | undefined;
  return (
    typeof payload === "object" &&
    payload !== null &&
    Array.isArray(payload.messages) &&
    typeof payload.context === "object" &&
    payload.context !== null
  );
}

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!isValidRequest(body)) {
    return Response.json({ error: "Unsupported AI request" }, { status: 400 });
  }

  const latestUserMessage = [...body.payload.messages]
    .reverse()
    .find((message) => message.role === "user");
  const interpretation = interpretAiAction(
    body.payload.context,
    latestUserMessage?.content ?? ""
  );
  if (interpretation.matched) {
    if ("error" in interpretation) {
      return Response.json({ text: interpretation.error, mode: "mock" } satisfies AiResponse);
    }
    return Response.json({
      text: interpretation.text,
      mode: "mock",
      action: interpretation.action,
    } satisfies AiResponse);
  }

  // Live path first; on any error, fall through to the deterministic mock.
  if (isLive()) {
    try {
      const { text, action } = await callOpenAI(body);
      return Response.json({ text, mode: "live", action } satisfies AiResponse);
    } catch (err) {
      // Degrade to mock, but log WHY so a live-mode test is diagnosable
      // (bad key = 401, blocked/no proxy = ENOTFOUND/ECONNREFUSED/timeout,
      // TLS inspection = self-signed/unable-to-verify cert).
      console.error(
        "[ai] live call failed, falling back to offline mock:",
        err instanceof Error ? err.message : err
      );
    }
  }

  return Response.json({
    text: renderMock(body),
    mode: "mock",
  } satisfies AiResponse);
}
