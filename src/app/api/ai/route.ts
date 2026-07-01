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
import { buildMessages } from "@/lib/ai/prompt";
import type { AiRequest, AiResponse, AiUsage } from "@/lib/ai/types";

// Route Handlers aren't cached for POST; make the intent explicit anyway.
export const dynamic = "force-dynamic";

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";

// Approximate USD per 1,000,000 tokens. These change over time — VERIFY against
// https://openai.com/api/pricing, or override with OPENAI_PRICE_IN /
// OPENAI_PRICE_OUT (USD per 1M tokens). Token counts come straight from the API
// response, so only the rate is an estimate.
const PRICING: Record<string, { in: number; out: number }> = {
  "gpt-4o-mini": { in: 0.15, out: 0.6 },
  "gpt-4o": { in: 2.5, out: 10 },
  "gpt-4.1-mini": { in: 0.4, out: 1.6 },
  "gpt-4.1": { in: 2.0, out: 8.0 },
};

function rateFor(model: string): { in: number; out: number } {
  const envIn = Number(process.env.OPENAI_PRICE_IN);
  const envOut = Number(process.env.OPENAI_PRICE_OUT);
  if (Number.isFinite(envIn) && Number.isFinite(envOut)) {
    return { in: envIn, out: envOut };
  }
  return PRICING[model] ?? { in: 0, out: 0 };
}

function isLive(): boolean {
  return process.env.AI_MODE === "live" && Boolean(process.env.OPENAI_API_KEY);
}

async function callOpenAI(req: AiRequest): Promise<{ text: string; usage: AiUsage }> {
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
      temperature: 0.3,
      max_tokens: 500,
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`OpenAI responded ${res.status}${detail ? `: ${detail.slice(0, 300)}` : ""}`);
  }
  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("OpenAI returned no content");

  const promptTokens = data?.usage?.prompt_tokens ?? 0;
  const completionTokens = data?.usage?.completion_tokens ?? 0;
  const rate = rateFor(model);
  const estimatedCostUsd =
    (promptTokens / 1_000_000) * rate.in + (completionTokens / 1_000_000) * rate.out;

  return {
    text,
    usage: {
      model,
      promptTokens,
      completionTokens,
      totalTokens: data?.usage?.total_tokens ?? promptTokens + completionTokens,
      estimatedCostUsd,
    },
  };
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

  // Live path first; on any error, fall through to the deterministic mock.
  if (isLive()) {
    try {
      const { text, usage } = await callOpenAI(body);
      return Response.json({ text, mode: "live", usage } satisfies AiResponse);
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
