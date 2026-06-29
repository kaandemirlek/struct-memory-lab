// ImportBox.tsx
"use client";

import { useState } from "react";
import { useStructStore } from "@/store/useStructStore";
import { parseCpp } from "@/engine/parser";
import Panel from "@/components/ui/Panel";
import Button from "@/components/ui/Button";

const SAMPLE = `struct Player {
    uint32_t id;
    bool alive;
    double health;
};`;

export default function ImportBox() {
  const [code, setCode] = useState(SAMPLE);
  const [error, setError] = useState<string | null>(null);
  const setModel = useStructStore((s) => s.setModel);

  const handleParse = () => {
    try {
      setModel(parseCpp(code));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    }
  };

  return (
    <Panel
      title="Import"
      description="Paste a C++ struct to load it into the editor."
    >
      <textarea
        value={code}
        onChange={(e) => setCode(e.target.value)}
        rows={6}
        spellCheck={false}
        className="w-full resize-y rounded-lg border border-border bg-surface-muted p-3 font-mono text-sm outline-none focus:border-accent"
      />
      <div className="mt-3">
        <Button variant="primary" onClick={handleParse}>
          Parse struct
        </Button>
      </div>
      {error && (
        <p
          className="mt-3 break-words rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger"
          role="alert"
        >
          {error}
        </p>
      )}
    </Panel>
  );
}
