import type { AiAction } from "./types";

const objectSchema = (properties: Record<string, unknown>, required: string[]) => ({
  type: "object",
  additionalProperties: false,
  properties,
  required,
});
const string = { type: "string" };
const integer = { type: "integer", minimum: 0 };

/** Chat Completions function tools: model yalnızca izin verilen edit önerilerini üretebilir. */
export const EDITOR_TOOLS = [
  {
    type: "function",
    function: {
      name: "add_status_bit",
      description: "Propose adding a Status Bit. Use dot paths for nested fields.",
      parameters: objectSchema(
        {
          fieldName: string, name: string, wordIndex: integer, startBit: integer,
          width: { type: "integer", minimum: 1 },
          kind: { type: "string", enum: ["flag", "uint", "int", "enum"] },
        },
        ["fieldName", "name", "wordIndex", "startBit", "width", "kind"]
      ),
    },
  },
  {
    type: "function",
    function: {
      name: "rename_status_bit",
      description: "Propose renaming an existing Status Bit.",
      parameters: objectSchema(
        { fieldName: string, bitName: string, newName: string },
        ["fieldName", "bitName", "newName"]
      ),
    },
  },
  {
    type: "function",
    function: {
      name: "move_status_bit",
      description: "Propose moving or resizing an existing Status Bit.",
      parameters: objectSchema(
        { fieldName: string, bitName: string, wordIndex: integer, startBit: integer, width: { type: "integer", minimum: 1 } },
        ["fieldName", "bitName", "wordIndex", "startBit", "width"]
      ),
    },
  },
  {
    type: "function",
    function: {
      name: "remove_status_bit",
      description: "Propose removing an existing Status Bit.",
      parameters: objectSchema(
        { fieldName: string, bitName: string },
        ["fieldName", "bitName"]
      ),
    },
  },
  {
    type: "function",
    function: {
      name: "set_status_bit_meanings",
      description: "Propose adding or replacing value-label meanings on a Status Bit.",
      parameters: objectSchema(
        {
          fieldName: string,
          bitName: string,
          meanings: {
            type: "array",
            items: objectSchema({ value: { type: "integer" }, label: string }, ["value", "label"]),
          },
        },
        ["fieldName", "bitName", "meanings"]
      ),
    },
  },
];

export function parseEditorToolCall(toolCall: unknown): AiAction | null {
  const call = toolCall as { function?: { name?: unknown; arguments?: unknown } };
  if (typeof call?.function?.name !== "string" || typeof call.function.arguments !== "string") return null;

  let args: Record<string, unknown>;
  try {
    args = JSON.parse(call.function.arguments) as Record<string, unknown>;
  } catch {
    return null;
  }
  const getString = (key: string) => typeof args[key] === "string" ? args[key] as string : null;
  const getNumber = (key: string) => typeof args[key] === "number" ? args[key] as number : null;
  const fieldName = getString("fieldName");
  if (!fieldName) return null;

  switch (call.function.name) {
    case "add_status_bit": {
      const name = getString("name");
      const wordIndex = getNumber("wordIndex");
      const startBit = getNumber("startBit");
      const width = getNumber("width");
      const kind = getString("kind");
      if (!name || wordIndex === null || startBit === null || width === null ||
          !kind || !["flag", "uint", "int", "enum"].includes(kind)) return null;
      return {
        type: "add_bit_field", fieldName, name, wordIndex, startBit, width,
        kind: kind as "flag" | "uint" | "int" | "enum",
      };
    }
    case "rename_status_bit": {
      const bitName = getString("bitName");
      const newName = getString("newName");
      return bitName && newName ? { type: "rename_bit_field", fieldName, bitName, newName } : null;
    }
    case "move_status_bit": {
      const bitName = getString("bitName");
      const wordIndex = getNumber("wordIndex");
      const startBit = getNumber("startBit");
      const width = getNumber("width");
      return bitName && wordIndex !== null && startBit !== null && width !== null
        ? { type: "move_bit_field", fieldName, bitName, wordIndex, startBit, width }
        : null;
    }
    case "remove_status_bit": {
      const bitName = getString("bitName");
      return bitName ? { type: "remove_bit_field", fieldName, bitName } : null;
    }
    case "set_status_bit_meanings": {
      const bitName = getString("bitName");
      const raw = Array.isArray(args.meanings) ? args.meanings : [];
      const meanings = raw.filter((item): item is { value: number; label: string } =>
        typeof item === "object" && item !== null &&
        typeof (item as { value?: unknown }).value === "number" &&
        typeof (item as { label?: unknown }).label === "string"
      );
      return bitName && meanings.length > 0
        ? { type: "set_bit_meanings", fieldName, bitName, meanings }
        : null;
    }
    default:
      return null;
  }
}
