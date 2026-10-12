/**
 * Amendment A24 — node-local widget form (FE-3036 row 5).
 *
 * Two reachable node shapes had no lossless representation in this document.
 *
 *  1. A class the pinned catalog cannot describe whose `widgets_values` is a
 *     non-empty positional array is stored opaquely (A2) and is therefore not
 *     name-addressable at all: `set_widget` is rejected `opaque_widgets`.
 *  2. A custom serializer that emits an OBJECT (`VHS_*`) was stored as a
 *     name-keyed map whose keys are the serializer's own, then projected back
 *     through the pinned `widget_order` as a positional ARRAY — so the object
 *     shape and every non-widget key in it were lost, and for an uncatalogued
 *     class `project()` threw for the whole document.
 *
 * A24 lets the PRODUCER declare, per node instance, the ordered identity of
 * its serializable widgets: `widgets_values_form: { order: [...] }`. That one
 * field is enough for this package to store each value under its own
 * `(name, occurrence)` register, address it by that pair without consulting
 * the catalog, keep every key the serializer emitted that is NOT a widget
 * verbatim, and project the original shape back.
 *
 * These are the three round trips the amendment exists for — duplicate names,
 * unknown keys in a custom-serialized object, and occurrence-addressed
 * mutation of an uncatalogued class — plus the fail-closed refusals that keep
 * a malformed declaration from poisoning the document.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import * as Y from "yjs";
import { describe, expect, it } from "vitest";

import { fixturesDir } from "./helpers.js";
import {
  OPAQUE_WIDGETS_KEY,
  WIDGET_FORM_KEY,
  applyOps,
  compact,
  hasAppliedOp,
  mint,
  project,
  readGraph,
  type AddNodeOp,
  type SetWidgetOp,
  type WidgetCatalog,
  type WorkflowJSON,
  type WorkflowNode,
} from "../src/index.js";

/** Neither class under test is in the catalog — that is the point of A24. */
const catalog: WidgetCatalog = { types: { CLIPTextEncode: { widget_order: ["text"] } } };

const DUP_VALUES = ["first", "second", 7] as const;
const DUP_FORM = { order: ["value", "value", "mode"] };

/** A custom serializer's object, with two keys that are NOT widgets. */
const VHS_VALUES = {
  video: "clip.mp4",
  videopreview: { hidden: false, paused: true, params: { frame_load_cap: 0 } },
  force_rate: 0,
  __vhs_internal: [1, 2, { deep: null }],
  choose_video_to_upload: "image",
};
const VHS_FORM = { order: ["video", "force_rate", "choose_video_to_upload"] };

function dupNode(overrides: Partial<WorkflowNode> = {}): WorkflowNode {
  return {
    id: 1,
    type: "DupWidgets",
    widgets_values: [...DUP_VALUES],
    widgets_values_form: { order: [...DUP_FORM.order] },
    ...overrides,
  } as WorkflowNode;
}

function vhsNode(overrides: Partial<WorkflowNode> = {}): WorkflowNode {
  return {
    id: 2,
    type: "VHS_LoadVideo",
    widgets_values: structuredClone(VHS_VALUES),
    widgets_values_form: { order: [...VHS_FORM.order] },
    ...overrides,
  } as WorkflowNode;
}

const workflowOf = (...nodes: WorkflowNode[]): WorkflowJSON =>
  ({ nodes, links: [] }) as WorkflowJSON;

function write(
  counter: number,
  nodeId: number,
  widget: string,
  value: unknown,
  occurrence?: number,
): SetWidgetOp {
  return {
    op: "set_widget",
    op_id: counter.toString(16).padStart(32, "0"),
    actor: "agent:a",
    base_version: counter,
    stamp: [counter, "agent:a"],
    node_id: nodeId,
    widget,
    value,
    ...(occurrence === undefined ? {} : { widget_occurrence: occurrence }),
  };
}

const nodeById = (doc: Y.Doc, id: number): WorkflowNode =>
  project(doc, catalog).nodes.find((n) => String(n.id) === String(id))!;

const outcomes = (doc: Y.Doc, ops: SetWidgetOp[] | AddNodeOp[]): string[] =>
  applyOps(doc, ops, catalog).outcomes.map((o) => o.outcome);

// ---------------------------------------------------------------------------
// 1. Ordered per-instance identity: two widgets with the SAME name
// ---------------------------------------------------------------------------

describe("A24: duplicate widget names on an uncatalogued class", () => {
  it("round-trips both values and the declared order through mint and project", () => {
    const projected = nodeById(mint(workflowOf(dupNode()), catalog), 1);
    expect(projected.widgets_values).toEqual([...DUP_VALUES]);
    expect(projected["widgets_values_form"]).toEqual(DUP_FORM);
  });

  it("stores each occurrence in its own register rather than collapsing them", () => {
    const doc = mint(workflowOf(dupNode({ widgets_values: ["same", "same", 1] })), catalog);
    expect(outcomes(doc, [write(1, 1, "value", "only-the-second", 1)])).toEqual(["applied"]);
    expect(nodeById(doc, 1).widgets_values).toEqual(["same", "only-the-second", 1]);
  });

  it("addresses the first occurrence when widget_occurrence is absent or zero", () => {
    const absent = mint(workflowOf(dupNode()), catalog);
    expect(outcomes(absent, [write(1, 1, "value", "A")])).toEqual(["applied"]);
    expect(nodeById(absent, 1).widgets_values).toEqual(["A", "second", 7]);

    const zero = mint(workflowOf(dupNode()), catalog);
    expect(outcomes(zero, [write(1, 1, "value", "A", 0)])).toEqual(["applied"]);
    expect(nodeById(zero, 1).widgets_values).toEqual(["A", "second", 7]);
  });

  /**
   * A rejection must precede every mutation and must abort the remainder of
   * the batch (§4). Asserting only the outcome code would pass even if the
   * write had already landed and then been reported as rejected, so each case
   * additionally proves the encoded document is byte-identical, the `op_id`
   * was not consumed into `__applied`, and a following VALID op in the same
   * batch did not apply.
   */
  const rejectionFacts = (bad: SetWidgetOp) => {
    const doc = mint(workflowOf(dupNode()), catalog);
    const before = Buffer.from(Y.encodeStateAsUpdate(doc));
    const seenBefore = applyOps(doc, [], catalog).ops_seen;
    const follower = write(9, 1, "mode", 42);
    const result = applyOps(doc, [bad, follower], catalog);
    return {
      outcome: result.outcomes[0],
      opsSeenUnchanged: result.ops_seen === seenBefore,
      badConsumed: hasAppliedOp(doc, bad.op_id),
      followerConsumed: hasAppliedOp(doc, follower.op_id),
      bytesUnchanged: Buffer.from(Y.encodeStateAsUpdate(doc)).equals(before),
      values: nodeById(doc, 1).widgets_values,
    };
  };

  const REJECTED_CLEANLY = {
    outcome: { outcome: "rejected", reason: { code: "unknown_widget" } },
    opsSeenUnchanged: true,
    badConsumed: false,
    followerConsumed: false,
    bytesUnchanged: true,
    values: [...DUP_VALUES],
  };

  it("rejects an occurrence the declared order does not have", () => {
    expect(rejectionFacts(write(1, 1, "value", "x", 2))).toMatchObject(REJECTED_CLEANLY);
  });

  it("rejects a name the declared order does not have", () => {
    expect(rejectionFacts(write(1, 1, "not_a_widget", "x"))).toMatchObject(REJECTED_CLEANLY);
  });

  it("CONTROL: the follower op above does apply when nothing precedes it", () => {
    // Otherwise the abort-remainder assertion would hold for a follower that
    // could never have applied in the first place.
    const doc = mint(workflowOf(dupNode()), catalog);
    expect(outcomes(doc, [write(9, 1, "mode", 42)])).toEqual(["applied"]);
    expect(nodeById(doc, 1).widgets_values).toEqual(["first", "second", 42]);
  });
});

// ---------------------------------------------------------------------------
// 2. Opaque serializer fidelity: unknown keys survive, verbatim
// ---------------------------------------------------------------------------

describe("A24: custom-serialized object fidelity", () => {
  it("round-trips the object shape, its key order, and every non-widget key", () => {
    const projected = nodeById(mint(workflowOf(vhsNode()), catalog), 2);
    expect(projected.widgets_values).toEqual(VHS_VALUES);
    expect(Object.keys(projected.widgets_values as object)).toEqual(Object.keys(VHS_VALUES));
    expect(projected["widgets_values_form"]).toEqual(VHS_FORM);
  });

  it("leaves unknown keys byte-identical across an accepted widget write", () => {
    const doc = mint(workflowOf(vhsNode()), catalog);
    expect(outcomes(doc, [write(1, 2, "force_rate", 24)])).toEqual(["applied"]);
    const after = nodeById(doc, 2).widgets_values as Record<string, unknown>;
    expect(after["force_rate"]).toBe(24);
    expect(JSON.stringify(after["videopreview"])).toBe(JSON.stringify(VHS_VALUES.videopreview));
    expect(JSON.stringify(after["__vhs_internal"])).toBe(JSON.stringify(VHS_VALUES.__vhs_internal));
    expect(Object.keys(after)).toEqual(Object.keys(VHS_VALUES));
  });

  it("refuses to address a non-widget key the serializer emitted", () => {
    const doc = mint(workflowOf(vhsNode()), catalog);
    const result = applyOps(doc, [write(1, 2, "videopreview", "clobbered")], catalog);
    expect(result.outcomes[0]).toMatchObject({ outcome: "rejected", reason: { code: "unknown_widget" } });
    expect(nodeById(doc, 2).widgets_values).toEqual(VHS_VALUES);
  });

  it("projects without consulting the catalog at all", () => {
    const doc = mint(workflowOf(dupNode(), vhsNode()), catalog);
    const empty: WidgetCatalog = { types: {} };
    expect(() => project(doc, empty)).not.toThrow();
    expect(project(doc, empty).nodes.find((n) => String(n.id) === "2")?.widgets_values).toEqual(VHS_VALUES);
  });
});

// ---------------------------------------------------------------------------
// 3. The write path: add_node, replay, convergence
// ---------------------------------------------------------------------------

describe("A24: add_node and replication semantics", () => {
  function addNode(counter: number, node: WorkflowNode): AddNodeOp {
    return {
      op: "add_node",
      op_id: `a${counter.toString(16).padStart(31, "0")}`,
      actor: "agent:a",
      base_version: counter,
      stamp: [counter, "agent:a"],
      node_id: node.id as number,
      node,
    } as AddNodeOp;
  }

  it("accepts an uncatalogued self-described node without a catalogue entry", () => {
    const doc = mint(workflowOf(), catalog);
    expect(outcomes(doc, [addNode(1, vhsNode())])).toEqual(["applied"]);
    expect(nodeById(doc, 2).widgets_values).toEqual(VHS_VALUES);
  });

  it("makes an added self-described node immediately occurrence-addressable", () => {
    const doc = mint(workflowOf(), catalog);
    applyOps(doc, [addNode(1, dupNode())], catalog);
    expect(outcomes(doc, [write(2, 1, "value", "B", 1)])).toEqual(["applied"]);
    expect(nodeById(doc, 1).widgets_values).toEqual(["first", "B", 7]);
  });

  it("is idempotent: replaying one op_id leaves the encoded doc byte-identical", () => {
    const doc = mint(workflowOf(dupNode()), catalog);
    const op = write(1, 1, "value", "B", 1);
    const first = applyOps(doc, [op], catalog);
    const before = Buffer.from(Y.encodeStateAsUpdate(doc));
    const replay = applyOps(doc, [op], catalog);
    expect(replay.outcomes.map((o) => o.outcome)).toEqual(["no-op"]);
    // The op identity was consumed once, not twice: the `__applied` ledger
    // does not grow and the document is byte-identical.
    expect(replay.ops_seen).toBe(first.ops_seen);
    expect(Buffer.from(Y.encodeStateAsUpdate(doc)).equals(before)).toBe(true);
  });

  it("converges in both arrival orders for two writes to the same occurrence", () => {
    const lower = write(1, 1, "value", "lower", 1);
    const higher = write(2, 1, "value", "higher", 1);
    const forward = mint(workflowOf(dupNode()), catalog);
    const reverse = mint(workflowOf(dupNode()), catalog);
    applyOps(forward, [lower, higher], catalog);
    applyOps(reverse, [higher, lower], catalog);
    expect(nodeById(forward, 1).widgets_values).toEqual(["first", "higher", 7]);
    expect(nodeById(reverse, 1).widgets_values).toEqual(nodeById(forward, 1).widgets_values);
  });

  it("gives each occurrence a distinct LWW register, so neither write drops the other", () => {
    const doc = mint(workflowOf(dupNode()), catalog);
    expect(outcomes(doc, [write(2, 1, "value", "second-wins", 1), write(1, 1, "value", "first-wins", 0)]))
      .toEqual(["applied", "applied"]);
    expect(nodeById(doc, 1).widgets_values).toEqual(["first-wins", "second-wins", 7]);
  });
});

// ---------------------------------------------------------------------------
// 4. The declaration survives the host's own re-mint, and stays catalog-free
// ---------------------------------------------------------------------------

describe("A24: compaction and the follower read surface", () => {
  it("survives compact() — which is project() -> mint(), so the form must round-trip", () => {
    const doc = mint(workflowOf(dupNode(), vhsNode()), catalog);
    applyOps(doc, [write(1, 1, "value", "edited", 1), write(2, 2, "force_rate", 24)], catalog);
    const before = project(doc, catalog);
    const after = project(compact(doc, catalog), catalog);
    expect(after.nodes).toEqual(before.nodes);
    expect(after.nodes.find((n) => String(n.id) === "1")?.widgets_values).toEqual(["first", "edited", 7]);
  });

  it("stays occurrence-addressable after compaction", () => {
    const doc = compact(mint(workflowOf(dupNode()), catalog), catalog);
    expect(outcomes(doc, [write(1, 1, "value", "post-compact", 1)])).toEqual(["applied"]);
    expect(nodeById(doc, 1).widgets_values).toEqual(["first", "post-compact", 7]);
  });

  it("exposes the form to a catalog-less follower, which is the only way it can place these values", () => {
    const doc = mint(workflowOf(dupNode()), catalog);
    const snapshot = readGraph(doc).nodes["1"]!;
    expect(snapshot[WIDGET_FORM_KEY]).toMatchObject({ shape: "array", order: DUP_FORM.order });
    expect(snapshot[OPAQUE_WIDGETS_KEY]).toBeUndefined();
  });

  it("spells the reserved key exactly as the cross-implementation wire vector declares it", () => {
    // The key is a cross-implementation contract, not an internal detail: a
    // second implementation resolves it by name. So the vector, the export and
    // the encoded bytes must agree, and a rename has to move all three.
    const vector = JSON.parse(
      readFileSync(join(fixturesDir, "golden-vectors", "wire-layout.json"), "utf8"),
    ) as { reserved_node_keys: Record<string, string> };
    expect(vector.reserved_node_keys["widget_form"]).toBe(WIDGET_FORM_KEY);
    const update = Buffer.from(Y.encodeStateAsUpdate(mint(workflowOf(dupNode()), catalog)));
    const token = Buffer.concat([Buffer.from([WIDGET_FORM_KEY.length]), Buffer.from(WIDGET_FORM_KEY, "utf8")]);
    expect(update.includes(token), `encoded update must spell '${WIDGET_FORM_KEY}'`).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 5. An UNDECLARED node is untouched — A2 and the catalog path are unchanged
// ---------------------------------------------------------------------------

describe("A24: nodes that declare nothing keep their existing behaviour", () => {
  const undeclared = (type: string, wv: unknown): WorkflowJSON =>
    workflowOf({ id: 9, type, widgets_values: wv } as WorkflowNode);

  it("still stores an uncatalogued positional array opaquely and still refuses a named write", () => {
    const doc = mint(undeclared("Note", ["sticky"]), catalog);
    expect(readGraph(doc).nodes["9"]![OPAQUE_WIDGETS_KEY]).toEqual(["sticky"]);
    expect(readGraph(doc).nodes["9"]![WIDGET_FORM_KEY]).toBeUndefined();
    expect(applyOps(doc, [write(1, 9, "text", "x")], catalog).outcomes[0]).toMatchObject({
      outcome: "rejected",
      reason: { code: "opaque_widgets" },
    });
  });

  it("still resolves a catalogued class through the pinned widget_order", () => {
    const doc = mint(undeclared("CLIPTextEncode", ["hello"]), catalog);
    expect(outcomes(doc, [write(1, 9, "text", "goodbye")])).toEqual(["applied"]);
    expect(nodeById(doc, 9).widgets_values).toEqual(["goodbye"]);
    expect(nodeById(doc, 9)["widgets_values_form"]).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// 6. The declaration wins over the catalog, and reaches every write path
// ---------------------------------------------------------------------------

describe("A24: a declared order wins over the pinned catalog for that instance", () => {
  // The class IS catalogued, and the instance's real layout is longer than the
  // pinned `widget_order` because the node carries two `text` widgets. This is
  // the FE-3036 case where the two legitimately disagree.
  const declaringClipNode = (): WorkflowNode =>
    ({
      id: 3,
      type: "CLIPTextEncode",
      widgets_values: ["positive", "negative"],
      widgets_values_form: { order: ["text", "text"] },
    }) as WorkflowNode;

  it("projects through the declaration, not through widget_order", () => {
    const projected = nodeById(mint(workflowOf(declaringClipNode()), catalog), 3);
    expect(projected.widgets_values).toEqual(["positive", "negative"]);
  });

  it("addresses the second occurrence the catalog cannot describe", () => {
    const doc = mint(workflowOf(declaringClipNode()), catalog);
    expect(outcomes(doc, [write(1, 3, "text", "edited", 1)])).toEqual(["applied"]);
    expect(nodeById(doc, 3).widgets_values).toEqual(["positive", "edited"]);
  });

  /**
   * `insert_workflow` is the one path where A24's fidelity promise is narrower
   * than everywhere else, and the narrowing is PRE-EXISTING rather than
   * introduced here: `prepareInsertedWorkflow` runs `scrubPrivateKeys` over
   * the whole template, which deletes every `__`-prefixed key at every depth
   * so a template cannot forge a doc-internal one. A serializer's own
   * `__`-prefixed data key inside `widgets_values` is collateral. Widening
   * that scrub is a change to a security guard and belongs to whoever owns it,
   * not to this amendment — so the behaviour is pinned rather than papered
   * over, and both halves are asserted.
   */
  const insertOp = (node: WorkflowNode): AddNodeOp =>
    ({
      op: "insert_workflow",
      op_id: `c${"0".repeat(31)}`,
      actor: "agent:a",
      base_version: 1,
      stamp: [1, "agent:a"],
      workflow: { nodes: [node], links: [] },
    }) as unknown as AddNodeOp;

  it("reaches an inserted template node and keeps its non-widget keys", () => {
    const doc = mint(workflowOf(), catalog);
    expect(applyOps(doc, [insertOp(vhsNode())], catalog).outcomes[0]).toMatchObject({ outcome: "applied" });
    const inserted = project(doc, catalog).nodes.find((n) => n.type === "VHS_LoadVideo")!;
    const values = inserted.widgets_values as Record<string, unknown>;
    expect(values["videopreview"]).toEqual(VHS_VALUES.videopreview);
    expect(values["video"]).toBe("clip.mp4");
    expect(inserted["widgets_values_form"]).toEqual(VHS_FORM);
  });

  it("loses a `__`-prefixed serializer key on that path only — the pre-existing scrub", () => {
    const doc = mint(workflowOf(), catalog);
    applyOps(doc, [insertOp(vhsNode())], catalog);
    const inserted = project(doc, catalog).nodes.find((n) => n.type === "VHS_LoadVideo")!;
    expect(inserted.widgets_values).not.toHaveProperty("__vhs_internal");
    // Every other path keeps it, so this is the scrub and not the form.
    expect(nodeById(mint(workflowOf(vhsNode()), catalog), 2).widgets_values).toHaveProperty("__vhs_internal");
  });

  it("reaches an interior node of a subgraph definition too", () => {
    const workflow = {
      nodes: [{ id: 50, type: "def-a" } as WorkflowNode],
      links: [],
      definitions: {
        subgraphs: [{ id: "def-a", name: "Def A", nodes: [vhsNode()], links: [] }],
      },
    } as unknown as WorkflowJSON;
    const doc = mint(workflow, catalog);
    // §5.2 interior addressing: `path` is instance-then-interior-node and
    // `node_id` is that path joined, which is how comfy-cli mints it.
    const interior = {
      ...write(1, 50, "force_rate", 24),
      node_id: "50/2",
      path: ["50", "2"],
      inner_widget: "force_rate",
    } as unknown as SetWidgetOp;
    expect(outcomes(doc, [interior])).toEqual(["applied"]);
    const defs = project(doc, catalog)["definitions"] as { subgraphs: { nodes: WorkflowNode[] }[] };
    const values = defs.subgraphs[0]!.nodes[0]!.widgets_values as Record<string, unknown>;
    expect(values["force_rate"]).toBe(24);
    expect(values["videopreview"]).toEqual(VHS_VALUES.videopreview);
  });
});

// ---------------------------------------------------------------------------
// 7. Fail-closed: a malformed declaration never reaches the document
// ---------------------------------------------------------------------------

describe("A24: a malformed widgets_values_form is refused, never guessed at", () => {
  const mintRefusal = (node: WorkflowNode): unknown => {
    try {
      mint(workflowOf(node), catalog);
      return null;
    } catch (err) {
      return err instanceof Error ? err.message : String(err);
    }
  };

  it("refuses an array whose length disagrees with the declared order", () => {
    expect(mintRefusal(dupNode({ widgets_values: ["only-one"] }))).toMatch(/widgets_values_form/);
  });

  it("refuses an object missing a declared widget key", () => {
    const rest = structuredClone(VHS_VALUES) as Record<string, unknown>;
    delete rest["video"];
    expect(mintRefusal(vhsNode({ widgets_values: rest }))).toMatch(/widgets_values_form/);
  });

  it("refuses a duplicate name in the declared order of an OBJECT serializer", () => {
    expect(mintRefusal(vhsNode({ widgets_values_form: { order: ["video", "video"] } }))).toMatch(/widgets_values_form/);
  });

  it("refuses a declaration with no widgets_values to describe", () => {
    const node = dupNode();
    delete (node as Record<string, unknown>)["widgets_values"];
    expect(mintRefusal(node)).toMatch(/widgets_values_form/);
  });

  it("refuses an unknown key inside the declaration", () => {
    expect(mintRefusal(dupNode({ widgets_values_form: { order: [...DUP_FORM.order], stable_ids: [] } })))
      .toMatch(/widgets_values_form/);
  });

  it("refuses an order that is not a non-empty array of non-empty strings", () => {
    expect(mintRefusal(dupNode({ widgets_values_form: { order: [] } }))).toMatch(/widgets_values_form/);
    expect(mintRefusal(dupNode({ widgets_values_form: { order: ["a", 2, "c"] } }))).toMatch(/widgets_values_form/);
    expect(mintRefusal(dupNode({ widgets_values_form: { order: "value" } }))).toMatch(/widgets_values_form/);
  });

  /**
   * `__proto__` as an OWN serializer key, which `JSON.parse` produces and an
   * object literal cannot. Issue #13's family: an inherited key must never be
   * resolved through the prototype, and a residue entry must never land as a
   * setter call. Both the declared and the undeclared spelling are exercised
   * because they take different code paths — `order` membership versus residue.
   */
  it("treats `__proto__` as an ordinary own key, declared or not", () => {
    const hostile = JSON.parse('{"__proto__": 1, "real": 2}') as Record<string, unknown>;

    const asResidue = mint(
      workflowOf(vhsNode({ widgets_values: hostile, widgets_values_form: { order: ["real"] } })),
      catalog,
    );
    const residue = nodeById(asResidue, 2).widgets_values as Record<string, unknown>;
    expect(Object.hasOwn(residue, "__proto__")).toBe(true);
    expect(residue["real"]).toBe(2);
    expect(Object.getPrototypeOf(residue)).not.toBeNull();
    expect(({} as Record<string, unknown>)["real"]).toBeUndefined();

    const asWidget = mint(
      workflowOf(vhsNode({ widgets_values: hostile, widgets_values_form: { order: ["__proto__"] } })),
      catalog,
    );
    expect(outcomes(asWidget, [write(1, 2, "__proto__", 99)])).toEqual(["applied"]);
    const declared = nodeById(asWidget, 2).widgets_values as Record<string, unknown>;
    expect(Object.getOwnPropertyDescriptor(declared, "__proto__")?.value).toBe(99);
    expect(declared["real"]).toBe(2);
  });

  /**
   * The two reads below are the UNTRUSTED-DOC-STATE path: our own writers
   * cannot produce either state, so the only way in is a raw update a host
   * folded into the document. Both are constructed by writing the reserved key
   * directly, which is the thing `createNodeMap` refuses from a payload —
   * which is exactly why the READ side has to answer for it too.
   */
  const forgeForm = (form: unknown): Y.Doc => {
    const doc = mint(workflowOf(dupNode()), catalog);
    const node = (doc.getMap("nodes") as Y.Map<Y.Map<unknown>>).get("1")!;
    doc.transact(() => {
      node.set(WIDGET_FORM_KEY, form);
    });
    return doc;
  };

  it("reads an object form with a duplicate name as NOT self-described", () => {
    // A duplicate would let the write side authorize occurrence 1 while
    // projection, which reads an object's keys at occurrence 0 only, could
    // never render it — an acknowledged, invisible write.
    const doc = forgeForm({ shape: "object", order: ["value", "value"], keys: ["value"] });
    const result = applyOps(doc, [write(1, 1, "value", "x", 1)], catalog);
    // Falls back to the catalog path, whose refusal for this class is loud.
    expect(result.outcomes[0]).toMatchObject({
      outcome: "rejected",
      reason: { code: "uncatalogued_widget_write" },
    });
  });

  it("still reads an ARRAY form with a duplicate name as self-described", () => {
    // The asymmetry is the point: a positional array is exactly where two
    // same-named widgets are addressable, which is A24's primary case.
    const doc = forgeForm({ shape: "array", order: ["value", "value"] });
    expect(outcomes(doc, [write(1, 1, "value", "x", 1)])).toEqual(["applied"]);
  });

  it("refuses a promoted host write whose value_index disagrees with the declared order", () => {
    const doc = mint(workflowOf(dupNode()), catalog);
    const before = Buffer.from(Y.encodeStateAsUpdate(doc));
    const op = {
      ...write(1, 1, "mode", 42),
      promoted: { value_index: 0, instance_path: ["1"], host_widgets_values: [0, 0, 0] },
    } as unknown as SetWidgetOp;
    // `mode` is declared at index 2, so index 0 names a different slot.
    expect(applyOps(doc, [op], catalog).outcomes[0]).toMatchObject({
      outcome: "rejected",
      reason: { code: "malformed_op" },
    });
    expect(Buffer.from(Y.encodeStateAsUpdate(doc)).equals(before)).toBe(true);

    const agreeing = {
      ...write(2, 1, "mode", 42),
      promoted: { value_index: 2, instance_path: ["1"], host_widgets_values: [0, 0, 0] },
    } as unknown as SetWidgetOp;
    expect(outcomes(doc, [agreeing])).toEqual(["applied"]);
    expect(nodeById(doc, 1).widgets_values).toEqual(["first", "second", 42]);
  });

  it("refuses a node payload carrying the doc-internal storage key directly", () => {
    const node = dupNode();
    (node as Record<string, unknown>)["__widgets_form"] = { shape: "array", order: ["x"] };
    expect(mintRefusal(node)).toMatch(/reserved key '__widgets_form'/);
  });

  it("rejects, not accepts, an add_node carrying a malformed declaration", () => {
    const doc = mint(workflowOf(), catalog);
    const bad = {
      op: "add_node",
      op_id: `b${"0".repeat(31)}`,
      actor: "agent:a",
      base_version: 1,
      stamp: [1, "agent:a"],
      node_id: 1,
      node: dupNode({ widgets_values: ["only-one"] }),
    } as AddNodeOp;
    expect(applyOps(doc, [bad], catalog).outcomes[0]).toMatchObject({
      outcome: "rejected",
      reason: { code: "invalid_node_payload" },
    });
    expect(project(doc, catalog).nodes).toEqual([]);
  });
});
