/**
 * Full declared-op-vocabulary permutation matrix (perm-4).
 *
 * The vocabulary is read from FROZEN_OPS and DEFERRED_OPS rather than copied
 * into the matrix. Pair coverage is exhaustive across kind pairs, eight
 * salient document preconditions, stamp relations, arrival orders, and batch
 * boundaries. Longer streams are fixed-seed fast-check samples with shrinking
 * left enabled.
 *
 * Amendment A6 / docs/decisions/EXCEPTIONS.md and schema §2.5 item 2 are the
 * deliberate state-dependent convergence exceptions. Section 4
 * abort-remainder effects are tracked separately. R-69 output-reference
 * ordering, repeated inputcount link-id reuse, and unrelated removed-link
 * aliases are unexpected risks: this suite does not assert that any divergence
 * persists; it only proves that no additional projection field differs when
 * one appears.
 */
import * as fc from "fast-check";
import * as Y from "yjs";
import { describe, expect, it } from "vitest";
import {
  DEFERRED_OPS,
  FROZEN_OPS,
  applyOps,
  mint,
  project,
  type Op,
  type WireOp,
  type WidgetCatalog,
  type WorkflowJSON,
  type WorkflowNode,
} from "../src/index.js";
import { canonicalize } from "./helpers.js";

const KINDS = [...FROZEN_OPS, ...DEFERRED_OPS];
const ACTORS = ["agent:perm4:0", "agent:perm4:1", "human:perm4:0", "human:perm4:1"] as const;
const VERSION_PAIRS = [[0, 0], [0, 1], [1, 0], [1, 1], [0, 9], [9, 0], [4, 4], [4, 5]] as const;
const PRECONDITIONS = [
  "present-valid",
  "source-missing",
  "destination-missing",
  "from-slot-out-of-range",
  "to-slot-out-of-range",
  "occupied-input",
  "interior-or-inputcount",
  "promoted-or-autogrow",
] as const;
const PAIR_EXECUTIONS = 150_528;
const SAMPLED_RUNS = 24_736;
const SAMPLED_EXECUTIONS = SAMPLED_RUNS * 2;
const TOTAL_EXECUTIONS = PAIR_EXECUTIONS + SAMPLED_EXECUTIONS;
const SAMPLE_SEED = 0x4f70504;
const IDEMPOTENCY_VERIFIED = new Set<Kind>();

type Kind = (typeof KINDS)[number];
type Precondition = (typeof PRECONDITIONS)[number];
type BatchMode = "together" | "split";

const DEF = "perm4-definition";
const catalog: WidgetCatalog = {
  types: {
    Source: { widget_order: ["value"] },
    Sink: { widget_order: ["count"] },
    Aux: { widget_order: ["value"] },
  },
};

interface RunState {
  projection: WorkflowJSON;
  outcomes: Array<{ opId: string; outcome: string; code?: string }>;
  appliedIds: Set<string>;
}

interface Taxonomy {
  equivalent: number;
  a6: number;
  stateDependent: number;
  abortBoundary: number;
  unexpectedR69: number;
  unexpectedInputcountLinkReuse: number;
  unexpectedRemovedLinkAlias: number;
}

function node(
  id: number,
  type: string,
  inputs: unknown[] = [],
  outputs: unknown[] = [],
  widgets_values: unknown[] = [],
): WorkflowNode {
  return { id, type, pos: [id, id], inputs, outputs, widgets_values };
}

function base(precondition: Precondition): WorkflowJSON {
  const nodes = [
    node(10, "Source", [], [{ name: "OUT", type: "VALUE", links: [] }], [0]),
    node(20, "Sink", [{ name: "in", type: "VALUE", link: precondition === "occupied-input" ? 80 : null }], [], [1]),
    node(30, "Aux", [], [], [2]),
    node(40, "Aux", [], [], [3]),
    node(57, DEF, [{ name: "width", type: "INT", link: null, widget: { name: "width" } }], [], [640]),
  ];
  if (precondition === "source-missing") nodes.splice(nodes.findIndex((candidate) => candidate.id === 10), 1);
  if (precondition === "destination-missing") nodes.splice(nodes.findIndex((candidate) => candidate.id === 20), 1);
  const links = precondition === "occupied-input"
    ? [[80, 10, 0, 20, 0, "VALUE"]]
    : [];
  if (precondition === "occupied-input") {
    const source = nodes.find((candidate) => candidate.id === 10)!;
    ((source.outputs as Array<{ links: number[] }>)[0]!).links = [80];
  }
  return {
    nodes,
    links,
    groups: [],
    config: {},
    extra: {},
    version: 0.4,
    last_node_id: 57,
    last_link_id: 80,
    definitions: {
      subgraphs: [{
        id: DEF,
        name: "Perm4 definition",
        inputs: [{ name: "width", type: "INT" }],
        outputs: [],
        nodes: [node(13, "Sink", [], [], [640])],
        links: [],
      }],
    },
  } as WorkflowJSON;
}

function opId(serial: number): string {
  return Math.abs(serial).toString(16).padStart(32, "0").slice(-32);
}

function envelope(serial: number, actor: string, version: number) {
  return { op_id: opId(serial), actor, base_version: version, stamp: [version, actor] as [number, string] };
}

function makeOp(
  kind: Kind,
  precondition: Precondition,
  side: 0 | 1,
  serial: number,
  actor: string,
  version: number,
): WireOp {
  const env = envelope(serial, actor, version);
  const value = side === 0 ? serial : -serial;
  switch (kind) {
    case "add_node":
      return {
        ...env,
        op: "add_node",
        node_id: 40,
        node_incarnation: env.op_id,
        class_type: "Aux",
        pos: [value, value],
        node: node(40, "Aux", [], [], [value]),
      };
    case "connect": {
      const common = {
        ...env,
        op: "connect" as const,
        link_id: 100 + side,
        from_node: 10,
        from_slot: precondition === "from-slot-out-of-range" ? 5 : 0,
        to_node: 20,
        link_type: "VALUE",
      };
      if (precondition === "interior-or-inputcount") {
        return { ...common, grow: { name: `value_${side + 1}`, type: "VALUE", inputcount: { widget: "count", value } } };
      }
      if (precondition === "promoted-or-autogrow") {
        if (side === 0) {
          return { ...common, to_node: 57, link_type: "INT", grow: { name: "width", type: "INT", promoted: true } };
        }
        return { ...common, grow: { name: `values.value${side}`, type: "VALUE" } };
      }
      return { ...common, to_slot: precondition === "to-slot-out-of-range" ? 5 : 0 };
    }
    case "disconnect":
      return {
        ...env,
        op: "disconnect",
        link_id: precondition === "occupied-input" ? 80 : 100 + side,
        to_node: precondition === "destination-missing" ? 999 : 20,
        to_slot: precondition === "to-slot-out-of-range" ? 5 : 0,
      };
    case "set_widget":
      if (precondition === "interior-or-inputcount") {
        return {
          ...env,
          op: "set_widget",
          node_id: "57/13",
          widget: "missing",
          value,
          path: ["57", "13"],
          inner_widget: "missing",
        };
      }
      if (precondition === "promoted-or-autogrow") {
        return {
          ...env,
          op: "set_widget",
          node_id: 57,
          widget: "width",
          value,
          promoted: { value_index: 0, instance_path: ["57"], host_widgets_values: [value] },
        };
      }
      return { ...env, op: "set_widget", node_id: 20, widget: "count", value };
    case "delete_node":
      return { ...env, op: "delete_node", node_id: side === 0 ? 10 : 20, removed_links: [80, 100, 101] };
    case "clear":
      return { ...env, op: "clear", removed_nodes: side === 0 ? [10, 40, 57] : [20, 40, 57] };
    case "reset_doc":
      return { ...env, op: "reset_doc", workflow: { nodes: [], links: [] } };
  }
}

function run(workflow: WorkflowJSON, ops: readonly WireOp[], mode: BatchMode): RunState {
  const doc = mint(workflow, catalog);
  const groups = mode === "together" ? [[...ops]] : ops.map((op) => [op]);
  const outcomes: RunState["outcomes"] = [];
  for (const group of groups) {
    const before = Y.encodeStateAsUpdate(doc);
    const result = applyOps(doc, group as Op[], catalog);
    outcomes.push(...result.outcomes.map((outcome) => ({
      opId: outcome.op_id,
      outcome: outcome.outcome,
      ...(outcome.outcome === "rejected" ? { code: outcome.reason.code } : {}),
    })));
    if (mode === "split" && result.outcomes[0]?.outcome === "rejected") {
      expect(Y.encodeStateAsUpdate(doc)).toEqual(before);
    }
    if (mode === "together" && result.outcomes.some((outcome) => outcome.outcome === "rejected")) {
      assertRejectedOpDoesNotMutate(before, group);
    }
    for (const op of group) {
      const outcome = result.outcomes.find((candidate) => candidate.op_id === op.op_id);
      if (outcome?.outcome === "rejected" || IDEMPOTENCY_VERIFIED.has(op.op)) continue;
      const beforeRetry = Y.encodeStateAsUpdate(doc);
      expect(applyOps(doc, [op] as Op[], catalog).outcomes[0]?.outcome).toBe("no-op");
      expect(Y.encodeStateAsUpdate(doc)).toEqual(beforeRetry);
      IDEMPOTENCY_VERIFIED.add(op.op);
    }
  }
  const appliedIds = new Set(doc.getMap("__applied").keys());
  for (const outcome of outcomes) {
    if (outcome.outcome === "rejected") expect(appliedIds.has(outcome.opId)).toBe(false);
  }
  return { projection: canonicalize(project(doc, catalog)), outcomes, appliedIds };
}

function assertRejectedOpDoesNotMutate(encodedDoc: Uint8Array, group: readonly WireOp[]): void {
  const oracle = new Y.Doc();
  Y.applyUpdate(oracle, encodedDoc);
  for (const op of group) {
    const before = Y.encodeStateAsUpdate(oracle);
    const outcome = applyOps(oracle, [op] as Op[], catalog).outcomes[0];
    if (outcome?.outcome !== "rejected") continue;
    expect(Y.encodeStateAsUpdate(oracle)).toEqual(before);
    expect(oracle.getMap("__applied").has(op.op_id)).toBe(false);
    return;
  }
}

function stable(value: unknown): string {
  return JSON.stringify(value);
}

function normalizeR69(workflow: WorkflowJSON): WorkflowJSON {
  const copy = structuredClone(workflow);
  for (const candidate of copy.nodes) {
    for (const output of (candidate.outputs ?? []) as Array<{ links?: unknown[] }>) {
      if (Array.isArray(output.links)) output.links.sort((a, b) => String(a).localeCompare(String(b)));
    }
    const inputs = (candidate.inputs ?? []) as Array<{ link?: unknown; grow_id?: unknown }>;
    if (!inputs.some((input) => input.grow_id != null)) continue;
    const fixed = inputs.filter((input) => input.grow_id == null);
    const grown = inputs
      .filter((input) => input.grow_id != null)
      .sort((a, b) => String(a.grow_id).localeCompare(String(b.grow_id)));
    candidate.inputs = [...fixed, ...grown];
    for (const [index, input] of (candidate.inputs as typeof inputs).entries()) {
      if (input.grow_id == null) continue;
      const link = (copy.links as unknown[][]).find((tuple) =>
        String(tuple[0]) === String(input.grow_id) && String(tuple[3]) === String(candidate.id),
      );
      if (link) link[4] = index;
    }
  }
  return copy;
}

function normalizeInputcountLinkReuse(workflow: WorkflowJSON): WorkflowJSON {
  const copy = structuredClone(workflow);
  const destination = copy.nodes.find((candidate) => String(candidate.id) === "20");
  if (destination && Array.isArray(destination.widgets_values)) destination.widgets_values[0] = "<inputcount>";
  return copy;
}

function normalizeSourceDeleteAutogrow(workflow: WorkflowJSON, ops: readonly WireOp[]): WorkflowJSON {
  const affected = new Set(ops
    .filter((op): op is Extract<WireOp, { op: "connect" }> =>
      op.op === "connect" && op.grow != null && op.grow.promoted !== true && String(op.from_node) === "10",
    )
    .map((op) => String(op.link_id)));
  const copy = structuredClone(workflow);
  copy.links = (copy.links as unknown[][]).filter((link) => !affected.has(String(link[0])));
  for (const candidate of copy.nodes) {
    const inputs = (candidate.inputs ?? []) as Array<{ grow_id?: unknown; link?: unknown }>;
    candidate.inputs = inputs.filter((input) => !affected.has(String(input.grow_id)));
    for (const output of (candidate.outputs ?? []) as Array<{ links?: unknown[] }>) {
      if (Array.isArray(output.links)) output.links = output.links.filter((linkId) => !affected.has(String(linkId)));
    }
    for (const [index, input] of (candidate.inputs as typeof inputs).entries()) {
      const link = (copy.links as unknown[][]).find((tuple) =>
        String(tuple[0]) === String(input.link) && String(tuple[3]) === String(candidate.id),
      );
      if (link) link[4] = index;
    }
  }
  if (ops.some((op) => op.op === "connect" && affected.has(String(op.link_id)) && op.grow?.inputcount != null)) {
    const destination = copy.nodes.find((candidate) => String(candidate.id) === "20");
    if (destination && Array.isArray(destination.widgets_values)) destination.widgets_values[0] = "<source-delete-autogrow>";
  }
  return copy;
}

function removedLinkAliases(ops: readonly WireOp[]): Set<string> {
  const aliases = new Set<string>();
  for (const connect of ops.filter((op): op is Extract<WireOp, { op: "connect" }> =>
    op.op === "connect" && op.grow?.promoted === true)) {
    for (const deletion of ops.filter((op): op is Extract<WireOp, { op: "delete_node" }> => op.op === "delete_node")) {
      if (String(deletion.node_id) !== String(connect.to_node) &&
          deletion.removed_links.some((linkId) => String(linkId) === String(connect.link_id))) {
        aliases.add(String(connect.link_id));
      }
    }
  }
  return aliases;
}

function normalizeRemovedLinkAlias(workflow: WorkflowJSON, aliases: ReadonlySet<string>): WorkflowJSON {
  const copy = structuredClone(workflow);
  copy.links = (copy.links as unknown[][]).filter((link) => !aliases.has(String(link[0])));
  for (const candidate of copy.nodes) {
    for (const input of (candidate.inputs ?? []) as Array<{ link?: unknown }>) {
      if (aliases.has(String(input.link))) input.link = null;
    }
    for (const output of (candidate.outputs ?? []) as Array<{ links?: unknown[] }>) {
      if (Array.isArray(output.links)) output.links = output.links.filter((linkId) => !aliases.has(String(linkId)));
    }
  }
  return copy;
}

function rejectionMap(state: RunState): Map<string, string> {
  return new Map(state.outcomes.filter((outcome) => outcome.outcome === "rejected").map((outcome) => [outcome.opId, outcome.code ?? "rejected"]));
}

function hasA6Shape(ops: readonly WireOp[], precondition: Precondition): boolean {
  const mutatesPresence = ops.some((op) => op.op === "add_node" || op.op === "delete_node" || op.op === "clear");
  const documentDependent = ops.some((op) =>
    (op.op === "connect" && (precondition === "from-slot-out-of-range" || precondition === "to-slot-out-of-range")) ||
    (op.op === "set_widget" && precondition === "interior-or-inputcount"),
  );
  return mutatesPresence && documentDependent;
}

function hasDeclaredStateDependentShape(ops: readonly WireOp[]): boolean {
  const removesSource = ops.some((op) =>
    (op.op === "delete_node" && String(op.node_id) === "10") ||
    (op.op === "clear" && op.removed_nodes.some((nodeId) => String(nodeId) === "10")),
  );
  const autogrowsFromSource = ops.some((op) =>
    op.op === "connect" && op.grow != null && op.grow.promoted !== true && String(op.from_node) === "10",
  );
  return removesSource && autogrowsFromSource;
}

function hasInputcountLinkReuseShape(ops: readonly WireOp[]): boolean {
  const links = ops
    .filter((op): op is Extract<WireOp, { op: "connect" }> => op.op === "connect" && op.grow?.inputcount != null)
    .map((op) => String(op.link_id));
  return new Set(links).size < links.length;
}

function classify(
  left: RunState,
  right: RunState,
  ops: readonly WireOp[],
  precondition: Precondition,
  mode: BatchMode,
): keyof Taxonomy {
  if (stable(left.projection) === stable(right.projection)) return "equivalent";
  const leftRejected = rejectionMap(left);
  const rightRejected = rejectionMap(right);
  const rejectionChanged = ops.some((op) => leftRejected.has(op.op_id) !== rightRejected.has(op.op_id));
  if (hasA6Shape(ops, precondition) && rejectionChanged) return "a6";
  if (mode === "together" && rejectionChanged) return "abortBoundary";
  if (hasDeclaredStateDependentShape(ops) &&
      stable(normalizeR69(normalizeSourceDeleteAutogrow(left.projection, ops))) ===
        stable(normalizeR69(normalizeSourceDeleteAutogrow(right.projection, ops)))) {
    return "stateDependent";
  }
  if (stable(normalizeR69(left.projection)) === stable(normalizeR69(right.projection))) return "unexpectedR69";
  if (hasInputcountLinkReuseShape(ops) &&
      stable(normalizeInputcountLinkReuse(normalizeR69(left.projection))) ===
        stable(normalizeInputcountLinkReuse(normalizeR69(right.projection)))) {
    return "unexpectedInputcountLinkReuse";
  }
  const aliases = removedLinkAliases(ops);
  if (aliases.size > 0 &&
      stable(normalizeRemovedLinkAlias(left.projection, aliases)) ===
        stable(normalizeRemovedLinkAlias(right.projection, aliases))) {
    return "unexpectedRemovedLinkAlias";
  }
  throw new Error(`unexpected divergence ${stable({ precondition, mode, ops, left, right })}`);
}

function actorPairs(): Array<readonly [string, string]> {
  return ACTORS.flatMap((left) => ACTORS.filter((right) => right !== left).map((right) => [left, right] as const));
}

function kindPairs(): Array<readonly [Kind, Kind]> {
  return KINDS.flatMap((left) => KINDS.map((right) => [left, right] as const));
}

describe("full op-pool permutation equivalence", () => {
  it("exhausts every declared op-kind pair across state, stamp, order, and batch dimensions", () => {
    let executions = 0;
    let serial = 1;
    const taxonomy: Taxonomy = {
      equivalent: 0, a6: 0, stateDependent: 0, abortBoundary: 0,
      unexpectedR69: 0, unexpectedInputcountLinkReuse: 0,
      unexpectedRemovedLinkAlias: 0,
    };
    let firstR69: string | undefined;
    let firstRemovedLinkAlias: string | undefined;

    for (const kinds of kindPairs()) {
      for (const precondition of PRECONDITIONS) {
        for (const actors of actorPairs()) {
          for (const versions of VERSION_PAIRS) {
            const pair = kinds.map((kind, side) => makeOp(kind, precondition, side as 0 | 1, serial++, actors[side]!, versions[side]!));
            for (const mode of ["together", "split"] as const) {
              const forward = run(base(precondition), pair, mode);
              const reverse = run(base(precondition), [pair[1]!, pair[0]!], mode);
              executions += 2;
              const category = classify(forward, reverse, pair, precondition, mode);
              taxonomy[category]++;
              if (category === "unexpectedR69" && firstR69 === undefined) {
                firstR69 = stable({ kinds, precondition, actors, versions, mode, ops: pair });
              }
              if (category === "unexpectedRemovedLinkAlias" && firstRemovedLinkAlias === undefined) {
                firstRemovedLinkAlias = stable({ kinds, precondition, actors, versions, mode, ops: pair });
              }
            }
          }
        }
      }
    }

    expect(KINDS).toEqual([...FROZEN_OPS, ...DEFERRED_OPS]);
    expect(kindPairs()).toHaveLength(KINDS.length ** 2);
    expect(executions).toBe(PAIR_EXECUTIONS);
    expect(Object.values(taxonomy).reduce((sum, count) => sum + count, 0)).toBe(PAIR_EXECUTIONS / 2);
    // Deferred reset_doc never consumes its op_id; every frozen kind does and
    // has one byte-identical immediate duplicate check in run().
    expect(IDEMPOTENCY_VERIFIED).toEqual(new Set(FROZEN_OPS));
    // A6 and section-4 categories are ruled. R-69 is deliberately measured,
    // not count-pinned: fixing it must not require weakening this test.
    expect(taxonomy.a6).toBeGreaterThan(0);
    expect(taxonomy.abortBoundary).toBeGreaterThan(0);
    console.info("perm-4 pair taxonomy", { executions, taxonomy, firstR69, firstRemovedLinkAlias });
  }, 900_000);

  it("samples reproducible length-3-to-6 full-vocabulary streams with shrinking enabled", () => {
    let runs = 0;
    let executions = 0;
    const hits = Object.fromEntries(KINDS.map((kind) => [kind, 0])) as Record<Kind, number>;
    const taxonomy: Taxonomy = {
      equivalent: 0, a6: 0, stateDependent: 0, abortBoundary: 0,
      unexpectedR69: 0, unexpectedInputcountLinkReuse: 0,
      unexpectedRemovedLinkAlias: 0,
    };
    let firstR69: string | undefined;
    let firstInputcountLinkReuse: string | undefined;
    let firstRemovedLinkAlias: string | undefined;
    const scenarioArb = fc.record({
      kinds: fc.array(fc.constantFrom(...KINDS), { minLength: 3, maxLength: 6 }),
      precondition: fc.constantFrom(...PRECONDITIONS),
      actors: fc.array(fc.constantFrom(...ACTORS), { minLength: 6, maxLength: 6 }),
      versions: fc.array(fc.integer({ min: 0, max: 9 }), { minLength: 6, maxLength: 6 }),
      order: fc.array(fc.integer(), { minLength: 6, maxLength: 6 }),
      mode: fc.constantFrom<BatchMode>("together", "split"),
      nonce: fc.integer({ min: 1, max: 0x0fffffff }),
    });

    fc.assert(fc.property(scenarioArb, (scenario) => {
      runs++;
      const ops = scenario.kinds.map((kind, index) => {
        hits[kind]++;
        return makeOp(kind, scenario.precondition, index % 2 as 0 | 1, scenario.nonce * 8 + index, scenario.actors[index]!, scenario.versions[index]!);
      });
      const permuted = ops
        .map((op, index) => ({ op, order: scenario.order[index]! }))
        .sort((a, b) => a.order - b.order || a.op.op_id.localeCompare(b.op.op_id))
        .map(({ op }) => op);
      const forward = run(base(scenario.precondition), ops, scenario.mode);
      const reverse = run(base(scenario.precondition), permuted, scenario.mode);
      executions += 2;
      const category = classify(forward, reverse, ops, scenario.precondition, scenario.mode);
      taxonomy[category]++;
      if (category === "unexpectedR69" && firstR69 === undefined) {
        firstR69 = stable({ seed: SAMPLE_SEED, scenario, ops, permuted: permuted.map((op) => op.op_id) });
      }
      if (category === "unexpectedInputcountLinkReuse" && firstInputcountLinkReuse === undefined) {
        firstInputcountLinkReuse = stable({ seed: SAMPLE_SEED, scenario, ops, permuted: permuted.map((op) => op.op_id) });
      }
      if (category === "unexpectedRemovedLinkAlias" && firstRemovedLinkAlias === undefined) {
        firstRemovedLinkAlias = stable({ seed: SAMPLE_SEED, scenario, ops, permuted: permuted.map((op) => op.op_id) });
      }
    }), { seed: SAMPLE_SEED, numRuns: SAMPLED_RUNS });

    expect(runs).toBe(SAMPLED_RUNS);
    expect(executions).toBe(SAMPLED_EXECUTIONS);
    expect(TOTAL_EXECUTIONS).toBe(200_000);
    for (const [kind, count] of Object.entries(hits)) expect(count, `${kind} was not sampled`).toBeGreaterThan(0);
    expect(Object.values(taxonomy).reduce((sum, count) => sum + count, 0)).toBe(SAMPLED_RUNS);
    console.info("perm-4 sampled taxonomy", {
      seed: SAMPLE_SEED, runs, executions, hits, taxonomy,
      firstR69, firstInputcountLinkReuse, firstRemovedLinkAlias,
    });
  }, 900_000);
});
