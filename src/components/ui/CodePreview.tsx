"use client";

import { highlightCpp, type TokenKind } from "@/engine/highlight";

const KIND_CLASS: Record<TokenKind, string> = {
  comment: "italic text-muted",
  keyword: "text-purple-500 dark:text-purple-400",
  type: "text-sky-600 dark:text-sky-400",
  number: "text-amber-600 dark:text-amber-400",
  punct: "text-muted",
  plain: "",
};

export default function CodePreview({
  value,
  highlight = true,
}: {
  value: string;
  highlight?: boolean;
}) {
  const tokens = highlight ? highlightCpp(value) : [{ value, kind: "plain" as const }];

  return (
    <pre className="max-h-[55vh] overflow-auto rounded-lg border border-border bg-surface-muted p-4 font-mono text-sm leading-6 whitespace-pre-wrap break-words">
      {tokens.map((token, i) => (
        <span key={i} className={KIND_CLASS[token.kind]}>
          {token.value}
        </span>
      ))}
    </pre>
  );
}
