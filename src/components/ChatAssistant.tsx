"use client";

import { useEffect, useRef, useState } from "react";
import { useStructStore, resolveComparison } from "@/store/useStructStore";
import { askAI } from "@/lib/ai/client";
import { buildStructContext } from "@/lib/ai/context";
import type { ChatMessage, AiUsage } from "@/lib/ai/types";
import Button from "@/components/ui/Button";
import { SparklesIcon, CloseIcon, SendIcon } from "@/components/ui/icons";

const SUGGESTIONS = [
  "How big is this struct?",
  "Why is there padding?",
  "What changed in the latest version?",
  "How many fields are there?",
];

/** A rendered turn; assistant turns may carry live-mode token usage. */
type ChatEntry = ChatMessage & { usage?: AiUsage };

const fmtCost = (n: number) => `$${n < 0.01 ? n.toFixed(6) : n.toFixed(4)}`;

export default function ChatAssistant() {
  const model = useStructStore((s) => s.currentModel);
  const versions = useStructStore((s) => s.versions);
  const baseVersionId = useStructStore((s) => s.baseVersionId);
  const targetVersionId = useStructStore((s) => s.targetVersionId);
  const platform = useStructStore((s) => s.platform);

  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatEntry[]>([]);
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<"idle" | "loading">("idle");
  const [mode, setMode] = useState<"mock" | "live" | null>(null);

  // Running session cost/tokens across all live replies.
  const session = messages.reduce(
    (acc, m) => {
      if (m.usage) {
        acc.cost += m.usage.estimatedCostUsd;
        acc.tokens += m.usage.totalTokens;
      }
      return acc;
    },
    { cost: 0, tokens: 0 }
  );

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Keep the transcript pinned to the latest message.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, status]);

  // Focus the input when the panel opens.
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const send = async (raw?: string) => {
    const text = (raw ?? input).trim();
    if (!text || status === "loading") return;

    const nextMessages: ChatEntry[] = [...messages, { role: "user", content: text }];
    setMessages(nextMessages);
    setInput("");
    setStatus("loading");

    try {
      const cmp = resolveComparison(versions, model, baseVersionId, targetVersionId);
      const context = buildStructContext(model, versions, cmp, platform);
      // Send only role/content to the API — usage is display-only.
      const apiMessages: ChatMessage[] = nextMessages.map(({ role, content }) => ({
        role,
        content,
      }));
      const res = await askAI({ kind: "chat", payload: { messages: apiMessages, context } });
      setMessages((m) => [...m, { role: "assistant", content: res.text, usage: res.usage }]);
      setMode(res.mode);
    } catch {
      setMessages((m) => [
        ...m,
        { role: "assistant", content: "Sorry, I couldn't respond just now. Please try again." },
      ]);
    } finally {
      setStatus("idle");
    }
  };

  return (
    <>
      {/* Floating launcher */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={open ? "Close assistant" : "Ask the assistant"}
        className="fixed bottom-5 right-5 z-40 flex h-12 items-center gap-2 rounded-full bg-accent px-4 text-accent-foreground shadow-lg transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        <SparklesIcon />
        <span className="text-sm font-semibold">Ask AI</span>
      </button>

      {/* Slide-over panel */}
      {open && (
        <div
          role="dialog"
          aria-label="Struct assistant"
          className="fixed bottom-20 right-5 z-40 flex h-[min(70vh,560px)] w-[min(92vw,380px)] flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-2xl"
          onKeyDown={(e) => {
            if (e.key === "Escape") setOpen(false);
          }}
        >
          <header className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
            <span className="flex items-center gap-2 text-sm font-semibold">
              <span className="text-accent">
                <SparklesIcon />
              </span>
              Struct assistant
              {mode && (
                <span className="rounded-full border border-border bg-surface-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted">
                  {mode === "live" ? "Live" : "Offline"}
                </span>
              )}
            </span>
            <div className="flex items-center gap-2">
              {session.tokens > 0 && (
                <span
                  title={`${session.tokens} tokens this session (estimated)`}
                  className="text-[10px] tabular-nums text-muted"
                >
                  Session ~{fmtCost(session.cost)}
                </span>
              )}
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close assistant"
                title="Close"
                className="grid h-7 w-7 place-items-center rounded-md text-muted transition-colors hover:bg-surface-muted hover:text-foreground"
              >
                <CloseIcon width={16} height={16} />
              </button>
            </div>
          </header>

          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
            {messages.length === 0 ? (
              <div className="space-y-3">
                <p className="text-sm text-muted">
                  Ask me about this struct — its layout, padding, versions, or what
                  changed between them.
                </p>
                <div className="flex flex-col gap-1.5">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => send(s)}
                      className="rounded-lg border border-border bg-surface-muted px-3 py-1.5 text-left text-sm text-foreground transition-colors hover:border-accent/50"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((m, i) => (
                <div
                  key={i}
                  className={`flex flex-col ${m.role === "user" ? "items-end" : "items-start"}`}
                >
                  <p
                    className={`max-w-[85%] whitespace-pre-wrap break-words rounded-lg px-3 py-2 text-sm leading-relaxed ${
                      m.role === "user"
                        ? "bg-accent text-accent-foreground"
                        : "border border-border bg-surface-muted text-foreground"
                    }`}
                  >
                    {m.content}
                  </p>
                  {m.role === "assistant" && m.usage && (
                    <span className="mt-1 text-[10px] tabular-nums text-muted">
                      {m.usage.promptTokens} in · {m.usage.completionTokens} out · ~
                      {fmtCost(m.usage.estimatedCostUsd)}
                    </span>
                  )}
                </div>
              ))
            )}

            {status === "loading" && (
              <div className="flex justify-start">
                <p className="rounded-lg border border-border bg-surface-muted px-3 py-2 text-sm text-muted">
                  Thinking…
                </p>
              </div>
            )}
          </div>

          <form
            className="flex items-center gap-2 border-t border-border px-3 py-2.5"
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
          >
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about this struct…"
              className="min-w-0 flex-1 rounded-lg border border-border bg-surface-muted px-3 py-2 text-sm outline-none focus:border-accent"
            />
            <Button
              type="submit"
              variant="primary"
              size="icon"
              aria-label="Send message"
              disabled={status === "loading" || input.trim().length === 0}
            >
              <SendIcon />
            </Button>
          </form>
        </div>
      )}
    </>
  );
}
