// ============================================================================
// lib/ai/mock.ts — BEST-EFFORT OFFLINE CHAT
// ============================================================================
// Default mode for the AI layer. Free-form chat can't be truly faked, but
// because the grounding context carries every computed number, the mock can
// answer the most common questions (size, padding, alignment, fields,
// versions, what-changed) deterministically — so the assistant stays useful on
// the locked-down company machine. Anything outside those intents gets an
// honest "enable live mode" reply. The live (OpenAI) path is opt-in via env.
// ============================================================================

import type { AiRequest, StructContext } from "./types";
import { HOWTOS } from "./appGuide";

const bytes = (n: number) => `${n} byte${n === 1 ? "" : "s"}`;

function describeSize(c: StructContext): string {
  return (
    `"${c.name}" is ${bytes(c.totalSize)} in total, aligned to ${bytes(c.alignment)}, ` +
    `with ${bytes(c.totalPadding)} of padding.`
  );
}

function describePadding(c: StructContext): string {
  const gaps = c.fields.filter((f) => f.paddingBefore > 0);
  if (c.totalPadding === 0) {
    return `"${c.name}" has no padding — every field is already naturally aligned.`;
  }
  const parts = gaps.map(
    (f) => `${f.paddingBefore} byte${f.paddingBefore === 1 ? "" : "s"} before "${f.name}" (so it lands on offset ${f.offset})`
  );
  const tail = c.totalPadding - gaps.reduce((s, f) => s + f.paddingBefore, 0);
  if (tail > 0) parts.push(`${bytes(tail)} of tail padding at the end`);
  return (
    `"${c.name}" has ${bytes(c.totalPadding)} of padding: ${parts.join("; ")}. ` +
    `Padding appears because each type must sit on an offset that's a multiple of its alignment.`
  );
}

function describeAlignment(c: StructContext): string {
  return (
    `"${c.name}" is aligned to ${bytes(c.alignment)} — that's the largest alignment of any field. ` +
    `The whole struct's size is rounded up to a multiple of that so arrays of it stay aligned.`
  );
}

function describeBits(c: StructContext): string {
  const withBits = c.fields.filter((f) => f.bitFields && f.bitFields.length > 0);
  if (withBits.length === 0) {
    return (
      "No Status Bits are defined yet. In the Memory Layout, click an unsigned-integer " +
      "field, then use the Status Bits panel to define flags/enums on its individual bits."
    );
  }
  const parts = withBits.map((f) => {
    const bits = f
      .bitFields!.map((b) => {
        const meanings =
          b.meanings && b.meanings.length > 0
            ? ` (${b.meanings.map((m) => `${m.value}=${m.label}`).join(", ")})`
            : "";
        return `${b.name} — ${b.bitRange}, ${b.kind}${meanings}`;
      })
      .join("; ");
    return `"${f.name}": ${bits}`;
  });
  return `Status Bits defined — ${parts.join(" · ")}.`;
}

function describeFields(c: StructContext): string {
  const list = c.fields
    .map((f) => `${f.name} (${f.type}${f.arrayLength > 1 ? `[${f.arrayLength}]` : ""}) @${f.offset}`)
    .join(", ");
  return `"${c.name}" has ${c.fields.length} field${c.fields.length === 1 ? "" : "s"}: ${list}.`;
}

function describeVersions(c: StructContext): string {
  if (c.versions.length === 0) {
    return `No versions saved yet. Use "Save version" in Edit Layout to snapshot the struct.`;
  }
  const list = c.versions.map((v) => `${v.label} (${v.fieldCount} fields)`).join(", ");
  return `There ${c.versions.length === 1 ? "is" : "are"} ${c.versions.length} saved version${c.versions.length === 1 ? "" : "s"}: ${list}.`;
}

function describeChanges(c: StructContext): string {
  if (!c.comparison) {
    return `No comparison is selected. Open the Compare Versions tab and pick a From and a To version, and I can summarize what changed.`;
  }
  const cmp = c.comparison;
  if (cmp.changes.length === 0) {
    return `There are no differences between ${cmp.fromLabel} and ${cmp.toLabel}.`;
  }
  const changeList = cmp.changes.map((ch) => ch.detail).join("; ");
  const verdict =
    cmp.verdict === "breaking"
      ? "This is a binary-breaking change — code reading the old byte layout can misread data."
      : cmp.verdict === "risky"
        ? "No hard breaks, but review the warnings before shipping."
        : "These changes are binary-compatible.";
  const warnings = cmp.warnings.length > 0 ? ` Notable: ${cmp.warnings.slice(0, 3).join(" ")}` : "";
  return `From ${cmp.fromLabel} to ${cmp.toLabel}: ${changeList}. ${verdict}${warnings}`;
}

const OFFLINE_HINT =
  "I'm running offline, so I can answer questions about this struct (size, " +
  "padding, alignment, fields, versions, what changed) and how to use this app " +
  '(try "how do I add a nested struct?" or "how do I compare versions?"). ' +
  "For open-ended help, enable live mode (AI_MODE=live).";

// Bir soru "nasıl / nerede / bu ne yapar" gibi bir kullanım (how-to) sorusu mu?
// Öyleyse önce uygulama rehberine (HOWTOS) bakarız; değilse veri intent'lerine.
// Bu ayrım "en son versiyonda ne değişti" (veri) ile "versiyonları nasıl
// karşılaştırırım" (how-to) sorularını birbirine karıştırmaz.
const HOWISH = /\b(how|where|steps?|guide)\b/;
const isHowish = (q: string): boolean =>
  HOWISH.test(q) ||
  ["what is", "what does", "what's", "whats", "can i", "do i", "where's"].some((p) =>
    q.includes(p)
  );

/** Uygulama rehberinden (nasıl yapılır) eşleşen ilk yanıtı döndürür; yoksa null. */
function matchHowTo(q: string): string | null {
  for (const h of HOWTOS) {
    if (h.keywords.some((k) => q.includes(k))) return h.answer;
  }
  return null;
}

/** Deterministic intent match on the latest user message. */
export function mockChatReply(context: StructContext, lastUserMessage: string): string {
  const q = lastUserMessage.toLowerCase();

  // Tam kelime/deyim eşleşmesi (\b...\b) — düz includes() "hi"yi "which"in,
  // "pad"i "padding"in içinde bulup yanlış intent'e düşüyordu. Kelime kökleri
  // yerine türevler listeye açıkça yazılır ("align", "aligned", "alignment").
  const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const has = (...terms: string[]) =>
    terms.some((t) => new RegExp(`\\b${escapeRe(t)}\\b`).test(q));

  // Nasıl/nerede tarzı sorularda önce uygulama rehberi (yoksa veri intent'lerine düşer).
  const howto = matchHowTo(q);
  if (howto && isHowish(q)) return howto;

  if (has("padding", "pad", "padded", "gap", "gaps", "wasted")) return describePadding(context);
  if (has("align", "aligned", "alignment")) return describeAlignment(context);
  if (has("size", "sizeof", "how big", "how large", "byte", "bytes", "total")) return describeSize(context);
  if (
    has(
      "what changed", "changed", "change", "changes", "diff", "difference",
      "differences", "impact", "break", "breaks", "breaking",
      "compat", "compatible", "compatibility", "incompatible"
    )
  )
    return describeChanges(context);
  if (has("version", "versions", "snapshot", "snapshots", "history")) return describeVersions(context);
  if (has("bit", "bits", "flag", "flags", "status word", "status bits")) return describeBits(context);
  if (has("field", "fields", "how many", "member", "members", "list")) return describeFields(context);
  if (has("hi", "hello", "hey", "help", "what can you")) {
    return `Hi! ${describeSize(context)} ${OFFLINE_HINT}`;
  }

  // Veri intent'i tutmadı ama bir how-to eşleşmesi varsa (howish olmasa bile) onu ver.
  if (howto) return howto;

  // Unknown intent — stay honest and give a quick snapshot to be useful anyway.
  return `${OFFLINE_HINT}\n\nRight now: ${describeSize(context)}`;
}

/** Route the request to the matching deterministic reply. */
export function renderMock(req: AiRequest): string {
  switch (req.kind) {
    case "chat": {
      const last = [...req.payload.messages].reverse().find((m) => m.role === "user");
      return mockChatReply(req.payload.context, last?.content ?? "");
    }
    default: {
      // Exhaustiveness guard — new kinds must add a branch above.
      const _never: never = req.kind;
      return `No reply available for "${_never}".`;
    }
  }
}
