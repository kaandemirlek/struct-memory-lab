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
// Bir alanın tipi: ya sabit genişlikli primitive, ya da iç içe (nested) struct.
// "struct" olduğunda Field.nested dolu olur.
// ---------------------------------------------------------------------------
export type FieldType = CppPrimitive | "struct";

// ---------------------------------------------------------------------------
// Bir struct içindeki tek bir alan (field).
// ---------------------------------------------------------------------------
export interface Field {
  /** Stabil kimlik — drag-drop ve diff için şart (isim değişince bile aynı kalır). */
  id: string;
  name: string;
  type: FieldType; // uint32_t, double, ... veya "struct" (nested)
  arrayLength: number; // Dizi uzunluğu. Tekil alan için 1, dizi için >1 (örn. uint8_t name[16]).
  /** type === "struct" iken iç içe struct modeli (özyinelemeli). */
  nested?: StructModel;
  /**
   * Bit seviyesinde semantik alanlar (yalnızca unsigned integer tiplerde anlamlı).
   * Fiziksel yerleşimi (computeLayout) DEĞİŞTİRMEZ — byte'ların bir YORUM katmanıdır.
   * Savunma/gömülü: status word'ler, telemetri bayrakları, donanım register'ları.
   */
  bitFields?: BitField[];
}

// ---------------------------------------------------------------------------
// Bit seviyesinde semantik alan (status word yorumu).
//   Örn: statusWords[0].bit0 -> irCameraFail (0=OK, 1=FAIL)
// ---------------------------------------------------------------------------
export interface BitField {
  id: string;
  name: string; // semantik ad: "irCameraFail", "operationMode"
  wordIndex: number; // dizi/word indeksi (tekil alan için 0)
  startBit: number; // word içinde 0-tabanlı başlangıç biti
  width: number; // bit sayısı (1 = bayrak, >1 = çok-bitli alan)
  /** Değer anlamları: [{value:0,label:"OK"},{value:1,label:"FAIL"}] */
  meanings?: BitMeaning[];
}

export interface BitMeaning {
  value: number;
  label: string;
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
  type: FieldType;
  /** Gösterim etiketi: "uint32_t" ya da nested için struct adı ("Vec3"). */
  typeName?: string;
  /** Struct başından itibaren byte cinsinden başlangıç. */
  offset: number;
  /** Bu alanın kapladığı toplam byte (dizi dahil). */
  size: number;
  /** Bu alandan ÖNCE eklenen padding byte sayısı (hizalama için). */
  paddingBefore: number;
  /** type === "struct" iken iç içe yerleşim (ileride görselde açmak için). */
  nested?: LayoutResult;
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
