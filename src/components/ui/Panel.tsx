"use client";

import { useState, type ReactNode } from "react";
import { ChevronRightIcon } from "./icons";

function Chevron({ open }: { open: boolean }) {
  return (
    <ChevronRightIcon
      width={14}
      height={14}
      strokeWidth={2.5}
      className={`shrink-0 text-muted transition-transform ${open ? "rotate-90" : ""}`}
      aria-hidden
    />
  );
}

// Shared card wrapper. Optionally collapsible with a summary shown in the header.
export default function Panel({
  title,
  description,
  actions,
  children,
  className = "",
  collapsible = false,
  summary,
  open: controlledOpen,
  defaultOpen = true,
  onOpenChange,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
  collapsible?: boolean;
  summary?: ReactNode;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [uncontrolled, setUncontrolled] = useState(defaultOpen);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : uncontrolled;

  const toggle = () => {
    const next = !open;
    if (!isControlled) setUncontrolled(next);
    onOpenChange?.(next);
  };

  if (!collapsible) {
    return (
      <section
        className={`rounded-lg border border-border bg-surface p-4 shadow-sm ${className}`}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-base font-semibold tracking-tight">{title}</h2>
            {description && (
              <p className="mt-0.5 break-words text-xs text-muted">{description}</p>
            )}
          </div>
          {actions && <div className="flex shrink-0 gap-2">{actions}</div>}
        </div>
        {children}
      </section>
    );
  }

  return (
    <section className={`rounded-lg border border-border bg-surface shadow-sm ${className}`}>
      <div className="flex items-center justify-between gap-3 px-4 py-3.5">
        <button
          onClick={toggle}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
          aria-expanded={open}
        >
          <Chevron open={open} />
          <h2 className="shrink-0 text-base font-semibold tracking-tight">{title}</h2>
          {summary && <span className="min-w-0 truncate text-xs">{summary}</span>}
        </button>
        {actions && <div className="flex shrink-0 gap-2">{actions}</div>}
      </div>
      {open && (
        <div className="border-t border-border px-4 pb-4 pt-3">{children}</div>
      )}
    </section>
  );
}
