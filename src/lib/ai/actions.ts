import { bitsPerWord, isUnsignedInt } from "@/engine/bitfields";
import type { BitMeaning, Field, StructModel } from "@/types";
import type { AiAction, ContextField, StructContext } from "./types";

export type ActionInterpretation =
  | { matched: false }
  | { matched: true; action: AiAction; text: string }
  | { matched: true; error: string };

const IDENT = "([A-Za-z_][A-Za-z0-9_]*)";
const FIELD_REF = "([A-Za-z_][A-Za-z0-9_.]*)";
const FIELD_WORD = "(?:field(?:ında|inde|unda|ünde)?|alan(?:ında|inde|unda|ünde)?)";
const FIELD_POSSESSIVE = "(?:alanındaki|fieldındaki|fieldindeki)";
const RANGE = "(\\d+)\\s*[-–]\\s*(\\d+)\\.?\\s*(?:bit(?:ler)?(?:e|ine|ına)?|bits?)";
const UNSIGNED_TYPES = new Set([
  "uint8_t", "uint16_t", "uint32_t", "uint64_t", "unsigned long",
]);

function wordIndexFrom(text: string): number {
  return Number(text.match(/\bword\s+(\d+)\b/iu)?.[1] ?? 0);
}

function overlaps(
  bits: { name?: string; wordIndex: number; startBit: number; width: number }[] | undefined,
  wordIndex: number,
  startBit: number,
  width: number,
  ignoredName?: string
): boolean {
  const end = startBit + width;
  return (bits ?? []).some(
    (bit) =>
      bit.name !== ignoredName &&
      bit.wordIndex === wordIndex &&
      startBit < bit.startBit + bit.width &&
      end > bit.startBit
  );
}

function findContextField(context: StructContext, name: string): ContextField | null {
  const exactPath = context.fields.find((field) => field.path === name);
  if (exactPath) return exactPath;
  const byName = context.fields.filter((field) => field.name === name);
  return byName.length === 1 ? byName[0] : null;
}

function validateContextRange(
  field: ContextField,
  wordIndex: number,
  startBit: number,
  endBit: number,
  ignoredName?: string
): string | null {
  if (!UNSIGNED_TYPES.has(field.type)) {
    return `"${field.name}" is ${field.type}; Status Bits require an unsigned integer field.`;
  }
  if (wordIndex < 0 || wordIndex >= field.arrayLength) {
    return `Word ${wordIndex} is outside field "${field.name}".`;
  }
  const bitCount = (field.size / field.arrayLength) * 8;
  if (endBit < startBit) return "The end bit must be greater than or equal to the start bit.";
  if (startBit < 0 || endBit >= bitCount) {
    return `Bits ${startBit}–${endBit} are outside the 0–${bitCount - 1} range of "${field.name}".`;
  }
  if (overlaps(field.bitFields, wordIndex, startBit, endBit - startBit + 1, ignoredName)) {
    return `Bits ${startBit}–${endBit} overlap an existing Status Bit on "${field.name}".`;
  }
  return null;
}

type FieldAndBitResult =
  | { field: ContextField; bit: NonNullable<ContextField["bitFields"]>[number] }
  | { error: string };

function fieldAndBit(
  context: StructContext,
  fieldName: string,
  bitName: string
): FieldAndBitResult {
  const field = findContextField(context, fieldName);
  if (!field) return { error: `I couldn't find a field named "${fieldName}".` };
  const bit = field.bitFields?.find((candidate) => candidate.name === bitName);
  if (!bit) return { error: `I couldn't find a Status Bit named "${bitName}" on "${fieldName}".` };
  return { field, bit };
}

function parseMeanings(text: string): BitMeaning[] {
  return [...text.matchAll(/(-?\d+)\s*=\s*([A-Za-z_][A-Za-z0-9_-]*)/g)].map((match) => ({
    value: Number(match[1]),
    label: match[2],
  }));
}

/** Offline/live fark etmeksizin güvenli ve yapılandırılmış edit komutlarını yorumlar. */
export function interpretAiAction(context: StructContext, text: string): ActionInterpretation {
  // Rename: "id alanındaki old bitini active olarak yeniden adlandır"
  const renameTr = text.match(new RegExp(
    `${FIELD_REF}\\s+${FIELD_POSSESSIVE}\\s+${IDENT}[^\\n]*?${IDENT}\\s+olarak\\s+(?:yeniden\\s+)?adlandır`, "iu"
  ));
  const renameEn = text.match(new RegExp(
    `rename\\s+${IDENT}\\s+(?:in|on)\\s+${FIELD_REF}\\s+to\\s+${IDENT}`, "iu"
  ));
  if (renameTr || renameEn) {
    const fieldName = renameTr?.[1] ?? renameEn![2];
    const bitName = renameTr?.[2] ?? renameEn![1];
    const newName = renameTr?.[3] ?? renameEn![3];
    const found = fieldAndBit(context, fieldName, bitName);
    if ("error" in found) return { matched: true, error: found.error };
    return {
      matched: true,
      action: { type: "rename_bit_field", fieldName, bitName, newName },
      text: `I can rename "${bitName}" on "${fieldName}" to "${newName}".`,
    };
  }

  // Meanings: "id alanındaki mode için 0=OFF, 1=ON anlamlarını ekle"
  const meaningsTr = text.match(new RegExp(
    `${FIELD_REF}\\s+${FIELD_POSSESSIVE}\\s+${IDENT}\\s+(?:için|icin)[^\\n]*?(?:anlamlarını|anlamlari)(?:\\s+ekle)?`, "iu"
  ));
  const meaningsEn = text.match(new RegExp(
    `(?:add|set)\\s+(?:meanings?\\s+)?[^\\n]*?\\s+to\\s+${IDENT}\\s+(?:in|on)\\s+${FIELD_REF}`, "iu"
  ));
  if (meaningsTr || meaningsEn) {
    const fieldName = meaningsTr?.[1] ?? meaningsEn![2];
    const bitName = meaningsTr?.[2] ?? meaningsEn![1];
    const meanings = parseMeanings(text);
    if (meanings.length === 0) return { matched: true, error: "Use value=label pairs such as 0=OFF, 1=ON." };
    const found = fieldAndBit(context, fieldName, bitName);
    if ("error" in found) return { matched: true, error: found.error };
    return {
      matched: true,
      action: { type: "set_bit_meanings", fieldName, bitName, meanings },
      text: `I can add ${meanings.map((meaning) => `${meaning.value}=${meaning.label}`).join(", ")} to "${bitName}".`,
    };
  }

  // Move/resize: "id alanındaki mode bitini word 1, 5-7 bitlerine taşı"
  const moveTr = text.match(new RegExp(
    `${FIELD_REF}\\s+${FIELD_POSSESSIVE}\\s+${IDENT}[^\\n]*?${RANGE}[^\\n]*?(?:taşı|kaydır)`, "iu"
  ));
  const moveEn = text.match(new RegExp(
    `move\\s+${IDENT}\\s+(?:in|on)\\s+${FIELD_REF}[^\\n]*?${RANGE}`, "iu"
  ));
  if (moveTr || moveEn) {
    const fieldName = moveTr?.[1] ?? moveEn![2];
    const bitName = moveTr?.[2] ?? moveEn![1];
    const startBit = Number(moveTr?.[3] ?? moveEn![3]);
    const endBit = Number(moveTr?.[4] ?? moveEn![4]);
    const wordIndex = wordIndexFrom(text);
    const found = fieldAndBit(context, fieldName, bitName);
    if ("error" in found) return { matched: true, error: found.error };
    const error = validateContextRange(found.field, wordIndex, startBit, endBit, bitName);
    if (error) return { matched: true, error };
    return {
      matched: true,
      action: { type: "move_bit_field", fieldName, bitName, wordIndex, startBit, width: endBit - startBit + 1 },
      text: `I can move "${bitName}" to ${wordIndex ? `word ${wordIndex}, ` : ""}bits ${startBit}–${endBit}.`,
    };
  }

  // Remove: "id alanındaki mode bitini sil"
  const removeTr = text.match(new RegExp(
    `${FIELD_REF}\\s+${FIELD_POSSESSIVE}\\s+${IDENT}[^\\n]*?(?:sil|kaldır)`, "iu"
  ));
  const removeEn = text.match(new RegExp(
    `(?:delete|remove)\\s+${IDENT}\\s+(?:from|in|on)\\s+${FIELD_REF}`, "iu"
  ));
  if (removeTr || removeEn) {
    const fieldName = removeTr?.[1] ?? removeEn![2];
    const bitName = removeTr?.[2] ?? removeEn![1];
    const found = fieldAndBit(context, fieldName, bitName);
    if ("error" in found) return { matched: true, error: found.error };
    return {
      matched: true,
      action: { type: "remove_bit_field", fieldName, bitName },
      text: `I can remove "${bitName}" from "${fieldName}".`,
    };
  }

  // Add: "statusWords alanında word 2, 4-6 bitler arasında fault oluştur"
  const addTr = text.match(new RegExp(
    `${FIELD_REF}\\s+${FIELD_WORD}[^\\n]*?${RANGE}(?:\\s+arasında)?\\s+${IDENT}\\s+(?:oluştur|ekle)`, "iu"
  ));
  const addEn = text.match(new RegExp(
    `(?:add|create)\\s+${IDENT}[^\\n]*?${RANGE}[^\\n]*?(?:of|in|on|to)\\s+${FIELD_REF}`, "iu"
  ));
  if (addTr || addEn) {
    const fieldName = addTr?.[1] ?? addEn![4];
    const startBit = Number(addTr?.[2] ?? addEn![2]);
    const endBit = Number(addTr?.[3] ?? addEn![3]);
    const bitName = addTr?.[4] ?? addEn![1];
    const wordIndex = wordIndexFrom(text);
    const field = findContextField(context, fieldName);
    if (!field) return { matched: true, error: `I couldn't find a field named "${fieldName}".` };
    const error = validateContextRange(field, wordIndex, startBit, endBit);
    if (error) return { matched: true, error };
    const width = endBit - startBit + 1;
    const action: AiAction = {
      type: "add_bit_field", fieldName, name: bitName, wordIndex, startBit, width,
      kind: width === 1 ? "flag" : "uint",
    };
    return {
      matched: true,
      action,
      text: `I can add "${bitName}" to "${fieldName}" on ${wordIndex ? `word ${wordIndex}, ` : ""}bits ${startBit}–${endBit}.`,
    };
  }

  return { matched: false };
}

export function describeAiAction(action: AiAction): string {
  switch (action.type) {
    case "add_bit_field":
      return `I can add "${action.name}" to "${action.fieldName}" on ${action.wordIndex ? `word ${action.wordIndex}, ` : ""}bits ${action.startBit}–${action.startBit + action.width - 1}.`;
    case "rename_bit_field":
      return `I can rename "${action.bitName}" on "${action.fieldName}" to "${action.newName}".`;
    case "move_bit_field":
      return `I can move "${action.bitName}" to ${action.wordIndex ? `word ${action.wordIndex}, ` : ""}bits ${action.startBit}–${action.startBit + action.width - 1}.`;
    case "remove_bit_field":
      return `I can remove "${action.bitName}" from "${action.fieldName}".`;
    case "set_bit_meanings":
      return `I can add ${action.meanings.map((meaning) => `${meaning.value}=${meaning.label}`).join(", ")} to "${action.bitName}".`;
  }
}

export function validateContextAiAction(context: StructContext, action: AiAction): string | null {
  const field = findContextField(context, action.fieldName);
  if (!field) return `I couldn't uniquely identify field "${action.fieldName}".`;
  if (!UNSIGNED_TYPES.has(field.type)) return `"${field.name}" is not an unsigned integer field.`;

  if (action.type === "add_bit_field" || action.type === "move_bit_field") {
    const error = validateContextRange(
      field,
      action.wordIndex,
      action.startBit,
      action.startBit + action.width - 1,
      action.type === "move_bit_field" ? action.bitName : undefined
    );
    if (error) return error;
  }
  if (action.type !== "add_bit_field") {
    const bit = field.bitFields?.find((candidate) => candidate.name === action.bitName);
    if (!bit) return `I couldn't find Status Bit "${action.bitName}" on "${action.fieldName}".`;
    if (action.type === "set_bit_meanings") {
      const magnitude = 2 ** Math.min(bit.width, 52);
      const min = bit.kind === "int" ? -(magnitude / 2) : 0;
      const max = bit.kind === "int" ? magnitude / 2 - 1 : magnitude - 1;
      if (action.meanings.some((meaning) => meaning.value < min || meaning.value > max)) {
        return `A meaning value is outside the ${min}–${max} range of "${bit.name}".`;
      }
    }
  }
  return null;
}

export function findModelField(model: StructModel, pathOrName: string): Field | null {
  const parts = pathOrName.split(".");
  let fields = model.fields;
  let found: Field | undefined;
  let completePath = true;
  for (const part of parts) {
    found = fields.find((field) => field.name === part);
    if (!found) {
      completePath = false;
      break;
    }
    fields = found.nested?.fields ?? [];
  }
  if (found && completePath) return found;

  const matches: Field[] = [];
  const visit = (items: Field[]) => {
    for (const field of items) {
      if (field.name === pathOrName) matches.push(field);
      if (field.nested) visit(field.nested.fields);
    }
  };
  visit(model.fields);
  return matches.length === 1 ? matches[0] : null;
}

/** Apply anında güncel modele karşı tekrar çalıştırılan istemci tarafı güvenlik kapısı. */
export function validateAiAction(model: StructModel, action: AiAction): string | null {
  const field = findModelField(model, action.fieldName);
  if (!field) return `Field "${action.fieldName}" no longer exists.`;
  if (!isUnsignedInt(field.type)) return `Field "${field.name}" is not an unsigned integer.`;

  if (action.type === "add_bit_field" || action.type === "move_bit_field") {
    if (action.wordIndex < 0 || action.wordIndex >= field.arrayLength) {
      return `Word ${action.wordIndex} is outside field "${field.name}".`;
    }
    const bitCount = bitsPerWord(field);
    if (action.startBit < 0 || action.width < 1 || action.startBit + action.width > bitCount) {
      return `The requested bit range is outside field "${field.name}".`;
    }
    const ignoredName = action.type === "move_bit_field" ? action.bitName : undefined;
    if (overlaps(field.bitFields, action.wordIndex, action.startBit, action.width, ignoredName)) {
      return "The requested range now overlaps an existing Status Bit.";
    }
  }

  if (action.type !== "add_bit_field") {
    const bit = field.bitFields?.find((candidate) => candidate.name === action.bitName);
    if (!bit) return `Status Bit "${action.bitName}" no longer exists on "${field.name}".`;
    if (action.type === "rename_bit_field" && !action.newName.trim()) return "The new name is empty.";
    if (action.type === "set_bit_meanings") {
      const magnitude = 2 ** Math.min(bit.width, 52);
      const min = bit.kind === "int" ? -(magnitude / 2) : 0;
      const max = bit.kind === "int" ? magnitude / 2 - 1 : magnitude - 1;
      if (action.meanings.some((meaning) => meaning.value < min || meaning.value > max)) {
        return `A meaning value is outside the ${min}–${max} range of "${bit.name}".`;
      }
    }
  }
  return null;
}
