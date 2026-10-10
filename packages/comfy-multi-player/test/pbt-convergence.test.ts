/** Property coverage for KA-4: legal causal permutations and retries converge. */
import * as fc from "fast-check";
import * as Y from "yjs";
import { describe, expect, it } from "vitest";
import { applyOps, mint, project, type Op, type WorkflowNode } from "../src/index.js";
import { loadCatalog } from "./helpers.js";

const catalog = loadCatalog();
const FC_OPTIONS = { seed: 0x24c0ffee, numRuns: 100 } as const;

interface Scenario {
  actors: number;
  nodes: number;
  versions: number[];
  values: number[];
  orderKeys: number[];
  deleteMask: boolean[];
  clear: boolean;
  batchSizes: number[];
  retryMask: boolean[];
}

interface Coverage {
  runs: number;
  deletes: number;
  clears: number;
  retries: number;
  permutations: number;
}

const scenarioArb: fc.Arbitrary<Scenario> = fc.record({
  actors: fc.integer({ min: 1, max: 4 }),
  nodes: fc.integer({ min: 2, max: 8 }),
  versions: fc.array(fc.integer({ min: 0, max: 20 }), { minLength: 32, maxLength: 32 }),
  values: fc.array(fc.integer(), { minLength: 16, maxLength: 16 }),
  orderKeys: fc.array(fc.integer(), { minLength: 64, maxLength: 64 }),
  deleteMask: fc.array(fc.boolean(), { minLength: 8, maxLength: 8 }),
  clear: fc.boolean(),
  batchSizes: fc.array(fc.integer({ min: 1, max: 5 }), { minLength: 1, maxLength: 12 }),
  retryMask: fc.array(fc.boolean(), { minLength: 64, maxLength: 64 }),
});

function node(id: number): WorkflowNode {
  return {
    id,
    type: "KSampler",
    pos: [id, id],
    inputs: [
      { name: "model", type: "MODEL", link: null },
      { name: "positive", type: "CONDITIONING", link: null },
    ],
    outputs: [{ name: "LATENT", type: "LATENT", links: [] }],
    widgets_values: [0, "fixed", 20],
  };
}

function envelope(index: number, scenario: Scenario) {
  const actor = `agent:pbt:${index % scenario.actors}`;
  const base_version = scenario.versions[index % scenario.versions.length]!;
  return {
    op_id: index.toString(16).padStart(32, "0"),
    actor,
    base_version,
    stamp: [base_version, actor] as [number, string],
  };
}

/** Build causal phases. Ops inside each phase touch disjoint targets and may be permuted. */
function phases(s: Scenario): Op[][] {
  let serial = 1;
  const ids = Array.from({ length: s.nodes }, (_, i) => 1000 + i);
  const adds = ids.map((id) => ({
    ...envelope(serial++, s),
    op: "add_node" as const,
    node_id: id,
    class_type: "KSampler",
    pos: [id, id],
    node: node(id),
  }));
  const writes = ids.map((id, i) => ({
    ...envelope(serial++, s),
    op: "set_widget" as const,
    node_id: id,
    widget: "steps",
    value: s.values[i % s.values.length],
  }));
  // Pairwise-disjoint endpoints avoid output-link array arrival-order artifacts.
  const connects = Array.from({ length: Math.floor(ids.length / 2) }, (_, i) => ({
    ...envelope(serial++, s),
    op: "connect" as const,
    link_id: 5000 + i,
    from_node: ids[i * 2]!,
    from_slot: 0,
    to_node: ids[i * 2 + 1]!,
    to_slot: 1,
    link_type: "LATENT",
  }));
  const deletes = ids
    .filter((_id, i) => s.deleteMask[i] && i % 2 === 0)
    .map((id, i) => ({
      ...envelope(serial++, s),
      op: "delete_node" as const,
      node_id: id,
      removed_links: connects
        .filter((op) => op.from_node === id || op.to_node === id)
        .map((op) => op.link_id),
    }));
  const out: Op[][] = [adds, writes, connects, deletes];
  if (s.clear) {
    out.push([
      { ...envelope(serial++, s), op: "clear", removed_nodes: ids } as Op,
    ]);
  }
  return out.filter((phase) => phase.length > 0);
}

function ordered(phasesToOrder: Op[][], keys: number[]): Op[] {
  let offset = 0;
  return phasesToOrder.flatMap((phase) => {
    const keyed = phase.map((op, i) => ({ op, key: keys[(offset + i) % keys.length]! }));
    offset += phase.length;
    return keyed.sort((a, b) => a.key - b.key || a.op.op_id.localeCompare(b.op.op_id)).map(({ op }) => op);
  });
}

/**
 * Duplicate ops two ways: immediately after the original (adjacent retry) and,
 * for a deterministic subset, appended at the very end of the stream (delayed
 * retry that lands after later ops and across batch boundaries). Every
 * duplicate must be an idempotent no-op regardless of when it arrives.
 */
function withRetries(ops: Op[], mask: boolean[]): Op[] {
  const adjacent = ops.flatMap((op, i) => (mask[i % mask.length] ? [op, op] : [op]));
  const delayed = ops.filter((_op, i) => mask[(i + 1) % mask.length]);
  return [...adjacent, ...delayed];
}

function assertNonVacuous(coverage: Coverage): void {
  expect(coverage.runs).toBe(FC_OPTIONS.numRuns);
  expect(coverage.deletes, "no generated operation stream included delete_node").toBeGreaterThan(0);
  expect(coverage.clears, "no generated operation stream included clear").toBeGreaterThan(0);
  expect(coverage.retries, "no stream passed to applyOps contained a duplicate retry").toBeGreaterThan(0);
  expect(coverage.permutations, "no applied permutation differed from forward order").toBeGreaterThan(0);
}

function applyInBatches(doc: Y.Doc, ops: Op[], sizes: number[]): ReturnType<typeof applyOps>["outcomes"] {
  let cursor = 0;
  let batch = 0;
  const outcomes: ReturnType<typeof applyOps>["outcomes"] = [];
  while (cursor < ops.length) {
    const size = sizes[batch++ % sizes.length]!;
    const result = applyOps(doc, ops.slice(cursor, cursor + size), catalog);
    expect(result.outcomes.find((outcome) => outcome.outcome === "rejected")).toBeUndefined();
    outcomes.push(...result.outcomes);
    cursor += size;
  }
  return outcomes;
}

function assertRetriesAreNoOps(ops: Op[], outcomes: ReturnType<typeof applyOps>["outcomes"]): void {
  expect(outcomes).toHaveLength(ops.length);
  const seen = new Set<string>();
  for (const [index, op] of ops.entries()) {
    const outcome = outcomes[index]!;
    expect(outcome.op_id).toBe(op.op_id);
    if (seen.has(op.op_id)) {
      expect(outcome.outcome, `retry occurrence ${index} for ${op.op} ${op.op_id} was not a no-op`).toBe("no-op");
    }
    seen.add(op.op_id);
  }
}

function fork(snapshot: Uint8Array): Y.Doc {
  const doc = new Y.Doc();
  Y.applyUpdate(doc, snapshot);
  return doc;
}

describe("property-based convergence and idempotency", () => {
  it("converges across actor counts, causal permutations, batches, and duplicate retries", () => {
    const coverage: Coverage = { runs: 0, deletes: 0, clears: 0, retries: 0, permutations: 0 };
    fc.assert(
      fc.property(scenarioArb, (scenario) => {
        const causalPhases = phases(scenario);
        const forward = causalPhases.flat();
        const permuted = ordered(causalPhases, scenario.orderKeys);
        const retried = withRetries(permuted, scenario.retryMask);
        const snapshot = Y.encodeStateAsUpdate(mint({ nodes: [], links: [] }, catalog));
        const a = fork(snapshot);
        const b = fork(snapshot);

        applyInBatches(a, forward, [forward.length || 1]);
        const retryOutcomes = applyInBatches(b, retried, scenario.batchSizes);
        assertRetriesAreNoOps(retried, retryOutcomes);

        coverage.runs += 1;
        if (forward.some((op) => op.op === "delete_node")) coverage.deletes += 1;
        if (forward.some((op) => op.op === "clear")) coverage.clears += 1;
        if (new Set(retried.map((op) => op.op_id)).size < retried.length) coverage.retries += 1;
        if (permuted.some((op, index) => op.op_id !== forward[index]?.op_id)) coverage.permutations += 1;

        expect(JSON.stringify(project(b, catalog))).toBe(JSON.stringify(project(a, catalog)));
      }),
      FC_OPTIONS,
    );
    assertNonVacuous(coverage);
  });

  // reset_doc is a DEFERRED op (rejected until un-deferred by amendment), so it
  // cannot appear in a converging stream — the honest coverage is that it is
  // rejected loudly and leaves the document byte-identical (abort-before-mutate).
  it("rejects a deferred reset_doc op without mutating the document", () => {
    fc.assert(
      fc.property(scenarioArb, (scenario) => {
        const doc = mint({ nodes: [], links: [] }, catalog);
        expect(
          applyOps(doc, phases(scenario).flat(), catalog).outcomes.find((outcome) => outcome.outcome === "rejected"),
        ).toBeUndefined();
        const before = Y.encodeStateAsUpdate(doc);

        const reset = { ...envelope(9999, scenario), op: "reset_doc" } as unknown as Op;
        const result = applyOps(doc, [reset], catalog);

        expect(result.outcomes.find((outcome) => outcome.outcome === "rejected")).toBeDefined();
        expect(result.outcomes.filter((outcome) => outcome.outcome === "applied")).toEqual([]);
        expect(Y.encodeStateAsUpdate(doc)).toEqual(before);
      }),
      FC_OPTIONS,
    );
  });

  it("double-apply is a byte-identical document no-op", () => {
    fc.assert(
      fc.property(scenarioArb, (scenario) => {
        const ops = phases(scenario).flat();
        const doc = mint({ nodes: [], links: [] }, catalog);
        expect(applyOps(doc, ops, catalog).outcomes.find((outcome) => outcome.outcome === "rejected")).toBeUndefined();
        const projection = JSON.stringify(project(doc, catalog));
        const update = Y.encodeStateAsUpdate(doc);

        const retry = applyOps(doc, ops, catalog);
        expect(retry.outcomes.find((outcome) => outcome.outcome === "rejected")).toBeUndefined();
        expect(retry.outcomes.filter((outcome) => outcome.outcome === "applied")).toEqual([]);
        expect(retry.outcomes.filter((outcome) => outcome.outcome === "no-op").map((outcome) => outcome.op_id)).toHaveLength(ops.length);
        expect(JSON.stringify(project(doc, catalog))).toBe(projection);
        expect(Y.encodeStateAsUpdate(doc)).toEqual(update);
      }),
      FC_OPTIONS,
    );
  });
});
