// ============================================================================
// highlight.ts  ← PERSON B
// ============================================================================
// Çok küçük, bağımlılıksız C++ tokenizer'ı (import alanındaki sözdizimi
// renklendirmesi için). Desteklediğimiz C++ alt kümesi küçük olduğu için bu
// yeterli; harf harf metni korur (overlay hizalaması için şart).
// ============================================================================

export type TokenKind = "comment" | "keyword" | "type" | "number" | "punct" | "plain";

export interface Token {
  value: string;
  kind: TokenKind;
}

const KEYWORDS = new Set([
  "struct",
  "class",
  "enum",
  "union",
  "const",
  "static",
  "typedef",
  "using",
  "namespace",
  "public",
  "private",
  "protected",
]);

const TYPES = new Set([
  "void",
  "bool",
  "char",
  "short",
  "int",
  "long",
  "float",
  "double",
  "signed",
  "unsigned",
  "wchar_t",
  "size_t",
  "int8_t",
  "uint8_t",
  "int16_t",
  "uint16_t",
  "int32_t",
  "uint32_t",
  "int64_t",
  "uint64_t",
]);

function classify(tok: string): TokenKind {
  if (tok.startsWith("//") || tok.startsWith("/*")) return "comment";
  if (/^\d/.test(tok)) return "number";
  if (/^[A-Za-z_]/.test(tok)) {
    if (KEYWORDS.has(tok)) return "keyword";
    if (TYPES.has(tok)) return "type";
    return "plain";
  }
  if (/^\s/.test(tok)) return "plain";
  return "punct";
}

const TOKEN_RE =
  /\/\/[^\n]*|\/\*[\s\S]*?\*\/|\d[\w.]*|[A-Za-z_]\w*|\s+|[{}()[\];,*&<>:.]|[^\s\w]/g;

export function highlightCpp(code: string): Token[] {
  const tokens: Token[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  TOKEN_RE.lastIndex = 0;
  while ((m = TOKEN_RE.exec(code)) !== null) {
    if (m.index > last) {
      tokens.push({ value: code.slice(last, m.index), kind: "plain" });
    }
    tokens.push({ value: m[0], kind: classify(m[0]) });
    last = m.index + m[0].length;
    if (m[0].length === 0) TOKEN_RE.lastIndex++; // guard against zero-length matches
  }
  if (last < code.length) tokens.push({ value: code.slice(last), kind: "plain" });
  return tokens;
}
