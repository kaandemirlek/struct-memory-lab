"use client";

import { useState } from "react";
import { useStructStore } from "@/store/useStructStore";
import Button from "@/components/ui/Button";
import FieldEditor from "@/components/FieldEditor";
import {
  PanelLeftCloseIcon,
  PanelLeftOpenIcon,
} from "@/components/ui/icons";

// Sol "Fields" sütunu — daraltılınca tek eylemli ince bir şeride dönüşür
// (tamamı "genişlet" düğmesi) ve orta çalışma alanı genişler.
export default function FieldsSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const fieldCount = useStructStore((s) => s.currentModel.fields.length);

  return (
    <aside
      className={`w-full transition-[width] duration-200 lg:self-start ${
        collapsed ? "lg:w-16" : "lg:w-[360px] xl:w-[440px]"
      }`}
    >
      {collapsed ? (
        // Daraltılmış hâl: tek işlevli ince bir şerit — tamamı "genişlet" düğmesi.
        // (Küçük rayda mini kontroller sıkışık duruyordu; tek net eylem daha iyi.)
        <button
          type="button"
          aria-label="Expand fields sidebar"
          title="Expand fields"
          onClick={() => setCollapsed(false)}
          className="flex min-h-48 w-full flex-col items-center gap-3 rounded-lg border border-border bg-surface p-2 pt-3 text-muted shadow-sm transition-colors hover:border-accent/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <PanelLeftOpenIcon />
          <span className="text-[11px] font-semibold tracking-wide [writing-mode:vertical-rl]">
            Fields · {fieldCount}
          </span>
        </button>
      ) : (
        <FieldEditor
          collapseAction={
            <Button
              variant="ghost"
              size="icon"
              className="text-muted hover:text-foreground"
              aria-label="Collapse fields sidebar"
              title="Collapse fields"
              onClick={() => setCollapsed(true)}
            >
              <PanelLeftCloseIcon />
            </Button>
          }
        />
      )}
    </aside>
  );
}
