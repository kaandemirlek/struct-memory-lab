// ============================================================================
// segments.ts  ← PERSON A   (LayoutVisualizer'ın saf, test edilebilir çekirdeği)
// ============================================================================
// computeLayout'un ürettiği LayoutResult'ı, ekranda çizilecek "segment"
// listesine çevirir. Padding'i (alanların içindeki paddingBefore sayısını)
// ayrı, görünür gri bloklara dönüştürür ve sondaki tail padding'i ekler.
//
// "Türet-sonra-çiz" deseni: bu fonksiyon test edilir, bileşen sadece map'ler.
// ============================================================================

import type { FieldType, LayoutResult } from "@/types";

export interface LayoutSegment {
  kind: "field" | "padding";
  offset: number; // banttaki başlangıç byte'ı
  size: number; // kaç byte
  name?: string; // sadece field için
  type?: FieldType; // sadece field için ("struct" olabilir)
  typeName?: string; // gösterim etiketi ("uint32_t" / "Vec3") — sadece field için
  colorIndex?: number; // sadece field için (kararlı renk seçimi)
}

export function toSegments(layout: LayoutResult): LayoutSegment[] {
  const segments: LayoutSegment[] = [];
  let colorIndex = 0;

  for (const f of layout.fields) {
    // Fikir 2: alandan önceki padding'i görünür gri bloğa çevir.
    if (f.paddingBefore > 0) {
      segments.push({
        kind: "padding",
        offset: f.offset - f.paddingBefore,
        size: f.paddingBefore,
      });
    }
    segments.push({
      kind: "field",
      offset: f.offset,
      size: f.size,
      name: f.name,
      type: f.type,
      typeName: f.typeName,
      colorIndex: colorIndex++,
    });
  }

  // Tail padding: son alanın bittiği yer ile totalSize arasındaki boşluk.
  const last = layout.fields[layout.fields.length - 1];
  const usedEnd = last ? last.offset + last.size : 0;
  const tail = layout.totalSize - usedEnd;
  if (tail > 0) {
    segments.push({ kind: "padding", offset: usedEnd, size: tail });
  }

  return segments;
}
