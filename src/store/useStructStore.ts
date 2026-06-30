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
import type { BitField, Field, StructModel, Version } from "@/types";

// Basit benzersiz id üretici (alanlar ve versiyonlar için).
let _idCounter = 0;
export const makeId = (prefix = "id"): string =>
  `${prefix}_${Date.now().toString(36)}_${(_idCounter++).toString(36)}`;

// Uygulama açılışında gösterilecek örnek struct.
// ÖNEMLİ: başlangıç id'leri SABİT olmalı. makeId() Date.now() kullandığı için
// sunucu ve tarayıcıda farklı değer üretir → hydration uyuşmazlığı. Çalışma
// anında (client'ta) eklenen alanlar makeId() kullanabilir, sorun değil.
const initialModel: StructModel = {
  name: "Player",
  fields: [
    { id: "f_id", name: "id", type: "uint32_t", arrayLength: 1 },
    { id: "f_alive", name: "alive", type: "bool", arrayLength: 1 },
    { id: "f_health", name: "health", type: "double", arrayLength: 1 },
  ],
};

interface StructState {
  // --- ORTAK STATE ---
  /** Editörde üzerinde çalışılan struct. (A yazar, B okur.) */
  currentModel: StructModel;
  /** Kaydedilmiş versiyonlar (v1, v2, ...). (B yönetir.) */
  versions: Version[];
  /** Karşılaştırmanın KAYNAK tarafı (From): seçili versiyon (null = en son). */
  baseVersionId: string | null;
  /** Karşılaştırmanın HEDEF tarafı (To): seçili versiyon (null = güncel düzenlemeler). */
  targetVersionId: string | null;

  // --- PERSON A action'ları (currentModel düzenleme) ---
  setModel: (model: StructModel) => void;
  setStructName: (name: string) => void;
  addField: () => void;
  updateField: (id: string, patch: Partial<Omit<Field, "id">>) => void;
  removeField: (id: string) => void;
  reorderFields: (fromIndex: number, toIndex: number) => void;
  // bit alanları (status word semantiği)
  addBitField: (fieldId: string) => void;
  updateBitField: (fieldId: string, bitId: string, patch: Partial<Omit<BitField, "id">>) => void;
  removeBitField: (fieldId: string, bitId: string) => void;

  // --- PERSON B action'ları (versiyon yönetimi) ---
  saveVersion: () => void;
  loadVersion: (versionId: string) => void;
  /** Karşılaştırma kaynağını (From) seç (null = en son kaydedilen versiyon). */
  setBaseVersion: (versionId: string | null) => void;
  /** Karşılaştırma hedefini (To) seç (null = güncel düzenlemeler). */
  setTargetVersion: (versionId: string | null) => void;
  /** Bir versiyonun görünen etiketini değiştir. */
  renameVersion: (versionId: string, label: string) => void;
  /** Bir versiyonu sil; taban olarak seçiliyse seçimi temizle. */
  deleteVersion: (versionId: string) => void;
}

export const useStructStore = create<StructState>()(
  persist(
    (set, get) => ({
  currentModel: initialModel,
  versions: [],
  baseVersionId: null,
  targetVersionId: null,

  // -------------------------------------------------------------------------
  // PERSON A — currentModel düzenleme action'ları
  // -------------------------------------------------------------------------
  setModel: (model) => set({ currentModel: model }),

  setStructName: (name) =>
    set((s) => ({ currentModel: { ...s.currentModel, name } })),

  addField: () =>
    set((s) => ({
      currentModel: {
        ...s.currentModel,
        fields: [
          ...s.currentModel.fields,
          { id: makeId("f"), name: "newField", type: "int32_t", arrayLength: 1 },
        ],
      },
    })),

  updateField: (id, patch) =>
    set((s) => ({
      currentModel: {
        ...s.currentModel,
        fields: s.currentModel.fields.map((f) =>
          f.id === id ? { ...f, ...patch } : f
        ),
      },
    })),

  removeField: (id) =>
    set((s) => ({
      currentModel: {
        ...s.currentModel,
        fields: s.currentModel.fields.filter((f) => f.id !== id),
      },
    })),

  reorderFields: (fromIndex, toIndex) =>
    set((s) => {
      const fields = [...s.currentModel.fields];
      const [moved] = fields.splice(fromIndex, 1);
      fields.splice(toIndex, 0, moved);
      return { currentModel: { ...s.currentModel, fields } };
    }),

  // --- bit alanları (status word semantiği) ---
  addBitField: (fieldId) =>
    set((s) => ({
      currentModel: {
        ...s.currentModel,
        fields: s.currentModel.fields.map((f) => {
          if (f.id !== fieldId) return f;
          const existing = f.bitFields ?? [];
          // word0'da bir sonraki boş bit'e yerleştir (anında çakışmayı azalt).
          const nextStart = existing
            .filter((b) => b.wordIndex === 0)
            .reduce((m, b) => Math.max(m, b.startBit + b.width), 0);
          const nb: BitField = {
            id: makeId("bit"),
            name: "newBit",
            wordIndex: 0,
            startBit: nextStart,
            width: 1,
            meanings: [],
          };
          return { ...f, bitFields: [...existing, nb] };
        }),
      },
    })),

  updateBitField: (fieldId, bitId, patch) =>
    set((s) => ({
      currentModel: {
        ...s.currentModel,
        fields: s.currentModel.fields.map((f) =>
          f.id !== fieldId
            ? f
            : {
                ...f,
                bitFields: (f.bitFields ?? []).map((b) =>
                  b.id === bitId ? { ...b, ...patch } : b
                ),
              }
        ),
      },
    })),

  removeBitField: (fieldId, bitId) =>
    set((s) => ({
      currentModel: {
        ...s.currentModel,
        fields: s.currentModel.fields.map((f) =>
          f.id !== fieldId
            ? f
            : { ...f, bitFields: (f.bitFields ?? []).filter((b) => b.id !== bitId) }
        ),
      },
    })),

  // -------------------------------------------------------------------------
  // PERSON B — versiyon yönetimi action'ları
  // -------------------------------------------------------------------------
  saveVersion: () =>
    set((s) => {
      const label = `v${s.versions.length + 1}`;
      const snapshot: Version = {
        id: makeId("ver"),
        label,
        // Derin kopya: sonradan editörde yapılan değişiklik versiyonu bozmasın.
        model: structuredClone(get().currentModel),
        createdAt: new Date().toISOString(),
      };
      return { versions: [...s.versions, snapshot] };
    }),

  loadVersion: (versionId) =>
    set((s) => {
      const v = s.versions.find((x) => x.id === versionId);
      if (!v) return {};
      return { currentModel: structuredClone(v.model) };
    }),

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
    })),
    }),
    {
      name: "struct-memory-lab",
      storage: createJSONStorage(() => localStorage),
      // Sadece veriyi sakla (action'lar her açılışta yeniden oluşturulur).
      partialize: (state) => ({
        currentModel: state.currentModel,
        versions: state.versions,
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
    fromLabel = "current edits";
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
    toLabel = "current edits";
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
