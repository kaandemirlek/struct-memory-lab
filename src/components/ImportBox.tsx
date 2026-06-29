// ImportBox.tsx  ← PERSON A
"use client";

import { useState } from "react";
import { useStructStore } from "@/store/useStructStore";
import { parseCpp } from "@/engine/parser";

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
      setError(null); // başarılı: önceki hatayı temizle
    } catch (e) {
      setError(e instanceof Error ? e.message : "Bilinmeyen hata");
    }
  };

  return (
    <section className="rounded-lg border border-black/10 dark:border-white/15 p-4">
      <h2 className="font-semibold mb-2">📥 Import (Person A)</h2>
      <textarea
        value={code}
        onChange={(e) => setCode(e.target.value)}
        rows={6}
        className="w-full font-mono text-sm rounded border border-black/10 dark:border-white/15 bg-transparent p-2"
      />
      <button
        onClick={handleParse}
        className="mt-2 rounded bg-foreground text-background px-3 py-1.5 text-sm font-medium"
      >
        Parse →
      </button>
      {error && (
        <p className="mt-2 text-sm text-red-500" role="alert">
          ⚠️ {error}
        </p>
      )}
    </section>
  );
}
