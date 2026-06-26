// WarningsPanel.tsx  ← PERSON B
"use client";

import { useStructStore } from "@/store/useStructStore";
import { analyzeCompatibility } from "@/engine/compatibility";

const STYLES: Record<string, string> = {
  danger: "bg-red-500/15 text-red-600 dark:text-red-400",
  warning: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400",
  info: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
};

export default function WarningsPanel() {
  const versions = useStructStore((s) => s.versions);
  const current = useStructStore((s) => s.currentModel);

  const last = versions[versions.length - 1];
  // analyzeCompatibility, computeLayout'u kendi içinde (şimdilik mock) kullanır.
  const warnings = last ? analyzeCompatibility(last.model, current) : [];

  return (
    <section className="rounded-lg border border-black/10 dark:border-white/15 p-4">
      <h2 className="font-semibold mb-2">⚠️ Compatibility (Person B)</h2>
      {!last ? (
        <p className="text-sm opacity-60">Uyarılar için önce bir versiyon kaydet.</p>
      ) : warnings.length === 0 ? (
        <p className="text-sm opacity-60">Uyarı yok (ya da analiz henüz boş).</p>
      ) : (
        <ul className="space-y-1">
          {warnings.map((w, i) => (
            <li key={i} className={`rounded px-2 py-1 text-sm ${STYLES[w.severity]}`}>
              {w.message}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
