// Fresh-checkpoint compaction (schema §4 rule 2; ADR 029 risk 3, proof item 4).
//
// `compact` must (a) remove the two unbounded growth terms the growth matrix
// pins — the `__applied` ledger and Yjs tombstone history — while (b) keeping
// every semantic the applier reads across the epoch boundary: projection,
// live LWW stamps, node incarnations, link state, the Lamport floor, and the
// pinned catalog. Each test here targets one way a naive `mint(project(doc))`
// gets (b) wrong.
import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import {
  applyOps,
  compact,
  docCatalogPin,
  hasAppliedOp,
  mint,
  project,
  readApplied,
  readLinkState,
  readMeta,
  readStamps,
  type Op,
  type WidgetCatalog,
  type WorkflowJSON,
  type WorkflowNode,
} from "../src/index.js";
import { DocDerivedLamportClockStore, observedDocCounter } from "../src/clock.js";
import { LINK_STATE_DESCRIPTOR_VERSION } from "../src/types.js";
import {
  ROOT_CLOCK_RESERVATIONS,
  definitionsMap,
  linkStateMap,
  metaMap,
  nodeIncarnation,
  nodesMap,
} from "../src/doc.js";
import { CATALOG, ksamplerNode, opId, workflow } from "../scripts/growth-matrix.mjs";
import { canonicalize, loadCatalog, loadSession, sessionFiles } from "./helpers.js";

const catalog = CATALOG as WidgetCatalog;

function envelope(i: number, actor = "actor-a") {
  return { op_id: opId(i), actor, base_version: i + 1, stamp: [i + 1, actor] as [number, string] };
}

function setSteps(i: number, nodeId: number, value: number, incarnation?: string): Op {
  return {
    op: "set_widget",
    ...envelope(i),
    node_id: nodeId,
    ...(incarnation === undefined ? {} : { node_incarnation: incarnation }),
    widget: "steps",
    value,
  } as Op;
}

function churned(opCount: number): { doc: Y.Doc; last: number } {
  const doc = mint(workflow(4) as WorkflowJSON, catalog, "pin-a");
  const ops: Op[] = [];
  for (let i = 0; i < opCount; i++) ops.push(setSteps(i, 1, 20 + i));
  const result = applyOps(doc, ops, catalog);
  expect(result.outcomes.every((o) => o.outcome === "applied")).toBe(true);
  return { doc, last: 20 + opCount - 1 };
}

function steps(doc: Y.Doc, nodeId: number): unknown {
  const node = project(doc, catalog).nodes.find((n) => n.id === nodeId)!;
  const values = node.widgets_values;
  if (!Array.isArray(values)) throw new TypeError(`node ${nodeId} has non-positional widget values`);
  return values[2];
}

function encodedBytes(doc: Y.Doc): number {
  return Y.encodeStateAsUpdate(doc).byteLength;
}

describe("compact: projection and pins survive", () => {
  it("projects identically to the source for every fixture session", () => {
    const fixtureCatalog = loadCatalog();
    for (const file of sessionFiles()) {
      const session = loadSession(file);
      const doc = mint(session.header.base_workflow, fixtureCatalog, "fixture-pin");
      applyOps(doc, session.ops, fixtureCatalog);
      const compacted = compact(doc, fixtureCatalog);
      expect(canonicalize(project(compacted, fixtureCatalog)), file).toEqual(
        canonicalize(project(doc, fixtureCatalog)),
      );
      expect(readMeta(compacted), file).toEqual(readMeta(doc));
      expect(readLinkState(compacted), file).toEqual(readLinkState(doc));
      expect(docCatalogPin(compacted), file).toBe("fixture-pin");
    }
  });

  it("does not mutate the source document", () => {
    const { doc } = churned(20);
    const before = Y.encodeStateAsUpdate(doc);
    compact(doc, catalog);
    expect(Y.encodeStateAsUpdate(doc)).toEqual(before);
  });
});

describe("compact: removes the unbounded growth terms", () => {
  it("empties the __applied ledger", () => {
    const { doc } = churned(50);
    const compacted = compact(doc, catalog);
    expect(Object.keys(readApplied(doc))).toHaveLength(50);
    expect(readApplied(compacted)).toEqual({});
    expect(hasAppliedOp(compacted, opId(0))).toBe(false);
  });

  it("shrinks encoded state after single-target churn while keeping the live value", () => {
    const { doc, last } = churned(200);
    const compacted = compact(doc, catalog);
    expect(steps(compacted, 1)).toBe(last);
    // 200 ops × (~100 B applied row + ~40 B tombstoned value) dwarf one KSampler.
    expect(encodedBytes(compacted)).toBeLessThan(encodedBytes(doc) / 2);
  });
});

describe("compact: carries LWW state so replays converge the same way", () => {
  it("keeps the winning stamp per live target, so an older replayed write still loses", () => {
    const { doc, last } = churned(30);
    const compacted = compact(doc, catalog);
    const target = JSON.stringify(["widget", "1", "0", "steps"]);
    expect(readStamps(compacted)[target]).toEqual(readStamps(doc)[target]);

    // Same op_id as op 3 — the empty ledger no longer dedupes it, so only the
    // stamp gate can reject it. Value must not regress to 23.
    const replay = setSteps(3, 1, 23);
    applyOps(compacted, [replay], catalog);
    expect(steps(compacted, 1)).toBe(last);

    // A brand-new op with an older counter loses the same way.
    const stale = { ...setSteps(2, 1, 7), op_id: opId(9999) } as Op;
    applyOps(compacted, [stale], catalog);
    expect(steps(compacted, 1)).toBe(last);

    // A newer counter wins, proving the gate is the stamp and not a frozen doc.
    applyOps(compacted, [setSteps(500, 1, 1234)], catalog);
    expect(steps(compacted, 1)).toBe(1234);
  });

  it("converges in both arrival orders and stays idempotent after compaction", () => {
    const { doc, last } = churned(5);
    const a = compact(doc, catalog);
    const b = compact(doc, catalog);
    // Competing writes to one live target: counters 100 (actor-a) and 100
    // (actor-b) tie on counter and fall through to the actor tiebreak.
    const fromA = { ...setSteps(100, 1, 111), op_id: opId(8001) } as Op;
    const fromB = { ...setSteps(100, 1, 222), ...envelope(100, "actor-b"), op_id: opId(8002) } as Op;
    applyOps(a, [fromA], catalog);
    applyOps(a, [fromB], catalog);
    applyOps(b, [fromB], catalog);
    applyOps(b, [fromA], catalog);
    expect(canonicalize(project(a, catalog))).toEqual(canonicalize(project(b, catalog)));
    expect(steps(a, 1)).not.toBe(last);
    expect(readStamps(a)).toEqual(readStamps(b));

    // Double delivery of one op on the compacted lineage: the second copy is
    // deduped by the fresh ledger and changes nothing.
    const before = Y.encodeStateAsUpdate(a).byteLength;
    const twice = applyOps(a, [fromA], catalog);
    expect(twice.outcomes[0]!.outcome).toBe("no-op");
    expect(canonicalize(project(a, catalog))).toEqual(canonicalize(project(b, catalog)));
    expect(Y.encodeStateAsUpdate(a).byteLength).toBe(before);
  });

  it("drops widget stamps of a deleted node but keeps its node stamp (FC-8)", () => {
    const doc = mint(workflow(4) as WorkflowJSON, catalog, "pin-a");
    applyOps(doc, [setSteps(0, 2, 99)], catalog);
    const del: Op = {
      op: "delete_node",
      ...envelope(1),
      node_id: 2,
      removed_links: [2, 3],
    } as Op;
    const result = applyOps(doc, [del], catalog);
    expect(result.outcomes[0]!.outcome).toBe("applied");

    const compacted = compact(doc, catalog);
    const stamps = readStamps(compacted);
    expect(stamps[JSON.stringify(["widget", "2", "0", "steps"])]).toBeUndefined();
    expect(stamps[JSON.stringify(["node", "2"])]).toEqual(readStamps(doc)[JSON.stringify(["node", "2"])]);

    // The stale concurrent re-add (counter 1 < the delete's 2) must lose on the
    // compacted replica exactly as it does on the source.
    const node = ksamplerNode(2) as WorkflowNode;
    const staleAdd = {
      op: "add_node",
      ...envelope(0, "actor-b"),
      op_id: opId(7777),
      node_id: 2,
      class_type: "KSampler",
      pos: [0, 0],
      node,
    } as Op;
    applyOps(compacted, [staleAdd], catalog);
    applyOps(doc, [staleAdd], catalog);
    expect(project(compacted, catalog).nodes.map((n) => n.id)).toEqual(
      project(doc, catalog).nodes.map((n) => n.id),
    );
    expect(project(compacted, catalog).nodes.some((n) => n.id === 2)).toBe(false);
  });

  it("carries node incarnations, so a live incarnation-stamped write still applies", () => {
    const doc = mint(workflow(2) as WorkflowJSON, catalog, "pin-a");
    const node = ksamplerNode(9) as WorkflowNode;
    const add = {
      op: "add_node",
      ...envelope(0),
      node_incarnation: "life-2",
      node_id: 9,
      class_type: "KSampler",
      pos: [0, 0],
      node,
    } as Op;
    expect(applyOps(doc, [add], catalog).outcomes[0]!.outcome).toBe("applied");
    expect(nodeIncarnation(nodesMap(doc).get("9")!)).toBe("life-2");

    const naive = mint(project(doc, catalog), catalog, "pin-a");
    const compacted = compact(doc, catalog);
    expect(nodeIncarnation(nodesMap(naive).get("9")!)).toBe("0");
    expect(nodeIncarnation(nodesMap(compacted).get("9")!)).toBe("life-2");

    const write = setSteps(1, 9, 77, "life-2");
    applyOps(naive, [write], catalog);
    applyOps(compacted, [write], catalog);
    expect(steps(naive, 9)).not.toBe(77); // the naive re-mint silently loses the agent's write
    expect(steps(compacted, 9)).toBe(77);
  });
});

describe("compact: carries host bookkeeping the projection cannot express", () => {
  it("does not create a clock-reservation root the source lacks", () => {
    const { doc } = churned(3);
    expect(doc.share.has(ROOT_CLOCK_RESERVATIONS)).toBe(false);
    const compacted = compact(doc, catalog);
    expect(compacted.share.has(ROOT_CLOCK_RESERVATIONS)).toBe(false);
    expect(observedDocCounter(compacted)).toBe(observedDocCounter(doc));
  });

  it("carries clock reservations so the Lamport floor never regresses", async () => {
    const { doc } = churned(3);
    const store = new DocDerivedLamportClockStore(doc);
    await store.transaction(
      { workflow_id: "wf", lineage_id: "lin", producer_id: "agent:a" },
      async (floor) => ({ counter: (floor ?? 0) + 1000, value: undefined }),
    );
    const floor = observedDocCounter(doc)!;
    expect(floor).toBeGreaterThanOrEqual(1003);

    const compacted = compact(doc, catalog);
    expect(compacted.getMap(ROOT_CLOCK_RESERVATIONS).toJSON()).toEqual(
      doc.getMap(ROOT_CLOCK_RESERVATIONS).toJSON(),
    );
    expect(observedDocCounter(compacted)).toBe(floor);
  });

  it("carries a stranded link-state descriptor the projection dropped (schema §4 rule 2)", () => {
    const { doc } = churned(2);
    // A well-formed imported descriptor (shape per readLinkState) for a link
    // no node wire references, so the projection cannot reconstruct it.
    const stranded = {
      version: LINK_STATE_DESCRIPTOR_VERSION,
      authority: "imported",
      tuple: [424242, 4, 0, 1, 0, "LATENT"],
      destination: { kind: "concrete", to_slot: 0, slot: { name: "samples", type: "LATENT", link: 424242 } },
    };
    expect(readLinkState(doc)["424242"]).toBeUndefined();
    doc.transact(() => linkStateMap(doc).set("424242", stranded));
    const compacted = compact(doc, catalog);
    expect(readLinkState(compacted)["424242"]).toEqual(readLinkState(doc)["424242"]);
    expect(readLinkState(compacted)).toEqual(readLinkState(doc));
  });

  it("carries definition internals and interior incarnations for the subgraph session", () => {
    const fixtureCatalog = loadCatalog();
    const session = loadSession("session-subgraph.session.jsonl");
    const doc = mint(session.header.base_workflow, fixtureCatalog, "fixture-pin");
    applyOps(doc, session.ops, fixtureCatalog);
    const compacted = compact(doc, fixtureCatalog);
    expect(definitionsMap(compacted).toJSON()).toEqual(definitionsMap(doc).toJSON());
    expect(Object.keys(definitionsMap(compacted).toJSON()).length).toBeGreaterThan(0);
    // Definition-level bookkeeping (digests when define_subgraph ran, else absent)
    // must round-trip byte-for-byte rather than be re-derived.
    expect(metaMap(compacted).get("__definition_digests")).toEqual(metaMap(doc).get("__definition_digests"));
  });
});

describe("compact: determinism and refusal", () => {
  it("two compactions of one source are structurally identical", () => {
    const { doc } = churned(10);
    const a = compact(doc, catalog);
    const b = compact(doc, catalog);
    expect(project(a, catalog)).toEqual(project(b, catalog));
    expect(readStamps(a)).toEqual(readStamps(b));
    expect(readLinkState(a)).toEqual(readLinkState(b));
    expect(readMeta(a)).toEqual(readMeta(b));
    expect(nodesMap(a).toJSON()).toEqual(nodesMap(b).toJSON());
  });

  it("refuses a document whose schema it cannot read (KA-11)", () => {
    const { doc } = churned(1);
    doc.transact(() => metaMap(doc).set("schema_version", "1"));
    expect(() => compact(doc, catalog)).toThrow(/compact/);
  });
});
