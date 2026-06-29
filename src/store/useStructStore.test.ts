// @vitest-environment jsdom
// (the store uses zustand `persist` → localStorage, which needs a DOM env)

import { describe, it, expect, beforeEach } from "vitest";
import {
  useStructStore,
  resolveComparison,
  CURRENT_EDITS,
} from "@/store/useStructStore";
import type { StructModel, Version } from "@/types";

const baseModel = (): StructModel => ({
  name: "Player",
  fields: [
    { id: "f1", name: "id", type: "uint32_t", arrayLength: 1 },
    { id: "f2", name: "alive", type: "bool", arrayLength: 1 },
  ],
});

beforeEach(() => {
  // Reset to a known baseline before each test (actions are kept).
  useStructStore.setState({
    currentModel: baseModel(),
    versions: [],
    baseVersionId: null,
    targetVersionId: null,
  });
});

const get = () => useStructStore.getState();

describe("useStructStore — versioning actions", () => {
  it("saveVersion snapshots the current model with an incrementing label", () => {
    get().saveVersion();
    get().saveVersion();
    const { versions } = get();
    expect(versions.map((v) => v.label)).toEqual(["v1", "v2"]);
    expect(versions[0].model.fields.map((f) => f.name)).toEqual(["id", "alive"]);
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
  const v: (id: string, label: string, model: StructModel) => Version = (
    id,
    label,
    model
  ) => ({ id, label, model, createdAt: "2026-01-01T00:00:00.000Z" });
  const versions = [v("v1", "v1", m1), v("v2", "v2", m2)];

  it("defaults From to the latest version and To to current edits", () => {
    const c = resolveComparison(versions, current, null, null);
    expect(c.fromVersionId).toBe("v2");
    expect(c.fromLabel).toBe("v2");
    expect(c.fromValue).toBe("v2");
    expect(c.toModel).toBe(current);
    expect(c.toLabel).toBe("current edits");
    expect(c.toValue).toBe(CURRENT_EDITS);
  });

  it("treats a CURRENT_EDITS base as the live model", () => {
    const c = resolveComparison(versions, current, CURRENT_EDITS, null);
    expect(c.fromModel).toBe(current);
    expect(c.fromLabel).toBe("current edits");
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
