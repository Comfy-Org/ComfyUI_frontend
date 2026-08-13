import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import {
  SCHEMA_VERSION,
  createNodeMap,
  definitionsMap,
  initDoc,
  linksMap,
  metaMap,
  nodesMap,
} from "../src/index.js";

describe("schema", () => {
  it("pins SCHEMA_VERSION at 1", () => {
    expect(SCHEMA_VERSION).toBe(1);
  });

  it("initDoc creates the v1 layout: nodes/links/definitions/meta + bookkeeping", () => {
    const doc = initDoc(new Y.Doc(), "object_info@2026-08-01");
    expect(nodesMap(doc)).toBeInstanceOf(Y.Map);
    expect(linksMap(doc)).toBeInstanceOf(Y.Map);
    expect(definitionsMap(doc)).toBeInstanceOf(Y.Map);
    expect(doc.getMap("__applied")).toBeInstanceOf(Y.Map);
    expect(doc.getMap("__stamps")).toBeInstanceOf(Y.Map);
    const meta = metaMap(doc);
    expect(meta.get("schema_version")).toBe(SCHEMA_VERSION);
    expect(meta.get("catalog_version")).toBe("object_info@2026-08-01");
    expect(meta.get("last_node_id")).toBe(0);
    expect(meta.get("last_link_id")).toBe(0);
    // Passthrough keys are plain values, never Y types (schema §6).
    expect(meta.get("extra")).toEqual({});
    expect(meta.get("extra")).not.toBeInstanceOf(Y.Map);
  });

  it("initDoc is idempotent", () => {
    const doc = initDoc(new Y.Doc());
    metaMap(doc).set("last_node_id", 7);
    initDoc(doc);
    expect(metaMap(doc).get("last_node_id")).toBe(7);
    expect(metaMap(doc).get("catalog_version")).toBe("");
  });

  it("createNodeMap builds a NAME-KEYED widgets Y.Map from positional values + widget order", () => {
    const doc = initDoc(new Y.Doc());
    const node = createNodeMap(
      {
        id: "57:3",
        type: "KSampler",
        pos: [420, 180],
        flags: { collapsed: false },
        widgets_values: [123, "fixed", 20],
      },
      ["seed", "control_after_generate", "steps"],
    );
    nodesMap(doc).set("57:3", node);

    const stored = nodesMap(doc).get("57:3")!;
    expect(stored.get("type")).toBe("KSampler");
    expect(stored.get("pos")).toEqual([420, 180]);
    expect(stored.get("flags")).toBeInstanceOf(Y.Map);
    const widgets = stored.get("widgets") as Y.Map<unknown>;
    expect(widgets).toBeInstanceOf(Y.Map);
    // Name-keyed, not positional (schema §1.2): the spike proved positional
    // Y.Array widgets corrupt under same-index concurrent writes.
    expect(widgets.get("seed")).toBe(123);
    expect(widgets.get("control_after_generate")).toBe("fixed");
    expect(widgets.get("steps")).toBe(20);
    expect(stored.get("widgets_values")).toBeUndefined();
  });

  it("createNodeMap accepts an already name-keyed widgets record without a catalog", () => {
    const doc = initDoc(new Y.Doc());
    const node = createNodeMap({
      id: 42,
      type: "CLIPTextEncode",
      widgets_values: { text: "a fluffy cat" },
    });
    nodesMap(doc).set("42", node);
    const widgets = nodesMap(doc).get("42")!.get("widgets") as Y.Map<unknown>;
    expect(widgets.get("text")).toBe("a fluffy cat");
  });

  it("createNodeMap rejects positional widgets_values without the pinned widget order", () => {
    expect(() =>
      createNodeMap({ id: 1, type: "KSampler", widgets_values: [123] }),
    ).toThrow(/widget_order/);
    expect(() =>
      createNodeMap({ id: 1, type: "KSampler", widgets_values: [123, 20] }, ["seed"]),
    ).toThrow(/names only 1/);
  });
});
