/**
 * The read-only snapshot surface (`src/read.ts`) — enforcement proofs.
 *
 * Issue #18 removed `export * from "./doc.js"` because reachability, not
 * intent, was the vulnerability: the import that hands you `nodesMap` for a
 * read hands you a live `Y.Map`, and an unstamped `.set()` on it is invisible
 * to ordering (KA-2), to LWW, and to dedupe (KA-4), so the replica diverges
 * with no diagnostic (KA-1, FC-5). Every broken consumer call site was a READ,
 * so the package grew a read surface instead of giving the handles back.
 *
 * The claim that surface makes is mechanical, and this file is where it is
 * paid for:
 *
 *   1. no `Y.AbstractType` is reachable from any return value, at any depth;
 *   2. the returned data is a COPY, not a view onto the document's own
 *      objects — `Y.Map#get` returns the stored reference, so a naive reader
 *      really would be writable, and that is demonstrated here;
 *   3. every returned object/array is deep-frozen, so a write attempt throws;
 *   4. a read never materializes a root on a document that lacks it (a
 *      follower's document before its first frame has none);
 *   5. reads add no bytes to `encodeStateAsUpdate`.
 *
 * Tests 1-3 would pass vacuously against a surface that always returned `{}`,
 * so "reads the document correctly" is asserted first and separately.
 */
import * as Y from "yjs";
import { describe, expect, it } from "vitest";
import {
  appliedOpIds,
  applyOps,
  docCatalogPin,
  hasAppliedOp,
  hasNode,
  mint,
  OPAQUE_WIDGETS_KEY,
  project,
  SchemaVersionError,
  readGraph,
  readMeta,
  readStamps,
  type Op,
  type WorkflowJSON,
} from "../src/index.js";
import * as publicApi from "../src/index.js";
import {
  metaMap,
  nodesMap,
  ROOT_DEFINITIONS,
  ROOT_LINKS,
  ROOT_META,
  ROOT_NODES,
} from "../src/doc.js";
import { loadCatalog } from "./helpers.js";

const catalog = loadCatalog();
const CATALOG_SHA = "0123456789abcdef0123456789abcdef01234567";
const KSAMPLER_ID = 11;
/** A frontend-only class the catalog cannot describe — stored opaquely (§1.2). */
const NOTE_ID = 12;
const SET_WIDGET_OP_ID = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

function fixtureWorkflow(): WorkflowJSON {
  return {
    id: "readonly-surface-fixture",
    last_node_id: NOTE_ID,
    last_link_id: 1,
    nodes: [
      {
        id: KSAMPLER_ID,
        type: "KSampler",
        pos: [40, 60],
        size: [315, 262],
        flags: { collapsed: false },
        order: 0,
        mode: 0,
        inputs: [{ name: "model", type: "MODEL", link: null }],
        outputs: [{ name: "LATENT", type: "LATENT", links: null }],
        properties: { "Node name for S&R": "KSampler" },
        widgets_values: [7, "randomize", 20, 8, "euler", "normal", 1],
      },
      {
        id: NOTE_ID,
        type: "Note",
        pos: [400, 60],
        size: [200, 100],
        flags: {},
        order: 1,
        mode: 0,
        widgets_values: ["a sticky note"],
      },
    ],
    links: [[1, KSAMPLER_ID, 0, NOTE_ID, 0, "LATENT"]],
    groups: [{ title: "g", bounding: [0, 0, 10, 10] }],
    extra: { ds: { scale: 1, offset: [0, 0] } },
  } as unknown as WorkflowJSON;
}

const setWidgetOp: Op = {
  op: "set_widget",
  op_id: SET_WIDGET_OP_ID,
  actor: "alice",
  base_version: 3,
  stamp: [3, "alice"],
  node_id: KSAMPLER_ID,
  widget: "steps",
  value: 30,
} as unknown as Op;

function fixtureDoc(): Y.Doc {
  const doc = mint(fixtureWorkflow(), catalog, CATALOG_SHA);
  const result = applyOps(doc, [setWidgetOp], catalog);
  // The fixture is only useful if the op really landed.
  expect(
    result.outcomes.filter((outcome) => outcome.outcome === "applied").map((outcome) => outcome.op_id),
  ).toContain(SET_WIDGET_OP_ID);
  return doc;
}

/** Every read-surface entry, applied to a document. Adding an export without adding it here fails the classification test below. */
function readSurfaceResults(doc: Y.Doc): [string, unknown][] {
  return [
    ["readGraph(doc)", readGraph(doc)],
    ["readMeta(doc)", readMeta(doc)],
    ["docCatalogPin(doc)", docCatalogPin(doc)],
    ["hasNode(doc, id)", hasNode(doc, KSAMPLER_ID)],
    ["hasAppliedOp(doc, opId)", hasAppliedOp(doc, SET_WIDGET_OP_ID)],
    ["appliedOpIds(doc)", appliedOpIds(doc)],
    ["readStamps(doc)", readStamps(doc)],
  ];
}

/** Depth-bounded walk over a returned structure, yielding `[path, value]` for every reachable value. */
function reachable(root: unknown, label: string): [string, unknown][] {
  const out: [string, unknown][] = [];
  const visit = (value: unknown, path: string, depth: number): void => {
    out.push([path, value]);
    if (depth > 40) throw new Error(`walk exceeded depth 40 at ${path}`);
    if (value === null || typeof value !== "object") return;
    if (Array.isArray(value)) {
      value.forEach((v, i) => visit(v, `${path}[${i}]`, depth + 1));
      return;
    }
    // Reflect, not Object.entries: a getter that returned a live handle must
    // not be able to hide behind enumerability.
    for (const key of Reflect.ownKeys(value)) {
      const desc = Reflect.getOwnPropertyDescriptor(value, key);
      if (desc === undefined) continue;
      const child = "value" in desc ? desc.value : desc.get?.call(value);
      visit(child, `${path}.${String(key)}`, depth + 1);
    }
  };
  visit(root, label, 0);
  return out;
}

describe("read-only surface — it actually reads the document", () => {
  it("readGraph returns the root graph as plain data", () => {
    const snap = readGraph(fixtureDoc());

    expect(Object.keys(snap.nodes).sort()).toEqual([String(KSAMPLER_ID), String(NOTE_ID)]);
    const ks = snap.nodes[String(KSAMPLER_ID)]!;
    expect(ks.type).toBe("KSampler");
    expect(ks.pos).toEqual([40, 60]);
    // Name-keyed widgets (§1.2), with the applied set_widget visible.
    expect(ks.widgets).toEqual({
      seed: 7,
      control_after_generate: "randomize",
      steps: 30,
      cfg: 8,
      sampler_name: "euler",
      scheduler: "normal",
      denoise: 1,
    });
    expect(ks).not.toHaveProperty(OPAQUE_WIDGETS_KEY);

    // A class the catalog cannot describe keeps its widgets_values verbatim.
    const note = snap.nodes[String(NOTE_ID)]!;
    expect(note.type).toBe("Note");
    expect(note[OPAQUE_WIDGETS_KEY]).toEqual(["a sticky note"]);

    expect(snap.links["1"]).toEqual([1, KSAMPLER_ID, 0, NOTE_ID, 0, "LATENT"]);
  });

  it("readMeta returns schema/catalog version and the §6 passthrough keys", () => {
    const meta = readMeta(fixtureDoc());
    expect(meta["schema_version"]).toBe(2);
    expect(meta["catalog_version"]).toBe(CATALOG_SHA);
    expect(meta["groups"]).toEqual([{ title: "g", bounding: [0, 0, 10, 10] }]);
    expect(meta["extra"]).toEqual({ ds: { scale: 1, offset: [0, 0] } });
  });

  it("docCatalogPin returns the pin, and '' when there is none to compare", () => {
    expect(docCatalogPin(fixtureDoc())).toBe(CATALOG_SHA);
    expect(docCatalogPin(mint(fixtureWorkflow(), catalog))).toBe("");
    expect(docCatalogPin(new Y.Doc())).toBe("");
  });

  it("hasNode and hasAppliedOp distinguish present from absent", () => {
    const doc = fixtureDoc();
    expect(hasNode(doc, KSAMPLER_ID)).toBe(true);
    expect(hasNode(doc, String(KSAMPLER_ID))).toBe(true);
    expect(hasNode(doc, 9999)).toBe(false);
    expect(hasAppliedOp(doc, SET_WIDGET_OP_ID)).toBe(true);
    expect(hasAppliedOp(doc, "f".repeat(32))).toBe(false);
  });

  it("appliedOpIds and readStamps expose the §4 ledgers", () => {
    const doc = fixtureDoc();
    expect(appliedOpIds(doc)).toContain(SET_WIDGET_OP_ID);
    const stamps = readStamps(doc);
    const rows = Object.values(stamps);
    expect(rows.length).toBeGreaterThan(0);
    // The stamp row carries [base_version, actor, op_id] — the durable actor
    // attribution a conformance harness compares (KA-2).
    expect(rows).toContainEqual([3, "alice", SET_WIDGET_OP_ID]);
  });
});

describe("read-only surface — no live handle escapes", () => {
  it("returns no Y type anywhere in any result, at any depth", () => {
    const doc = fixtureDoc();
    let visited = 0;
    for (const [label, result] of readSurfaceResults(doc)) {
      for (const [path, value] of reachable(result, label)) {
        visited++;
        expect(
          value instanceof Y.AbstractType,
          `${path} is a live ${value?.constructor?.name ?? "?"}`,
        ).toBe(false);
        expect(value instanceof Y.Doc, `${path} is a live Y.Doc`).toBe(false);
      }
    }
    // Non-vacuity: the walk really did traverse a populated structure.
    expect(visited).toBeGreaterThan(40);
  });

  it("copies rather than aliases — the naive read genuinely WOULD be writable", () => {
    const doc = fixtureDoc();

    // The hazard, demonstrated on the internal accessor: Y.Map#get hands back
    // the SAME object reference stored inside the item, so a "read" that
    // returned it lets the caller edit the document in place, unstamped.
    const liveNote = nodesMap(doc).get(String(NOTE_ID))!;
    const aliased = liveNote.get(OPAQUE_WIDGETS_KEY) as unknown[];
    aliased[0] = "written through a read";
    expect(
      (nodesMap(doc).get(String(NOTE_ID))!.get(OPAQUE_WIDGETS_KEY) as unknown[])[0],
      "the document was edited through a raw read — this is the hazard readGraph closes",
    ).toBe("written through a read");

    // The snapshot surface never hands that reference out.
    const snap = readGraph(doc);
    const snapshotValue = snap.nodes[String(NOTE_ID)]![OPAQUE_WIDGETS_KEY];
    expect(snapshotValue).not.toBe(aliased);
    expect(snapshotValue).toEqual(aliased);
    expect(readMeta(doc)["extra"]).not.toBe(doc.getMap("meta").get("extra"));
  });

  it("preserves __proto__ document keys as own properties", () => {
    const doc = fixtureDoc();
    const hostileNode = new Y.Map<unknown>();
    hostileNode.set("id", "__proto__");
    hostileNode.set("type", "Note");
    hostileNode.set("pos", JSON.parse('{"__proto__":{"polluted":true}}'));
    const hostileWidgets = new Y.Map<unknown>();
    hostileWidgets.set("__proto__", "widget value");
    hostileNode.set("widgets", hostileWidgets);
    nodesMap(doc).set("__proto__", hostileNode);
    doc.getMap<unknown>(ROOT_LINKS).set("__proto__", [1, 2, 3]);

    const graph = readGraph(doc);
    const node = graph.nodes["__proto__"]!;
    const pos = node.pos as Record<string, unknown>;
    const widgets = node.widgets as Record<string, unknown>;
    expect(Object.hasOwn(graph.nodes, "__proto__")).toBe(true);
    expect(Object.hasOwn(graph.links, "__proto__")).toBe(true);
    expect(Object.hasOwn(pos, "__proto__")).toBe(true);
    expect(Object.hasOwn(widgets, "__proto__")).toBe(true);
    expect(Object.getPrototypeOf(graph.nodes)).toBeNull();
    expect(Object.getPrototypeOf(graph.links)).toBeNull();
    expect(Object.getPrototypeOf(pos)).toBeNull();
    expect(Object.getPrototypeOf(widgets)).toBeNull();
    expect((pos as { polluted?: unknown }).polluted).toBeUndefined();
  });
});

describe("read-only surface — a caller cannot mutate the document through it", () => {
  it("every write attempt against a snapshot throws, and the document is unchanged", () => {
    const doc = fixtureDoc();
    const bytesBefore = Buffer.from(Y.encodeStateAsUpdate(doc));
    const projectionBefore = project(doc, catalog);

    const graph = readGraph(doc);
    const meta = readMeta(doc);
    const stamps = readStamps(doc);
    const applied = appliedOpIds(doc);
    const node = graph.nodes[String(KSAMPLER_ID)]! as Record<string, unknown>;

    const attempts: [string, () => void][] = [
      ["replace the nodes record", () => ((graph as unknown as Record<string, unknown>)["nodes"] = {})],
      ["add a node", () => ((graph.nodes as Record<string, unknown>)["999"] = {})],
      ["delete a node", () => delete (graph.nodes as Record<string, unknown>)[String(NOTE_ID)]],
      ["overwrite a node field", () => (node["type"] = "EvilNode")],
      ["delete a node field", () => delete node["type"]],
      ["defineProperty on a node", () => Object.defineProperty(node, "type", { value: "EvilNode" })],
      ["Object.assign onto a node", () => Object.assign(node, { type: "EvilNode" })],
      ["write into pos", () => ((node["pos"] as unknown[])[0] = 999)],
      ["push onto pos", () => (node["pos"] as unknown[]).push(1)],
      ["write a widget value", () => ((node["widgets"] as Record<string, unknown>)["steps"] = 1)],
      ["write a link tuple", () => ((graph.links["1"] as unknown[])[1] = 4242)],
      ["write meta", () => ((meta as Record<string, unknown>)["catalog_version"] = "spoofed")],
      ["write nested meta", () => (((meta["extra"] as Record<string, unknown>)["ds"] as Record<string, unknown>)["scale"] = 99)],
      ["write a stamp row", () => ((stamps as Record<string, unknown>)["nodes/11/widgets/steps"] = [99, "mallory", "z".repeat(32)])],
      ["push onto appliedOpIds", () => (applied as string[]).push("f".repeat(32))],
      ["overwrite an applied op id", () => ((applied as string[])[0] = "f".repeat(32))],
    ];

    for (const [what, attempt] of attempts) {
      expect(attempt, `${what} must throw, not silently no-op`).toThrow(TypeError);
    }

    // Nothing reached the document: not one byte, not one projected value.
    expect(Buffer.from(Y.encodeStateAsUpdate(doc)).equals(bytesBefore)).toBe(true);
    expect(project(doc, catalog)).toEqual(projectionBefore);
    // And a fresh read still sees the original values.
    const after = readGraph(doc);
    expect(after.nodes[String(KSAMPLER_ID)]!.type).toBe("KSampler");
    expect((after.nodes[String(KSAMPLER_ID)]!.widgets as Record<string, unknown>)["steps"]).toBe(30);
    expect(readMeta(doc)["catalog_version"]).toBe(CATALOG_SHA);
  });

  it("every object and array in every result is frozen", () => {
    const doc = fixtureDoc();
    let frozenCount = 0;
    for (const [label, result] of readSurfaceResults(doc)) {
      for (const [path, value] of reachable(result, label)) {
        if (value === null || typeof value !== "object") continue;
        expect(Object.isFrozen(value), `${path} is not frozen`).toBe(true);
        frozenCount++;
      }
    }
    expect(frozenCount).toBeGreaterThan(10);
  });
});

describe("read-only surface — a read is not a write", () => {
  it("never materializes a root on a document that has none", () => {
    // A follower's document between construction and its first doc_update
    // frame is exactly this: no roots at all. `doc.getMap(name)` would CREATE
    // each root it touched.
    const doc = new Y.Doc();
    const bytesBefore = Buffer.from(Y.encodeStateAsUpdate(doc));
    expect(doc.share.size).toBe(0);

    expect(readGraph(doc)).toEqual({ nodes: {}, links: {} });
    expect(readMeta(doc)).toEqual({});
    expect(readStamps(doc)).toEqual({});
    expect(docCatalogPin(doc)).toBe("");
    expect(hasNode(doc, 1)).toBe(false);
    expect(hasAppliedOp(doc, "a".repeat(32))).toBe(false);
    expect(appliedOpIds(doc)).toEqual([]);

    expect([...doc.share.keys()], "a read gave the document roots it never received").toEqual([]);
    expect(Buffer.from(Y.encodeStateAsUpdate(doc)).equals(bytesBefore)).toBe(true);
  });

  it("adds no bytes to a populated document", () => {
    const doc = fixtureDoc();
    const bytesBefore = Buffer.from(Y.encodeStateAsUpdate(doc));
    const sharedBefore = [...doc.share.keys()].sort();
    for (let i = 0; i < 3; i++) readSurfaceResults(doc);
    expect(Buffer.from(Y.encodeStateAsUpdate(doc)).equals(bytesBefore)).toBe(true);
    expect([...doc.share.keys()].sort()).toEqual(sharedBefore);
  });
});

describe("read-only surface — bounded walk", () => {
  it("refuses a value nested past the depth ceiling instead of recursing forever", () => {
    let deep: Record<string, unknown> = { end: true };
    for (let i = 0; i < 80; i++) deep = { next: deep };
    const doc = mint(
      { ...(fixtureWorkflow() as unknown as Record<string, unknown>), deep } as unknown as WorkflowJSON,
      catalog,
      CATALOG_SHA,
    );
    // Matched on the MESSAGE, not just the class: an unbounded walk blows the
    // stack, and "Maximum call stack size exceeded" is also a RangeError — so
    // asserting the class alone would pass with the ceiling deleted.
    expect(() => readMeta(doc)).toThrow(/nests deeper than 64 levels/);
    // A shallow value on the same document still reads.
    expect(docCatalogPin(doc)).toBe(CATALOG_SHA);
  });
});

describe("read-only surface — the KA-11 read gate (#38)", () => {
  /**
   * The defect this block exists for: `project()` grew a schema-version read
   * gate in #60, and a surface that reads the SAME layout by the SAME key
   * names without one is a way AROUND that gate — `readGraph` would hand back
   * v1 key names for a v2 document, which is precisely the KA-11
   * mis-projection #60 refused. A guard a consumer can walk around is
   * decorative.
   *
   * The rule has TWO clauses and both are load-bearing:
   *   1. REFUSE when the document carries content under a schema this package
   *      cannot read;
   *   2. STAY EMPTY when it carries nothing. ADR-004's follower reads a
   *      root-less document before its first frame and there is nothing there
   *      to mis-key. NOT because #30 said so — #30 made `migrate()` REFUSE
   *      that same document, which is a role split (a write may refuse an
   *      incoherent request; a pure read need not) and is the one place this
   *      surface's disposition differs from `project()`'s. Amendment A12.
   *
   * And the content question is asked WITHOUT naming a root, because the §1
   * root names are v1's and renaming them is the canonical `SCHEMA_VERSION`
   * bump trigger — a name-keyed probe is blind to exactly the document the
   * gate exists to refuse.
   *
   * The "document is OLDER than the reader" arm is not constructible at
   * `SCHEMA_VERSION = 1` (there is no v0). It is not re-implemented here: this
   * gate delegates the comparison to `assertReadableSchema`, where #60's
   * `test/schema-version-on-read.test.ts` reaches that arm through
   * `assertSchemaVersionAgainst`.
   */

  /** A document that carries real content, with `meta.schema_version` forced to `version`. */
  function docWithSchemaVersion(version: unknown): Y.Doc {
    const doc = fixtureDoc();
    metaMap(doc).set("schema_version", version);
    return doc;
  }

  /** A document that carries content but makes no readable schema claim at all. */
  function docWithContentAndNoMeta(): Y.Doc {
    const doc = new Y.Doc();
    const node = new Y.Map<unknown>();
    node.set("type", "KSampler");
    nodesMap(doc).set(String(KSAMPLER_ID), node);
    expect(doc.share.has("meta"), "fixture must not carry a meta root").toBe(false);
    return doc;
  }

  const UNREADABLE: [string, () => Y.Doc][] = [
    ["newer than this package", () => docWithSchemaVersion(3)],
    ["not an integer version", () => docWithSchemaVersion("1")],
    ["a zero version", () => docWithSchemaVersion(0)],
    ["absent from a document that has meta", () => {
      const doc = fixtureDoc();
      metaMap(doc).delete("schema_version");
      return doc;
    }],
    ["absent because the document has no meta root", docWithContentAndNoMeta],
  ];

  for (const [what, build] of UNREADABLE) {
    it(`refuses every accessor when the document carries content and its schema is ${what}`, () => {
      const doc = build();
      const bytesBefore = Buffer.from(Y.encodeStateAsUpdate(doc));
      const sharedBefore = [...doc.share.keys()].sort();

      const calls: [string, () => unknown][] = [
        ["readGraph", () => readGraph(doc)],
        ["readMeta", () => readMeta(doc)],
        ["docCatalogPin", () => docCatalogPin(doc)],
        ["hasNode", () => hasNode(doc, KSAMPLER_ID)],
        ["hasAppliedOp", () => hasAppliedOp(doc, SET_WIDGET_OP_ID)],
        ["appliedOpIds", () => appliedOpIds(doc)],
        ["readStamps", () => readStamps(doc)],
      ];
      for (const [name, call] of calls) {
        // Matched on the function's own name in the message, so a gate wired
        // into only ONE accessor cannot pass this by throwing from another.
        expect(call, `${name} must refuse`).toThrow(SchemaVersionError);
        expect(call, `${name} must name itself in the refusal`).toThrow(
          new RegExp(`^${name}: `),
        );
      }

      // The refusal is byte-exact and materializes nothing (KA-11 posture).
      expect(Buffer.from(Y.encodeStateAsUpdate(doc)).equals(bytesBefore)).toBe(true);
      expect([...doc.share.keys()].sort()).toEqual(sharedBefore);
    });

    it(`is not a way around project()'s refusal when the schema is ${what}`, () => {
      // The bypass, stated as an equivalence: whatever project() refuses to
      // read, this surface refuses too. Both arms are asserted, so the test
      // cannot pass because project() silently started accepting.
      const doc = build();
      expect(() => project(doc, catalog)).toThrow(SchemaVersionError);
      expect(() => readGraph(doc)).toThrow(SchemaVersionError);
    });
  }

  it("still reads a document whose schema IS this package's", () => {
    // The positive control: without it every assertion above passes for a
    // surface that refused unconditionally.
    const doc = fixtureDoc();
    expect(readMeta(doc)["schema_version"]).toBe(2);
    expect(Object.keys(readGraph(doc).nodes).sort()).toEqual([
      String(KSAMPLER_ID),
      String(NOTE_ID),
    ]);
    expect(docCatalogPin(doc)).toBe(CATALOG_SHA);
    expect(hasNode(doc, KSAMPLER_ID)).toBe(true);
  });

  it("stays empty for a document that carries nothing — the follower's pre-first-frame doc", () => {
    // Clause 2. This document has no schema claim either, so clause 1 read
    // alone would refuse it. Refusing IS what `migrate()` does for this
    // document (#30), and deliberately not what a read does: see Amendment
    // A12 for the role split and the `project()` disposition divergence.
    const doc = new Y.Doc();
    expect(doc.share.size).toBe(0);

    expect(readGraph(doc)).toEqual({ nodes: {}, links: {} });
    expect(readMeta(doc)).toEqual({});
    expect(readStamps(doc)).toEqual({});
    expect(docCatalogPin(doc)).toBe("");
    expect(hasNode(doc, KSAMPLER_ID)).toBe(false);
    expect(hasAppliedOp(doc, SET_WIDGET_OP_ID)).toBe(false);
    expect(appliedOpIds(doc)).toEqual([]);
    expect([...doc.share.keys()]).toEqual([]);
  });

  it("stays empty when roots exist but are empty — content, not root presence", () => {
    // `Y.Doc#getMap` registers an EMPTY root immediately (the #20 defect), so
    // an unrelated reader elsewhere in the process can put roots on a document
    // that carries nothing. A presence-keyed gate would flip that document
    // from "readable and empty" to "refused"; a content-keyed one does not.
    const doc = new Y.Doc();
    metaMap(doc);
    nodesMap(doc);
    expect([...doc.share.keys()].sort()).toEqual(["meta", "nodes"]);

    expect(readGraph(doc)).toEqual({ nodes: {}, links: {} });
    expect(readMeta(doc)).toEqual({});
    expect(docCatalogPin(doc)).toBe("");
    expect(hasNode(doc, KSAMPLER_ID)).toBe(false);
    expect(appliedOpIds(doc)).toEqual([]);
  });

  it("refuses a v2 document that renamed its roots — the case a name-keyed probe cannot see", () => {
    // THE reason the content probe reads `doc.store` rather than enumerating
    // root names. KA-11 makes the schema §1 root-map NAMES the thing whose
    // change requires a version bump, and `fixtures/golden-vectors/
    // wire-layout.json` says so in as many words — so a v2 that renamed its
    // roots is not an exotic hypothetical, it is the repo's own worked example
    // of what a v2 is. A probe that asks "does `nodes` hold a key" asks in v1
    // vocabulary and calls this document EMPTY.
    //
    // That is worse than a wrong error. On a follower that diffs successive
    // snapshots, an empty graph is not "nothing to draw" — it is "delete every
    // node".
    const v2 = new Y.Doc();
    v2.getMap<unknown>("graph").set("7", new Y.Map<unknown>());
    v2.getMap<unknown>("header").set("schema_version", 2);
    expect(Y.encodeStateAsUpdate(v2).length).toBeGreaterThan(2);
    expect(() => project(v2, catalog)).toThrow(SchemaVersionError);
    expect(() => readGraph(v2)).toThrow(SchemaVersionError);

    // And the same for content under a root no version of this package names.
    const foreign = new Y.Doc();
    foreign.getMap<unknown>("whatever").set("k", 1);
    expect(() => readGraph(foreign)).toThrow(SchemaVersionError);
  });

  it("refuses a document whose content was all deleted — tombstones are not nothing", () => {
    // Everything live is gone, but the structs are there and the document
    // still makes no schema claim. `Y.Map#size` and `keys()` both filter
    // tombstones, so a liveness-keyed probe reads this as empty; the struct
    // store does not.
    const doc = new Y.Doc();
    const nodes = doc.getMap<unknown>(ROOT_NODES);
    nodes.set("1", new Y.Map<unknown>());
    nodes.delete("1");
    expect(nodes.size).toBe(0);
    expect(() => project(doc, catalog)).toThrow(SchemaVersionError);
    expect(() => readGraph(doc)).toThrow(SchemaVersionError);
  });

  it("calls an empty document empty whichever Y type registered its roots", () => {
    // Both of these carry nothing: two bytes, zero structs. The only
    // difference is which accessor some unrelated caller reached for. An
    // earlier probe went through `doc.getMap` and treated the constructor
    // clash from the Y.Array case as CONTENT, so the two disagreed about
    // whether the document was empty — the exact "an unrelated call elsewhere
    // in the process flips the disposition" failure the probe exists to avoid.
    const asMap = new Y.Doc();
    asMap.getMap<unknown>(ROOT_DEFINITIONS);
    const asArray = new Y.Doc();
    asArray.getArray<unknown>(ROOT_DEFINITIONS);
    for (const doc of [asMap, asArray]) {
      expect(Y.encodeStateAsUpdate(doc).length).toBe(2);
      expect(readGraph(doc)).toEqual({ nodes: {}, links: {} });
      expect(readMeta(doc)).toEqual({});
      expect(docCatalogPin(doc)).toBe("");
      expect(hasNode(doc, KSAMPLER_ID)).toBe(false);
    }

    // Scope, because the wording invites the wider reading: this is a claim
    // about the GATE, not about every accessor. A clash on a root an accessor
    // actually reads still throws Yjs's constructor error from `rootMap` —
    // #55's documented posture for a malformed layout, unchanged here.
    const clashOnLinks = new Y.Doc();
    clashOnLinks.getArray<unknown>(ROOT_LINKS);
    expect(() => readGraph(clashOnLinks)).toThrow(/already been defined/);
    expect(docCatalogPin(clashOnLinks)).toBe("");
  });

  it("stays empty for a document holding only structs it cannot integrate", () => {
    // Mid-arrival: a delta whose dependencies have not landed. Yjs buffers it
    // in `store.pendingStructs`, registers the root, and integrates nothing —
    // `encodeStateAsUpdate` is 20 bytes here, not 2, so "carries nothing" is
    // not the same question as "has no bytes". No reader can see a pending
    // struct, so the document really is carrying nothing YET, and a follower
    // in this state needs an empty read rather than a throw.
    const src = new Y.Doc();
    src.transact(() => src.getMap<unknown>(ROOT_META).set("schema_version", 1));
    const sv = Y.encodeStateVector(src);
    src.transact(() => src.getMap<unknown>(ROOT_NODES).set("7", new Y.Map<unknown>()));

    const partial = new Y.Doc();
    Y.applyUpdate(partial, Y.encodeStateAsUpdate(src, sv));
    expect(partial.store.pendingStructs, "fixture must actually be pending").not.toBeNull();
    // `clients.size`, not `.values().every(...)` — the map is EMPTY here, and
    // `every` over an empty list is vacuously true, so the weaker spelling
    // would assert nothing at all.
    expect(partial.store.clients.size, "nothing may have integrated").toBe(0);
    expect([...partial.share.keys()], "but a root IS registered").toEqual([ROOT_NODES]);
    expect(Y.encodeStateAsUpdate(partial).length).toBeGreaterThan(2);

    expect(readGraph(partial)).toEqual({ nodes: {}, links: {} });
    expect(readMeta(partial)).toEqual({});
    expect(hasNode(partial, 7)).toBe(false);
    expect(docCatalogPin(partial)).toBe("");
  });

  it("asks whether the document carries anything WITHOUT touching a root", () => {
    // The content probe reads `doc.store`, never a root, and that is not an
    // implementation detail — a probe that enumerated root NAMES would be
    // asking the question in v1 vocabulary, which is the one vocabulary a v2
    // document is allowed to change (KA-11; `wire-layout.json`). Counting root
    // lookups is how that stays true: a readable document must cost exactly
    // the `meta` read the gate's version check needs, plus the one root the
    // accessor is actually for. A name-keyed probe walks a root first and the
    // count goes to three.
    const doc = fixtureDoc();
    const real = doc.getMap.bind(doc);
    const names: string[] = [];
    doc.getMap = ((name?: string) => {
      names.push(String(name));
      return real(name as string);
    }) as typeof doc.getMap;

    expect(hasNode(doc, KSAMPLER_ID)).toBe(true);
    expect(names, "one meta read for the gate, one nodes read for the answer").toEqual([
      "meta",
      "nodes",
    ]);

    names.length = 0;
    expect(docCatalogPin(doc)).toBe(CATALOG_SHA);
    expect(names).toEqual(["meta", "meta"]);
  });

  it("refuses a malformed root with the SAME error type project() gives it", () => {
    // A root integrated as a different concrete Y type makes `doc.getMap`
    // throw Yjs's constructor-clash `Error`. The content probe runs BEFORE the
    // version check, so letting that escape would make this surface report a
    // generic `Error` for a document `project()` refuses with a typed
    // `SchemaVersionError` — and the typed error is the whole reason
    // `assertReadableSchema` is exported for hosts to lift. The probe treats
    // an untypable root as content instead, so the refusal type matches.
    const doc = new Y.Doc();
    doc.getArray<unknown>("nodes").push([1]);
    metaMap(doc).set("schema_version", 3);
    expect(() => project(doc, catalog)).toThrow(SchemaVersionError);
    expect(() => readGraph(doc)).toThrow(SchemaVersionError);
    expect(() => readStamps(doc)).toThrow(SchemaVersionError);

    // Amendment A3's carve-out is unchanged where it always applied: when the
    // clash is on `meta` ITSELF, both paths surface Yjs's own error, not a
    // SchemaVersionError. Still fail-closed, still a throw, same on both.
    const metaClash = new Y.Doc();
    metaClash.getArray<unknown>("meta").push([1]);
    nodesMap(metaClash).set("1", new Y.Map<unknown>());
    for (const call of [() => project(metaClash, catalog), () => readGraph(metaClash)]) {
      expect(call).toThrow(Error);
      expect(call).not.toThrow(SchemaVersionError);
    }
  });

  it("refuses as soon as ANY root carries content, not just the one being read", () => {
    // `meta` alone, carrying a key that is not a schema claim: the graph is
    // empty, so readGraph would return `{}` and look harmless — but the
    // DOCUMENT is carrying content under a schema nobody has declared, and the
    // next frame could fill `nodes` with a layout this package misreads.
    const doc = new Y.Doc();
    metaMap(doc).set("catalog_version", CATALOG_SHA);
    expect(() => readGraph(doc)).toThrow(SchemaVersionError);
    expect(() => docCatalogPin(doc)).toThrow(SchemaVersionError);

    // And the same for a document carrying ONLY definitions.
    const defsOnly = new Y.Doc();
    defsOnly.getMap<unknown>("definitions").set("d1", new Y.Map<unknown>());
    expect(() => readGraph(defsOnly)).toThrow(SchemaVersionError);
  });
});

describe("read-only surface — classification", () => {
  /**
   * Runtime exports of the entrypoint that are NOT part of the read surface.
   * The point of listing them is that a NEW export lands in neither list and
   * fails this test, forcing whoever adds it to say which it is — and, if it
   * is a read, to bring it under the no-live-handle proofs above.
   */
  const OP_LAYER_AND_TYPES: readonly string[] = [
    "applyOps",
    "inspectOps",
    "project",
    "mint",
    "migrate",
    "SCHEMA_VERSION",
    "OpRejectedError",
    "SchemaVersionError",
    "FROZEN_OPS",
    "DEFERRED_OPS",
    "BATCHABLE_OPS",
    "codePointCompare",
    "compareStampKeys",
    "stampKey",
    "stampTargetKey",
    "writeTarget",
    "assertReadableSchema",
    "readSchemaVersion",
    "nodesMap",
    "linksMap",
    "encodingLosses",
    "MAX_OPS_PER_BATCH",
    "MAX_PAYLOAD_DEPTH",
    "MAX_COLLECTION_ENTRIES",
    "MAX_OP_COST",
    "opBoundsRefusal",
    "NODE_INCARNATION_KEY",
    "LEGACY_NODE_INCARNATION",
    "widgetTargetKey",
    "MAX_LAMPORT_COUNTER",
    "DocDerivedLamportClockStore",
    "observedDocCounter",
    "validateLamportCounter",
    "observeLamport",
    "tickLamport",
    "persistLamportTick",
    "freezeLamportEnvelope",
    "AGENT_EVENT_JSON_SCHEMA",
    "CMP_EVENT_SCHEMA_VERSION",
  ];
  const READ_SURFACE: readonly string[] = [
    "readGraph",
    "readMeta",
    "docCatalogPin",
    "hasNode",
    "hasAppliedOp",
    "appliedOpIds",
    "readStamps",
    "OPAQUE_WIDGETS_KEY",
  ];

  it("classifies every runtime export as op layer/types or read surface", () => {
    const unclassified = Object.keys(publicApi).filter(
      (name) => !OP_LAYER_AND_TYPES.includes(name) && !READ_SURFACE.includes(name),
    );
    expect(unclassified, "new entrypoint exports must be classified here").toEqual([]);
    for (const name of [...OP_LAYER_AND_TYPES, ...READ_SURFACE]) {
      expect(publicApi, `${name} is listed but not exported`).toHaveProperty(name);
    }
  });

  it("covers every read-surface function in the no-live-handle proofs", () => {
    const proved = readSurfaceResults(fixtureDoc()).map(([label]) => label.split("(")[0]!);
    const functions = READ_SURFACE.filter(
      (name) => typeof (publicApi as Record<string, unknown>)[name] === "function",
    );
    expect(proved.sort()).toEqual([...functions].sort());
  });
});
