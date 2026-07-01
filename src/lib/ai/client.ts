// ============================================================================
// lib/ai/client.ts — BROWSER-SIDE ENTRY POINT
// ============================================================================
// Components call askAI(); it POSTs to the /api/ai route handler, which decides
// mock vs. live server-side. Keeping a single client entry means features 2-4
// reuse this untouched.
// ============================================================================

import type { AiRequest, AiResponse } from "./types";

export async function askAI(
  req: AiRequest,
  signal?: AbortSignal
): Promise<AiResponse> {
  const res = await fetch("/api/ai", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
    signal,
  });
  if (!res.ok) {
    throw new Error(`AI request failed (${res.status})`);
  }
  return (await res.json()) as AiResponse;
}

export type { AiRequest, AiResponse } from "./types";
