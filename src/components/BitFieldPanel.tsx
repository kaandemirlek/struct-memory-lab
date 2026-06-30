// BitFieldPanel.tsx  ← Person A   (Faz 2 görsel + Faz 3 düzenleme)
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

const inputClass =
  "min-w-0 rounded border border-border bg-surface-muted px-1.5 py-1 text-xs outline-none focus:border-accent";

// Düzenleme öncesi demo için örnek status paketi.
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

const toInt = (v: string, min: number) => Math.max(min, Math.floor(Number(v) || 0));

// Salt-okunur bit ızgarası + bu alana ait uyarılar.
function WordGrid({ field }: { field: Field }) {
  const bpw = bitsPerWord(field);
  const words = wordCount(field);
  const bits = field.bitFields ?? [];
  const warnings = bitWarningsForField(field);

  return (
    <>
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
                    title={owner ? `bit ${bit}: ${owner.name}${overlap ? " (OVERLAP!)" : ""}` : `bit ${bit}: boş`}
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
      {warnings.length > 0 && (
        <ul className="mt-1 space-y-0.5">
          {warnings.map((wn, i) => (
            <li key={i} className="text-xs text-danger">⚠ {wn.message}</li>
          ))}
        </ul>
      )}
    </>
  );
}

// Tek bir bit alanının düzenleme satırı (isim/word/bit/width + anlamlar).
function BitFieldRow({ fieldId, bit, words, colorIdx }: { fieldId: string; bit: BitField; words: number; colorIdx: number }) {
  const updateBitField = useStructStore((s) => s.updateBitField);
  const removeBitField = useStructStore((s) => s.removeBitField);
  const meanings = bit.meanings ?? [];

  const setMeanings = (next: typeof meanings) => updateBitField(fieldId, bit.id, { meanings: next });

  return (
    <div className="rounded-lg border border-border p-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="inline-block h-3 w-3 shrink-0 rounded-sm" style={{ background: COLORS[colorIdx % COLORS.length] }} />
        <input
          value={bit.name}
          onChange={(e) => updateBitField(fieldId, bit.id, { name: e.target.value })}
          className={`flex-1 font-mono ${inputClass}`}
        />
        <label className="text-[10px] text-muted">word</label>
        <select
          value={bit.wordIndex}
          onChange={(e) => updateBitField(fieldId, bit.id, { wordIndex: Number(e.target.value) })}
          className={inputClass}
        >
          {Array.from({ length: words }).map((_, w) => (
            <option key={w} value={w}>{w}</option>
          ))}
        </select>
        <label className="text-[10px] text-muted">bit</label>
        <input
          type="number"
          min={0}
          value={bit.startBit}
          onChange={(e) => updateBitField(fieldId, bit.id, { startBit: toInt(e.target.value, 0) })}
          className={`w-12 ${inputClass}`}
        />
        <label className="text-[10px] text-muted">width</label>
        <input
          type="number"
          min={1}
          value={bit.width}
          onChange={(e) => updateBitField(fieldId, bit.id, { width: toInt(e.target.value, 1) })}
          className={`w-12 ${inputClass}`}
        />
        <button
          onClick={() => removeBitField(fieldId, bit.id)}
          aria-label={`Remove ${bit.name}`}
          className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-muted transition-colors hover:bg-danger/10 hover:text-danger"
        >
          ×
        </button>
      </div>

      {/* Anlamlar (value = label) */}
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
        <span className="text-[10px] text-muted">meanings:</span>
        {meanings.map((m, i) => (
          <span key={i} className="flex items-center gap-0.5">
            <input
              type="number"
              value={m.value}
              onChange={(e) => setMeanings(meanings.map((x, j) => (j === i ? { ...x, value: toInt(e.target.value, 0) } : x)))}
              className={`w-10 ${inputClass}`}
            />
            <span className="text-muted">=</span>
            <input
              value={m.label}
              placeholder="OK"
              onChange={(e) => setMeanings(meanings.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))}
              className={`w-16 ${inputClass}`}
            />
            <button
              onClick={() => setMeanings(meanings.filter((_, j) => j !== i))}
              className="px-1 text-muted hover:text-danger"
              aria-label="Remove meaning"
            >
              ×
            </button>
          </span>
        ))}
        <button
          onClick={() => setMeanings([...meanings, { value: meanings.length, label: "" }])}
          className="rounded border border-border px-1.5 py-0.5 text-[10px] text-muted hover:text-foreground"
        >
          + meaning
        </button>
      </div>
    </div>
  );
}

// Bir unsigned-int alanın tam editörü: grid + bit satırları + ekle.
function FieldBitEditor({ field }: { field: Field }) {
  const addBitField = useStructStore((s) => s.addBitField);
  const words = wordCount(field);
  const bits = field.bitFields ?? [];

  return (
    <div className="mb-4">
      <div className="mb-1 font-mono text-sm">
        {field.name}
        {field.arrayLength > 1 ? `[${field.arrayLength}]` : ""}{" "}
        <span className="text-muted">({field.type}, {bitsPerWord(field)} bit/word)</span>
      </div>

      <WordGrid field={field} />

      <div className="mt-2 space-y-1.5">
        {bits.map((b, i) => (
          <BitFieldRow key={b.id} fieldId={field.id} bit={b} words={words} colorIdx={i} />
        ))}
      </div>

      <Button variant="secondary" onClick={() => addBitField(field.id)} className="mt-2">
        + Add bit field
      </Button>
    </div>
  );
}

export default function BitFieldPanel() {
  const model = useStructStore((s) => s.currentModel);
  const setModel = useStructStore((s) => s.setModel);

  const fields = model.fields.filter((f) => isUnsignedInt(f.type));

  return (
    <Panel
      title="Status Bits"
      description="Define bit-level meaning of unsigned-integer (status word) fields."
      actions={
        <Button variant="secondary" onClick={() => setModel(structuredClone(EXAMPLE))}>
          Load example
        </Button>
      }
    >
      {fields.length === 0 ? (
        <p className="text-sm text-muted">
          No unsigned-integer fields. Add a uint8/16/32/64 field (or load the example) to define status bits.
        </p>
      ) : (
        fields.map((f) => <FieldBitEditor key={f.id} field={f} />)
      )}
    </Panel>
  );
}
