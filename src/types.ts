// ============================================================================
// types.ts — THE SHARED CONTRACT
// ============================================================================
// Bu dosya iki slice'ın buluşma noktasıdır. Burada tanımlanan veri şekilleri
// ve fonksiyon imzaları, Person A ile Person B'nin birbirini beklemeden
// çalışabilmesini sağlar.
//
// KURAL: Bu dosya YALNIZCA birlikte (ikiniz anlaşarak) değiştirilir.
//        Burada bir şey değiştirmeden önce diğer kişiyle konuşun.
// ============================================================================

// ---------------------------------------------------------------------------
// Temel C++ tipleri — parser'ın tanıyacağı sabit genişlikli tipler.
// İhtiyaç oldukça birlikte genişletin.
// ---------------------------------------------------------------------------
export type CppPrimitive =
  | "bool"
  | "char"
  | "int8_t"
  | "uint8_t"
  | "int16_t"
  | "uint16_t"
  | "int32_t"
  | "uint32_t"
  | "int64_t"
  | "uint64_t"
  | "float"
  | "double";

/** Her primitive tipin byte cinsinden boyutu ve hizalaması (alignment). */
export const TYPE_INFO: Record<CppPrimitive, { size: number; align: number }> = {
  bool: { size: 1, align: 1 },
  char: { size: 1, align: 1 },
  int8_t: { size: 1, align: 1 },
  uint8_t: { size: 1, align: 1 },
  int16_t: { size: 2, align: 2 },
  uint16_t: { size: 2, align: 2 },
  int32_t: { size: 4, align: 4 },
  uint32_t: { size: 4, align: 4 },
  int64_t: { size: 8, align: 8 },
  uint64_t: { size: 8, align: 8 },
  float: { size: 4, align: 4 },
  double: { size: 8, align: 8 },
};

// ---------------------------------------------------------------------------
// Bir struct içindeki tek bir alan (field).
// ---------------------------------------------------------------------------
export interface Field {
  /** Stabil kimlik — drag-drop ve diff için şart (isim değişince bile aynı kalır). */
  id: string;
  name: string;
  type: CppPrimitive;
  /** Dizi uzunluğu. Tekil alan için 1, dizi için >1 (örn. uint8_t name[16]). */
  arrayLength: number;
}

// ---------------------------------------------------------------------------
// Editörde üzerinde çalışılan "şu anki" struct.
// ---------------------------------------------------------------------------
export interface StructModel {
  name: string;
  fields: Field[];
}

// ---------------------------------------------------------------------------
// computeLayout() çıktısı — bellek yerleşiminin hesaplanmış hali.
// ---------------------------------------------------------------------------
export interface FieldLayout {
  fieldId: string;
  name: string;
  type: CppPrimitive;
  /** Struct başından itibaren byte cinsinden başlangıç. */
  offset: number;
  /** Bu alanın kapladığı toplam byte (dizi dahil). */
  size: number;
  /** Bu alandan ÖNCE eklenen padding byte sayısı (hizalama için). */
  paddingBefore: number;
}

export interface LayoutResult {
  fields: FieldLayout[];
  /** sizeof(struct) — sondaki padding dahil. */
  totalSize: number;
  /** Struct'ın hizalaması (en büyük alan hizalaması). */
  alignment: number;
  /** Toplam boşa giden (padding) byte. */
  totalPadding: number;
}

// ---------------------------------------------------------------------------
// Versiyonlama — bir struct'ın zaman içindeki anlık görüntüleri.
// ---------------------------------------------------------------------------
export interface Version {
  id: string;
  /** Görünen etiket: "v1", "v2", ... */
  label: string;
  model: StructModel;
  /** ISO timestamp. */
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Diff — iki versiyon arasındaki değişiklikler.
// ---------------------------------------------------------------------------
export type DiffKind =
  | "added"
  | "removed"
  | "type-changed"
  | "renamed"
  | "reordered";

export interface DiffEntry {
  kind: DiffKind;
  fieldName: string;
  /** İnsan dostu açıklama, örn. "type changed: uint16_t → uint32_t". */
  detail: string;
}

// ---------------------------------------------------------------------------
// Uyumluluk uyarıları — tehlikeli değişiklikler.
// ---------------------------------------------------------------------------
export type WarningSeverity = "danger" | "warning" | "info";

export interface Warning {
  severity: WarningSeverity;
  /** Sade dille uyarı, örn. "health alanı offset 8 → 16'ya kaydı". */
  message: string;
}

// ============================================================================
// FONKSİYON İMZALARI — slice'lar arası anlaşma.
// Gerçek implementasyonlar engine/ altındaki dosyalarda.
// ============================================================================

/** PERSON A — C++ metnini StructModel'e çevirir. */
export type ParseCpp = (code: string) => StructModel;

/** PERSON A — bellek yerleşimini (offset/padding/size) hesaplar. */
export type ComputeLayout = (model: StructModel) => LayoutResult;

/** PERSON B — iki versiyonu karşılaştırır. */
export type DiffVersions = (a: StructModel, b: StructModel) => DiffEntry[];

/** PERSON B — iki versiyon arası uyumluluk uyarıları üretir (computeLayout'a ihtiyaç duyar).
 *  computeLayout opsiyonel: verilmezse implementasyon kendi (mock/gerçek) layout'unu kullanır. */
export type AnalyzeCompatibility = (
  a: StructModel,
  b: StructModel,
  computeLayout?: ComputeLayout
) => Warning[];

/** PERSON B — StructModel'i tekrar geçerli bir C++ .hpp metnine çevirir. */
export type ExportCpp = (model: StructModel) => string;
