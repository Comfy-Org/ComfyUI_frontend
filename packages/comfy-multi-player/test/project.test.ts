/**
 * Regression coverage for #13 — invalid or untrusted node input must not crash
 * or corrupt `project()` (KA-3, KA-4, KA-12, FC-8).
 *
 * The fix draws a deliberate line, and both sides are asserted here:
 *
 *  - Untrusted ops never reach the doc at all: `applyOps` rejects a payload
 *    carrying a reserved doc-internal key, or a name-keyed widget write that
 *    could never be projected, BEFORE any mutation. `add_node` and `set_widget`
 *    apply the SAME pair of rules — an asymmetry there just relocates the
 *    poisoning to the laxer op.
 *  - Structurally corrupt doc state is skipped per node, so one bad entry
 *    cannot make the whole document unprojectable. The gate is exactly two
 *    conditions wide — not a `Y.Map`, or a `widgets` slot that is not a
 *    `Y.Map` — because those are the only two states that make projection
 *    THROW. Neither is reachable through `mint`/`applyOps`.
 *  - Everything else a node can carry is READABLE and must project verbatim,
 *    even when it is odd: a mistyped `flags`/`inputs`/`outputs`, a blank or
 *    absent `type`, an `id` disagreeing with its map key. All of those ARE
 *    reachable through this package's own writers, and an earlier draft of the
 *    gate skipped them — which made `project()` silently delete nodes that
 *    `applyOps` had accepted and acknowledged. Those cases are pinned below.
 *  - Catalog-contract violations are NOT skipped. Projecting with a catalog
 *    other than the one the doc pins still throws loudly (KA-12 / schema §3
 *    pin 4); silently dropping nodes there would hide contract drift.
 */
import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import { createNodeMap, initDoc } from "../src/doc.js";
import { applyOps, mint, nodesMap, project, type Op, type WorkflowJSON } from "../src/index.js";
import { loadCatalog } from "./helpers.js";

const catalog = loadCatalog();
const ksamplerOrder = catalog.types.KSampler!.widget_order;

function bytes(doc: Y.Doc): Buffer {
  return Buffer.from(Y.encodeStateAsUpdate(doc));
}

let opSeq = 0;
/** A well-formed stamped envelope; the tests vary only the payload under test. */
function op(fields: Record<string, unknown>): Op {
  opSeq += 1;
  return {
    op_id: `13ff${opSeq.toString(16).padStart(28, "0")}`,
    actor: "test",
    base_version: 0,
    stamp: [0, "test"],
    ...fields,
  } as unknown as Op;
}

describe("project invalid node input", () => {
  it("skips the two entry states that would make projection throw, keeping the rest", () => {
    // `initDoc` rather than a bare `Y.Doc`: `project()` fails closed on a
    // document with no readable `meta.schema_version` (KA-11, #38), and a
    // hand-built document with no meta root is not a document any replica
    // could hold. The invalid NODE state below is the subject of these tests.
    const doc = new Y.Doc();
    initDoc(doc);
    const nodes = nodesMap(doc);
    const valid = createNodeMap({ id: 1, type: "KSampler", widgets_values: [] }, ksamplerOrder);
    const wrongWidgets = createNodeMap({ id: 4, type: "KSampler" }, ksamplerOrder);
    wrongWidgets.set("widgets", "not a map");

    nodes.set("1", valid);
    nodes.set("4", wrongWidgets);
    nodes.set("6", "not a node map" as unknown as Y.Map<unknown>);

    expect(() => project(doc, catalog)).not.toThrow();
    const projected = project(doc, catalog).nodes;
    expect(projected.map((node) => node.id)).toEqual([1]);
    expect(projected[0]).toEqual({ id: 1, type: "KSampler", widgets_values: [] });
  });

  // ---- Blocker-1 regression: the read path must not delete what the write
  // path accepted. Each shape below is produced by THIS PACKAGE's own writers
  // and must survive projection. An earlier draft skipped every one of them.
  it("projects writer-produced nodes whose slots are odd but readable (no silent deletion)", () => {
    const odd: Array<[string, Record<string, unknown>]> = [
      ["flags not an object", { id: 1, type: "KSampler", widgets_values: [], flags: [] }],
      ["inputs not an array", { id: 1, type: "KSampler", widgets_values: [], inputs: {} }],
      ["outputs not an array", { id: 1, type: "KSampler", widgets_values: [], outputs: {} }],
      ["blank type", { id: 1, type: "", widgets_values: [] }],
      ["no type key", { id: 1, widgets_values: [] }],
      ["non-string type", { id: 1, type: 5, widgets_values: [] }],
    ];
    for (const [label, node] of odd) {
      const doc = mint({ nodes: [node], links: [] } as unknown as WorkflowJSON, catalog);
      const projected = project(doc, catalog).nodes;
      expect(projected.length, `${label} was dropped by project()`).toBe(1);
      expect(projected[0], `${label} did not round-trip`).toEqual(node);
    }
  });

  it("keeps a node whose payload id disagrees with its op node_id (applyOps accepted it)", () => {
    const doc = mint({ nodes: [{ id: 1, type: "KSampler", widgets_values: [] }], links: [] }, catalog);
    const result = applyOps(
      doc,
      [op({ op: "add_node", node_id: 5, node: { id: 99, type: "KSampler", widgets_values: [] } })],
      catalog,
    );
    expect(result.outcomes.find((outcome) => outcome.outcome === "rejected")).toBeUndefined();
    expect(result.outcomes.filter((outcome) => outcome.outcome === "applied")).toHaveLength(1);
    // Reported applied => visible on read. Anything else is data loss with a
    // success return, and it also burns node id 5 (add_node's structural
    // idempotency makes the honest retry a silent no-op).
    expect(project(doc, catalog).nodes.map((n) => n.id)).toEqual([1, 99]);
  });

  it("never drops a node that applyOps reported as applied (schema §7 totality)", () => {
    const doc = mint({ nodes: [{ id: 1, type: "KSampler", widgets_values: [] }], links: [] }, catalog);
    const payloads: Record<string, unknown>[] = [
      { id: 10, type: "KSampler", widgets_values: [], flags: [] },
      { id: 11, type: "KSampler", widgets_values: [], inputs: {} },
      { id: 12, widgets_values: [] },
      { id: 13, type: "", widgets_values: [] },
    ];
    for (const node of payloads) {
      const r = applyOps(doc, [op({ op: "add_node", node_id: node["id"], node })], catalog);
      expect(
        r.outcomes.find((outcome) => outcome.outcome === "rejected"),
        `add_node(${String(node["id"])}) was rejected`,
      ).toBeUndefined();
    }
    expect(project(doc, catalog).nodes).toHaveLength(1 + payloads.length);
  });

  it("documents that a skipped entry does not survive a §4 compaction re-mint", () => {
    // The read-path fail-open has a price, and it is permanent: compaction
    // re-mints FROM project(doc), so a skipped entry is absent from the
    // compacted document. Pinned so a future reader cannot mistake the skip
    // for "hidden but recoverable". `initDoc` because `project()` fails closed
    // on an unreadable `meta.schema_version` (KA-11, #38).
    const doc = new Y.Doc();
    initDoc(doc);
    nodesMap(doc).set("1", createNodeMap({ id: 1, type: "KSampler", widgets_values: [] }, ksamplerOrder));
    nodesMap(doc).set("6", "not a node map" as unknown as Y.Map<unknown>);

    const compacted = mint(project(doc, catalog), catalog);
    expect(project(compacted, catalog).nodes.map((n) => n.id)).toEqual([1]);
    expect(nodesMap(compacted).has("6")).toBe(false);
  });

  it("gives projected records a null prototype so a __proto__ field cannot change them", () => {
    // `initDoc` rather than a bare `Y.Doc`: `project()` fails closed on a
    // document with no readable `meta.schema_version` (KA-11, #38), and a
    // hand-built document with no meta root is not a document any replica
    // could hold. The invalid NODE state below is the subject of these tests.
    const doc = new Y.Doc();
    initDoc(doc);
    const maliciousFlags = JSON.parse('{"__proto__":{"inherited":true}}') as Record<string, unknown>;
    nodesMap(doc).set(
      "8",
      createNodeMap({ id: 8, type: "KSampler", flags: maliciousFlags }, ksamplerOrder),
    );

    const node = project(doc, catalog).nodes[0]!;
    const flags = node.flags as Record<string, unknown>;
    expect(Object.getPrototypeOf(node)).toBeNull();
    expect(Object.getPrototypeOf(flags)).toBeNull();
    expect(Object.hasOwn(flags, "__proto__")).toBe(true);
    expect((flags as { inherited?: unknown }).inherited).toBeUndefined();
  });

  it("skips invalid nodes inside subgraph definitions, keeping the valid interior", () => {
    const doc = mint(
      {
        nodes: [],
        links: [],
        definitions: {
          subgraphs: [{ id: "sg", nodes: [{ id: "a", type: "Unknown" }], links: [] }],
        },
      } as unknown as WorkflowJSON,
      catalog,
    );
    const interior = doc.getMap<Y.Map<unknown>>("definitions").get("sg")!.get("nodes") as Y.Map<unknown>;
    interior.set("bad", "not a node map");
    (doc.getMap<Y.Map<unknown>>("definitions").get("sg")! as Y.Map<unknown>).set("node_order", ["a", "bad"]);

    const definitions = project(doc, catalog).definitions as { subgraphs: Array<{ nodes: Array<{ id: unknown }> }> };
    expect(definitions.subgraphs[0]!.nodes.map((n) => n.id)).toEqual(["a"]);
  });

  it("still throws loudly when the pinned catalog does not describe a node's named widgets (KA-12)", () => {
    // NOT a skip: this is catalog drift, and hiding it by dropping the node
    // would let a replica project a silently different workflow. The state is
    // hand-built because `applyOps` now refuses to create it (see the
    // set_widget suite below) — that refusal is what makes a throw here mean
    // catalog drift and nothing else.
    // `initDoc` rather than a bare `Y.Doc`: `project()` fails closed on a
    // document with no readable `meta.schema_version` (KA-11, #38), and a
    // hand-built document with no meta root is not a document any replica
    // could hold. The invalid NODE state below is the subject of these tests.
    const doc = new Y.Doc();
    initDoc(doc);
    const inheritedType = createNodeMap({ id: 7, type: "__proto__" });
    const widgets = new Y.Map<unknown>();
    widgets.set("value", "unsafe");
    inheritedType.set("widgets", widgets);
    nodesMap(doc).set("7", inheritedType);

    expect(() => project(doc, catalog)).toThrow(/'__proto__' has widget values but is not in the pinned catalog/);
  });
});

describe("set_widget applies the same catalog rules as add_node (#13)", () => {
  const base: WorkflowJSON = { nodes: [{ id: 1, type: "KSampler", widgets_values: [] }], links: [] };

  /** Add an uncatalogued-class node (accepted, stored named-and-empty), then try to write a widget to it. */
  function writeTo(nodeType: string, widget: string) {
    const doc = mint(base, catalog);
    const added = applyOps(doc, [op({ op: "add_node", node_id: 5, node: { id: 5, type: nodeType } })], catalog);
    expect(added.outcomes.find((outcome) => outcome.outcome === "rejected")).toBeUndefined();
    const before = bytes(doc);
    const result = applyOps(doc, [op({ op: "set_widget", node_id: 5, widget, value: 7 })], catalog);
    let projects = true;
    try {
      project(doc, catalog);
    } catch {
      projects = false;
    }
    return {
      code: result.outcomes.find((outcome) => outcome.outcome === "rejected")?.reason.code ?? "(accepted)",
      unchanged: bytes(doc).equals(before),
      projects,
    };
  }

  it("refuses a named widget write to a class absent from the pinned catalog", () => {
    // Symmetry with add_node's `uncatalogued_widget_write`. Without this,
    // add_node is stricter than set_widget and the poisoning simply moves to
    // the op that is actually reachable (api-contract-proposal Q4).
    expect(writeTo("SomeCustomNode", "anything")).toEqual({
      code: "uncatalogued_widget_write",
      unchanged: true,
      projects: true,
    });
  });

  it("refuses a widget write to a node typed with an inherited catalog key", () => {
    // Regression: an OWN-property catalog lookup makes `__proto__` read as
    // "absent", which without the rule above turned main's accidental
    // TypeError rejection into an ACCEPTED write that bricked the document.
    for (const inherited of ["__proto__", "constructor", "toString", "valueOf"]) {
      expect(writeTo(inherited, "seed"), inherited).toEqual({
        code: "uncatalogued_widget_write",
        unchanged: true,
        projects: true,
      });
    }
  });

  it("refuses the same write arriving through connect's grow.inputcount bump", () => {
    // `applyInputcountBump` reuses `validateWidgetName`, so the rule has to
    // hold on this route too or the guard is one op-kind wide.
    const doc = mint(
      { nodes: [{ id: 1, type: "KSampler", widgets_values: [], outputs: [{ name: "LATENT", type: "LATENT", links: [] }] }], links: [] } as unknown as WorkflowJSON,
      catalog,
    );
    applyOps(doc, [op({ op: "add_node", node_id: 5, node: { id: 5, type: "__proto__", inputs: [] } })], catalog);
    const beforeConnect = Buffer.from(Y.encodeStateAsUpdate(doc));
    const result = applyOps(
      doc,
      [op({ op: "connect", from_node: 1, from_slot: 0, to_node: 5, link_id: 9, link_type: "LATENT", grow: { name: "image_1", type: "LATENT", inputcount: { widget: "inputcount", value: 2 } } })],
      catalog,
    );
    expect(result.outcomes.find((outcome) => outcome.outcome === "rejected")?.reason.code).toBe(
      "uncatalogued_widget_write",
    );
    // Byte-identity IS asserted now. This comment used to say the opposite:
    // `applyConnect` appended the grown slot before reaching the inputcount
    // bump, so the op mutated and then failed, and #31 correctly declined to
    // pin a property the path did not have, deferring it to #34/#59. #34
    // hoisted `validateWidgetName` above the slot append, so the property
    // holds and is worth pinning here rather than only in #34's own file —
    // this is the test that would notice if the hoist were ever reverted for
    // the `uncatalogued_widget_write` route specifically.
    expect(Buffer.from(Y.encodeStateAsUpdate(doc)).equals(beforeConnect)).toBe(true);
    // And, as before, the write does not land and the document stays readable:
    expect(project(doc, catalog).nodes.map((n) => n.id)).toEqual([1, 5]);
    expect(project(doc, catalog).nodes[1]!.widgets_values).toBeUndefined();
  });

  it("applies the same refusal to an INTERIOR write (schema §5.3)", () => {
    // An interior node projects through projectDefinition -> projectNode ->
    // widgetsToPositional, so an uncatalogued named write poisons the document
    // exactly as it does at top level. Without the check the interior arm
    // falls through its `if (entry)` block and accepts the write.
    const doc = mint(
      {
        nodes: [{ id: 1, type: "sg", widgets_values: [] }],
        links: [],
        definitions: { subgraphs: [{ id: "sg", nodes: [{ id: "a", type: "TotallyUnknownClass" }], links: [] }] },
      } as unknown as WorkflowJSON,
      catalog,
    );
    const before = bytes(doc);
    const result = applyOps(
      doc,
      [op({ op: "set_widget", node_id: 1, path: [1, "a"], inner_widget: "anything", value: 3 })],
      catalog,
    );
    expect(result.outcomes.find((outcome) => outcome.outcome === "rejected")?.reason.code).toBe(
      "uncatalogued_widget_write",
    );
    expect(bytes(doc).equals(before)).toBe(true);
    expect(() => project(doc, catalog)).not.toThrow();
  });

  it("still accepts a widget write to a catalogued class", () => {
    const doc = mint(base, catalog);
    const result = applyOps(doc, [op({ op: "set_widget", node_id: 1, widget: ksamplerOrder[0]!, value: 42 })], catalog);
    expect(result.outcomes.find((outcome) => outcome.outcome === "rejected")).toBeUndefined();
    expect(project(doc, catalog).nodes[0]!.widgets_values).toEqual([42]);
  });

  it("still skips validation entirely when there is no catalog at all", () => {
    // "No catalog" is not "class unknown": the host cannot tell the two apart,
    // and add_node draws the same line (`catalog_required` only for a
    // positional payload it would have to decompose).
    const doc = mint(base, catalog);
    const result = applyOps(doc, [op({ op: "set_widget", node_id: 1, widget: "whatever", value: 1 })]);
    expect(result.outcomes.find((outcome) => outcome.outcome === "rejected")).toBeUndefined();
  });
});

describe("applyOps rejects untrusted node payloads before mutation (#13)", () => {
  const base: WorkflowJSON = { nodes: [{ id: 1, type: "KSampler", widgets_values: [] }], links: [] };

  function reject(node: unknown, node_id: number): { code: string; unchanged: boolean; projects: boolean } {
    const doc = mint(base, catalog);
    const before = bytes(doc);
    const op = {
      op: "add_node",
      op_id: node_id.toString(16).padStart(32, "0"),
      actor: "attacker",
      base_version: 0,
      stamp: [0, "attacker"],
      node_id,
      class_type: (node as { type?: unknown })?.type,
      pos: [0, 0],
      node,
    } as unknown as Op;
    const result = applyOps(doc, [op], catalog);
    expect(result.outcomes.filter((outcome) => outcome.outcome === "applied")).toEqual([]);
    let projects = true;
    try {
      project(doc, catalog);
    } catch {
      projects = false;
    }
    return {
      code: result.outcomes.find((outcome) => outcome.outcome === "rejected")?.reason.code ?? "(accepted)",
      unchanged: bytes(doc).equals(before),
      projects,
    };
  }

  it("rejects a payload carrying the reserved doc-internal 'widgets' key", () => {
    expect(reject({ id: 13, type: "KSampler", widgets: "not-a-y-map", widgets_values: [] }, 13)).toEqual({
      code: "invalid_node_payload",
      unchanged: true,
      projects: true,
    });
  });

  it("rejects a payload carrying the reserved opaque-widgets key", () => {
    expect(reject({ id: 13, type: "KSampler", __widgets_opaque: ["x"] }, 13)).toEqual({
      code: "invalid_node_payload",
      unchanged: true,
      projects: true,
    });
  });

  it("rejects named widgets_values for a class the pinned catalog does not describe", () => {
    expect(reject({ id: 14, type: "__proto__", widgets_values: { payload: "x" } }, 14)).toEqual({
      code: "uncatalogued_widget_write",
      unchanged: true,
      projects: true,
    });
  });

  it("rejects a named widget that is not in the type's widget_order", () => {
    expect(reject({ id: 15, type: "KSampler", widgets_values: { not_a_widget: 1 } }, 15)).toEqual({
      code: "unknown_widget",
      unchanged: true,
      projects: true,
    });
  });

  it("still accepts a positional widgets_values array for an uncatalogued class (opaque storage)", () => {
    const doc = mint(base, catalog);
    const op = {
      op: "add_node",
      op_id: "a".repeat(32),
      actor: "author",
      base_version: 0,
      stamp: [0, "author"],
      node_id: 16,
      class_type: "Note",
      pos: [0, 0],
      node: { id: 16, type: "Note", widgets_values: ["verbatim", null] },
    } as unknown as Op;

    expect(
      applyOps(doc, [op], catalog).outcomes.find((outcome) => outcome.outcome === "rejected"),
    ).toBeUndefined();
    expect(project(doc, catalog).nodes.find((n) => n.id === 16)).toEqual({
      id: 16,
      type: "Note",
      widgets_values: ["verbatim", null],
    });
  });
});
