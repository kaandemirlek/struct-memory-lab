// BitFieldPanel.tsx  ← Person A   (Faz 2: salt-okunur bit-grid görseli)
"use client";

import { useStructStore } from "@/store/useStructStore";
import {
  bitsPerWord,
  wordCount,
  isUnsignedInt,
  bitWarningsForField,
} from "@/engine/bitfields";
import type { BitField, Field, StructModel } from "@/types";
import Panel from "@/components/ui/Panel";
import Button from "@/components/ui/Button";

// Bit alanları için kararlı renk paleti (alan indeksine göre).
const COLORS = ["#60a5fa", "#34d399", "#f472b6", "#fbbf24", "#a78bfa", "#fb7185"];

// Düzenleme UI'ı (Faz 3) gelene kadar demo için örnek status paketi.
const EXAMPLE: StructModel = {
  name: "StatusPacket",
  fields: [
    {
      id: "sw",
      name: "statusWords",
      type: "uint32_t",
      arrayLength: 3,
      bitFields: [
        { id: "b0", name: "irCameraFail", wordIndex: 0, startBit: 0, width: 1, meanings: [{ value: 0, label: "OK" }, { value: 1, label: "FAIL" }] },
        { id: "b1", name: "laserFail", wordIndex: 0, startBit: 1, width: 1, meanings: [{ value: 0, label: "OK" }, { value: 1, label: "FAIL" }] },
        { id: "b2", name: "trackingLost", wordIndex: 0, startBit: 2, width: 1, meanings: [{ value: 0, label: "OK" }, { value: 1, label: "LOST" }] },
        { id: "b3", name: "operationMode", wordIndex: 0, startBit: 4, width: 3, meanings: [{ value: 0, label: "Idle" }, { value: 1, label: "Search" }, { value: 2, label: "Track" }] },
      ],
    },
  ],
};

/** Bir bit alanının insan-dostu aralık etiketi: "bit 0" / "bits 4–6". */
function rangeLabel(b: BitField): string {
  return b.width === 1 ? `bit ${b.startBit}` : `bits ${b.startBit}–${b.startBit + b.width - 1}`;
}

function WordGrid({ field }: { field: Field }) {
  const bpw = bitsPerWord(field);
  const words = wordCount(field);
  const bits = field.bitFields ?? [];
  const warnings = bitWarningsForField(field);

  return (
    <div className="mb-4">
      <div className="mb-1 font-mono text-sm">
        {field.name}
        {field.arrayLength > 1 ? `[${field.arrayLength}]` : ""}{" "}
        <span className="text-muted">({field.type}, {bpw} bit/word)</span>
      </div>

      {Array.from({ length: words }).map((_, w) => (
        <div key={w} className="mb-2">
          <div className="mb-1 text-xs text-muted">
            word{w} <span className="opacity-60">· bit 0 → {bpw - 1} (soldan sağa)</span>
          </div>
          <div className="overflow-x-auto">
            <div className="flex w-max">
              {Array.from({ length: bpw }).map((_, bit) => {
                const owners = bits.filter(
                  (b) => b.wordIndex === w && bit >= b.startBit && bit < b.startBit + b.width
                );
                const owner = owners[0];
                const idx = owner ? bits.indexOf(owner) : -1;
                const overlap = owners.length > 1;
                return (
                  <div
                    key={bit}
                    title={
                      owner
                        ? `bit ${bit}: ${owner.name}${overlap ? " (OVERLAP!)" : ""}`
                        : `bit ${bit}: boş`
                    }
                    className="grid h-7 w-5 shrink-0 place-items-center border-r border-black/10 text-[9px] last:border-r-0"
                    style={{
                      background: owner ? COLORS[idx % COLORS.length] : "transparent",
                      color: owner ? "#000" : "var(--color-text-muted, #888)",
                      boxShadow: overlap ? "inset 0 0 0 2px #ef4444" : undefined,
                    }}
                  >
                    {bit}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ))}

      {/* Legend: her bit alanı + aralık + anlamlar */}
      {bits.length > 0 && (
        <ul className="mt-2 space-y-1">
          {bits.map((b, i) => (
            <li key={b.id} className="flex flex-wrap items-center gap-1.5 text-[11px]">
              <span
                className="inline-block h-3 w-3 shrink-0 rounded-sm"
                style={{ background: COLORS[i % COLORS.length] }}
              />
              <span className="font-mono">{b.name}</span>
              <span className="text-muted">
                word{b.wordIndex} · {rangeLabel(b)}
              </span>
              {b.meanings && b.meanings.length > 0 && (
                <span className="text-muted">
                  ({b.meanings.map((m) => `${m.value}=${m.label}`).join(", ")})
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* Bu alana ait uyarılar */}
      {warnings.length > 0 && (
        <ul className="mt-2 space-y-0.5">
          {warnings.map((w, i) => (
            <li key={i} className="text-xs text-danger">
              ⚠ {w.message}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function BitFieldPanel() {
  const model = useStructStore((s) => s.currentModel);
  const setModel = useStructStore((s) => s.setModel);

  const bitFieldFields = model.fields.filter(
    (f) => isUnsignedInt(f.type) && (f.bitFields?.length ?? 0) > 0
  );

  return (
    <Panel
      title="Status Bits"
      description="Bit-level meaning of unsigned-integer (status word) fields."
      actions={
        <Button variant="secondary" onClick={() => setModel(structuredClone(EXAMPLE))}>
          Load example
        </Button>
      }
    >
      {bitFieldFields.length === 0 ? (
        <p className="text-sm text-muted">
          No bit fields defined. Load the example StatusPacket to see a status-word bit map.
        </p>
      ) : (
        bitFieldFields.map((f) => <WordGrid key={f.id} field={f} />)
      )}
    </Panel>
  );
}
