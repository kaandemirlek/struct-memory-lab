// ImportBox.tsx — top-bar action: opens an Import dialog.
"use client";

import { useState } from "react";
import { useStructStore } from "@/store/useStructStore";
import { parseCpp } from "@/engine/parser";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";

const SAMPLE = `struct Player {
    uint32_t id;
    bool alive;
    double health;
};`;

export default function ImportBox() {
  const setModel = useStructStore((s) => s.setModel);
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState(SAMPLE);
  const [error, setError] = useState<string | null>(null);

  const handleParse = () => {
    try {
      setModel(parseCpp(code));
      setError(null);
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    }
  };

  return (
    <>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
      >
        Import
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Import C++ struct"
        footer={
          <Button variant="primary" onClick={handleParse}>
            Parse struct
          </Button>
        }
      >
        <p className="mb-2 text-xs text-muted">
          Paste a C++ struct to load it into the editor.
        </p>
        <textarea
          value={code}
          onChange={(e) => setCode(e.target.value)}
          rows={8}
          spellCheck={false}
          className="w-full resize-y rounded-lg border border-border bg-surface-muted p-3 font-mono text-sm outline-none focus:border-accent"
        />
        {error && (
          <p
            className="mt-3 break-words rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger"
            role="alert"
          >
            {error}
          </p>
        )}
      </Modal>
    </>
  );
}
