"use client";

import { useState } from "react";
import {
  CURRENT_EDITS,
  CURRENT_EDITS_LABEL,
  resolveComparison,
  useStructStore,
} from "@/store/useStructStore";
import Button from "@/components/ui/Button";
import VersionPanel, { type VersionPanelMode } from "@/components/VersionPanel";
import {
  PanelRightCloseIcon,
  PanelRightOpenIcon,
  StackIcon,
} from "@/components/ui/icons";

function compactLabel(label: string) {
  if (label === CURRENT_EDITS_LABEL) return "Live";
  return label.length > 4 ? label.slice(0, 4) : label;
}

export default function VersionSidebar({ mode }: { mode: VersionPanelMode }) {
  const [collapsed, setCollapsed] = useState(false);
  const versions = useStructStore((s) => s.versions);
  const current = useStructStore((s) => s.currentModel);
  const baseVersionId = useStructStore((s) => s.baseVersionId);
  const targetVersionId = useStructStore((s) => s.targetVersionId);
  const setBaseVersion = useStructStore((s) => s.setBaseVersion);
  const setTargetVersion = useStructStore((s) => s.setTargetVersion);
  const cmp = resolveComparison(versions, current, baseVersionId, targetVersionId);
  const versionCount = versions.length;
  const expandedWidth = mode === "edit" ? "lg:w-[260px]" : "lg:w-[360px]";
  const title = mode === "edit" ? "snapshots" : "versions";

  const compareTargets = [
    ...versions.map((v) => ({
      id: v.id,
      label: v.label,
      from: cmp.fromVersionId === v.id,
      to: cmp.toVersionId === v.id,
      setFrom: () => setBaseVersion(v.id),
      setTo: () => setTargetVersion(v.id),
    })),
    {
      id: CURRENT_EDITS,
      label: CURRENT_EDITS_LABEL,
      from: cmp.fromValue === CURRENT_EDITS,
      to: cmp.toValue === CURRENT_EDITS,
      setFrom: () => setBaseVersion(CURRENT_EDITS),
      setTo: () => setTargetVersion(null),
    },
  ];

  return (
    <aside
      className={`w-full transition-[width] duration-200 lg:sticky lg:top-[76px] lg:self-start ${
        collapsed ? "lg:w-16" : expandedWidth
      }`}
    >
      {collapsed ? (
        <div className="flex min-h-48 w-full flex-col items-center rounded-lg border border-border bg-surface p-2 shadow-sm">
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Expand ${title} sidebar`}
            title={`Expand ${title}`}
            onClick={() => setCollapsed(false)}
          >
            <PanelRightOpenIcon />
          </Button>

          {mode === "compare" ? (
            <div className="mt-3 flex w-full flex-1 flex-col items-center gap-1.5">
              {compareTargets.map((target) => (
                <button
                  key={target.id}
                  type="button"
                  onClick={target.setFrom}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    target.setTo();
                  }}
                  title={`${target.label}: left-click From, right-click To`}
                  className={`grid h-8 w-11 place-items-center rounded-md border px-1 text-[10px] font-semibold transition-colors ${
                    target.from
                      ? "border-accent bg-accent/15 text-accent"
                      : target.to
                        ? "border-emerald-500/60 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                        : "border-border bg-surface-muted text-muted hover:text-foreground"
                  }`}
                >
                  <span className="max-w-full truncate">
                    {compactLabel(target.label)}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div className="mt-3 flex flex-1 flex-col items-center gap-3 text-muted">
              <StackIcon />
              <span className="hidden text-xs font-medium uppercase [writing-mode:vertical-rl] lg:block">
                Snapshots
              </span>
              <span className="rounded-full bg-surface-muted px-2 py-0.5 text-xs font-semibold text-foreground">
                {versionCount}
              </span>
            </div>
          )}
        </div>
      ) : (
        <VersionPanel
          mode={mode}
          collapseAction={
            <Button
              variant="ghost"
              size="icon"
              className="text-muted hover:text-foreground"
              aria-label={`Collapse ${title} sidebar`}
              title={`Collapse ${title}`}
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
