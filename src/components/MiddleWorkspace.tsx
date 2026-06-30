"use client";

import LayoutVisualizer from "@/components/LayoutVisualizer";
import OptimizerPanel from "@/components/OptimizerPanel";
import DiffView from "@/components/DiffView";
import WarningsPanel from "@/components/WarningsPanel";

export type WorkspaceTab = "edit" | "compare";

const TABS: { id: WorkspaceTab; label: string }[] = [
  { id: "edit", label: "Edit Layout" },
  { id: "compare", label: "Compare Versions" },
];

export default function MiddleWorkspace({
  tab,
  onTabChange,
}: {
  tab: WorkspaceTab;
  onTabChange: (tab: WorkspaceTab) => void;
}) {

  return (
    <div className="min-w-0 space-y-4">
      <div className="inline-flex rounded-lg border border-border bg-surface p-0.5">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onTabChange(item.id)}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              tab === item.id
                ? "bg-accent text-accent-foreground"
                : "text-muted hover:bg-surface-muted hover:text-foreground"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === "edit" ? (
        <>
          <LayoutVisualizer mode="edit" />
          <OptimizerPanel />
        </>
      ) : (
        <>
          <LayoutVisualizer mode="compare" />
          <div className="space-y-4">
            <WarningsPanel />
            <DiffView />
          </div>
        </>
      )}
    </div>
  );
}
