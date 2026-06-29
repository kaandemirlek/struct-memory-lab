# Versioning & Export (Person B slice)

This is the right-hand half of the app: track how the struct evolves, judge whether
a change is safe, optimize its layout, and export valid C++.

## Panels

- **Versions** — snapshot the current struct. Each row:
  - **left-click** sets it as the **From** side of the comparison (indigo highlight),
  - **right-click** sets it as the **To** side (green highlight),
  - **double-click** (or the pencil icon) renames it inline (`Enter` saves, `Esc` cancels),
  - the clock icon **restores** that snapshot into the editor,
  - the trash icon **deletes** it (with an inline confirm).
  - Each row shows its field count and relative save time (full time on hover).
- **Changes** — the diff between the chosen **From → To** (each can be any version
  or *Current edits*). Reports added / removed / renamed / type-changed / reordered.
  The header shows a change count.
- **Compatibility** — risks of the same From → To change, with a one-line
  **verdict** (`2 breaking · 1 warning`) and warnings sorted by severity:
  - offset shift, removed field, type **truncation** → **danger**
  - signedness change, int↔float reinterpret, size/alignment change → **warning**
  - widening type → **info**
- **Optimize** — suggests a field reordering (by alignment) that minimizes padding,
  shows the byte savings, and applies it on demand.
- **Export** — the generated `.hpp` (with `#pragma once` and a conditional
  `#include <cstdint>`). Copy or download; **disabled while the struct is invalid**.

## Engine (pure, deterministic, unit-tested)

`src/engine/` — `diff.ts`, `compatibility.ts`, `exporter.ts`, `validation.ts`,
`optimizer.ts`, `versioning.ts`. All covered by Vitest (`npm test`).

## State

All comparison/version state lives in the shared `src/store/useStructStore.ts`
and is persisted to `localStorage` (survives refresh). The pure
`resolveComparison` helper turns the From/To selection into concrete models.

> Shared with Person A: `src/types.ts`, the store, and `src/components/ui/*`.
> Change those by agreement.
