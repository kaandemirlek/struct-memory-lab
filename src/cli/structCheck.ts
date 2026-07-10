// ============================================================================
// cli/structCheck.ts — CI GUARD for binary-incompatible struct changes
// ============================================================================
// Reuses the deterministic engine to compare a baseline struct against a
// candidate and exit non-zero when the change is binary-incompatible, so a CI
// pipeline can fail the build. Inputs may be C++ headers (.h/.hpp) or JSON
// struct models. Run via `npm run struct-check -- <baseline> <candidate>`.
// ============================================================================

import { readFileSync } from "node:fs";
import { parseCpp, parseModelJson } from "@/engine/parser";
import { diffVersions } from "@/engine/diff";
import { generateCompatibilityReport } from "@/engine/compatibility";
import { computeLayout } from "@/engine/layout";
import { isPlatform, PLATFORMS } from "@/engine/platform";
import type { Platform, StructModel } from "@/types";
import { DEFAULT_PLATFORM } from "@/types";

interface Options {
  strict: boolean;
  json: boolean;
  platform: Platform;
}

function printUsage(): void {
  console.log(`struct-check — fail CI on binary-incompatible struct changes

Usage:
  npm run struct-check -- <baseline> <candidate> [--strict] [--json] [--platform=<id>]

  <baseline>, <candidate>   .h/.hpp C++ headers, or .json struct models
  --strict                  also fail on non-breaking "risky" warnings
  --json                    emit machine-readable JSON
  --platform=<id>           target ABI: ${PLATFORMS.map((p) => p.id).join(" | ")} (default ${DEFAULT_PLATFORM})

Exit codes:
  0  compatible
  1  incompatible (breaking, or risky under --strict)
  2  usage / parse error`);
}

// JSON, uygulamayla AYNI yoldan yüklenir (parseModelJson): hem ham modeli hem
// tam export objesini ({ format, struct, layout }) kabul eder ve alanları
// normalize eder. Hata mesajına dosya yolu eklenir (CI logunda iz sürülebilsin).
// Parse platformdan bağımsızdır (long/size_t olduğu gibi saklanır); platform
// yalnızca aşağıda computeLayout'ta rol oynar.
function loadModel(path: string): StructModel {
  const raw = readFileSync(path, "utf8");
  try {
    return path.toLowerCase().endsWith(".json") ? parseModelJson(raw) : parseCpp(raw);
  } catch (e) {
    throw new Error(`${path}: ${e instanceof Error ? e.message : String(e)}`);
  }
}

function parseArgs(argv: string[]): { files: string[]; opts: Options } {
  const files: string[] = [];
  const opts: Options = { strict: false, json: false, platform: DEFAULT_PLATFORM };
  for (const a of argv) {
    if (a === "--strict") opts.strict = true;
    else if (a === "--json") opts.json = true;
    else if (a.startsWith("--platform=")) {
      const v = a.slice("--platform=".length);
      if (!isPlatform(v)) {
        console.error(
          `error: unknown platform "${v}" (expected ${PLATFORMS.map((p) => p.id).join(", ")})`
        );
        process.exit(2);
      }
      opts.platform = v;
    } else if (a === "-h" || a === "--help") {
      printUsage();
      process.exit(0);
    } else files.push(a);
  }
  return { files, opts };
}

const mark = (severity: string) =>
  severity === "danger" ? "x" : severity === "warning" ? "!" : "-";

export function main(argv: string[]): void {
  const { files, opts } = parseArgs(argv);
  if (files.length !== 2) {
    printUsage();
    process.exit(2);
  }

  let base: StructModel;
  let candidate: StructModel;
  try {
    base = loadModel(files[0]);
    candidate = loadModel(files[1]);
  } catch (e) {
    console.error(`error: ${e instanceof Error ? e.message : String(e)}`);
    process.exit(2);
  }

  const layoutFn = (m: StructModel) => computeLayout(m, opts.platform);
  const changes = diffVersions(base, candidate);
  const report = generateCompatibilityReport(base, candidate, layoutFn);
  const incompatible =
    report.verdict === "breaking" || (opts.strict && report.verdict === "risky");

  if (opts.json) {
    console.log(
      JSON.stringify(
        {
          baseline: files[0],
          candidate: files[1],
          platform: opts.platform,
          verdict: report.verdict,
          binaryCompatible: report.binaryCompatible,
          summary: report.summary,
          changes,
          warnings: report.warnings,
          incompatible,
        },
        null,
        2
      )
    );
  } else {
    console.log(`struct-check: ${files[0]} -> ${files[1]}`);
    console.log(
      `struct: ${base.name}${base.name !== candidate.name ? ` -> ${candidate.name}` : ""}\n`
    );

    if (changes.length === 0) {
      console.log("No changes.");
    } else {
      console.log(`Changes (${changes.length}):`);
      for (const c of changes) console.log(`  - [${c.kind}] ${c.detail}`);
    }

    console.log(
      `\nVerdict: ${report.verdict.toUpperCase()} ` +
        `(${report.summary.danger} breaking, ${report.summary.warning} warnings, ${report.summary.info} notes)`
    );
    for (const w of report.warnings) console.log(`  ${mark(w.severity)} ${w.message}`);
    console.log(
      incompatible
        ? "\nFAIL: binary-incompatible change."
        : "\nOK: change is binary-compatible."
    );
  }

  process.exit(incompatible ? 1 : 0);
}
