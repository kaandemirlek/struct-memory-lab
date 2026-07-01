// ============================================================================
// lib/share.ts — SHAREABLE STRUCT PERMALINKS
// ============================================================================
// Encodes a struct model into a URL hash so a link opens the tool at that exact
// struct/version — handy for code reviews and tickets. Everything lives in the
// hash (base64url), so no server round-trip and nothing is logged server-side.
// ============================================================================

import { TYPE_INFO, type StructModel } from "@/types";

function toBase64Url(json: string): string {
  const b64 = btoa(String.fromCharCode(...new TextEncoder().encode(json)));
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(s: string): string {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

/** Serialize just the model shape (id/name/fields) — not the whole store. */
export function encodeModel(model: StructModel): string {
  return toBase64Url(JSON.stringify({ name: model.name, fields: model.fields }));
}

/** Build a full shareable URL for the given model (browser-only). */
export function buildShareUrl(model: StructModel): string {
  const { origin, pathname } = window.location;
  return `${origin}${pathname}#s=${encodeModel(model)}`;
}

/** Validate a decoded object really is a usable StructModel. */
function isValidModel(obj: unknown): obj is StructModel {
  if (!obj || typeof obj !== "object") return false;
  const m = obj as { name?: unknown; fields?: unknown };
  if (typeof m.name !== "string" || !Array.isArray(m.fields)) return false;
  return m.fields.every((f) => {
    const field = f as Record<string, unknown>;
    return (
      typeof field.id === "string" &&
      typeof field.name === "string" &&
      typeof field.type === "string" &&
      field.type in TYPE_INFO &&
      typeof field.arrayLength === "number"
    );
  });
}

/** Parse a `#s=...` hash into a model, or null if absent/invalid. */
export function decodeModelFromHash(hash: string): StructModel | null {
  const match = /[#&]s=([^&]+)/.exec(hash);
  if (!match) return null;
  try {
    const model = JSON.parse(fromBase64Url(decodeURIComponent(match[1])));
    return isValidModel(model) ? model : null;
  } catch {
    return null;
  }
}

/**
 * If the URL carries a shared struct, apply it and strip the hash (so a refresh
 * doesn't re-apply it). Returns true when a shared model was loaded.
 */
export function consumeSharedModel(apply: (model: StructModel) => void): boolean {
  if (typeof window === "undefined") return false;
  const model = decodeModelFromHash(window.location.hash);
  if (!model) return false;
  apply(model);
  window.history.replaceState(null, "", window.location.pathname + window.location.search);
  return true;
}
