"use client";

import { useState } from "react";
import LayoutVisualizer from "@/components/LayoutVisualizer";
import OptimizerPanel from "@/components/OptimizerPanel";
import DiffView from "@/components/DiffView";
import WarningsPanel from "@/components/WarningsPanel";

type Tab = "edit" | "compare";

const TABS: { id: Tab; label: string }[] = [
  { id: "edit", label: "Edit Layout" },
  { id: "compare", label: "Compare Versions" },
];

export default function MiddleWorkspace() {
  const [tab, setTab] = useState<Tab>("edit");

  return (
    <div className="min-w-0 space-y-4">
      <div className="inline-flex rounded-lg border border-border bg-surface p-0.5">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
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
          <div className="grid items-start gap-4 xl:grid-cols-2">
            <DiffView />
            <WarningsPanel />
          </div>
        </>
      )}
    </div>
  );
}
