"use client";

import { useState } from "react";
import { useStructStore } from "@/store/useStructStore";
import Button from "@/components/ui/Button";
import VersionPanel from "@/components/VersionPanel";
import {
  PanelRightCloseIcon,
  PanelRightOpenIcon,
  StackIcon,
} from "@/components/ui/icons";

export default function VersionSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const versionCount = useStructStore((s) => s.versions.length);

  return (
    <aside
      className={`w-full transition-[width] duration-200 lg:sticky lg:top-[76px] lg:self-start ${
        collapsed ? "lg:w-14" : "lg:w-[360px]"
      }`}
    >
      {collapsed ? (
        <div className="flex min-h-48 w-full flex-col items-center rounded-lg border border-border bg-surface p-2 shadow-sm">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Expand versions sidebar"
            title="Expand versions"
            onClick={() => setCollapsed(false)}
          >
            <PanelRightOpenIcon />
          </Button>
          <div className="mt-3 flex flex-1 flex-col items-center gap-3 text-muted">
            <StackIcon />
            <span className="hidden text-xs font-medium uppercase [writing-mode:vertical-rl] lg:block">
              Versions
            </span>
            <span className="rounded-full bg-surface-muted px-2 py-0.5 text-xs font-semibold text-foreground">
              {versionCount}
            </span>
          </div>
        </div>
      ) : (
        <VersionPanel
          collapseAction={
            <Button
              variant="ghost"
              size="icon"
              className="text-muted hover:text-foreground"
              aria-label="Collapse versions sidebar"
              title="Collapse versions"
              onClick={() => setCollapsed(true)}
            >
              <PanelRightCloseIcon />
            </Button>
          }
        />
      )}
    </aside>
  );
}
