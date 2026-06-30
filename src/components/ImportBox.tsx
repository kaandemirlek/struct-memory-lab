"use client";

import { useState } from "react";
import { useStructStore } from "@/store/useStructStore";
import { parseCpp } from "@/engine/parser";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { UploadIcon } from "@/components/ui/icons";

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
        <UploadIcon />
        Import
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Import C++ struct"
        description="Paste a struct definition to load it into the editor."
        size="lg"
        footer={
          <>
            <button
              type="button"
              onClick={() => {
                setCode(SAMPLE);
                setError(null);
              }}
              className="mr-auto text-xs text-muted transition-colors hover:text-foreground"
            >
              Reset to sample
            </button>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleParse}>
              Parse struct
            </Button>
          </>
        }
      >
        <textarea
          value={code}
          onChange={(e) => {
            setCode(e.target.value);
            setError(null);
          }}
          rows={12}
          spellCheck={false}
          autoFocus
          className="w-full resize-y rounded-lg border border-border bg-surface-muted p-3 font-mono text-sm leading-6 outline-none focus:border-accent"
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
