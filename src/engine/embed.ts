import type { BitField, BitFieldKind, StructModel } from "@/types";

/** Eski, tam StructModel JSON'u taşıyan header'lar için geri uyumluluk işareti. */
export const LEGACY_EMBED_MARKER = "// struct-memory-lab-model:";

/** Yeni header'larda tek satırlık, yalnızca uygulamaya özel metadata işareti. */
export const COMPACT_EMBED_MARKER = "// SML-META:v1:";

type CompactMeaning = [value: number, label: string];
type CompactBit = [
  id: string,
  name: string,
  wordIndex: number,
  startBit: number,
  width: number,
  kind?: BitFieldKind,
  meanings?: CompactMeaning[],
];
export type CompactField = [
  id: string,
  bits?: CompactBit[],
  nestedFields?: CompactField[],
];

function compactFields(model: StructModel): CompactField[] {
  return model.fields.map((field) => {
    const bits: CompactBit[] | undefined = field.bitFields?.map((bit) => {
      const compact: CompactBit = [
        bit.id,
        bit.name,
        bit.wordIndex,
        bit.startBit,
        bit.width,
      ];
      if (bit.kind !== undefined || bit.meanings !== undefined) {
        compact[5] = bit.kind;
      }
      if (bit.meanings !== undefined) {
        compact[6] = bit.meanings.map((meaning) => [meaning.value, meaning.label]);
      }
      return compact;
    });
    const nested = field.nested ? compactFields(field.nested) : undefined;
    return [field.id, bits, nested];
  });
}

function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value: string): string {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

/** C++'tan türetilemeyen model bilgisini küçük, versiyonlu bir payload'a çevirir. */
export function encodeCompactMetadata(model: StructModel): string {
  return toBase64Url(JSON.stringify(compactFields(model)));
}

/** Bozuk veya desteklenmeyen metadata'da null döner; normal C++ importu devam eder. */
export function decodeCompactMetadata(payload: string): CompactField[] | null {
  try {
    const parsed: unknown = JSON.parse(fromBase64Url(payload));
    return Array.isArray(parsed) ? (parsed as CompactField[]) : null;
  } catch {
    return null;
  }
}

export function expandCompactBit(raw: CompactBit): Partial<BitField> | null {
  if (!Array.isArray(raw) || typeof raw[0] !== "string" || typeof raw[1] !== "string") {
    return null;
  }
  return {
    id: raw[0],
    name: raw[1],
    wordIndex: raw[2],
    startBit: raw[3],
    width: raw[4],
    kind: raw[5],
    meanings: Array.isArray(raw[6])
      ? raw[6].map(([value, label]) => ({ value, label }))
      : undefined,
  };
}
