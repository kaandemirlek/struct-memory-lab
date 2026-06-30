// ============================================================================
// layout.ts  ← PERSON A   (⚠️ B'nin compatibility'si buna bağlı)
// ============================================================================
// StructModel için C++ bellek yerleşimini hesaplar: her alanın offset'i,
// hizalama için eklenen padding, toplam boyut (sizeof) ve toplam padding.
//
// 4 kural (standart-layout, paketlenmemiş):
//   1. Boyut    : eleman boyutu × dizi uzunluğu.
//   2. Hizalama : alan, offset'i kendi align'ının katı olan yere konur.
//   3. Padding  : hizalamak için araya boş byte eklenir.
//   4. Tail pad : struct align = max(alan align'ları); toplam boyut buna yuvarlanır.
//
// DETERMİNİSTİK → birim testi kolay (bkz. layout.test.ts).
// ============================================================================

import type { ComputeLayout, FieldLayout, LayoutResult } from "@/types";
import { TYPE_INFO } from "@/types"; //primitives'in boyut ve hizalama bilgisi -> types'ta tanımlamıştık

/** alignUp
 * value'yu align'ın bir sonraki katına yukarı yuvarlar.
 * alignUp(5, 8) = 8 · alignUp(8, 8) = 8 · alignUp(0, 8) = 0, alignUp(9, 8) = 16 -> field'ın başlayabileceği offseti verir
 * (align her zaman 2'nin kuvveti olduğu için bit-maskesiyle de yazılabilir,
 *  ama bu hali okunması daha kolay.)
 */
export const alignUp = (value: number, align: number): number => 
  Math.ceil(value / align) * align;


// computeLayout, StructModel'deki alanların bellek yerleşimini hesaplar ve her alanın offset'ini, padding miktarını, toplam boyutu ve hizalamayı döndürür.
export const computeLayout: ComputeLayout = (model) => { //types'ta tanımladığımız computeLayout fonksiyonunu burada implement ettik
  const fields: FieldLayout[] = [];
  let offset = 0; // sıfırdan başlar, field yerleştikçe offset ilerler
  let maxAlign = 1; // struct'ın hizalaması = en büyük alan hizalaması, başlangıçta 1 (bool) ile başlar

  for (const f of model.fields) {
    // Bir alanın eleman boyutu/hizalaması: primitive ise TYPE_INFO'dan,
    // nested struct ise ÖZYİNELEMELİ olarak kendi layout'undan gelir.
    let elemSize: number;
    let align: number;
    let typeName: string;
    let nested: LayoutResult | undefined;

    if (f.type === "struct" && f.nested) {
      nested = computeLayout(f.nested); // <-- özyineleme
      elemSize = nested.totalSize; // tail padding dahil → struct dizilerinin hizası korunur
      align = nested.alignment; // struct'ın hizalaması = en büyük üyesininki
      typeName = f.nested.name || "struct";
    } else if (f.type !== "struct") {
      ({ size: elemSize, align } = TYPE_INFO[f.type]);
      typeName = f.type;
    } else {
      // type "struct" ama nested yok (bozuk durum) → güvenli varsayım
      elemSize = 0;
      align = 1;
      typeName = "struct";
    }

    // Bir dizinin hizalaması, elemanının hizalamasıyla aynıdır.
    const size = elemSize * Math.max(1, f.arrayLength); //arrayfield ise size = elemSize * arrayLength, değilse size = elemSize

    // Kural 2 + 3: alanı hizalı offset'e taşı, aradaki boşluğu say.
    const aligned = alignUp(offset, align);
    const paddingBefore = aligned - offset; //padding'i hesapla

    fields.push({ //field layout objesi oluştur
      fieldId: f.id,
      name: f.name,
      type: f.type,
      typeName,
      offset: aligned,
      size,
      arrayLength: Math.max(1, f.arrayLength),
      elementSize: elemSize,
      paddingBefore,
      nested,
    });

    offset = aligned + size; //offset'i bir sonraki field için ilerlet
    maxAlign = Math.max(maxAlign, align); // en büyük hizalamayı güncelle, daha sonra tailpadding için kullanacağız
  }

  // Kural 4: sondaki (tail) padding ile toplam boyutu struct align'ına yuvarla. -> total size, maxAlign'ın katı olacak şekilde alignUp ile yuvarlanır
  const totalSize = alignUp(offset, maxAlign);

  // Toplam padding = ayrılan toplam yer − gerçekten kullanılan byte'lar.
  const usedBytes = fields.reduce((sum, f) => sum + f.size, 0); //fields'in boyutlarını topla   -> padding = totalSize - usedBytes
  const totalPadding = totalSize - usedBytes;

  return { fields, totalSize, alignment: maxAlign, totalPadding };
};
