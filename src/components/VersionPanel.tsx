// VersionPanel.tsx  ← PERSON B
"use client";

import { useStructStore } from "@/store/useStructStore";

export default function VersionPanel() {
  const versions = useStructStore((s) => s.versions);
  const saveVersion = useStructStore((s) => s.saveVersion);
  const loadVersion = useStructStore((s) => s.loadVersion);

  return (
    <section className="rounded-lg border border-black/10 dark:border-white/15 p-4">
      <h2 className="font-semibold mb-2">📌 Versions (Person B)</h2>

      <button
        onClick={saveVersion}
        className="mb-3 rounded bg-foreground text-background px-3 py-1.5 text-sm font-medium"
      >
        💾 Versiyon kaydet
      </button>

      {versions.length === 0 ? (
        <p className="text-sm opacity-60">Henüz versiyon yok.</p>
      ) : (
        <ul className="space-y-1">
          {versions.map((v) => (
            <li key={v.id}>
              <button
                onClick={() => loadVersion(v.id)}
                className="w-full text-left rounded border border-black/10 dark:border-white/15 px-2 py-1 text-sm hover:bg-black/5 dark:hover:bg-white/10"
              >
                {v.label} · {v.model.fields.length} alan
              </button>
            </li>
          ))}
        </ul>
      )}
      {/* TODO (PERSON B): seçili versiyonu vurgula, sil/yeniden adlandır ekle. */}
    </section>
  );
}
