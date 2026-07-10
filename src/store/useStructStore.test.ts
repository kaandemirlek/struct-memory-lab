// @vitest-environment jsdom
// (the store uses zustand `persist` → localStorage, which needs a DOM env)

import { describe, it, expect, beforeEach } from "vitest";
import {
  useStructStore,
  resolveComparison,
  CURRENT_EDITS,
  CURRENT_EDITS_LABEL,
} from "@/store/useStructStore";
import type { Field, StructModel, Version } from "@/types";

const get = () => useStructStore.getState();

describe("useStructStore — Person A actions", () => {
  const f = (id: string, name: string): Field => ({
    id,
    name,
    type: "uint32_t",
    arrayLength: 1,
  });

  beforeEach(() => {
    useStructStore.setState({
      currentModel: { name: "T", fields: [f("a", "a"), f("b", "b"), f("c", "c")] },
      versions: [],
      baseVersionId: null,
      targetVersionId: null,
    });
  });

  const names = () => get().currentModel.fields.map((x) => x.name);

  it("reorderFields moves a field from one index to another", () => {
    get().reorderFields(0, 2);
    expect(names()).toEqual(["b", "c", "a"]);
    get().reorderFields(2, 0);
    expect(names()).toEqual(["a", "b", "c"]);
  });

  it("addField appends a new field", () => {
    get().addField();
    expect(get().currentModel.fields).toHaveLength(4);
    expect(names()[3]).toBe("newField");
  });

  it("removeField deletes by id", () => {
    get().removeField("b");
    expect(names()).toEqual(["a", "c"]);
  });

  it("updateField patches a field (id stays stable)", () => {
    get().updateField("a", { name: "renamed", type: "double" });
    expect(get().currentModel.fields[0]).toMatchObject({
      id: "a",
      name: "renamed",
      type: "double",
    });
  });

  it("setStructName changes the name without touching fields", () => {
    get().setStructName("New");
    expect(get().currentModel.name).toBe("New");
    expect(names()).toEqual(["a", "b", "c"]);
  });
});

describe("useStructStore — nested struct editing", () => {
  const nestedModel = (): StructModel => ({
    name: "Player",
    fields: [
      { id: "f1", name: "id", type: "uint32_t", arrayLength: 1 },
      {
        id: "f2",
        name: "position",
        type: "struct",
        arrayLength: 1,
        nested: {
          name: "Vec3",
          fields: [
            { id: "nx", name: "x", type: "float", arrayLength: 1 },
            { id: "ny", name: "y", type: "float", arrayLength: 1 },
          ],
        },
      },
    ],
  });

  beforeEach(() => {
    useStructStore.setState({ currentModel: nestedModel(), past: [], future: [] });
  });

  const nestedFields = () => get().currentModel.fields[1].nested!.fields;

  it("updateField reaches fields inside a nested struct", () => {
    get().updateField("nx", { name: "renamedX", type: "double" });
    expect(nestedFields()[0]).toMatchObject({ id: "nx", name: "renamedX", type: "double" });
  });

  it("removeField deletes a nested field without touching siblings", () => {
    get().removeField("ny");
    expect(nestedFields().map((f) => f.id)).toEqual(["nx"]);
    expect(get().currentModel.fields).toHaveLength(2); // üst seviye dokunulmadı
  });

  it("addField(parentId) appends into the nested struct", () => {
    get().addField("f2");
    expect(nestedFields()).toHaveLength(3);
    expect(nestedFields()[2].name).toBe("newField");
  });

  it("addField without a parent still appends at the top level", () => {
    get().addField();
    expect(get().currentModel.fields).toHaveLength(3);
  });

  it("nested edits participate in undo", () => {
    get().updateField("nx", { name: "changed" });
    expect(nestedFields()[0].name).toBe("changed");
    get().undo();
    expect(nestedFields()[0].name).toBe("x");
  });
});

describe("useStructStore — versioning actions", () => {
  const baseModel = (): StructModel => ({
    name: "Player",
    fields: [
      { id: "f1", name: "id", type: "uint32_t", arrayLength: 1 },
      { id: "f2", name: "alive", type: "bool", arrayLength: 1 },
    ],
  });

  beforeEach(() => {
    useStructStore.setState({
      currentModel: baseModel(),
      versions: [],
      baseVersionId: null,
      targetVersionId: null,
    });
  });

  it("saveVersion snapshots the current model with an incrementing label", () => {
    get().saveVersion();
    get().saveVersion();
    expect(get().versions.map((v) => v.label)).toEqual(["v1", "v2"]);
    expect(get().versions[0].model.fields.map((f) => f.name)).toEqual([
      "id",
      "alive",
    ]);
  });

  it("snapshots are deep copies — later edits don't mutate them", () => {
    get().saveVersion();
    get().setStructName("Changed");
    get().addField();
    const snap = get().versions[0];
    expect(snap.model.name).toBe("Player");
    expect(snap.model.fields).toHaveLength(2);
  });

  it("loadVersion restores a snapshot into the current model", () => {
    get().saveVersion();
    const id = get().versions[0].id;
    get().setStructName("Edited");
    get().loadVersion(id);
    expect(get().currentModel.name).toBe("Player");
  });

  it("renameVersion updates the label", () => {
    get().saveVersion();
    const id = get().versions[0].id;
    get().renameVersion(id, "baseline");
    expect(get().versions[0].label).toBe("baseline");
  });

  it("deleteVersion removes it and clears base/target if they pointed at it", () => {
    get().saveVersion();
    const id = get().versions[0].id;
    get().setBaseVersion(id);
    get().setTargetVersion(id);
    get().deleteVersion(id);
    expect(get().versions).toHaveLength(0);
    expect(get().baseVersionId).toBeNull();
    expect(get().targetVersionId).toBeNull();
  });

  it("deleteVersion keeps selections that pointed at other versions", () => {
    get().saveVersion(); // v1
    get().saveVersion(); // v2
    const [v1, v2] = get().versions;
    get().setBaseVersion(v2.id);
    get().deleteVersion(v1.id);
    expect(get().baseVersionId).toBe(v2.id);
    expect(get().versions.map((v) => v.label)).toEqual(["v2"]);
  });
});

describe("resolveComparison", () => {
  const m1: StructModel = { name: "S", fields: [] };
  const m2: StructModel = {
    name: "S",
    fields: [{ id: "f", name: "x", type: "bool", arrayLength: 1 }],
  };
  const current: StructModel = { name: "Cur", fields: [] };
  const v = (id: string, label: string, model: StructModel): Version => ({
    id,
    label,
    model,
    createdAt: "2026-01-01T00:00:00.000Z",
  });
  const versions = [v("v1", "v1", m1), v("v2", "v2", m2)];

  it("defaults From to the latest version and To to current edits", () => {
    const c = resolveComparison(versions, current, null, null);
    expect(c.fromVersionId).toBe("v2");
    expect(c.fromLabel).toBe("v2");
    expect(c.fromValue).toBe("v2");
    expect(c.toModel).toBe(current);
    expect(c.toLabel).toBe(CURRENT_EDITS_LABEL);
    expect(c.toValue).toBe(CURRENT_EDITS);
  });

  it("treats a CURRENT_EDITS base as the live model", () => {
    const c = resolveComparison(versions, current, CURRENT_EDITS, null);
    expect(c.fromModel).toBe(current);
    expect(c.fromLabel).toBe(CURRENT_EDITS_LABEL);
    expect(c.fromVersionId).toBeUndefined();
  });

  it("resolves an explicit To version", () => {
    const c = resolveComparison(versions, current, null, "v1");
    expect(c.toVersionId).toBe("v1");
    expect(c.toModel).toBe(m1);
  });

  it("falls back to the latest version when the base id no longer exists", () => {
    const c = resolveComparison(versions, current, "deleted", null);
    expect(c.fromVersionId).toBe("v2");
  });

  it("yields no From model when there are no versions", () => {
    const c = resolveComparison([], current, null, null);
    expect(c.fromModel).toBeUndefined();
  });
});

describe("useStructStore — bit field actions", () => {
  beforeEach(() => {
    useStructStore.setState({
      currentModel: {
        name: "StatusPacket",
        fields: [
          { id: "sw", name: "statusWords", type: "uint32_t", arrayLength: 3, bitFields: [] },
        ],
      },
      versions: [],
      baseVersionId: null,
      targetVersionId: null,
    });
  });

  const bits = () => get().currentModel.fields[0].bitFields!;

  it("addBitField appends a 1-bit field at the next free bit of word 0", () => {
    get().addBitField("sw");
    get().addBitField("sw");
    expect(bits()).toHaveLength(2);
    expect(bits().map((b) => b.startBit)).toEqual([0, 1]); // ardışık yerleşim
    expect(bits()[0].width).toBe(1);
  });

  it("addBitField accepts an exact word, bit and width from the visual editor", () => {
    get().addBitField("sw", { wordIndex: 2, startBit: 7, width: 4 });
    expect(bits()[0]).toMatchObject({
      name: "status_2_7",
      wordIndex: 2,
      startBit: 7,
      width: 4,
    });
  });

  it("updateBitField patches name/position/meanings", () => {
    get().addBitField("sw");
    const id = bits()[0].id;
    get().updateBitField("sw", id, {
      name: "irCameraFail",
      width: 3,
      meanings: [{ value: 0, label: "OK" }, { value: 1, label: "FAIL" }],
    });
    expect(bits()[0]).toMatchObject({ name: "irCameraFail", width: 3 });
    expect(bits()[0].meanings).toHaveLength(2);
  });

  it("removeBitField deletes by id", () => {
    get().addBitField("sw");
    get().addBitField("sw");
    const id = bits()[0].id;
    get().removeBitField("sw", id);
    expect(bits()).toHaveLength(1);
    expect(bits()[0].id).not.toBe(id);
  });

  it("nested struct içindeki alanın bit'lerini de düzenler (özyinelemeli)", () => {
    useStructStore.setState({
      currentModel: {
        name: "Outer",
        fields: [
          {
            id: "p",
            name: "pkt",
            type: "struct",
            arrayLength: 1,
            nested: {
              name: "Inner",
              fields: [{ id: "isw", name: "flags", type: "uint32_t", arrayLength: 1, bitFields: [] }],
            },
          },
        ],
      },
      versions: [],
      baseVersionId: null,
      targetVersionId: null,
    });
    get().addBitField("isw", { wordIndex: 0, startBit: 3, width: 1 });
    const innerBits = get().currentModel.fields[0].nested!.fields[0].bitFields!;
    expect(innerBits).toHaveLength(1);
    expect(innerBits[0]).toMatchObject({ wordIndex: 0, startBit: 3, width: 1 });
  });
});
