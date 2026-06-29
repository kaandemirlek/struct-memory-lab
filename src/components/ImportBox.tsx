"use client";

import { useState } from "react";
import { useStructStore } from "@/store/useStructStore";
import { parseCpp } from "@/engine/parser";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { FileCodeIcon, UploadIcon } from "@/components/ui/icons";

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
  const lineNumbers = code.split("\n").map((_, i) => i + 1);

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
        title="Import"
        size="xl"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleParse}>
              <FileCodeIcon />
              Parse struct
            </Button>
          </>
        }
      >
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
          <div className="overflow-hidden rounded-lg border border-border bg-[#111827] shadow-sm">
            <div className="flex items-center justify-between gap-3 border-b border-white/10 bg-[#0b1220] px-3 py-2">
              <div className="flex min-w-0 items-center gap-2 text-xs font-medium text-slate-300">
                <FileCodeIcon />
                <span className="truncate">source.cpp</span>
              </div>
              <span className="shrink-0 text-xs tabular-nums text-slate-500">
                {lineNumbers.length} lines
              </span>
            </div>
            <div className="grid min-h-[420px] grid-cols-[3rem_minmax(0,1fr)]">
              <div
                className="select-none border-r border-white/10 bg-black/20 px-2 py-4 text-right font-mono text-xs leading-6 text-slate-500"
                aria-hidden
              >
                {lineNumbers.map((line) => (
                  <div key={line}>{line}</div>
                ))}
              </div>
              <textarea
                value={code}
                onChange={(e) => {
                  setCode(e.target.value);
                  setError(null);
                }}
                rows={16}
                spellCheck={false}
                className="block min-h-[420px] w-full resize-none bg-transparent p-4 font-mono text-sm leading-6 text-slate-100 outline-none placeholder:text-slate-500"
              />
            </div>
          </div>

          <div className="space-y-3">
            <div className="rounded-lg border border-border bg-surface p-3">
              <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase text-muted">
                <FileCodeIcon />
                <span>Import target</span>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted">Format</span>
                  <span className="font-medium">C++ struct</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted">Size</span>
                  <span className="font-medium tabular-nums">{code.length} chars</span>
                </div>
              </div>
            </div>

            <Button
              variant="secondary"
              className="w-full"
              onClick={() => {
                setCode(SAMPLE);
                setError(null);
              }}
            >
              Reset sample
            </Button>
          </div>
        </div>
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
