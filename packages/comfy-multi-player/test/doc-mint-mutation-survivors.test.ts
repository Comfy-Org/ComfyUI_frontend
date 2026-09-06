/**
 * Kill tests for the FIRST mutation run over `src/doc.ts` and `src/mint.ts`
 * (MUT-GLOB-KA4-1). Both files were outside `stryker.config.mjs`'s `mutate`
 * glob until this branch, so nothing here had ever been mutation-tested.
 *
 * Every `it` below was verified to fail against a named surviving mutant and to
 * pass against the unmutated tree. The mutate/red/restore transcript is kept
 * OUTSIDE this repository, in the in-app-agent workspace
 * (`reports/audit/mut-glob-ka4.md`), so it is not citable from here; each `it`
 * below names the invariant and the behaviour it pins so the claim can be
 * re-derived by mutating the named line. Historical pointer only:
 * mutate/red/restore transcript. Ordered by the invariant each one defends:
 *
 *  - KA-1 / schema §5.3 — `countDefinitionInstances` counts INTERIOR
 *    instantiations, not just top-level ones. Its whole interior branch
 *    survived every mutant, which means the shared-definition guard was
 *    enforced by half its input.
 *  - KA-4 / KA-1 — `resolveDefinition`'s legacy name fallback and its
 *    ambiguity guard (`count === 1 ? found : null`) had zero coverage; the
 *    ambiguous branch is a determinism hazard, since a Y.Map iteration order
 *    would otherwise decide which definition an interior write lands in.
 *  - KA-3 / KA-11 / schema §1 — the root-map key names and the reserved
 *    per-node opaque-widgets key are the doc's WIRE layout, shared with the
 *    Node doc host and with any second implementation. Four of the seven
 *    (`links`, `definitions`, `__applied`, `__stamps`) could be renamed with
 *    the pre-existing suite fully green, because every reader in this package
 *    goes through the same helper; `nodes` and `meta` reddened 2 and 6 tests
 *    respectively, so the gap was large but not total.
 *  - schema §6 / §4 — mint's structural/bookkeeping key filter.
 *  - schema §5.1 / §7 — interior `node_order` / `link_order`.
 *  - schema §11 — the bounded-writes mutation counter's direction.
 */
import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import {
  OPAQUE_WIDGETS_KEY,
  applyOps,
  linksMap,
  mint,
  nodesMap,
  project,
  type SetWidgetOp,
  type WidgetCatalog,
  type WorkflowJSON,
} from "../src/index.js";
import {
  _getMutationCount,
  _resetMutationCount,
  adel,
  apush,
  countDefinitionInstances,
  definitionsMap,
  mdel,
  metaMap,
  mset,
  resolveDefinition,
} from "../src/doc.js";

const catalog: WidgetCatalog = {
  types: {
    Inner: { widget_order: ["text"] },
    Host: { widget_order: [] },
  },
};

let seq = 0;
const env = () => {
  const op_id = ("g" + String(seq++).padStart(4, "0")).padEnd(32, "0");
  return { op_id, actor: "a", base_version: 1, stamp: [1, "a"] as [number, string] };
};
const bytes = (doc: Y.Doc) => Buffer.from(Y.encodeStateAsUpdate(doc));

// ---------------------------------------------------------------------------
// KA-1 / schema §5.3 — the shared-definition guard counts interior instances
// ---------------------------------------------------------------------------

/**
 * `def-A` is instantiated once at top level (node 100) and, when
 * `nestedInstance` is true, a second time from INSIDE `def-B` (interior node
 * 55). The §5.3 guard must see two instances in the nested case.
 */
function nestedDefsWorkflow(nestedInstance: boolean): WorkflowJSON {
  return {
    nodes: [
      { id: 100, type: "def-A", inputs: [], outputs: [] },
      { id: 200, type: "def-B", inputs: [], outputs: [] },
    ],
    links: [],
    definitions: {
      subgraphs: [
        { id: "def-A", name: "A", nodes: [{ id: 27, type: "Inner", widgets_values: ["orig"] }], links: [] },
        {
          id: "def-B",
          name: "B",
          nodes: nestedInstance ? [{ id: 55, type: "def-A" }] : [{ id: 55, type: "Inner", widgets_values: ["unrelated"] }],
          links: [],
        },
      ],
    },
  } as unknown as WorkflowJSON;
}

const interiorWrite = (): SetWidgetOp =>
  ({
    op: "set_widget",
    ...env(),
    node_id: 100,
    widget: "text",
    path: ["100", "27"],
    inner_widget: "text",
    value: "new",
  }) as SetWidgetOp;

const interiorTextOf = (doc: Y.Doc, defId: string): unknown => {
  const defs = (project(doc, catalog)["definitions"] as {
    subgraphs: { id: string; nodes: { id: unknown; widgets_values: unknown[] }[] }[];
  }).subgraphs;
  return defs.find((d) => d.id === defId)!.nodes[0]!.widgets_values[0];
};

describe("schema §5.3 shared-definition guard counts INTERIOR instances (KA-1)", () => {
  it("counts a definition instantiated from inside another definition", () => {
    expect(countDefinitionInstances(mint(nestedDefsWorkflow(true), catalog), "def-A")).toBe(2);
  });

  it("rejects an interior write to a definition whose SECOND instance is nested inside another definition", () => {
    const doc = mint(nestedDefsWorkflow(true), catalog);
    const before = bytes(doc);
    const res = applyOps(doc, [interiorWrite()], catalog);
    expect(res.outcomes.find((o) => o.outcome === "rejected")?.reason.code).toBe("shared_definition_unforked");
    expect(res.outcomes.filter((o) => o.outcome === "applied").map((o) => o.op_id)).toEqual([]);
    // One op must not mutate N nodes: `def-A` backs both node 100 and def-B's
    // interior node 55, so writing through it would replicate one op into two
    // places (KA-1, ops are the replication unit).
    expect(bytes(doc).equals(before)).toBe(true);
    expect(interiorTextOf(doc, "def-A")).toBe("orig");
  });

  it("applies the same write when the nested node instantiates a DIFFERENT type", () => {
    // Non-vacuity half: without this, a mutant that rejects every interior
    // write in a document that happens to contain two definitions passes too.
    const doc = mint(nestedDefsWorkflow(false), catalog);
    expect(countDefinitionInstances(doc, "def-A")).toBe(1);
    expect(applyOps(doc, [interiorWrite()], catalog).outcomes.some((o) => o.outcome === "rejected")).toBe(false);
    expect(interiorTextOf(doc, "def-A")).toBe("new");
    expect(interiorTextOf(doc, "def-B")).toBe("unrelated");
  });
});

// ---------------------------------------------------------------------------
// KA-1 / schema §5.3 — the guard must count instances the RESOLVER would reach
// ---------------------------------------------------------------------------

/**
 * `resolveDefinition` accepts a definition id OR its unique cosmetic name, so a
 * legacy workflow can address one definition both ways. `countDefinitionInstances`
 * used to match on the id alone, so the pair below counted as ONE instance and
 * the §5.3 guard let an interior write mutate a definition backing two nodes —
 * silently, with `applyOps` reporting success. The guard's input has to use the
 * same notion of "instantiates this definition" the resolver uses.
 */
function aliasedInstancesWorkflow(secondInstanceType: string): WorkflowJSON {
  return {
    nodes: [
      { id: 100, type: "D1", inputs: [], outputs: [] },
      { id: 101, type: secondInstanceType, inputs: [], outputs: [] },
    ],
    links: [],
    definitions: {
      subgraphs: [
        { id: "D1", name: "MySubgraph", nodes: [{ id: 27, type: "Inner", widgets_values: ["orig"] }], links: [] },
        // TWO unrelated definitions, so "is this name unique?" is a real
        // question. One is not enough: with a single other definition, counting
        // the names that MATCH and counting the names that DIFFER both give 1,
        // and the uniqueness test cannot be told from its own negation.
        { id: "D2", name: "Other", nodes: [{ id: 27, type: "Inner", widgets_values: ["other"] }], links: [] },
        { id: "D3", name: "Third", nodes: [{ id: 27, type: "Inner", widgets_values: ["third"] }], links: [] },
      ],
    },
  } as unknown as WorkflowJSON;
}

const aliasWrite = (nodeId: number, value: string): SetWidgetOp =>
  ({
    op: "set_widget",
    ...env(),
    node_id: nodeId,
    widget: "text",
    path: [String(nodeId), "27"],
    inner_widget: "text",
    value,
  }) as SetWidgetOp;

describe("schema §5.3: instances addressed by the definition's NAME count too (KA-1)", () => {
  it("both spellings resolve to the same definition", () => {
    const doc = mint(aliasedInstancesWorkflow("MySubgraph"), catalog);
    expect(idOf(resolveDefinition(doc, "D1"))).toBe("D1");
    expect(idOf(resolveDefinition(doc, "MySubgraph"))).toBe("D1");
  });

  it("counts a node typed by the definition's unique name as an instance", () => {
    // The catalogue is what makes the name answerable: it is an alias only
    // because the catalogue does NOT describe "MySubgraph" as a node class.
    expect(countDefinitionInstances(mint(aliasedInstancesWorkflow("MySubgraph"), catalog), "D1", catalog)).toBe(2);
  });

  it("does NOT treat the name as an alias when the pinned catalogue owns it as a node CLASS", () => {
    // Three shipped cloud-snapshot templates name a definition after the very
    // node class it wraps (`WanMoveTrackToVideo`). Counting the class node as an
    // instance rejects a legal interior write, and says "instantiated 2 times"
    // about a definition instantiated once.
    const classCatalog: WidgetCatalog = {
      types: { ...catalog.types, MySubgraph: { widget_order: [] } },
    };
    const doc = mint(aliasedInstancesWorkflow("MySubgraph"), classCatalog);
    expect(countDefinitionInstances(doc, "D1", classCatalog)).toBe(1);
    expect(applyOps(doc, [aliasWrite(100, "legal")], classCatalog).outcomes.some((o) => o.outcome === "rejected")).toBe(false);
    expect(interiorTextOf(doc, "D1")).toBe("legal");
  });

  it("does NOT treat the name as an alias when there is no catalogue to ask", () => {
    // Unverifiable, so not an alias: the frontend always writes a definition's
    // UUID into an instance `type`, which makes an unverifiable name far more
    // likely to be a class than a legacy instance. The ID half is unaffected.
    const doc = mint(aliasedInstancesWorkflow("MySubgraph"), catalog);
    expect(countDefinitionInstances(doc, "D1")).toBe(1);
    expect(countDefinitionInstances(mint(aliasedInstancesWorkflow("D1"), catalog), "D1")).toBe(2);
  });

  it("rejects an interior write reached through the ID-typed instance when a NAME-typed instance also exists", () => {
    const doc = mint(aliasedInstancesWorkflow("MySubgraph"), catalog);
    const before = bytes(doc);
    const res = applyOps(doc, [aliasWrite(100, "CORRUPTION")], catalog);
    expect(res.outcomes.find((o) => o.outcome === "rejected")?.reason.code).toBe("shared_definition_unforked");
    expect(res.outcomes.filter((o) => o.outcome === "applied").map((o) => o.op_id)).toEqual([]);
    expect(bytes(doc).equals(before)).toBe(true);
    expect(interiorTextOf(doc, "D1")).toBe("orig");
  });

  it("rejects the same write reached through the NAME-typed instance", () => {
    const doc = mint(aliasedInstancesWorkflow("MySubgraph"), catalog);
    const before = bytes(doc);
    const res = applyOps(doc, [aliasWrite(101, "CORRUPTION")], catalog);
    expect(res.outcomes.find((o) => o.outcome === "rejected")?.reason.code).toBe("shared_definition_unforked");
    expect(bytes(doc).equals(before)).toBe(true);
    expect(interiorTextOf(doc, "D1")).toBe("orig");
  });

  it("still applies when the second node instantiates something else entirely", () => {
    // Non-vacuity half: the rejection must come from the aliased instance, not
    // from "there are two nodes".
    const doc = mint(aliasedInstancesWorkflow("SomethingElse"), catalog);
    expect(countDefinitionInstances(doc, "D1")).toBe(1);
    expect(applyOps(doc, [aliasWrite(100, "fine")], catalog).outcomes.some((o) => o.outcome === "rejected")).toBe(false);
    expect(interiorTextOf(doc, "D1")).toBe("fine");
  });

  it("does NOT treat a name as an alias when another definition owns it as an id", () => {
    // `resolveDefinition` gives id priority, so "alpha" addresses the definition
    // whose id is "alpha" — counting it as an instance of `gamma` (which merely
    // carries "alpha" as its name) would over-reject.
    const wf = {
      nodes: [
        { id: 10, type: "alpha", inputs: [], outputs: [] },
        { id: 11, type: "gamma", inputs: [], outputs: [] },
      ],
      links: [],
      definitions: {
        subgraphs: [
          { id: "alpha", name: "beta", nodes: [{ id: 27, type: "Inner", widgets_values: ["a"] }], links: [] },
          { id: "gamma", name: "alpha", nodes: [{ id: 27, type: "Inner", widgets_values: ["g"] }], links: [] },
        ],
      },
    } as unknown as WorkflowJSON;
    const doc = mint(wf, catalog);
    expect(countDefinitionInstances(doc, "gamma")).toBe(1);
    expect(countDefinitionInstances(doc, "alpha")).toBe(1);
    expect(applyOps(doc, [aliasWrite(11, "written")], catalog).outcomes.some((o) => o.outcome === "rejected")).toBe(false);
    expect(interiorTextOf(doc, "gamma")).toBe("written");
    expect(interiorTextOf(doc, "alpha")).toBe("a");
  });

  it("gives the same count whichever spelling it is asked with", () => {
    // The count is a property of the DEFINITION, not of the string used to
    // address it. Asking by id and by name must agree, or the guard's answer
    // depends on how the caller happened to spell the lookup.
    const doc = mint(aliasedInstancesWorkflow("MySubgraph"), catalog);
    expect(countDefinitionInstances(doc, "D1", catalog)).toBe(2);
    expect(countDefinitionInstances(doc, "MySubgraph", catalog)).toBe(2);
  });

  it("THROWS on a nodes entry that is not a Y.Map, rather than skipping it", () => {
    // Skipping would UNDERCOUNT, which makes the §5.3 guard fail OPEN — an
    // interior write that `main` rejected would apply and mutate. Reached
    // through the exported `nodesMap()` and through `Y.applyUpdate` of a
    // snapshot from a non-conforming peer, so it is not merely theoretical.
    const doc = mint(aliasedInstancesWorkflow("SomethingElse"), catalog);
    nodesMap(doc).set("999", "not-a-y-map" as unknown as Y.Map<unknown>);
    expect(() => countDefinitionInstances(doc, "D1", catalog)).toThrow(TypeError);
    expect(() => countDefinitionInstances(doc, "D1", catalog)).toThrow(/not a Y\.Map/);
  });

  it("surfaces that throw as a LOUD rejection that leaves the document untouched", () => {
    // The fail-open version of this counted 1 instead of 2, passed the guard,
    // and wrote. The loud version must reject AND change nothing.
    const doc = mint(aliasedInstancesWorkflow("SomethingElse"), catalog);
    nodesMap(doc).set("999", 7 as unknown as Y.Map<unknown>);
    const before = bytes(doc);
    const res = applyOps(doc, [aliasWrite(100, "MUST_NOT_LAND")], catalog);
    expect(res.outcomes.find((o) => o.outcome === "rejected")?.reason.code).toBe("apply_failed");
    expect(res.outcomes.filter((o) => o.outcome === "applied").map((o) => o.op_id)).toEqual([]);
    expect(res.outcomes.filter((o) => o.outcome !== "rejected").length).toBe(0);
    expect(bytes(doc).equals(before)).toBe(true);
  });

  it("counts nodes claiming a type no definition resolves", () => {
    // `countDefinitionInstances` is exported, so it must answer for an id that
    // resolves to nothing rather than assuming the applier already resolved it.
    const wf = {
      nodes: [{ id: 1, type: "ghost", inputs: [], outputs: [] }],
      links: [],
    } as unknown as WorkflowJSON;
    expect(countDefinitionInstances(mint(wf, catalog), "ghost")).toBe(1);
    expect(countDefinitionInstances(mint(wf, catalog), "absent")).toBe(0);
  });

  it("gives an UNNAMED definition no name alias, so a type-less node is not an instance", () => {
    // A node with no `type` key reads as "", and an unnamed definition's name
    // also reads as "" — they must not be treated as the same thing.
    const wf = {
      nodes: [
        { id: 1, type: "D1", inputs: [], outputs: [] },
        { id: 2, inputs: [], outputs: [] },
      ],
      links: [],
      definitions: {
        subgraphs: [{ id: "D1", nodes: [{ id: 27, type: "Inner", widgets_values: ["orig"] }], links: [] }],
      },
    } as unknown as WorkflowJSON;
    const doc = mint(wf, catalog);
    expect(countDefinitionInstances(doc, "D1")).toBe(1);
    expect(applyOps(doc, [aliasWrite(1, "written")], catalog).outcomes.some((o) => o.outcome === "rejected")).toBe(false);
    expect(interiorTextOf(doc, "D1")).toBe("written");
  });

  it("does NOT treat an AMBIGUOUS name as an alias (it resolves to nothing)", () => {
    const wf = {
      nodes: [
        { id: 10, type: "id-1", inputs: [], outputs: [] },
        { id: 11, type: "shared", inputs: [], outputs: [] },
      ],
      links: [],
      definitions: {
        subgraphs: [
          { id: "id-1", name: "shared", nodes: [{ id: 27, type: "Inner", widgets_values: ["one"] }], links: [] },
          { id: "id-2", name: "shared", nodes: [{ id: 27, type: "Inner", widgets_values: ["two"] }], links: [] },
        ],
      },
    } as unknown as WorkflowJSON;
    const doc = mint(wf, catalog);
    // Node 11 cannot be descended into at all (`not_a_subgraph`), so it is not
    // an instance the resolver can reach and must not inflate the count.
    expect(countDefinitionInstances(doc, "id-1")).toBe(1);
    expect(applyOps(doc, [aliasWrite(10, "written")], catalog).outcomes.some((o) => o.outcome === "rejected")).toBe(false);
    expect(applyOps(doc, [aliasWrite(11, "nope")], catalog).outcomes.find((o) => o.outcome === "rejected")?.reason.code).toBe("not_a_subgraph");
  });
});

// ---------------------------------------------------------------------------
// KA-4 / KA-1 — resolveDefinition: id first, unique name second, ambiguous never
// ---------------------------------------------------------------------------

function namedDefsWorkflow(subgraphs: { id: string; name: string }[]): WorkflowJSON {
  return {
    nodes: subgraphs.map((sg, i) => ({ id: 10 + i, type: sg.id, inputs: [], outputs: [] })),
    links: [],
    definitions: {
      subgraphs: subgraphs.map((sg) => ({
        id: sg.id,
        name: sg.name,
        nodes: [{ id: 27, type: "Inner", widgets_values: [sg.id] }],
        links: [],
      })),
    },
  } as unknown as WorkflowJSON;
}

const idOf = (dm: Y.Map<unknown> | null): unknown => dm?.get("id");

describe("resolveDefinition: id wins, a UNIQUE name is the legacy fallback, an ambiguous name never resolves", () => {
  it("falls back to a unique cosmetic name when the key is not a definition id", () => {
    const doc = mint(namedDefsWorkflow([{ id: "id-1", name: "unique" }]), catalog);
    expect(idOf(resolveDefinition(doc, "unique"))).toBe("id-1");
  });

  it("resolves by id even when a DIFFERENT definition carries that id as its name", () => {
    // `gamma` is named "alpha"; the definition whose *id* is "alpha" must win,
    // so the id lookup cannot be reordered after the name scan.
    const doc = mint(
      namedDefsWorkflow([
        { id: "alpha", name: "beta" },
        { id: "gamma", name: "alpha" },
      ]),
      catalog,
    );
    expect(idOf(resolveDefinition(doc, "alpha"))).toBe("alpha");
    expect(idOf(resolveDefinition(doc, "beta"))).toBe("alpha");
  });

  it("refuses to resolve a name shared by two definitions", () => {
    // Resolving either one would make an interior write land in a
    // Y.Map-iteration-order-dependent definition, which is a KA-4 determinism
    // break, not merely a wrong answer.
    const doc = mint(
      namedDefsWorkflow([
        { id: "id-1", name: "shared" },
        { id: "id-2", name: "shared" },
      ]),
      catalog,
    );
    expect(resolveDefinition(doc, "shared")).toBeNull();
  });

  it("returns null for a key that is neither an id nor any name", () => {
    const doc = mint(namedDefsWorkflow([{ id: "id-1", name: "unique" }]), catalog);
    expect(resolveDefinition(doc, "nope")).toBeNull();
  });

  it("surfaces an unresolvable ambiguous name as not_a_subgraph through applyOps", () => {
    const doc = mint(
      namedDefsWorkflow([
        { id: "id-1", name: "shared" },
        { id: "id-2", name: "shared" },
      ]),
      catalog,
    );
    // Node 10's `type` is "id-1", which resolves by id — descend from a node
    // whose type is the ambiguous NAME instead.
    nodesMap(doc).get("10")!.set("type", "shared");
    const before = bytes(doc);
    const op = { ...interiorWrite(), node_id: 10, path: ["10", "27"] } as SetWidgetOp;
    expect(applyOps(doc, [op], catalog).outcomes.find((o) => o.outcome === "rejected")?.reason.code).toBe("not_a_subgraph");
    expect(bytes(doc).equals(before)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// KA-3 / KA-11 / schema §1 — the doc layout's key names are a wire contract
// ---------------------------------------------------------------------------

describe("schema §1 doc layout: root-map names and the reserved opaque key are pinned (KA-3, KA-11)", () => {
  const layoutWorkflow: WorkflowJSON = {
    nodes: [{ id: 1, type: "Inner", inputs: [], outputs: [], widgets_values: ["v"] }],
    links: [[7, 1, 0, 1, 0, "X"]],
    definitions: { subgraphs: [{ id: "d", name: "D", nodes: [], links: [] }] },
  } as unknown as WorkflowJSON;

  it("stores state under the literal schema §1 root names", () => {
    // Addressed by RAW name, not through nodesMap()/linksMap()/…: every reader
    // in this package goes through those helpers, so a consistent rename is
    // invisible to the rest of the suite while silently breaking the Node doc
    // host and any second implementation reading the same document (KA-3), and
    // doing it without a SCHEMA_VERSION bump is exactly what KA-11 forbids.
    const doc = mint(layoutWorkflow, catalog);
    expect(doc.getMap("nodes").has("1")).toBe(true);
    expect(doc.getMap("links").has("7")).toBe(true);
    expect(doc.getMap("definitions").has("d")).toBe(true);
    expect(doc.getMap("meta").get("schema_version")).toBe(2);
    // The bookkeeping roots are named too — `__applied` is the idempotency
    // gate (§4) and `__stamps` the LWW register file (§3).
    const op = { op: "set_widget", ...env(), node_id: 1, widget: "text", value: "w" } as SetWidgetOp;
    expect(applyOps(doc, [op], catalog).outcomes.some((o) => o.outcome === "rejected")).toBe(false);
    expect(doc.getMap("__applied").has(op.op_id)).toBe(true);
    expect(doc.getMap("__stamps").size).toBe(1);
  });

  it("the helpers address exactly those roots", () => {
    const doc = mint(layoutWorkflow, catalog);
    expect(nodesMap(doc)).toBe(doc.getMap("nodes"));
    expect(linksMap(doc)).toBe(doc.getMap("links"));
    expect(definitionsMap(doc)).toBe(doc.getMap("definitions"));
    expect(metaMap(doc)).toBe(doc.getMap("meta"));
  });

  it("the reserved opaque-widgets key is '__widgets_opaque' and is `__`-prefixed", () => {
    expect(OPAQUE_WIDGETS_KEY).toBe("__widgets_opaque");
    // The `__` prefix is load-bearing: project() drops `__`-prefixed META keys,
    // and mint() refuses to import a workflow key with that prefix.
    expect(OPAQUE_WIDGETS_KEY.startsWith("__")).toBe(true);
    const wf = { nodes: [{ id: 1, type: "Unknown", inputs: [], outputs: [], widgets_values: [1, 2] }], links: [] };
    const doc = mint(wf as unknown as WorkflowJSON, catalog);
    expect(nodesMap(doc).get("1")!.get(OPAQUE_WIDGETS_KEY)).toEqual([1, 2]);
  });
});

// ---------------------------------------------------------------------------
// schema §6 / §4 — mint's structural + bookkeeping key filter
// ---------------------------------------------------------------------------

describe("mint: structural and comfy-cli bookkeeping keys never land in meta (schema §6, §4)", () => {
  it("keeps nodes/links/definitions and _applied_ops/_widget_stamps out of the meta passthrough", () => {
    const wf = {
      nodes: [{ id: 1, type: "Inner", inputs: [], outputs: [], widgets_values: ["v"] }],
      links: [[7, 1, 0, 1, 0, "X"]],
      definitions: { subgraphs: [] },
      _applied_ops: ["stale-op-id"],
      _widget_stamps: { "1:text": [1, "someone"] },
      extra: { keep: true },
    } as unknown as WorkflowJSON;
    const doc = mint(wf, catalog);
    const metaKeys = [...metaMap(doc).keys()].sort();
    // `extra` is real §6 passthrough and must survive; the five filtered keys
    // must not, because a meta copy of `_applied_ops` is a SECOND, stale
    // idempotency record alongside the doc's own `__applied` (§4), and a meta
    // copy of `nodes` is a full-document snapshot inside the document (FC-4).
    expect(metaKeys).toEqual(["__definitions_extra", "catalog_version", "extra", "schema_version"]);
    for (const k of ["nodes", "links", "definitions", "_applied_ops", "_widget_stamps"]) {
      expect(metaMap(doc).has(k), `meta must not carry '${k}'`).toBe(false);
    }
    // …and none of them reappear in the projection.
    const projected = project(doc, catalog);
    expect(projected["_applied_ops"]).toBeUndefined();
    expect(projected["_widget_stamps"]).toBeUndefined();
    expect(projected["extra"]).toEqual({ keep: true });
  });
});

// ---------------------------------------------------------------------------
// schema §5.1 / §7 — interior order registers
// ---------------------------------------------------------------------------

describe("mint: interior nodes and links keep MINT order, not sorted-by-id order (schema §5.1, §7)", () => {
  it("projects interior nodes and links in the order they were minted", () => {
    // Ids deliberately neither ascending nor lexicographically ascending, so a
    // polluted or ignored `node_order`/`link_order` register cannot coincide
    // with the fallback `[...keys()].sort()`.
    const wf = {
      nodes: [],
      links: [],
      definitions: {
        subgraphs: [
          {
            id: "d",
            name: "D",
            nodes: [
              { id: 9, type: "Inner", widgets_values: ["nine"] },
              { id: 3, type: "Inner", widgets_values: ["three"] },
              { id: 20, type: "Inner", widgets_values: ["twenty"] },
            ],
            links: [
              [5, 9, 0, 3, 0, "X"],
              [2, 3, 0, 20, 0, "X"],
            ],
          },
        ],
      },
    } as unknown as WorkflowJSON;
    const sg = (project(mint(wf, catalog), catalog)["definitions"] as {
      subgraphs: { nodes: { id: unknown }[]; links: unknown[][] }[];
    }).subgraphs[0]!;
    expect(sg.nodes.map((n) => n.id)).toEqual([9, 3, 20]);
    expect(sg.links.map((l) => l[0])).toEqual([5, 2]);
  });
});

// ---------------------------------------------------------------------------
// schema §6 — the explicitly-empty subgraphs round trip
// ---------------------------------------------------------------------------

describe("mint: `definitions.subgraphs` round-trips whether it is empty or not (schema §6)", () => {
  it("preserves an explicitly-empty subgraphs array", () => {
    const wf = { nodes: [], links: [], definitions: { subgraphs: [] } } as unknown as WorkflowJSON;
    expect(project(mint(wf, catalog), catalog)["definitions"]).toEqual({ subgraphs: [] });
  });

  it("does not blank a NON-empty subgraphs list, and keeps sibling definitions keys", () => {
    const wf = {
      nodes: [],
      links: [],
      definitions: { subgraphs: [{ id: "d", name: "D", nodes: [], links: [] }], other: 1 },
    } as unknown as WorkflowJSON;
    expect(project(mint(wf, catalog), catalog)["definitions"]).toEqual({
      other: 1,
      subgraphs: [{ id: "d", name: "D", nodes: [], links: [] }],
    });
  });
});

// ---------------------------------------------------------------------------
// schema §11 — the bounded-writes instrumentation must count UP
// ---------------------------------------------------------------------------

describe("schema §11 bounded-writes instrumentation counts up, once per Y operation", () => {
  it("mset/apush/adel/mdel each add exactly one", () => {
    // The §11 conformance test compares `_getMutationCount()` against a ceiling.
    // A helper that decremented would make that check pass no matter how many
    // writes an op performed — a gate structurally incapable of failing, which
    // is the failure mode the workspace's vacuity profile exists to catch
    // (`.agents/checks/vacuity.md`, band A).
    const doc = new Y.Doc();
    const m = doc.getMap<unknown>("m");
    const a = doc.getArray<unknown>("a");
    _resetMutationCount(doc);
    expect(_getMutationCount(doc)).toBe(0);
    mset(m, "k", 1);
    expect(_getMutationCount(doc)).toBe(1);
    apush(a, 1);
    expect(_getMutationCount(doc)).toBe(2);
    apush(a, 2);
    expect(_getMutationCount(doc)).toBe(3);
    adel(a, 0);
    expect(_getMutationCount(doc)).toBe(4);
    mdel(m, "k");
    expect(_getMutationCount(doc)).toBe(5);
  });

  it("keeps mutation counts isolated per document", () => {
    const first = new Y.Doc();
    const second = new Y.Doc();
    _resetMutationCount(first);
    _resetMutationCount(second);

    mset(first.getMap<unknown>("m"), "first", 1);
    mset(second.getMap<unknown>("m"), "second", 2);
    mset(second.getMap<unknown>("m"), "third", 3);

    expect(_getMutationCount(first)).toBe(1);
    expect(_getMutationCount(second)).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// schema §1.2 / §7 — non-conforming node shapes are passed through, not parsed
// ---------------------------------------------------------------------------

describe("createNodeMap tolerates non-conforming node shapes (schema §1.2, §7)", () => {
  it("passes a non-object entry inside inputs/outputs through verbatim", () => {
    const wf = {
      nodes: [{ id: 1, type: "Inner", inputs: [null, "str"], outputs: [], widgets_values: ["v"] }],
      links: [],
    } as unknown as WorkflowJSON;
    const node = project(mint(wf, catalog), catalog).nodes[0]!;
    expect(node["inputs"]).toEqual([null, "str"]);
  });

  it("reads a scalar widgets_values as 'no positional values known', not as a record", () => {
    // comfy-cli `_widgets_as_list`: non-list, non-object → empty. Treating a
    // string as a plain object would key widgets by character index.
    const wf = {
      nodes: [{ id: 1, type: "Inner", inputs: [], outputs: [], widgets_values: "scalar" }],
      links: [],
    } as unknown as WorkflowJSON;
    expect(project(mint(wf, catalog), catalog).nodes[0]!["widgets_values"]).toEqual([]);
  });

  it("passes a non-object flags value through instead of building a nested Y.Map", () => {
    const wf = {
      nodes: [{ id: 1, type: "Inner", inputs: [], outputs: [], flags: 5, widgets_values: ["v"] }],
      links: [],
    } as unknown as WorkflowJSON;
    expect(project(mint(wf, catalog), catalog).nodes[0]!["flags"]).toBe(5);
  });

  it("round-trips a NON-EMPTY flags object through the nested Y.Map", () => {
    // Every existing fixture's `flags` is absent or empty, so `plainToYMap`'s
    // body could be deleted with the suite green.
    const wf = {
      nodes: [
        { id: 1, type: "Inner", inputs: [], outputs: [], flags: { collapsed: true, pinned: 1 }, widgets_values: ["v"] },
      ],
      links: [],
    } as unknown as WorkflowJSON;
    expect(project(mint(wf, catalog), catalog).nodes[0]!["flags"]).toEqual({ collapsed: true, pinned: 1 });
  });
});

// ---------------------------------------------------------------------------
// mint: malformed / partial workflow containers
// ---------------------------------------------------------------------------

describe("mint tolerates partial workflow containers without inventing content", () => {
  it("mints a workflow with no nodes and no links keys as an empty document", () => {
    const doc = mint({} as unknown as WorkflowJSON, catalog);
    const projected = project(doc, catalog);
    expect(projected.nodes).toEqual([]);
    expect(projected.links).toEqual([]);
  });

  it("ignores a non-array definitions.subgraphs instead of minting from it", () => {
    const wf = { nodes: [], links: [], definitions: { subgraphs: "not-an-array" } } as unknown as WorkflowJSON;
    expect(definitionsMap(mint(wf, catalog)).size).toBe(0);
  });

  it("keeps a definitions container that has no subgraphs key exactly as it was", () => {
    // Without this the "explicitly-empty subgraphs" branch can be forced open,
    // inventing a `subgraphs: []` the source workflow never had.
    const wf = { nodes: [], links: [], definitions: { other: 1 } } as unknown as WorkflowJSON;
    expect(project(mint(wf, catalog), catalog)["definitions"]).toEqual({ other: 1 });
  });

  it("counts instances in a definition that carries no nodes key", () => {
    const wf = {
      nodes: [{ id: 1, type: "d-empty", inputs: [], outputs: [] }],
      links: [],
      definitions: { subgraphs: [{ id: "d-empty", name: "E" }] },
    } as unknown as WorkflowJSON;
    expect(countDefinitionInstances(mint(wf, catalog), "d-empty")).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// KA-12 / FC-10 — the doc owns schema_version and catalog_version
// ---------------------------------------------------------------------------

describe("mint: a workflow cannot forge the doc's own meta keys (KA-12, FC-10)", () => {
  it.each([["schema_version", 99], ["catalog_version", "forged-sha"]])(
    "refuses a workflow carrying '%s'",
    (key, value) => {
      const wf = { nodes: [], links: [], [key]: value } as unknown as WorkflowJSON;
      expect(() => mint(wf, catalog)).toThrow(/collides with a reserved doc-meta key/);
    },
  );

  it("refuses a workflow key with the reserved `__` prefix", () => {
    const wf = { nodes: [], links: [], __definitions_extra: {} } as unknown as WorkflowJSON;
    expect(() => mint(wf, catalog)).toThrow(/collides with a reserved doc-meta key/);
  });

  it("records an EMPTY catalog_version when the caller pins none", () => {
    // An unpinned mint must be visibly unpinned — a fabricated-looking default
    // would read as a catalog citation that no catalog backs (FC-10).
    expect(metaMap(mint({ nodes: [], links: [] } as unknown as WorkflowJSON, catalog)).get("catalog_version")).toBe("");
    expect(
      metaMap(mint({ nodes: [], links: [] } as unknown as WorkflowJSON, catalog, "sha-abc")).get("catalog_version"),
    ).toBe("sha-abc");
  });
});
