"use client";

import { useRef, useState } from "react";
import { useStructStore } from "@/store/useStructStore";
import { parseCpp } from "@/engine/parser";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import CodeEditor from "@/components/ui/CodeEditor";
import { UploadIcon } from "@/components/ui/icons";

const SAMPLE = `struct Vec3 {
    float x;
    float y;
    float z;
};

struct Player {
    uint32_t id;
    bool alive;
    Vec3 position;
    uint32_t age[5];
};`;

export default function ImportBox() {
  const setModel = useStructStore((s) => s.setModel);
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState(SAMPLE);
  const [error, setError] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const [loadedName, setLoadedName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-uploading the same file
    if (!file) return;
    setReading(true);
    setError(null);
    setLoadedName(null);
    try {
      setCode(await file.text());
      setLoadedName(file.name);
    } catch {
      setError("Could not read the file.");
    } finally {
      setReading(false);
    }
  };

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
                setLoadedName(null);
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
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="min-w-0 truncate text-xs">
            {reading ? (
              <span className="text-muted">Reading file…</span>
            ) : loadedName ? (
              <span className="font-medium text-emerald-600 dark:text-emerald-400">
                Loaded {loadedName}
              </span>
            ) : (
              <span className="text-muted">Paste code below, or upload a file.</span>
            )}
          </span>
          <input
            ref={fileInputRef}
            type="file"
            accept=".h,.hpp,.hh,.hxx,.cuh,.cpp,.cc,.cxx,.txt"
            onChange={handleFile}
            className="hidden"
          />
          <Button
            variant="secondary"
            size="sm"
            disabled={reading}
            onClick={() => fileInputRef.current?.click()}
          >
            {reading ? (
              <span
                className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
                aria-hidden
              />
            ) : (
              <UploadIcon />
            )}
            {reading ? "Loading…" : "Upload file"}
          </Button>
        </div>
        <div className="relative">
          <CodeEditor
            value={code}
            onChange={(v) => {
              setCode(v);
              setError(null);
              setLoadedName(null);
            }}
            rows={12}
            autoFocus
            disabled={reading}
          />
          {reading && (
            <div className="absolute inset-0 flex items-center justify-center gap-2 rounded-lg border border-border bg-surface/85 backdrop-blur-sm">
              <span
                className="h-5 w-5 animate-spin rounded-full border-2 border-accent border-t-transparent"
                aria-hidden
              />
              <span className="text-sm font-medium text-muted">Reading file…</span>
            </div>
          )}
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
