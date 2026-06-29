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
import type { Field, StructModel, Version } from "@/types";

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

  // --- PERSON A action'ları (currentModel düzenleme) ---
  setModel: (model: StructModel) => void;
  setStructName: (name: string) => void;
  addField: () => void;
  updateField: (id: string, patch: Partial<Omit<Field, "id">>) => void;
  removeField: (id: string) => void;
  reorderFields: (fromIndex: number, toIndex: number) => void;

  // --- PERSON B action'ları (versiyon yönetimi) ---
  saveVersion: () => void;
  loadVersion: (versionId: string) => void;
}

export const useStructStore = create<StructState>((set, get) => ({
  currentModel: initialModel,
  versions: [],

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
}));
