import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import {
  createNodeMap,
  definitionsMap,
  initDoc,
  metaMap,
} from "../src/doc.js";
import { OPAQUE_WIDGETS_KEY, SCHEMA_VERSION, linksMap, nodesMap } from "../src/index.js";

describe("schema", () => {
  it("pins SCHEMA_VERSION at 5", () => {
    expect(SCHEMA_VERSION).toBe(5);
  });

  it("initDoc creates the schema v5 layout with lazy clock reservations", () => {
    const doc = new Y.Doc();
    initDoc(doc, "object_info@2026-08-01");
    expect(nodesMap(doc)).toBeInstanceOf(Y.Map);
    expect(linksMap(doc)).toBeInstanceOf(Y.Map);
    expect(definitionsMap(doc)).toBeInstanceOf(Y.Map);
    expect(doc.getMap("__applied")).toBeInstanceOf(Y.Map);
    expect(doc.getMap("__stamps")).toBeInstanceOf(Y.Map);
    expect(doc.getMap("__link_state")).toBeInstanceOf(Y.Map);
    expect(doc.share.has("__clock_reservations")).toBe(false);
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
    const doc = new Y.Doc();
    initDoc(doc);
    metaMap(doc).set("last_node_id", 7);
    initDoc(doc);
    expect(metaMap(doc).get("last_node_id")).toBe(7);
    expect(metaMap(doc).get("catalog_version")).toBe("");
  });

  it("createNodeMap builds a NAME-KEYED widgets Y.Map from positional values + widget order", () => {
    const doc = new Y.Doc();
    initDoc(doc);
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
    const doc = new Y.Doc();
    initDoc(doc);
    const node = createNodeMap({
      id: 42,
      type: "CLIPTextEncode",
      widgets_values: { text: "a fluffy cat" },
    });
    nodesMap(doc).set("42", node);
    const widgets = nodesMap(doc).get("42")!.get("widgets") as Y.Map<unknown>;
    expect(widgets.get("text")).toBe("a fluffy cat");
  });

  it("createNodeMap stores an UNKNOWN class's positional widgets_values opaquely (schema §1.2)", () => {
    // Frontend-only classes are never in object_info, so no catalog can ever
    // carry a widget_order for them — this is the sticky-note path.
    const doc = new Y.Doc();
    initDoc(doc);
    const values = ["A sticky note.\n\nWith a second line."];
    nodesMap(doc).set("1", createNodeMap({ id: 1, type: "Note", widgets_values: values }));
    const node = nodesMap(doc).get("1")!;
    expect(node.get("widgets")).toBeUndefined();
    expect(node.get(OPAQUE_WIDGETS_KEY)).toEqual(values);
    // Stored as ONE plain value, never a Y type: nothing to merge element-wise,
    // so §1.2's positional-array corruption cannot arise. Concurrent writes
    // resolve as whole-value LWW.
    expect(node.get(OPAQUE_WIDGETS_KEY)).not.toBeInstanceOf(Y.Array);
    expect(node.get(OPAQUE_WIDGETS_KEY)).not.toBeInstanceOf(Y.Map);
    // Whole-array, not element-wise: mutating the source cannot reach the doc.
    values[0] = "mutated after the fact";
    expect((node.get(OPAQUE_WIDGETS_KEY) as string[])[0]).toMatch(/^A sticky note/);
  });

  it("createNodeMap names the overrun positionally when widget_order is present but too SHORT (BE-9176)", () => {
    // A catalog MISMATCH is not an unknown class, and is not silently
    // swallowed either: `widgets_values` overrunning the pinned `widget_order`
    // (e.g. a COMFY_DYNAMICCOMBO_V3 selection the value-blind pinned catalog
    // was not built from) no longer loses the node — the overrun entry is
    // named positionally instead. The opaque path remains guarded to absent
    // order only.
    const doc = new Y.Doc();
    initDoc(doc);
    nodesMap(doc).set("1", createNodeMap({ id: 1, type: "KSampler", widgets_values: [123, 20] }, ["seed"]));
    const node = nodesMap(doc).get("1")!;
    const widgets = node.get("widgets") as Y.Map<unknown>;
    expect(widgets.get("seed")).toBe(123);
    expect(widgets.get("_extra_1")).toBe(20);
    expect(node.get(OPAQUE_WIDGETS_KEY)).toBeUndefined();
  });

  it("createNodeMap rejects a node carrying the reserved opaque key", () => {
    expect(() =>
      createNodeMap({ id: 1, type: "Note", [OPAQUE_WIDGETS_KEY]: ["x"] }),
    ).toThrow(/reserved key/);
  });

  it("createNodeMap keeps an EMPTY positional widgets_values name-keyed (not opaque)", () => {
    const doc = new Y.Doc();
    initDoc(doc);
    nodesMap(doc).set("1", createNodeMap({ id: 1, type: "Note", widgets_values: [] }));
    const node = nodesMap(doc).get("1")!;
    expect(node.get(OPAQUE_WIDGETS_KEY)).toBeUndefined();
    expect(node.get("widgets")).toBeInstanceOf(Y.Map);
  });
});
