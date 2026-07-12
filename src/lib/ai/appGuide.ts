// ============================================================================
// lib/ai/appGuide.ts — KNOWLEDGE ABOUT THE APP ITSELF (features + how-tos)
// ============================================================================
// The struct CONTEXT (context.ts) tells the assistant about the user's data;
// this file tells it about the PRODUCT — what every feature does and where the
// controls are — so it can answer "how do I add a nested struct?", "where is
// the Import button?", "how do I compare versions?", "what does this do?".
//
// Used by BOTH:
//   • prompt.ts  → APP_GUIDE goes into the live (OpenAI) system prompt.
//   • mock.ts    → HOWTOS give the offline mode deterministic how-to answers.
//
// Keep it accurate: every location below matches the real UI. When a feature
// moves, update it here (one source of truth for both modes).
// ============================================================================

/** A deterministic how-to answer the offline mock can return. */
export interface HowTo {
  /** Lowercase substrings; if the user's question contains any, this matches. */
  keywords: string[];
  answer: string;
}

export const HOWTOS: HowTo[] = [
  {
    keywords: ["nested", "sub-struct", "substruct", "struct inside", "inner struct", "struct field"],
    answer:
      'To add a nested struct: in the Fields panel (left), open a field\'s type dropdown and choose "struct…". The field turns into a nested struct (named "NewStruct") with one starter member. Rename it in its struct-name box and use its "+ Add field" button to add members — inner fields are edited inline, just like top-level ones. You can also import a C++ header that already defines a nested struct.',
  },
  {
    keywords: ["add a field", "add field", "new field", "add member", "insert field", "add a member"],
    answer:
      'Click "Add field" at the top-right of the Fields panel (left column). A new int32_t field appears at the bottom; edit its name, type, and array count inline. To add a field inside a nested struct, use that struct\'s "+ Add field" button. When the Fields panel is collapsed to a rail, the "+" icon adds a field too.',
  },
  {
    keywords: ["compare", "two versions", "difference between version", "diff between", "compatibility report"],
    answer:
      'First save at least one version (right sidebar → "Save version"). Then open the "Compare Versions" tab in the middle. In the right sidebar pick your two targets — left-click a version to set it as "From", right-click to set "To" (or use the From/To dropdowns). You get a color-coded diff plus a binary-compatibility report with a breaking / risky / compatible verdict.',
  },
  {
    keywords: ["import", "paste a struct", "paste struct", "load a struct", "load struct", "open a header", "upload"],
    answer:
      'Click "Import" in the top header. Paste a C++ header (.h/.hpp) or a JSON model into the box — or use "Upload file" — then click "Parse struct". Headers exported from this tool re-import losslessly, including Status Bits.',
  },
  {
    keywords: ["export", "download", "save as", "generate a header", "generate header", "get the .hpp", ".hpp", "produce a header"],
    answer:
      'Click "Export" in the top header. You can copy or download a C++ .hpp (with offset comments and static_assert layout locks), a JSON model, or a Markdown diff report. The .hpp embeds the model, so re-importing it restores everything exactly.',
  },
  {
    keywords: ["save version", "snapshot", "save a version", "versioning", "save my work", "save progress"],
    answer:
      'In the right sidebar (Edit Layout tab), click "Save version" to snapshot the current struct with a timestamp. Saved versions list in the sidebar — click one to preview it read-only (your live edits stay untouched), and rename or delete it there.',
  },
  {
    keywords: ["optimize", "reorder to", "rearrange", "shrink the struct", "save bytes", "reduce the size", "tighter", "smaller struct"],
    answer:
      'When reordering fields would shrink the struct, a green Optimizer panel appears under the Memory Layout showing the byte savings and a before/after — click "Apply" to reorder. You can also drag field handles to reorder manually. (Reordering by alignment, largest-first, removes most padding.)',
  },
  {
    keywords: ["status bit", "bit field", "bitfield", "bit-field", "flag", "individual bit", "bit layout", "bit meaning"],
    answer:
      'The "Status Bits" panel (below the Memory Layout) defines the meaning of individual bits inside an unsigned-integer field — flags and small enums. Click an unsigned int field in the layout to jump to its bit editor, then drag on the bit grid to create/resize bit ranges and label them. Export turns these into portable #define MASK/SHIFT macros.',
  },
  {
    keywords: ["platform", "abi", "windows", "linux", "32-bit", "32 bit", "lp64", "llp64", "ilp32", "long is", "target platform"],
    answer:
      "Use the platform dropdown in the top header to switch ABI: Linux/macOS x64 (LP64), Windows x64 (LLP64), or 32-bit x86 (ILP32). It changes the size of long and size_t and the alignment of 8-byte types, and the layout updates live — no re-import needed.",
  },
  {
    keywords: ["pragma pack", "pack(", "packed", "packing", "alignas"],
    answer:
      "Packing is honored on import: paste a header with #pragma pack(push, N) … #pragma pack(pop) and the layout caps each field's alignment at N; Export re-emits the pragma. There's no UI toggle for it yet — set it via Import.",
  },
  {
    keywords: ["share", "permalink", "copy link", "send a link", "url to", "link to this", "code review link"],
    answer:
      "Each saved version has a link (chain) icon in the right sidebar that copies a permalink — a URL that encodes the struct in its hash. Opening it loads the tool at that exact struct, which is handy for code reviews and tickets. Nothing is sent to a server.",
  },
  {
    keywords: ["annotat", "leave a note", "add a note", "notes on", "comment on a field"],
    answer:
      'You can attach notes to a specific field or version (e.g. "don\'t move this — the serializer depends on the offset"). Use the Annotations panel in the middle column to add, edit, or delete notes; they\'re saved with your work.',
  },
  {
    keywords: ["undo", "redo", "revert", "made a mistake", "go back a step"],
    answer:
      "Use the undo/redo arrows in the top header (or Ctrl+Z / Ctrl+Y). Every field edit is tracked, so you can step backward and forward freely.",
  },
  {
    keywords: ["reorder", "move a field", "change the order", "rearrange fields", "drag a field"],
    answer:
      "Drag a field by its handle (the dotted grip at the left of each row) to reorder it. Reordering changes offsets and can affect binary compatibility, so the layout and the compatibility report update live as you move things.",
  },
  {
    keywords: ["rename", "change the name", "change a name"],
    answer:
      'Click a field\'s name box in the Fields panel and type a new name; edit the "Struct name" box at the top to rename the whole struct. Renames are tracked across versions (shown as "renamed", not add+remove).',
  },
  {
    keywords: ["array", "make it an array", "multiple elements", "array length", "array count", "[16]", "how many elements"],
    answer:
      "Set a field's count in the × number box next to its type — e.g. 5 makes uint32_t age[5]. The layout draws each element and multiplies the size accordingly.",
  },
  {
    keywords: ["dark mode", "light mode", "theme", "night mode"],
    answer: "Toggle light/dark with the sun/moon button in the top header.",
  },
  {
    keywords: ["live mode", "offline mode", "openai", "api key", "enable ai", "are you live", "ai working", "ai_mode"],
    answer:
      "I run offline by default — deterministic answers about your struct and how to use this app. For full conversational answers, set AI_MODE=live and an OPENAI_API_KEY in .env.local and restart the dev server. A Live/Offline badge in the header shows which mode you're in; if a live call fails it silently falls back to offline.",
  },
  {
    keywords: ["what is this app", "what can this app", "what does this app", "what can you do", "what can i do here", "overview", "what is this tool", "getting started", "get started", "what does this do"],
    answer:
      'This is Struct Memory Lab: import or edit a C++ struct and see its exact memory layout — offsets, padding, alignment, and sizeof. You can snapshot versions, compare any two with a binary-compatibility report, optimize field order to cut padding, define bit-level "Status Bits", switch the target platform/ABI, and export a C++ header, JSON, or a diff report. Ask me "how do I…" for any feature.',
  },
];

// ---------------------------------------------------------------------------
// APP_GUIDE — prose form of the same knowledge for the live system prompt.
// Kept compact to limit prompt tokens while covering every feature.
// ---------------------------------------------------------------------------
export const APP_GUIDE = `About this app (answer how-to and "where is…" questions from this):
Struct Memory Lab imports/edits a C++ struct and shows its exact memory layout (offsets, padding, alignment, sizeof), computed by a deterministic engine.

Top header: app logo; platform/ABI dropdown (Linux/macOS x64 LP64, Windows x64 LLP64, 32-bit x86 ILP32 — changes long/size_t size and 8-byte alignment, layout updates live); light/dark toggle; Undo/Redo (Ctrl+Z / Ctrl+Y); Import; Export.

Left "Fields" panel (collapsible to a rail): a Struct name box, then one row per field with a drag handle, name box, type dropdown, an × count box (arrays), and a remove ×. "Add field" is top-right. To make a field a nested struct, pick "struct…" in its type dropdown; it gains its own name box and a "+ Add field" for inner members (edited inline). Choosing a primitive again clears the nesting.

Middle: two tabs. "Edit Layout" shows the Memory Layout (proportional colored byte map with an offset ruler; hatched blocks are padding; click a struct field to expand its inner layout; click an unsigned-int field to jump to its Status Bits editor), a Byte limit warning input, and the Status Bits panel (define flags/enums on the bits of unsigned-int fields; exported as #define MASK/SHIFT macros). An Annotations panel lets you attach notes to fields/versions. A green Optimizer panel appears when reordering would cut padding ("Apply" to reorder). "Compare Versions" shows a diff and a binary-compatibility report (breaking/risky/compatible) between two chosen versions.

Right sidebar (collapsible): "Save version" snapshots the struct; click a snapshot to preview it read-only; rename/delete it; a link icon copies a shareable permalink (struct encoded in the URL). In Compare mode, left-click a version to set From, right-click to set To.

Import (header): paste a C++ header or JSON, or upload a file, then "Parse struct". Supports nested structs, arrays, #pragma pack(N), native bit-fields (uint32_t f:3), enums, and typedef/using. Export (header): C++ .hpp (offset comments + static_assert locks + an embedded model for lossless re-import), JSON, or a Markdown diff report. Work autosaves to the browser.`;
