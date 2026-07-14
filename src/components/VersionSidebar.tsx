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
  PlusIcon,
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
  const saveVersion = useStructStore((s) => s.saveVersion);
  const previewVersionId = useStructStore((s) => s.previewVersionId);
  const setPreviewVersion = useStructStore((s) => s.setPreviewVersion);
  const cmp = resolveComparison(versions, current, baseVersionId, targetVersionId);
  // Her iki sekmede aynı genişlik → sekme değişince kayma/tutarsızlık olmasın.
  const expandedWidth = "lg:w-[320px]";
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

  // Edit sekmesi: Live + snapshot'lar; tıklayınca salt-okunur önizle.
  const editTargets = [
    {
      id: CURRENT_EDITS,
      label: CURRENT_EDITS_LABEL,
      active: previewVersionId === null,
      onSelect: () => setPreviewVersion(null),
    },
    ...versions.map((v) => ({
      id: v.id,
      label: v.label,
      active: previewVersionId === v.id,
      onSelect: () => setPreviewVersion(v.id),
    })),
  ];

  return (
    <aside
      className={`w-full transition-[width] duration-200 lg:sticky lg:top-[76px] lg:self-start ${
        collapsed ? "lg:w-16" : expandedWidth
      }`}
    >
      {collapsed ? (
        <div className="flex min-h-48 w-full flex-col items-center gap-2 rounded-lg border border-border bg-surface p-2 shadow-sm">
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Expand ${title} sidebar`}
            title={`Expand ${title}`}
            onClick={() => setCollapsed(false)}
          >
            <PanelRightOpenIcon />
          </Button>

          {mode === "edit" && (
            <Button
              variant="primary"
              size="icon"
              aria-label="Save version"
              title="Save version"
              onClick={saveVersion}
            >
              <PlusIcon />
            </Button>
          )}

          <div className="h-px w-8 shrink-0 bg-border" />

          <div className="flex w-full flex-1 flex-col items-center gap-1.5 overflow-y-auto">
            {mode === "compare"
              ? compareTargets.map((target) => (
                  <div
                    key={target.id}
                    className="flex w-full shrink-0 flex-col items-center gap-0.5"
                    title={target.label}
                  >
                    <span className="max-w-full truncate text-[9px] font-semibold text-muted">
                      {compactLabel(target.label)}
                    </span>
                    <span className="flex overflow-hidden rounded-md border border-border">
                      <button
                        type="button"
                        onClick={target.setFrom}
                        aria-pressed={target.from}
                        title={`Compare from ${target.label}`}
                        className={`grid h-6 w-5 place-items-center text-[9px] font-bold transition-colors ${
                          target.from
                            ? "bg-accent/20 text-accent"
                            : "bg-surface-muted text-muted hover:text-foreground"
                        }`}
                      >
                        F
                      </button>
                      <span className="w-px self-stretch bg-border" aria-hidden />
                      <button
                        type="button"
                        onClick={target.setTo}
                        aria-pressed={target.to}
                        title={`Compare to ${target.label}`}
                        className={`grid h-6 w-5 place-items-center text-[9px] font-bold transition-colors ${
                          target.to
                            ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                            : "bg-surface-muted text-muted hover:text-foreground"
                        }`}
                      >
                        T
                      </button>
                    </span>
                  </div>
                ))
              : editTargets.map((target) => (
                  <button
                    key={target.id}
                    type="button"
                    onClick={target.onSelect}
                    title={`Preview ${target.label} (read-only)`}
                    aria-pressed={target.active}
                    className={`grid h-8 w-11 shrink-0 place-items-center rounded-md border px-1 text-[10px] font-semibold transition-colors ${
                      target.active
                        ? "border-accent bg-accent/15 text-accent"
                        : "border-border bg-surface-muted text-muted hover:text-foreground"
                    }`}
                  >
                    <span className="max-w-full truncate">
                      {compactLabel(target.label)}
                    </span>
                  </button>
                ))}
          </div>

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
