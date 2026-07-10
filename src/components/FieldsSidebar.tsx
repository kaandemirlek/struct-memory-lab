"use client";

import { useState } from "react";
import { useStructStore } from "@/store/useStructStore";
import Button from "@/components/ui/Button";
import FieldEditor from "@/components/FieldEditor";
import {
  PanelLeftCloseIcon,
  PanelLeftOpenIcon,
  PlusIcon,
} from "@/components/ui/icons";

// Sol "Fields" sütunu — VersionSidebar ile aynı desen: daraltılınca panel,
// ikon düğmeli ince bir şeride (rail) dönüşür ve orta çalışma alanı genişler.
export default function FieldsSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const addField = useStructStore((s) => s.addField);
  const fieldCount = useStructStore((s) => s.currentModel.fields.length);

  return (
    <aside
      className={`w-full transition-[width] duration-200 lg:self-start ${
        collapsed ? "lg:w-16" : "lg:w-[360px] xl:w-[440px]"
      }`}
    >
      {collapsed ? (
        <div className="flex min-h-48 w-full flex-col items-center gap-2 rounded-lg border border-border bg-surface p-2 shadow-sm">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Expand fields sidebar"
            title="Expand fields"
            onClick={() => setCollapsed(false)}
          >
            <PanelLeftOpenIcon />
          </Button>

          <Button
            variant="secondary"
            size="icon"
            aria-label="Add field"
            title="Add field"
            onClick={() => addField()}
          >
            <PlusIcon />
          </Button>

          <div className="h-px w-8 shrink-0 bg-border" />

          <span
            className="text-[10px] font-semibold text-muted"
            title={`${fieldCount} field${fieldCount === 1 ? "" : "s"}`}
          >
            {fieldCount}
          </span>
        </div>
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
