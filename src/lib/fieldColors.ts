// Shared field palette. The actual colors live in globals.css as --field-N
// variables with separate dark/light values, so blocks follow the theme.
// Both the main visualizer and MiniLayoutStrip must use this list so a field
// keeps the same color everywhere (same modulo base).
export const FIELD_COLORS = [
  "var(--field-0)", // blue
  "var(--field-1)", // emerald
  "var(--field-2)", // pink
  "var(--field-3)", // amber
  "var(--field-4)", // violet
  "var(--field-5)", // rose
  "var(--field-6)", // cyan
  "var(--field-7)", // lime
  "var(--field-8)", // orange
  "var(--field-9)", // fuchsia
];
