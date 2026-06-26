// VersionPanel.tsx  ← PERSON B
"use client";

import { useStructStore } from "@/store/useStructStore";
import Panel from "@/components/ui/Panel";
import Button from "@/components/ui/Button";

export default function VersionPanel() {
  const versions = useStructStore((s) => s.versions);
  const saveVersion = useStructStore((s) => s.saveVersion);
  const loadVersion = useStructStore((s) => s.loadVersion);

  return (
    <Panel
      title="Versions"
      description="Save snapshots of the struct as it evolves."
      actions={
        <Button variant="primary" onClick={saveVersion}>
          Save version
        </Button>
      }
    >
      {versions.length === 0 ? (
        <p className="text-sm text-muted">
          No versions yet. Save one to start tracking changes.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {versions.map((v) => (
            <li key={v.id}>
              <button
                onClick={() => loadVersion(v.id)}
                className="flex w-full items-center justify-between rounded-lg border border-border px-3 py-2 text-sm transition-colors hover:bg-surface-muted"
              >
                <span className="font-medium">{v.label}</span>
                <span className="text-xs text-muted">
                  {v.model.fields.length} fields
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
