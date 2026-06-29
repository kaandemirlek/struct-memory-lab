// ============================================================================
// words.ts  ← PERSON A   (word-grid görünümünün saf, test edilebilir çekirdeği)
// ============================================================================
// LayoutResult'ı, her satırı W byte'lık bir "word" olan bir ızgaraya sarar.
// Bir alan word sınırını aşıyorsa (örn. word=4 iken double=8), her word için
// ayrı bir parça (run) üretiriz; böylece alanın word'leri nasıl kapladığı
// (ve sınırı nasıl aştığı) gözle görülür — eğitici olan tam da budur.
//
// "Türet-sonra-çiz": bu fonksiyon test edilir, bileşen sadece çizer.
// ============================================================================

import type { LayoutResult } from "@/types";
import { toSegments } from "@/engine/segments";

export interface WordCell {
  kind: "field" | "padding";
  startByte: number; // mutlak başlangıç byte'ı
  span: number; // bu word içinde kaç byte
  /** Bu parça, alanın İLK byte'ını içeriyor mu? (ismi yalnızca burada gösteririz) */
  isStart: boolean;
  fieldId?: string;
  name?: string;
  typeName?: string;
  colorIndex?: number;
}

export interface WordRow {
  index: number; // word numarası (0, 1, 2, ...)
  startByte: number; // word'ün başlangıç offset'i (index * wordSize)
  cells: WordCell[];
}

export function wrapIntoWords(layout: LayoutResult, wordSize: number): WordRow[] {
  const w = Math.max(1, Math.floor(wordSize));
  const total = layout.totalSize;
  const wordCount = Math.max(1, Math.ceil(total / w));

  const rows: WordRow[] = Array.from({ length: wordCount }, (_, i) => ({
    index: i,
    startByte: i * w,
    cells: [],
  }));

  for (const s of toSegments(layout)) {
    let b = s.offset;
    const end = s.offset + s.size;
    while (b < end) {
      const wordIndex = Math.floor(b / w);
      const wordEnd = (wordIndex + 1) * w;
      const runEnd = Math.min(end, wordEnd); // bu word içinde kaldığımız kadar
      rows[wordIndex].cells.push({
        kind: s.kind,
        startByte: b,
        span: runEnd - b,
        isStart: b === s.offset, // alanın ilk parçası mı?
        fieldId: s.fieldId,
        name: s.name,
        typeName: s.typeName,
        colorIndex: s.colorIndex,
      });
      b = runEnd;
    }
  }

  return rows;
}
