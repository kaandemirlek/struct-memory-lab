"use client";

import { useRef } from "react";
import { highlightCpp, type TokenKind } from "@/engine/highlight";

const KIND_CLASS: Record<TokenKind, string> = {
  comment: "italic text-muted",
  keyword: "text-purple-500 dark:text-purple-400",
  type: "text-sky-600 dark:text-sky-400",
  number: "text-amber-600 dark:text-amber-400",
  punct: "text-muted",
  plain: "",
};

// A textarea with a C++ syntax-highlighted layer behind it. The textarea text is
// transparent (caret stays visible) and a <pre> renders the colored tokens,
// perfectly aligned (same font/size/padding) and scroll-synced.
export default function CodeEditor({
  value,
  onChange,
  rows = 12,
  autoFocus,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  autoFocus?: boolean;
  disabled?: boolean;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const preRef = useRef<HTMLPreElement>(null);

  const syncScroll = () => {
    if (preRef.current && textareaRef.current) {
      preRef.current.scrollTop = textareaRef.current.scrollTop;
      preRef.current.scrollLeft = textareaRef.current.scrollLeft;
    }
  };

  // Tab, odağı kaydırmak yerine girinti ekler (kod editörü beklentisi).
  // Shift+Tab varsayılan kalır → klavye kullanıcısı alandan yine çıkabilir.
  // Önce execCommand denenir (native undo geçmişi korunur); desteklenmezse
  // değer elle güncellenir ve imleç eklenen girintinin sonuna taşınır.
  const INDENT = "    ";
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== "Tab" || e.shiftKey) return;
    e.preventDefault();
    const el = e.currentTarget;
    if (document.execCommand?.("insertText", false, INDENT)) return;
    const { selectionStart, selectionEnd } = el;
    onChange(value.slice(0, selectionStart) + INDENT + value.slice(selectionEnd));
    requestAnimationFrame(() => {
      el.selectionStart = el.selectionEnd = selectionStart + INDENT.length;
    });
  };

  const shared =
    "m-0 w-full rounded-lg border p-3 font-mono text-sm leading-6 whitespace-pre-wrap break-words";
  const tokens = highlightCpp(value);

  return (
    <div className="relative">
      <pre
        ref={preRef}
        aria-hidden
        className={`${shared} pointer-events-none absolute inset-0 overflow-auto border-transparent text-foreground`}
      >
        {tokens.map((t, i) => (
          <span key={i} className={KIND_CLASS[t.kind]}>
            {t.value}
          </span>
        ))}
        {"\n"}
      </pre>
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onScroll={syncScroll}
        rows={rows}
        autoFocus={autoFocus}
        disabled={disabled}
        spellCheck={false}
        className={`${shared} relative resize-y border-border bg-transparent text-transparent caret-foreground outline-none focus:border-accent`}
      />
    </div>
  );
}
