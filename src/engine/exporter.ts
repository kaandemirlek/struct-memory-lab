// ============================================================================
// exporter.ts  ← PERSON B
// ============================================================================
// StructModel'i (1) geçerli, derlenebilir C++ .hpp metnine ve (2) yapılandırılmış
// JSON'a çevirir. C++ çıktısı her alanın offset/size bilgisini yorum olarak,
// padding'i de yorum satırı olarak gösterir.
// ============================================================================

import type { CppPrimitive, Field, StructModel } from "@/types";

export interface ExportCppOptions {
  /** Alan başına offset/size yorumlarını, padding ve sizeof özetini ekle (varsayılan: true). */
  comments?: boolean;
}
import { computeLayout } from "@/engine/layout";

const INDENT = "    ";

const CSTDINT_TYPES: ReadonlySet<CppPrimitive> = new Set<CppPrimitive>([
  "int8_t",
  "uint8_t",
  "int16_t",
  "uint16_t",
  "int32_t",
  "uint32_t",
  "int64_t",
  "uint64_t",
]);

const needsCstdint = (model: StructModel): boolean =>
  model.fields.some((f) => CSTDINT_TYPES.has(f.type));

/** size_t <cstddef> başlığını gerektirir (<cstdint> değil). */
const needsCstddef = (model: StructModel): boolean =>
  model.fields.some((f) => f.type === "size_t");

/** Alan deklarasyonu (yorumsuz): "uint8_t name[16];" */
function declOf(field: Field): string {
  const suffix = field.arrayLength > 1 ? `[${field.arrayLength}]` : "";
  return `${field.type} ${field.name}${suffix};`;
}

const pad = (n: number) => `${INDENT}// ${n} ${n === 1 ? "byte" : "bytes"} padding`;

export function exportCpp(
  model: StructModel,
  options: ExportCppOptions = {}
): string {
  const withComments = options.comments ?? true;
  const structName = model.name.trim() || "Struct";
  const layout = computeLayout(model);
  const lines: string[] = ["#pragma once"];

  const includes: string[] = [];
  if (needsCstdint(model)) includes.push("#include <cstdint>");
  if (needsCstddef(model)) includes.push("#include <cstddef>");
  if (includes.length > 0) lines.push("", ...includes);

  lines.push("", `struct ${structName} {`);

  if (model.fields.length === 0) {
    lines.push(`${INDENT}// (no fields)`);
  } else if (withComments) {
    const decls = model.fields.map(declOf);
    const width = Math.max(...decls.map((d) => d.length));

    model.fields.forEach((field, i) => {
      const fl = layout.fields[i];
      if (fl.paddingBefore > 0) lines.push(pad(fl.paddingBefore));
      lines.push(
        `${INDENT}${decls[i].padEnd(width)}  // offset ${fl.offset}, size ${fl.size}`
      );
    });

    // Trailing (tail) padding to the struct's alignment.
    const last = layout.fields[layout.fields.length - 1];
    const trailing = layout.totalSize - (last.offset + last.size);
    if (trailing > 0) lines.push(pad(trailing));
  } else {
    for (const field of model.fields) lines.push(`${INDENT}${declOf(field)}`);
  }

  lines.push("};");
  if (withComments) {
    lines.push(
      "",
      `// sizeof = ${layout.totalSize} bytes, alignment = ${layout.alignment} bytes, padding = ${layout.totalPadding} bytes`
    );
  }

  return lines.join("\n") + "\n";
}

/** Modeli + hesaplanmış layout metadata'sını yapılandırılmış JSON olarak verir. */
export function exportModelJson(model: StructModel): string {
  const layout = computeLayout(model);
  return JSON.stringify(
    {
      format: "struct-memory-lab",
      version: 1,
      struct: model,
      layout: {
        totalSize: layout.totalSize,
        alignment: layout.alignment,
        totalPadding: layout.totalPadding,
        fields: layout.fields.map((f) => ({
          name: f.name,
          type: f.type,
          offset: f.offset,
          size: f.size,
          paddingBefore: f.paddingBefore,
        })),
      },
    },
    null,
    2
  );
}
