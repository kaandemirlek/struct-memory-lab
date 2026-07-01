"use client";

import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { useStructStore } from "@/store/useStructStore";
import {
  bitsPerWord,
  wordCount,
  isUnsignedInt,
  bitWarningsForField,
} from "@/engine/bitfields";
import type { BitField, BitFieldKind, Field } from "@/types";
import Panel from "@/components/ui/Panel";

type BitOrder = "msb" | "lsb";
type Draft = Pick<BitField, "wordIndex" | "startBit" | "width">;
type Interaction =
  | {
      kind: "move";
      bit: BitField;
      pointerBit: number;
      draft: Draft;
    }
  | {
      kind: "resize-start" | "resize-end";
      bit: BitField;
      draft: Draft;
    }
  | {
      kind: "create";
      anchorBit: number;
      draft: Draft;
    };

const inputClass =
  "min-w-0 rounded-lg border border-border bg-surface-muted px-2 py-1.5 text-xs outline-none focus:border-accent";

function colorFor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  return `hsl(${Math.abs(hash) % 360} 72% 68%)`;
}

function canPlace(field: Field, draft: Draft, ignoreId?: string): boolean {
  const limit = bitsPerWord(field);
  if (
    draft.wordIndex < 0 ||
    draft.wordIndex >= wordCount(field) ||
    draft.startBit < 0 ||
    draft.width < 1 ||
    draft.startBit + draft.width > limit
  ) {
    return false;
  }

  return !(field.bitFields ?? []).some(
    (bit) =>
      bit.id !== ignoreId &&
      bit.wordIndex === draft.wordIndex &&
      draft.startBit < bit.startBit + bit.width &&
      bit.startBit < draft.startBit + draft.width
  );
}

function bitAtPointer(element: HTMLElement, clientX: number, bitCount: number, order: BitOrder) {
  const rect = element.getBoundingClientRect();
  const displayIndex = Math.max(
    0,
    Math.min(bitCount - 1, Math.floor(((clientX - rect.left) / rect.width) * bitCount))
  );
  return order === "lsb" ? displayIndex : bitCount - 1 - displayIndex;
}

function BitInspector({
  field,
  bit,
  onClose,
}: {
  field: Field;
  bit: BitField;
  onClose: () => void;
}) {
  const updateBitField = useStructStore((s) => s.updateBitField);
  const removeBitField = useStructStore((s) => s.removeBitField);
  const meanings = bit.meanings ?? [];
  const setMeanings = (next: typeof meanings) =>
    updateBitField(field.id, bit.id, { meanings: next });

  // Meaning değeri için izinli aralık — signed 'int' alanda negatif olabilir.
  //   uint/enum/flag → 0..2^w-1 ;  int → -2^(w-1)..2^(w-1)-1  (bkz. bitfields.ts)
  const meaningKind = bit.kind ?? (bit.width === 1 ? "flag" : "uint");
  const valueMin = meaningKind === "int" ? -(2 ** Math.min(bit.width - 1, 30)) : 0;
  const valueMax =
    meaningKind === "int"
      ? 2 ** Math.min(bit.width - 1, 30) - 1
      : 2 ** Math.min(bit.width, 30) - 1;

  return (
    <div className="mt-4 rounded-xl border border-border bg-surface-muted/50 p-3">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <div className="text-xs font-semibold">Selected bit field</div>
          <div className="font-mono text-[11px] text-muted">
            word {bit.wordIndex} · bits {bit.startBit}–{bit.startBit + bit.width - 1}
          </div>
        </div>
        <button onClick={onClose} className="text-sm text-muted hover:text-foreground" aria-label="Close inspector">
          ×
        </button>
      </div>

      <label className="block">
        <span className="mb-1 block text-[11px] text-muted">Name</span>
        <input
          value={bit.name}
          onChange={(event) => updateBitField(field.id, bit.id, { name: event.target.value })}
          className={`w-full font-mono ${inputClass}`}
        />
      </label>

      <label className="mt-3 block">
        <span className="mb-1 block text-[11px] text-muted">Type</span>
        <select
          value={bit.kind ?? (bit.width === 1 ? "flag" : "uint")}
          onChange={(event) => {
            const kind = event.target.value as BitFieldKind;
            // flag her zaman 1 bit; diğerlerinde mevcut genişlik korunur.
            updateBitField(field.id, bit.id, kind === "flag" ? { kind, width: 1 } : { kind });
          }}
          className={`w-full ${inputClass}`}
        >
          <option value="flag">flag (1 bit)</option>
          <option value="uint">uint (unsigned)</option>
          <option value="int">int (signed)</option>
          <option value="enum">enum</option>
        </select>
      </label>

      <div className="mt-3">
        <div className="mb-1 flex items-center justify-between">
          <span className="text-[11px] text-muted">Value meanings</span>
          <button
            onClick={() => setMeanings([...meanings, { value: meanings.length, label: "" }])}
            className="text-[11px] text-accent hover:underline"
          >
            + Add meaning
          </button>
        </div>
        <div className="space-y-1.5">
          {meanings.map((meaning, index) => (
            <div key={index} className="flex items-center gap-1.5">
              <input
                type="number"
                min={valueMin}
                max={valueMax}
                value={meaning.value}
                onChange={(event) =>
                  setMeanings(
                    meanings.map((item, i) =>
                      i === index
                        ? { ...item, value: Math.max(valueMin, Number(event.target.value) || 0) }
                        : item
                    )
                  )
                }
                className={`w-20 font-mono ${inputClass}`}
              />
              <span className="text-xs text-muted">=</span>
              <input
                value={meaning.label}
                placeholder="Label"
                onChange={(event) =>
                  setMeanings(
                    meanings.map((item, i) =>
                      i === index ? { ...item, label: event.target.value } : item
                    )
                  )
                }
                className={`flex-1 ${inputClass}`}
              />
              <button
                onClick={() => setMeanings(meanings.filter((_, i) => i !== index))}
                className="grid h-7 w-7 place-items-center text-muted hover:text-danger"
                aria-label="Remove meaning"
              >
                ×
              </button>
            </div>
          ))}
          {meanings.length === 0 && (
            <p className="text-[11px] text-muted">Optional: map raw values to labels such as OK or FAIL.</p>
          )}
        </div>
      </div>

      <button
        onClick={() => {
          removeBitField(field.id, bit.id);
          onClose();
        }}
        className="mt-3 text-xs text-danger hover:underline"
      >
        Delete bit field
      </button>
    </div>
  );
}

function WordEditor({
  field,
  wordIndex,
  order,
  selectedId,
  onSelect,
}: {
  field: Field;
  wordIndex: number;
  order: BitOrder;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) {
  const bitCount = bitsPerWord(field);
  const bits = (field.bitFields ?? []).filter((bit) => bit.wordIndex === wordIndex);
  const addBitField = useStructStore((s) => s.addBitField);
  const updateBitField = useStructStore((s) => s.updateBitField);
  const gridRef = useRef<HTMLDivElement>(null);
  const [interaction, setInteraction] = useState<Interaction | null>(null);

  const shownBits = bits.map((bit) => {
    if (
      interaction &&
      interaction.kind !== "create" &&
      interaction.bit.id === bit.id
    ) {
      return { ...bit, ...interaction.draft };
    }
    return bit;
  });

  const startInteraction = (
    event: ReactPointerEvent,
    next: Interaction
  ) => {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    setInteraction(next);
  };

  const updateInteraction = (event: ReactPointerEvent) => {
    if (!interaction || !gridRef.current) return;
    let targetGrid: HTMLElement = gridRef.current;
    let targetWord = wordIndex;

    // Pointer capture keeps move events reliable while the cursor travels between
    // rows. elementFromPoint tells us which real word is currently underneath.
    if (interaction.kind === "move") {
      const underneath = document
        .elementsFromPoint(event.clientX, event.clientY)
        .map((element) => element.closest<HTMLElement>("[data-word-grid]"))
        .find((element) => element?.dataset.fieldId === field.id);
      if (underneath) {
        targetGrid = underneath;
        targetWord = Number(underneath.dataset.wordGrid);
      }
    }

    const pointerBit = bitAtPointer(targetGrid, event.clientX, bitCount, order);

    if (interaction.kind === "create") {
      setInteraction({
        ...interaction,
        draft: {
          wordIndex,
          startBit: Math.min(interaction.anchorBit, pointerBit),
          width: Math.abs(pointerBit - interaction.anchorBit) + 1,
        },
      });
      return;
    }

    if (interaction.kind === "move") {
      const delta = pointerBit - interaction.pointerBit;
      const startBit = Math.max(0, Math.min(bitCount - interaction.bit.width, interaction.bit.startBit + delta));
      setInteraction({
        ...interaction,
        draft: { wordIndex: targetWord, startBit, width: interaction.bit.width },
      });
      return;
    }

    if (interaction.kind === "resize-start") {
      const end = interaction.bit.startBit + interaction.bit.width - 1;
      const startBit = Math.max(0, Math.min(end, pointerBit));
      setInteraction({
        ...interaction,
        draft: { wordIndex, startBit, width: end - startBit + 1 },
      });
      return;
    }

    const end = Math.max(interaction.bit.startBit, Math.min(bitCount - 1, pointerBit));
    setInteraction({
      ...interaction,
      draft: {
        wordIndex,
        startBit: interaction.bit.startBit,
        width: end - interaction.bit.startBit + 1,
      },
    });
  };

  const finishInteraction = () => {
    if (!interaction) return;
    const ignoredId = interaction.kind === "create" ? undefined : interaction.bit.id;
    if (canPlace(field, interaction.draft, ignoredId)) {
      if (interaction.kind === "create") {
        addBitField(field.id, interaction.draft);
      } else {
        updateBitField(field.id, interaction.bit.id, interaction.draft);
        onSelect(interaction.bit.id);
      }
    }
    setInteraction(null);
  };

  const createFromCell = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!gridRef.current || event.target !== event.currentTarget) return;
    const pointerBit = bitAtPointer(gridRef.current, event.clientX, bitCount, order);
    if (!canPlace(field, { wordIndex, startBit: pointerBit, width: 1 })) return;
    startInteraction(event, {
      kind: "create",
      anchorBit: pointerBit,
      draft: { wordIndex, startBit: pointerBit, width: 1 },
    });
  };

  const draftValid = !interaction || canPlace(
    field,
    interaction.draft,
    interaction.kind === "create" ? undefined : interaction.bit.id
  );

  const visualStyle = (bit: Pick<BitField, "startBit" | "width">) => {
    const displayStart = order === "lsb" ? bit.startBit : bitCount - bit.startBit - bit.width;
    return {
      left: `${(displayStart / bitCount) * 100}%`,
      width: `${(bit.width / bitCount) * 100}%`,
    };
  };

  return (
    <div className="rounded-xl border border-border bg-surface-muted/30 p-3">
      <div className="mb-2 flex items-baseline justify-between">
        <span className="font-mono text-xs font-semibold">word {wordIndex}</span>
        <span className="font-mono text-[10px] text-muted">
          +0x{(wordIndex * (bitCount / 8)).toString(16).padStart(2, "0")} · {bitCount} bits
        </span>
      </div>

      <div className="overflow-x-auto pb-1">
        <div className="min-w-[640px]">
          <div
            className="mb-1 grid font-mono text-[9px] text-muted"
            style={{ gridTemplateColumns: `repeat(${bitCount}, minmax(0, 1fr))` }}
          >
            {Array.from({ length: bitCount }, (_, displayIndex) => (
              <span key={displayIndex} className="text-center">
                {order === "lsb" ? displayIndex : bitCount - 1 - displayIndex}
              </span>
            ))}
          </div>
          <div
            ref={gridRef}
            data-word-grid={wordIndex}
            data-field-id={field.id}
            onPointerDown={createFromCell}
            onPointerMove={updateInteraction}
            onPointerUp={finishInteraction}
            onPointerCancel={() => setInteraction(null)}
            className="relative h-14 touch-none select-none overflow-hidden rounded-lg border border-border bg-surface"
            style={{
              backgroundImage: `repeating-linear-gradient(to right, transparent 0, transparent calc(${100 / bitCount}% - 1px), var(--border) calc(${100 / bitCount}% - 1px), var(--border) ${100 / bitCount}%)`,
            }}
          >
            {shownBits.map((bit) => {
              const isActive =
                interaction?.kind !== "create" && interaction?.bit.id === bit.id;
              const valid = !isActive || draftValid;
              return (
                <div
                  key={bit.id}
                  style={{
                    ...visualStyle(bit),
                    background: colorFor(bit.id),
                    boxShadow: !valid
                      ? "inset 0 0 0 2px var(--danger)"
                      : selectedId === bit.id
                        ? "inset 0 0 0 2px var(--foreground)"
                        : undefined,
                  }}
                  onPointerDown={(event) => {
                    if (!gridRef.current) return;
                    onSelect(bit.id);
                    startInteraction(event, {
                      kind: "move",
                      bit,
                      pointerBit: bitAtPointer(gridRef.current, event.clientX, bitCount, order),
                      draft: {
                        wordIndex: bit.wordIndex,
                        startBit: bit.startBit,
                        width: bit.width,
                      },
                    });
                  }}
                  className="absolute inset-y-1 flex cursor-grab items-center justify-center overflow-hidden rounded-md px-2 text-[11px] font-semibold text-slate-950 shadow-sm active:cursor-grabbing"
                  title={`${bit.name}: bit ${bit.startBit}–${bit.startBit + bit.width - 1}`}
                >
                  <button
                    aria-label={`Resize start of ${bit.name}`}
                    onPointerDown={(event) =>
                      startInteraction(event, {
                        kind: "resize-start",
                        bit,
                        draft: {
                          wordIndex: bit.wordIndex,
                          startBit: bit.startBit,
                          width: bit.width,
                        },
                      })
                    }
                    className={`absolute inset-y-0 w-2 cursor-ew-resize hover:bg-black/20 ${
                      order === "lsb" ? "left-0" : "right-0"
                    }`}
                  />
                  <span className="pointer-events-none truncate">{bit.name}</span>
                  <button
                    aria-label={`Resize end of ${bit.name}`}
                    onPointerDown={(event) =>
                      startInteraction(event, {
                        kind: "resize-end",
                        bit,
                        draft: {
                          wordIndex: bit.wordIndex,
                          startBit: bit.startBit,
                          width: bit.width,
                        },
                      })
                    }
                    className={`absolute inset-y-0 w-2 cursor-ew-resize hover:bg-black/20 ${
                      order === "lsb" ? "right-0" : "left-0"
                    }`}
                  />
                </div>
              );
            })}

            {interaction?.kind === "create" && (
              <div
                style={{
                  ...visualStyle(interaction.draft),
                  background: draftValid ? "color-mix(in srgb, var(--accent) 65%, transparent)" : "var(--danger)",
                }}
                className="pointer-events-none absolute inset-y-1 rounded-md border-2 border-dashed border-white/70"
              />
            )}
          </div>
        </div>
      </div>
      <p className="mt-1.5 text-[10px] text-muted">Drag empty cells to create · drag blocks within or between words · pull edges to resize</p>
    </div>
  );
}

function FieldBitEditor({ field }: { field: Field }) {
  const [order, setOrder] = useState<BitOrder>("msb");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = (field.bitFields ?? []).find((bit) => bit.id === selectedId) ?? null;
  const warnings = bitWarningsForField(field);

  return (
    <section id={`bits-${field.id}`} className="scroll-mt-24 rounded-2xl border border-border p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-mono text-sm font-semibold">
            {field.name}{field.arrayLength > 1 ? `[${field.arrayLength}]` : ""}
          </h3>
          <p className="text-[11px] text-muted">{field.type} · {bitsPerWord(field)} bits per word</p>
        </div>
        <div className="flex rounded-lg border border-border bg-surface-muted p-0.5 text-[10px]">
          {(["msb", "lsb"] as const).map((value) => (
            <button
              key={value}
              onClick={() => setOrder(value)}
              className={`rounded-md px-2 py-1 uppercase ${
                order === value ? "bg-surface text-foreground shadow-sm" : "text-muted"
              }`}
            >
              {value} first
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        {Array.from({ length: wordCount(field) }, (_, wordIndex) => (
          <WordEditor
            key={wordIndex}
            field={field}
            wordIndex={wordIndex}
            order={order}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
        ))}
      </div>

      {selected && (
        <BitInspector field={field} bit={selected} onClose={() => setSelectedId(null)} />
      )}

      {warnings.length > 0 && (
        <ul className="mt-3 space-y-1" role="alert">
          {warnings.map((warning, index) => (
            <li key={index} className="text-xs text-danger">⚠ {warning.message}</li>
          ))}
        </ul>
      )}
    </section>
  );
}

// Bir alanın (kendisi ya da nested alt-ağacında) bit-tanımlanabilir alanı var mı?
function hasBitCapable(field: Field): boolean {
  if (isUnsignedInt(field.type)) return true;
  if (field.type === "struct" && field.nested) return field.nested.fields.some(hasBitCapable);
  return false;
}

const fieldArr = (field: Field) => (field.arrayLength > 1 ? `[${field.arrayLength}]` : "");

// Alan ağacını gezer: yalnızca bit-tanımlanabilir (unsigned) alanları editör olarak
// gösterir; nested struct'lara inip içlerindeki unsigned alanları da düzenlenebilir kılar.
function FieldTree({ fields }: { fields: Field[] }) {
  return (
    <div className="space-y-4">
      {fields.map((field) => {
        if (isUnsignedInt(field.type)) {
          return <FieldBitEditor key={field.id} field={field} />;
        }
        if (field.type === "struct" && field.nested && hasBitCapable(field)) {
          return (
            <div key={field.id} className="rounded-2xl border border-border/70 p-3">
              <div className="mb-2 font-mono text-xs font-semibold text-muted">
                {field.name}
                {fieldArr(field)} · {field.nested.name} (nested)
              </div>
              <div className="border-l-2 border-accent/30 pl-3">
                <FieldTree fields={field.nested.fields} />
              </div>
            </div>
          );
        }
        return null; // float / bool / signed → bit tanımlanamaz, gösterilmez
      })}
    </div>
  );
}

export default function BitFieldPanel() {
  const model = useStructStore((s) => s.currentModel);
  const anyBitCapable = model.fields.some(hasBitCapable);

  return (
    <Panel
      title="Status Bits"
      description="Define the bit layout of unsigned-integer fields (incl. inside nested structs). Saved with the current struct."
    >
      {!anyBitCapable ? (
        <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center">
          <p className="text-sm font-medium">No status-word fields</p>
          <p className="mt-1 text-xs text-muted">
            Add a uint8/16/32/64 field (here or inside a nested struct) to define bits.
          </p>
        </div>
      ) : (
        <FieldTree fields={model.fields} />
      )}
    </Panel>
  );
}
