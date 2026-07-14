// ============================================================================
// useStructStore.ts — ORTAK UYGULAMA HAFIZASI (SHARED)
// ============================================================================
// İki slice'ın buluştuğu yer:
//   • Person A   "şu anki struct"ı (currentModel) yazar/düzenler.
//   • Person B   currentModel'i okur; versiyon kaydeder, diff/karşılaştırma yapar.
//
// KURAL: Store'un ŞEKLİ (state alanları + action imzaları) birlikte değişir.
//        Kendi slice'ınızın action gövdesini doldurmak serbest; ama alan
//        eklemek/çıkarmak için diğer kişiyle anlaşın.
// ============================================================================

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { BitField, Field, Platform, StructModel, Version } from "@/types";
import { DEFAULT_PLATFORM } from "@/types";

// Basit benzersiz id üretici (alanlar ve versiyonlar için).
let _idCounter = 0;
export const makeId = (prefix = "id"): string =>
  `${prefix}_${Date.now().toString(36)}_${(_idCounter++).toString(36)}`;

// Bir alanı id'ye göre ağaçta (nested struct'lar dahil) bulup dönüştürür (immutable).
// Alan düzenleme, bit alanları ve nested struct içi düzenlemeler bunu paylaşır.
function mapFieldById(fields: Field[], id: string, fn: (f: Field) => Field): Field[] {
  return fields.map((f) => {
    if (f.id === id) return fn(f);
    if (f.nested) {
      return { ...f, nested: { ...f.nested, fields: mapFieldById(f.nested.fields, id, fn) } };
    }
    return f;
  });
}

// Bir alanı id'ye göre ağacın HERHANGİ bir seviyesinden siler (immutable).
function removeFieldById(fields: Field[], id: string): Field[] {
  return fields
    .filter((f) => f.id !== id)
    .map((f) =>
      f.nested
        ? { ...f, nested: { ...f.nested, fields: removeFieldById(f.nested.fields, id) } }
        : f
    );
}

// Uygulama açılışında gösterilecek örnek struct. Boş bir struct'a düşüldüğünde
// "Load example" ile geri yüklenebilsin diye dışa aktarılır.
// ÖNEMLİ: başlangıç id'leri SABİT olmalı. makeId() Date.now() kullandığı için
// sunucu ve tarayıcıda farklı değer üretir → hydration uyuşmazlığı. Çalışma
// anında (client'ta) eklenen alanlar makeId() kullanabilir, sorun değil.
export const EXAMPLE_MODEL: StructModel = {
  name: "Player",
  fields: [
    { id: "f_id", name: "id", type: "uint32_t", arrayLength: 1 },
    { id: "f_alive", name: "alive", type: "bool", arrayLength: 1 },
    {
      id: "f_position",
      name: "position",
      type: "struct",
      arrayLength: 1,
      nested: {
        name: "Vec3",
        fields: [
          { id: "f_position_x", name: "x", type: "float", arrayLength: 1 },
          { id: "f_position_y", name: "y", type: "float", arrayLength: 1 },
          { id: "f_position_z", name: "z", type: "float", arrayLength: 1 },
        ],
      },
    },
    { id: "f_age", name: "age", type: "uint32_t", arrayLength: 5 },
  ],
};

/**
 * Not yazıldığı andaki alanın parmak izi. Notlar birer KISIT gibi davranır
 * ("bunu taşıma") — alan sonradan değişirse bu iz sayesinde not "alan bu nottan
 * sonra değişti" diye işaretlenebilir; not sessizce eskimiş görünmez.
 */
export interface AnnotationFieldSnapshot {
  name: string;
  /** Gösterim etiketi: "uint32_t" ya da nested struct adı ("Vec3"). */
  typeLabel: string;
  arrayLength: number;
  /** Alanın struct içindeki sırası (reorder/araya ekleme = offset kayması). */
  index: number;
}

/**
 * Bir alana (fieldId) ya da versiyona (versionId) bırakılan serbest not.
 * ör. "bunu taşıma, serializer offset'e bağlı". Person B tarafı; paylaşılan
 * types.ts sözleşmesine dokunmamak için burada tanımlı.
 */
export interface Annotation {
  id: string;
  targetKind: "field" | "version";
  /** Hedefin kimliği: field.id ya da version.id. */
  targetId: string;
  text: string;
  createdAt: string;
  /** Yalnızca field notları; eski (persist edilmiş) notlarda bulunmayabilir. */
  fieldSnapshot?: AnnotationFieldSnapshot;
}

/** Alanın gösterim tipi ("uint32_t" / nested adı). Not parmak izi ile aynı kural. */
export function fieldTypeLabel(field: Field): string {
  return field.type === "struct" ? field.nested?.name ?? "struct" : field.type;
}

interface StructState {
  // --- ORTAK STATE ---
  /** Editörde üzerinde çalışılan struct. (A yazar, B okur.) */
  currentModel: StructModel;
  /** Kaydedilmiş versiyonlar (v1, v2, ...). (B yönetir.) */
  versions: Version[];
  /** Alan/versiyon notları (takım yorumları). */
  annotations: Annotation[];
  /**
   * Hedef platform / ABI (yerleşim + parser "long" eşlemesi bunu izler).
   * Global bir görünüm ayarıdır: modele değil, hesaplamaya aittir.
   */
  platform: Platform;
  /** Karşılaştırmanın KAYNAK tarafı (From): seçili versiyon (null = en son). */
  baseVersionId: string | null;
  /** Karşılaştırmanın HEDEF tarafı (To): seçili versiyon (null = güncel düzenlemeler). */
  targetVersionId: string | null;
  /**
   * Edit Layout sekmesinde SALT-OKUNUR önizlenen versiyon (null = Live).
   * currentModel'i DEĞİŞTİRMEZ; sadece hangi snapshot'ın görüntülendiğini tutar.
   * Kalıcı değildir (persist edilmez) — sayfa yenilenince Live'a döner.
   */
  previewVersionId: string | null;
  /**
   * Memory Layout'ta tıklanan, Status Bits'te düzenlenmek üzere ODAKLANAN alan
   * (null = odak yok). Status Bits paneli bu alanın editörünü en üste taşır ve
   * vurgular. Kalıcı DEĞİLDİR (persist edilmez) — sayfa yenilenince sıfırlanır.
   */
  focusedBitFieldId: string | null;

  // --- PERSON A action'ları (currentModel düzenleme) ---
  setModel: (model: StructModel) => void;
  setStructName: (name: string) => void;
  /** Hedef platformu değiştir (undo geçmişine girmez — model değişmiyor). */
  setPlatform: (platform: Platform) => void;
  /** Alan ekle: parentFieldId verilirse o nested struct'ın içine, yoksa üst seviyeye. */
  addField: (parentFieldId?: string) => void;
  /** Alanı güncelle — ağacın herhangi bir seviyesinde (nested dahil). */
  updateField: (id: string, patch: Partial<Omit<Field, "id">>) => void;
  /** Alanı sil — ağacın herhangi bir seviyesinde (nested dahil). */
  removeField: (id: string) => void;
  reorderFields: (fromIndex: number, toIndex: number) => void;
  // bit alanları (status word semantiği)
  addBitField: (
    fieldId: string,
    placement?: Partial<Pick<BitField, "wordIndex" | "startBit" | "width">>
  ) => void;
  updateBitField: (fieldId: string, bitId: string, patch: Partial<Omit<BitField, "id">>) => void;
  removeBitField: (fieldId: string, bitId: string) => void;

  // --- Geçmiş (undo/redo) ---
  past: StructModel[];
  future: StructModel[];
  undo: () => void;
  redo: () => void;

  // --- PERSON B action'ları (versiyon yönetimi) ---
  saveVersion: () => void;
  loadVersion: (versionId: string) => void;
  /** Edit Layout'ta bir versiyonu salt-okunur önizle (null = Live). */
  setPreviewVersion: (versionId: string | null) => void;
  /** Status Bits'te düzenlenecek alanı odakla (null = odak yok). */
  setFocusedBitField: (fieldId: string | null) => void;
  /** Karşılaştırma kaynağını (From) seç (null = en son kaydedilen versiyon). */
  setBaseVersion: (versionId: string | null) => void;
  /** Karşılaştırma hedefini (To) seç (null = güncel düzenlemeler). */
  setTargetVersion: (versionId: string | null) => void;
  /** Bir versiyonun görünen etiketini değiştir. */
  renameVersion: (versionId: string, label: string) => void;
  /** Bir versiyonu sil; taban olarak seçiliyse seçimi temizle. */
  deleteVersion: (versionId: string) => void;

  // --- Notlar (takım yorumları) ---
  /** Bir alana/versiyona not ekle. */
  addAnnotation: (targetKind: "field" | "version", targetId: string, text: string) => void;
  /** Bir notun metnini güncelle. */
  updateAnnotation: (id: string, text: string) => void;
  /** Bir notu sil. */
  removeAnnotation: (id: string) => void;
}

export const useStructStore = create<StructState>()(
  persist(
    (set, get) => {
      const MAX_HISTORY = 100;
      // currentModel'i değiştir ve önceki halini undo için kaydet.
      const editModel = (transform: (m: StructModel) => StructModel) =>
        set((s) => ({
          currentModel: transform(s.currentModel),
          past: [...s.past, s.currentModel].slice(-MAX_HISTORY),
          future: [],
          // Herhangi bir düzenleme önizlemeden çıkar → Live görünümüne dön.
          previewVersionId: null,
        }));

      return {
        currentModel: EXAMPLE_MODEL,
        versions: [],
        annotations: [],
        platform: DEFAULT_PLATFORM,
        baseVersionId: null,
        targetVersionId: null,
        previewVersionId: null,
        focusedBitFieldId: null,
        past: [],
        future: [],

        // -----------------------------------------------------------------
        // PERSON A — currentModel düzenleme (her biri undo geçmişi tutar)
        // -----------------------------------------------------------------
        setModel: (model) => editModel(() => model),

        setStructName: (name) => editModel((m) => ({ ...m, name })),

        setPlatform: (platform) => set({ platform }),

        addField: (parentFieldId) =>
          editModel((m) => {
            const newField: Field = {
              id: makeId("f"),
              name: "newField",
              type: "int32_t",
              arrayLength: 1,
            };
            if (!parentFieldId) {
              return { ...m, fields: [...m.fields, newField] };
            }
            // Nested struct'ın içine ekle (parent bir struct alanı olmalı).
            return {
              ...m,
              fields: mapFieldById(m.fields, parentFieldId, (f) =>
                f.nested
                  ? { ...f, nested: { ...f.nested, fields: [...f.nested.fields, newField] } }
                  : f
              ),
            };
          }),

        updateField: (id, patch) =>
          editModel((m) => ({
            ...m,
            fields: mapFieldById(m.fields, id, (f) => ({ ...f, ...patch })),
          })),

        removeField: (id) =>
          editModel((m) => ({
            ...m,
            fields: removeFieldById(m.fields, id),
          })),

        reorderFields: (fromIndex, toIndex) =>
          editModel((m) => {
            const fields = [...m.fields];
            const [moved] = fields.splice(fromIndex, 1);
            fields.splice(toIndex, 0, moved);
            return { ...m, fields };
          }),

        // --- bit alanları (status word semantiği) ---
        addBitField: (fieldId, placement) =>
          editModel((m) => ({
            ...m,
            fields: mapFieldById(m.fields, fieldId, (f) => {
              const existing = f.bitFields ?? [];
              // word0'da bir sonraki boş bit'e yerleştir (anında çakışmayı azalt).
              const nextStart = existing
                .filter((b) => b.wordIndex === 0)
                .reduce((mx, b) => Math.max(mx, b.startBit + b.width), 0);
              const nb: BitField = {
                id: makeId("bit"),
                name: `status_${placement?.wordIndex ?? 0}_${placement?.startBit ?? nextStart}`,
                wordIndex: placement?.wordIndex ?? 0,
                startBit: placement?.startBit ?? nextStart,
                width: placement?.width ?? 1,
                meanings: [],
              };
              return { ...f, bitFields: [...existing, nb] };
            }),
          })),

        updateBitField: (fieldId, bitId, patch) =>
          editModel((m) => ({
            ...m,
            fields: mapFieldById(m.fields, fieldId, (f) => ({
              ...f,
              bitFields: (f.bitFields ?? []).map((b) =>
                b.id === bitId ? { ...b, ...patch } : b
              ),
            })),
          })),

        removeBitField: (fieldId, bitId) =>
          editModel((m) => ({
            ...m,
            fields: mapFieldById(m.fields, fieldId, (f) => ({
              ...f,
              bitFields: (f.bitFields ?? []).filter((b) => b.id !== bitId),
            })),
          })),

        // -----------------------------------------------------------------
        // Undo / redo
        // -----------------------------------------------------------------
        undo: () =>
          set((s) => {
            if (s.past.length === 0) return {};
            const previous = s.past[s.past.length - 1];
            return {
              currentModel: previous,
              past: s.past.slice(0, -1),
              future: [s.currentModel, ...s.future].slice(0, MAX_HISTORY),
            };
          }),

        redo: () =>
          set((s) => {
            if (s.future.length === 0) return {};
            const next = s.future[0];
            return {
              currentModel: next,
              past: [...s.past, s.currentModel].slice(-MAX_HISTORY),
              future: s.future.slice(1),
            };
          }),

        // -----------------------------------------------------------------
        // PERSON B — versiyon yönetimi
        // -----------------------------------------------------------------
        saveVersion: () =>
          set((s) => {
            const label = `v${s.versions.length + 1}`;
            const snapshot: Version = {
              id: makeId("ver"),
              label,
              model: structuredClone(get().currentModel),
              createdAt: new Date().toISOString(),
            };
            return { versions: [...s.versions, snapshot] };
          }),

        loadVersion: (versionId) => {
          const v = get().versions.find((x) => x.id === versionId);
          // editModel önizlemeyi otomatik temizler (Live'a döner).
          if (v) editModel(() => structuredClone(v.model));
        },

        setPreviewVersion: (versionId) => set({ previewVersionId: versionId }),

        setFocusedBitField: (fieldId) => set({ focusedBitFieldId: fieldId }),

        setBaseVersion: (versionId) => set({ baseVersionId: versionId }),

        setTargetVersion: (versionId) => set({ targetVersionId: versionId }),

        renameVersion: (versionId, label) =>
          set((s) => ({
            versions: s.versions.map((v) =>
              v.id === versionId ? { ...v, label } : v
            ),
          })),

        deleteVersion: (versionId) =>
          set((s) => ({
            versions: s.versions.filter((v) => v.id !== versionId),
            baseVersionId:
              s.baseVersionId === versionId ? null : s.baseVersionId,
            targetVersionId:
              s.targetVersionId === versionId ? null : s.targetVersionId,
            previewVersionId:
              s.previewVersionId === versionId ? null : s.previewVersionId,
            // O versiyona ait notları da temizle (versiyon silme geri alınamaz).
            annotations: s.annotations.filter(
              (a) => !(a.targetKind === "version" && a.targetId === versionId)
            ),
          })),

        // -----------------------------------------------------------------
        // Notlar (takım yorumları)
        // -----------------------------------------------------------------
        addAnnotation: (targetKind, targetId, text) =>
          set((s) => {
            // Field notu: alanın ŞU ANKİ hâlini nota işle — sonradan tip/sıra/
            // dizi değişirse panel "alan bu nottan sonra değişti" gösterebilsin.
            let fieldSnapshot: AnnotationFieldSnapshot | undefined;
            if (targetKind === "field") {
              const index = s.currentModel.fields.findIndex((f) => f.id === targetId);
              const field = s.currentModel.fields[index];
              if (field) {
                fieldSnapshot = {
                  name: field.name,
                  typeLabel: fieldTypeLabel(field),
                  arrayLength: Math.max(1, field.arrayLength ?? 1),
                  index,
                };
              }
            }
            return {
              annotations: [
                ...s.annotations,
                {
                  id: makeId("note"),
                  targetKind,
                  targetId,
                  text,
                  createdAt: new Date().toISOString(),
                  fieldSnapshot,
                },
              ],
            };
          }),

        updateAnnotation: (id, text) =>
          set((s) => ({
            annotations: s.annotations.map((a) =>
              a.id === id ? { ...a, text } : a
            ),
          })),

        removeAnnotation: (id) =>
          set((s) => ({
            annotations: s.annotations.filter((a) => a.id !== id),
          })),
      };
    },
    {
      name: "struct-memory-lab",
      storage: createJSONStorage(() => localStorage),
      // Sadece veriyi sakla (action'lar her açılışta yeniden oluşturulur).
      partialize: (state) => ({
        currentModel: state.currentModel,
        versions: state.versions,
        annotations: state.annotations,
        platform: state.platform,
        baseVersionId: state.baseVersionId,
        targetVersionId: state.targetVersionId,
      }),
      // Next.js hydration uyumsuzluğunu önlemek için mount sonrası elle rehydrate.
      skipHydration: true,
    }
  )
);

// ----------------------------------------------------------------------------
// Karşılaştırma çözümleme.
//   Sentinel: bir taraf bir versiyon yerine "güncel düzenlemeler" olabilir.
// ----------------------------------------------------------------------------
export const CURRENT_EDITS = "__current__";

/** Display label for the live (unsaved) working state. */
export const CURRENT_EDITS_LABEL = "Live";

export interface ResolvedComparison {
  fromModel: StructModel | undefined;
  fromLabel: string;
  fromValue: string; // From dropdown value (versiyon id ya da CURRENT_EDITS)
  fromVersionId: string | undefined; // satır vurgusu için (güncel ise undefined)
  toModel: StructModel | undefined;
  toLabel: string;
  toValue: string;
  toVersionId: string | undefined;
}

/**
 * From/To seçimlerini gerçek modellere çözer.
 *  • From: CURRENT_EDITS = güncel · versiyon id = o versiyon · null = en son versiyon (varsayılan).
 *  • To:   null = güncel düzenlemeler · versiyon id = o versiyon.
 */
export function resolveComparison(
  versions: Version[],
  currentModel: StructModel,
  baseVersionId: string | null,
  targetVersionId: string | null
): ResolvedComparison {
  const latest = versions[versions.length - 1];

  // --- From ---
  let fromModel: StructModel | undefined;
  let fromLabel: string;
  let fromValue: string;
  let fromVersionId: string | undefined;
  if (baseVersionId === CURRENT_EDITS) {
    fromModel = currentModel;
    fromLabel = CURRENT_EDITS_LABEL;
    fromValue = CURRENT_EDITS;
    fromVersionId = undefined;
  } else {
    const picked = baseVersionId
      ? versions.find((v) => v.id === baseVersionId)
      : undefined;
    const eff = picked ?? latest;
    fromModel = eff?.model;
    fromLabel = eff?.label ?? "";
    fromValue = eff?.id ?? CURRENT_EDITS;
    fromVersionId = eff?.id;
  }

  // --- To ---
  const target = targetVersionId
    ? versions.find((v) => v.id === targetVersionId)
    : undefined;
  let toModel: StructModel | undefined;
  let toLabel: string;
  let toValue: string;
  let toVersionId: string | undefined;
  if (target) {
    toModel = target.model;
    toLabel = target.label;
    toValue = target.id;
    toVersionId = target.id;
  } else {
    toModel = currentModel;
    toLabel = CURRENT_EDITS_LABEL;
    toValue = CURRENT_EDITS;
    toVersionId = undefined;
  }

  return {
    fromModel,
    fromLabel,
    fromValue,
    fromVersionId,
    toModel,
    toLabel,
    toValue,
    toVersionId,
  };
}
