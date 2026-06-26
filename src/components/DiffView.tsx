// DiffView.tsx  ← PERSON B
"use client";

import { useStructStore } from "@/store/useStructStore";
import { diffVersions } from "@/engine/diff";

export default function DiffView() {
  const versions = useStructStore((s) => s.versions);
  const current = useStructStore((s) => s.currentModel);

  // En son kaydedilen versiyon ile şu anki modeli karşılaştır (başlangıç davranışı).
  const last = versions[versions.length - 1];
  const entries = last ? diffVersions(last.model, current) : [];

  return (
    <section className="rounded-lg border border-black/10 dark:border-white/15 p-4">
      <h2 className="font-semibold mb-2">🔀 Diff (Person B)</h2>
      {!last ? (
        <p className="text-sm opacity-60">Karşılaştırmak için önce bir versiyon kaydet.</p>
      ) : entries.length === 0 ? (
        <p className="text-sm opacity-60">
          {last.label} ile güncel arasında değişiklik yok (ya da diffVersions henüz boş).
        </p>
      ) : (
        <ul className="space-y-1 text-sm">
          {entries.map((e, i) => (
            <li key={i}>
              <span className="font-mono opacity-70">[{e.kind}]</span> {e.detail}
            </li>
          ))}
        </ul>
      )}
      {/* TODO (PERSON B): hangi iki versiyonun karşılaştırılacağını seçtir. */}
    </section>
  );
}
