import * as fc from "fast-check";
import * as Y from "yjs";
import { describe, expect, it } from "vitest";
import {
  applyOps,
  compareStampKeys,
  mint,
  project,
  readStamps,
  stampKey,
  type AddNodeOp,
  type ConnectOp,
  type Op,
  type SetWidgetOp,
  type WidgetCatalog,
  type WorkflowJSON,
  type WorkflowNode,
} from "../src/index.js";

/**
 * Fixed-seed sampled coverage for the five LWW register families. This is not
 * exhaustive: each property samples 240 scenarios from the bounded dimensions
 * below (1,200 generated scenarios total). The post-assertion hit checks are
 * vacuity guards, not additional generated cases.
 *
 * KA-2: every expected winner is computed from [base_version, actor, op_id].
 * KA-4: opposite arrival orders converge and an exact retry is byte-identical.
 * KA-10: every replica forks from one encoded snapshot.
 */

const RUNS = 240;
const SEEDS = {
  node: 0x50e51ce,
  widget: 0x71d6e7,
  concrete: 0xc0c2e7e,
  promoted: 0x9200e,
  inputcount: 0x1c0a17,
} as const;

const catalog: WidgetCatalog = {
  types: {
    Known: { widget_order: ["value"] },
    Src: { widget_order: [] },
    Sink: { widget_order: ["count"] },
    Aux: { widget_order: ["value"] },
  },
};

type TieKind = "version" | "actor" | "op_id";
type RetryKind = "winner" | "loser" | "none";
type BatchKind = "one" | "split-after-first" | "individual";

interface Scenario {
  tie: TieKind;
  retry: RetryKind;
  batch: BatchKind;
  reverse: boolean;
  winnerValue: number;
  loserValue: number;
}

interface Coverage {
  runs: number;
  ties: Record<TieKind, number>;
  retries: Record<Exclude<RetryKind, "none">, number>;
  batches: Record<BatchKind, number>;
  reverse: number;
}

const scenarioArb: fc.Arbitrary<Scenario> = fc.record({
  tie: fc.constantFrom<TieKind>("version", "actor", "op_id"),
  retry: fc.constantFrom<RetryKind>("winner", "loser", "none"),
  batch: fc.constantFrom<BatchKind>("one", "split-after-first", "individual"),
  reverse: fc.boolean(),
  winnerValue: fc.integer({ min: -1_000_000, max: 1_000_000 }),
  loserValue: fc.integer({ min: -1_000_000, max: 1_000_000 }),
}).filter(({ winnerValue, loserValue }) => winnerValue !== loserValue);

function emptyCoverage(): Coverage {
  return {
    runs: 0,
    ties: { version: 0, actor: 0, op_id: 0 },
    retries: { winner: 0, loser: 0 },
    batches: { one: 0, "split-after-first": 0, individual: 0 },
    reverse: 0,
  };
}

function countCoverage(coverage: Coverage, scenario: Scenario): void {
  coverage.runs += 1;
  coverage.ties[scenario.tie] += 1;
  coverage.batches[scenario.batch] += 1;
  if (scenario.retry !== "none") coverage.retries[scenario.retry] += 1;
  if (scenario.reverse) coverage.reverse += 1;
}

function assertNonVacuous(coverage: Coverage): void {
  expect(coverage.runs).toBe(RUNS);
  for (const [kind, hits] of Object.entries(coverage.ties)) {
    expect(hits, `tie category ${kind} was not sampled`).toBeGreaterThan(0);
  }
  for (const [kind, hits] of Object.entries(coverage.retries)) {
    expect(hits, `retry category ${kind} was not sampled`).toBeGreaterThan(0);
  }
  for (const [kind, hits] of Object.entries(coverage.batches)) {
    expect(hits, `batch/interleaving category ${kind} was not sampled`).toBeGreaterThan(0);
  }
  expect(coverage.reverse, "reverse arrival order was not sampled").toBeGreaterThan(0);
  expect(coverage.reverse, "forward arrival order was not sampled").toBeLessThan(coverage.runs);
}

const hexId = (head: string, nonce: number): string =>
  `${head}${Math.abs(nonce).toString(16).padStart(7, "0")}`.padEnd(32, head).slice(0, 32);

function stamps(tie: TieKind, nonce: number): {
  winner: { op_id: string; actor: string; base_version: number; stamp: [number, string] };
  loser: { op_id: string; actor: string; base_version: number; stamp: [number, string] };
} {
  const common = Math.abs(nonce % 10_000);
  if (tie === "version") {
    return {
      winner: { op_id: hexId("e", common), actor: "human:a", base_version: 8, stamp: [8, "human:a"] },
      loser: { op_id: hexId("f", common), actor: "human:z", base_version: 7, stamp: [7, "human:z"] },
    };
  }
  if (tie === "actor") {
    return {
      winner: { op_id: hexId("e", common), actor: "human:z", base_version: 8, stamp: [8, "human:z"] },
      loser: { op_id: hexId("f", common), actor: "human:a", base_version: 8, stamp: [8, "human:a"] },
    };
  }
  return {
    winner: { op_id: hexId("f", common), actor: "human:a", base_version: 8, stamp: [8, "human:a"] },
    loser: { op_id: hexId("e", common), actor: "human:a", base_version: 8, stamp: [8, "human:a"] },
  };
}

function node(id: number, type: string, value?: number): WorkflowNode {
  return {
    id,
    type,
    pos: [0, 0],
    inputs: [],
    outputs: [],
    ...(value === undefined ? {} : { widgets_values: [value] }),
  } as WorkflowNode;
}

function base(nodes: WorkflowNode[], extra: Partial<WorkflowJSON> = {}): WorkflowJSON {
  return { nodes, links: [], last_node_id: 20, last_link_id: 0, ...extra } as WorkflowJSON;
}

function auxWrite(nonce: number): SetWidgetOp {
  return {
    op: "set_widget",
    op_id: hexId("c", nonce),
    actor: "agent:causal",
    base_version: 3,
    stamp: [3, "agent:causal"],
    node_id: 20,
    widget: "value",
    value: nonce,
  };
}

function fork(snapshot: Uint8Array): Y.Doc {
  const doc = new Y.Doc();
  Y.applyUpdate(doc, snapshot);
  return doc;
}

function applyInterleaved(doc: Y.Doc, ordered: [Op, Op], causal: Op, batch: BatchKind): void {
  const stream = [ordered[0], causal, ordered[1]];
  const groups = batch === "one"
    ? [stream]
    : batch === "split-after-first"
      ? [stream.slice(0, 1), stream.slice(1)]
      : stream.map((op) => [op]);
  for (const group of groups) {
    const result = applyOps(doc, group, catalog);
    expect(result.outcomes.find((outcome) => outcome.outcome === "rejected")).toBeUndefined();
  }
}

function exercise(
  workflow: WorkflowJSON,
  winner: Op,
  loser: Op,
  scenario: Scenario,
  assertWinner: (workflow: WorkflowJSON, doc: Y.Doc) => void,
  normalize: (workflow: WorkflowJSON) => unknown = (workflow) => workflow,
): void {
  expect(compareStampKeys(stampKey(winner), stampKey(loser))).toBeGreaterThan(0);
  const snapshot = Y.encodeStateAsUpdate(mint(workflow, catalog));
  const first = fork(snapshot);
  const second = fork(snapshot);
  const forward: [Op, Op] = scenario.reverse ? [loser, winner] : [winner, loser];
  const reverse: [Op, Op] = [forward[1], forward[0]];
  const causal = auxWrite(scenario.winnerValue ^ scenario.loserValue);
  applyInterleaved(first, forward, causal, scenario.batch);
  applyInterleaved(second, reverse, causal, scenario.batch);

  assertWinner(project(first, catalog), first);
  assertWinner(project(second, catalog), second);
  expect(normalize(project(first, catalog))).toEqual(normalize(project(second, catalog)));

  if (scenario.retry !== "none") {
    const before = Buffer.from(Y.encodeStateAsUpdate(first));
    const retried = scenario.retry === "winner" ? winner : loser;
    expect(applyOps(first, [retried], catalog).outcomes[0]?.outcome).not.toBe("rejected");
    expect(Buffer.from(Y.encodeStateAsUpdate(first))).toEqual(before);
  }
}

function property(
  seed: number,
  build: (scenario: Scenario) => {
    workflow: WorkflowJSON;
    winner: Op;
    loser: Op;
    assertWinner: (workflow: WorkflowJSON, doc: Y.Doc) => void;
    normalize?: (workflow: WorkflowJSON) => unknown;
  },
): Coverage {
  const coverage = emptyCoverage();
  fc.assert(
    fc.property(scenarioArb, (scenario) => {
      countCoverage(coverage, scenario);
      const vector = build(scenario);
      exercise(vector.workflow, vector.winner, vector.loser, scenario, vector.assertWinner, vector.normalize);
    }),
    { seed, numRuns: RUNS },
  );
  assertNonVacuous(coverage);
  return coverage;
}

describe("fixed-seed register-family properties", () => {
  it("node presence and incarnation choose the greatest add stamp across retries and interleavings", () => {
    property(SEEDS.node, (scenario) => {
      const pair = stamps(scenario.tie, scenario.winnerValue);
      const add = (env: typeof pair.winner, value: number): AddNodeOp => ({
        op: "add_node",
        ...env,
        node_id: 9,
        node_incarnation: env.op_id,
        class_type: "Known",
        pos: [0, 0],
        node: node(9, "Known", value),
      });
      const winner = add(pair.winner, scenario.winnerValue);
      const loser = add(pair.loser, scenario.loserValue);
      return {
        workflow: base([node(20, "Aux", 0)]),
        winner,
        loser,
        assertWinner: (workflow, doc) => {
          const selected = workflow.nodes.find((candidate) => String(candidate.id) === "9")!;
          expect(selected.widgets_values).toEqual([scenario.winnerValue]);
          expect(readStamps(doc)[JSON.stringify(["node", "9"])]).toEqual(stampKey(winner));
          expect((doc.getMap<Y.Map<unknown>>("nodes").get("9"))?.get("__incarnation")).toBe(winner.op_id);
        },
      };
    });
  });

  it("widget registers choose the greatest stamp across retries and interleavings", () => {
    property(SEEDS.widget, (scenario) => {
      const pair = stamps(scenario.tie, scenario.winnerValue);
      const write = (env: typeof pair.winner, value: number): SetWidgetOp => ({
        op: "set_widget", ...env, node_id: 1, widget: "value", value,
      });
      const winner = write(pair.winner, scenario.winnerValue);
      const loser = write(pair.loser, scenario.loserValue);
      return {
        workflow: base([node(1, "Known", 0), node(20, "Aux", 0)]),
        winner,
        loser,
        assertWinner: (workflow) => {
          expect(workflow.nodes.find((candidate) => candidate.id === 1)?.widgets_values).toEqual([scenario.winnerValue]);
        },
      };
    });
  });

  it("concrete input registers choose the greatest connect stamp without link/delete matrices", () => {
    property(SEEDS.concrete, (scenario) => {
      const pair = stamps(scenario.tie, scenario.winnerValue);
      const connect = (env: typeof pair.winner, from: number, link: number): ConnectOp => ({
        op: "connect", ...env, link_id: link, from_node: from, from_slot: 0,
        to_node: 3, to_slot: 0, link_type: "X",
      });
      const winner = connect(pair.winner, 2, 902);
      const loser = connect(pair.loser, 1, 901);
      const src = (id: number) => ({ ...node(id, "Src"), outputs: [{ name: "out", type: "X", links: [] }] } as WorkflowNode);
      const sink = ({ ...node(3, "Sink", 0), inputs: [{ name: "in", type: "X", link: null }] } as WorkflowNode);
      return {
        workflow: base([src(1), src(2), sink, node(20, "Aux", 0)]),
        winner,
        loser,
        assertWinner: (workflow) => {
          const input = workflow.nodes.find((candidate) => candidate.id === 3)?.inputs?.[0] as { link: unknown };
          expect(input.link).toBe(902);
          expect(workflow.links).toContainEqual([902, 2, 0, 3, 0, "X"]);
          expect(workflow.links).toHaveLength(1);
        },
      };
    });
  });

  it("promoted input registers choose the greatest connect stamp for one declared input", () => {
    property(SEEDS.promoted, (scenario) => {
      const pair = stamps(scenario.tie, scenario.winnerValue);
      const connect = (env: typeof pair.winner, from: number, link: number): ConnectOp => ({
        op: "connect", ...env, link_id: link, from_node: from, from_slot: 0,
        to_node: 3, to_slot: null, link_type: "X", grow: { name: "declared", type: "X", promoted: true },
      });
      const winner = connect(pair.winner, 2, 912);
      const loser = connect(pair.loser, 1, 911);
      const src = (id: number) => ({ ...node(id, "Src"), outputs: [{ name: "out", type: "X", links: [] }] } as WorkflowNode);
      return {
        workflow: base(
          [src(1), src(2), node(3, "def-register"), node(20, "Aux", 0)],
          { definitions: { subgraphs: [{ id: "def-register", name: "Register", inputs: [{ name: "declared", type: "X" }], outputs: [], nodes: [], links: [] }] } },
        ),
        winner,
        loser,
        assertWinner: (workflow) => {
          const target = workflow.nodes.find((candidate) => candidate.id === 3)!;
          expect((target.inputs?.[0] as { name: string; link: unknown }).name).toBe("declared");
          expect((target.inputs?.[0] as { link: unknown }).link).toBe(912);
          expect(workflow.links).toContainEqual([912, 2, 0, 3, 0, "X"]);
          expect(workflow.links).toHaveLength(1);
        },
      };
    });
  });

  it("inputcount widget registers choose the greatest embedded connect stamp", () => {
    property(SEEDS.inputcount, (scenario) => {
      const pair = stamps(scenario.tie, scenario.winnerValue);
      const connect = (env: typeof pair.winner, link: number, name: string, count: number): ConnectOp => ({
        op: "connect", ...env, link_id: link, from_node: 1, from_slot: 0,
        to_node: 3, to_slot: null, link_type: "X",
        grow: { name, type: "X", inputcount: { widget: "count", value: count } },
      });
      const winner = connect(pair.winner, 922, "item_1", scenario.winnerValue);
      const loser = connect(pair.loser, 921, "item_1", scenario.loserValue);
      const src = ({ ...node(1, "Src"), outputs: [{ name: "out", type: "X", links: [] }] } as WorkflowNode);
      return {
        workflow: base([src, node(3, "Sink", 0), node(20, "Aux", 0)]),
        winner,
        loser,
        assertWinner: (workflow) => {
          expect(workflow.nodes.find((candidate) => candidate.id === 3)?.widgets_values).toEqual([scenario.winnerValue]);
          expect(workflow.links).toHaveLength(2);
        },
        // Output link order is not part of the inputcount widget register. It
        // remains arrival-ordered today; sort it here so this property tests
        // the register family it names rather than claiming wider convergence.
        normalize: (workflow) => {
          const copy = structuredClone(workflow);
          for (const candidate of copy.nodes) {
            if (!Array.isArray(candidate.outputs)) continue;
            for (const output of candidate.outputs as Record<string, unknown>[]) {
              if (Array.isArray(output["links"])) {
                output["links"] = [...output["links"]].sort();
              }
            }
          }
          return copy;
        },
      };
    });
  });
});
