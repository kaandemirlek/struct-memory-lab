import { beforeEach, describe, it, expect } from "vitest";
import { useStructStore } from "@/store/useStructStore";
import type { Field } from "@/types";

const f = (id: string, name: string): Field => ({ id, name, type: "uint32_t", arrayLength: 1 });

// Her testten önce bilinen bir duruma sıfırla.
beforeEach(() => {
  useStructStore.setState({
    currentModel: { name: "T", fields: [f("a", "a"), f("b", "b"), f("c", "c")] },
    versions: [],
  });
});

// Kolaylık: o anki alan isimlerini sırayla ver.
const names = () => useStructStore.getState().currentModel.fields.map((x) => x.name);

describe("useStructStore — Person A action'ları", () => {
  it("reorderFields: alanı bir index'ten diğerine taşır (drag-drop'un özü)", () => {
    useStructStore.getState().reorderFields(0, 2); // a'yı sona taşı
    expect(names()).toEqual(["b", "c", "a"]);

    useStructStore.getState().reorderFields(2, 0); // sondakini başa
    expect(names()).toEqual(["a", "b", "c"]);
  });

  it("addField: sona yeni alan ekler", () => {
    useStructStore.getState().addField();
    expect(useStructStore.getState().currentModel.fields).toHaveLength(4);
    expect(names()[3]).toBe("newField");
  });

  it("removeField: id'ye göre siler", () => {
    useStructStore.getState().removeField("b");
    expect(names()).toEqual(["a", "c"]);
  });

  it("updateField: alanı kısmen günceller (id sabit kalır)", () => {
    useStructStore.getState().updateField("a", { name: "renamed", type: "double" });
    const field = useStructStore.getState().currentModel.fields[0];
    expect(field).toMatchObject({ id: "a", name: "renamed", type: "double" });
  });

  it("setStructName: struct adını değiştirir, alanlara dokunmaz", () => {
    useStructStore.getState().setStructName("Yeni");
    expect(useStructStore.getState().currentModel.name).toBe("Yeni");
    expect(names()).toEqual(["a", "b", "c"]);
  });
});
