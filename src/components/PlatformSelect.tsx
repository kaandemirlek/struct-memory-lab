"use client";

import { useStructStore } from "@/store/useStructStore";
import { PLATFORMS } from "@/engine/platform";
import type { Platform } from "@/types";

// Header'daki hedef platform / ABI seçici. Yerleşim (size_t, 8-byte hizalama)
// ve parser'ın "long" eşlemesi seçime göre anında güncellenir.
export default function PlatformSelect() {
  const platform = useStructStore((s) => s.platform);
  const setPlatform = useStructStore((s) => s.setPlatform);
  const active = PLATFORMS.find((p) => p.id === platform);

  return (
    <label className="flex items-center gap-1.5" title={active?.description}>
      <span className="hidden text-xs text-muted lg:inline">Target</span>
      <select
        value={platform}
        onChange={(e) => setPlatform(e.target.value as Platform)}
        aria-label="Target platform / ABI"
        className="rounded-lg border border-border bg-surface px-2 py-1.5 text-xs outline-none transition-colors hover:bg-surface-muted focus:border-accent"
      >
        {PLATFORMS.map((p) => (
          <option key={p.id} value={p.id} title={p.description}>
            {p.label}
          </option>
        ))}
      </select>
    </label>
  );
}
