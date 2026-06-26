// ImportBox.tsx  ← PERSON A
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
  const setModel = useStructStore((s) => s.setModel);

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
        <Button variant="primary" onClick={() => setModel(parseCpp(code))}>
          Parse struct
        </Button>
      </div>
    </Panel>
  );
}
