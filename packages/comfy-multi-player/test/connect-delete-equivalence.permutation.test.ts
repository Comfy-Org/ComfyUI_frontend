/**
 * Bounded exhaustive connect x delete equivalence matrix.
 *
 * Taxonomy: schema Amendment A6 / docs/decisions/EXCEPTIONS.md permits exactly
 * the document-dependent slot checks to differ across arrival orders.  In this
 * matrix those are (a) an in-domain but out-of-range `from_slot` racing deletion
 * of a present source, and (b) an in-domain but out-of-range `to_slot` racing
 * deletion of a present destination.  Missing endpoints, valid slots, the
 * opposite endpoint's bad slot, actor/version order, incumbent topology, and
 * same-call versus split-call delivery are controls. A same-call rejection
 * may also abort a following delete under schema section 4; that is a batch-
 * boundary effect, not an A6 exception. Any remaining projection divergence
 * is an unexpected convergence bug.
 */
import * as Y from "yjs";
import { describe, expect, it } from "vitest";
import {
  applyOps,
  mint,
  project,
  type ConnectOp,
  type DeleteNodeOp,
  type Op,
  type WorkflowJSON,
  type WorkflowNode,
} from "../src/index.js";
import { canonicalize, loadCatalog } from "./helpers.js";

const catalog = loadCatalog();
const ACTORS = ["agent:pbt:0", "agent:pbt:1", "human:pbt:0", "human:pbt:1"] as const;
const VERSION_PAIRS = [[0, 0], [0, 1], [1, 0], [1, 1], [0, 9], [9, 0], [4, 4], [4, 5]] as const;
const ENDPOINT_PRESENCE = [
  { source: true, destination: true },
  { source: true, destination: false },
  { source: false, destination: true },
  { source: false, destination: false },
] as const;
const SLOT_PAIRS = [
  { from: 0, to: 0 },
  { from: 0, to: 5 },
  { from: 5, to: 0 },
  { from: 5, to: 5 },
] as const;
const EXPECTED_EXECUTIONS = 12_288;

type DeleteAxis = "source" | "destination";
type BatchMode = "together" | "split";

interface LogicalState {
  projection: WorkflowJSON;
  outcomes: Array<{ opId: string; outcome: string }>;
}

function sourceNode(id: number): WorkflowNode {
  return {
    id,
    type: "CLIPTextEncode",
    pos: [0, 0],
    inputs: [{ name: "clip", type: "CLIP", link: null }],
    outputs: [{ name: "CONDITIONING", type: "CONDITIONING", links: [] }],
    widgets_values: ["text"],
  };
}

function destinationNode(id: number, incumbent: boolean): WorkflowNode {
  return {
    id,
    type: "KSampler",
    pos: [100, 0],
    inputs: [{ name: "positive", type: "CONDITIONING", link: incumbent ? 600 : null }],
    outputs: [{ name: "LATENT", type: "LATENT", links: [] }],
    widgets_values: [0, "fixed", 20, 8, "euler", "normal", 1],
  };
}

function base(presence: (typeof ENDPOINT_PRESENCE)[number], incumbent: boolean): WorkflowJSON {
  const nodes: WorkflowNode[] = [sourceNode(300)];
  if (presence.source) nodes.push(sourceNode(100));
  if (presence.destination) nodes.push(destinationNode(200, incumbent));
  if (incumbent && presence.destination) {
    const incumbentSource = nodes[0]!;
    (incumbentSource.outputs as Array<{ links: unknown[] }>)[0]!.links = [600];
  }
  return {
    nodes,
    links: incumbent && presence.destination ? [[600, 300, 0, 200, 0, "CONDITIONING"]] : [],
    groups: [], config: {}, extra: {}, version: 0.4, last_node_id: 300, last_link_id: 600,
  };
}

function opId(serial: number): string {
  return serial.toString(16).padStart(32, "0");
}

function operations(
  serial: number,
  actors: readonly [string, string],
  versions: readonly [number, number],
  slots: (typeof SLOT_PAIRS)[number],
  axis: DeleteAxis,
): readonly [ConnectOp, DeleteNodeOp] {
  return [{
    op: "connect", op_id: opId(serial), actor: actors[0], base_version: versions[0],
    stamp: [versions[0], actors[0]], link_id: 700, from_node: 100,
    from_slot: slots.from, to_node: 200, to_slot: slots.to, link_type: "CONDITIONING",
  }, {
    op: "delete_node", op_id: opId(serial + 1), actor: actors[1], base_version: versions[1],
    stamp: [versions[1], actors[1]], node_id: axis === "source" ? 100 : 200,
    removed_links: axis === "destination" ? [600, 700] : [700],
  }];
}

function run(seed: WorkflowJSON, ops: readonly Op[], mode: BatchMode): LogicalState {
  const doc = mint(seed, catalog);
  const results = [];
  if (mode === "together") {
    const before = Y.encodeStateAsUpdate(doc);
    const result = applyOps(doc, [...ops], catalog);
    results.push(result);
    if (result.outcomes[0]?.outcome === "rejected") {
      expect([...Y.encodeStateAsUpdate(doc)]).toEqual([...before]);
      expect(doc.getMap("__applied").has(ops[0]!.op_id)).toBe(false);
      // Section 4 reports the unprocessed suffix explicitly as batch-aborted;
      // it must not report an applied/no-op effect or mutate the document.
      expect(result.outcomes[1]?.outcome).toBe("rejected");
      if (result.outcomes[1]?.outcome === "rejected") {
        expect(result.outcomes[1].reason.code).toBe("batch_aborted");
      }
      expect(doc.getMap("__applied").has(ops[1]!.op_id)).toBe(false);
    }
  } else {
    for (const op of ops) {
      const before = Y.encodeStateAsUpdate(doc);
      const result = applyOps(doc, [op], catalog);
      results.push(result);
      if (result.outcomes[0]?.outcome === "rejected") {
        expect([...Y.encodeStateAsUpdate(doc)]).toEqual([...before]);
        expect(doc.getMap("__applied").has(op.op_id)).toBe(false);
      }
    }
  }
  return {
    projection: canonicalize(project(doc, catalog)),
    outcomes: results.flatMap((result) => result.outcomes.map((outcome) => ({ opId: outcome.op_id, outcome: outcome.outcome }))),
  };
}

function comparable(state: LogicalState): unknown {
  // Equivalence is the user-visible graph projection. A6 separately permits
  // bookkeeping/outcome differences when an endpoint deletion makes a
  // document-dependent check unanswerable.
  return state.projection;
}

describe("bounded exhaustive connect x delete equivalence", () => {
  it("classifies only Amendment A6 state-dependent slot races as divergent", () => {
    let executions = 0;
    let serial = 1;
    let a6DivergentPairs = 0;
    let abortBoundaryPairs = 0;
    let equivalentPairs = 0;
    const unexpected: string[] = [];

    for (const axis of ["source", "destination"] as const) {
      for (const presence of ENDPOINT_PRESENCE) {
        for (const slots of SLOT_PAIRS) {
          const incumbent = true;
          for (const actorA of ACTORS) {
            for (const actorB of ACTORS) {
              if (actorA === actorB) continue;
              for (const versions of VERSION_PAIRS) {
                const pair = operations(serial, [actorA, actorB], versions, slots, axis);
                serial += 2;
                for (const mode of ["together", "split"] as const) {
                  const forward = run(base(presence, incumbent), pair, mode);
                  const reverse = run(base(presence, incumbent), [pair[1], pair[0]], mode);
                  executions += 2;
                  const repro = JSON.stringify({ axis, presence, slots, incumbent, actors: [actorA, actorB], versions, mode });
                  const divergent = JSON.stringify(comparable(forward)) !== JSON.stringify(comparable(reverse));
                  const connectId = pair[0].op_id;
                  const connectOutcome = (state: LogicalState): string =>
                    state.outcomes.find((outcome) => outcome.opId === connectId)?.outcome ?? "batch-aborted";
                  const forwardConnect = connectOutcome(forward);
                  const reverseConnect = connectOutcome(reverse);
                  const bothPresent = presence.source && presence.destination;
                  const permittedA6Tuple = axis === "source"
                    ? bothPresent && slots.from === 5 && slots.to === 0
                    : mode === "together" && presence.destination &&
                      (slots.to === 5 || bothPresent && slots.from === 5);
                  const a6 = divergent && permittedA6Tuple &&
                    (forwardConnect === "rejected") !== (reverseConnect === "rejected");
                  const permittedAbortTuple = mode === "together" && axis === "source" &&
                    bothPresent && slots.to === 5;
                  const abortBoundary = divergent && permittedAbortTuple && !a6 &&
                    forwardConnect === "rejected" && reverseConnect === "rejected";
                  if (a6) a6DivergentPairs++;
                  else if (abortBoundary) abortBoundaryPairs++;
                  else if (divergent) unexpected.push(`${repro} outcomes=${JSON.stringify([forward.outcomes, reverse.outcomes])}`);
                  else equivalentPairs++;
                }
              }
            }
          }
        }
      }
    }

    expect(executions).toBe(EXPECTED_EXECUTIONS);
    expect(unexpected, "unexpected divergence tuples").toEqual([]);
    expect(a6DivergentPairs + abortBoundaryPairs + equivalentPairs).toBe(EXPECTED_EXECUTIONS / 2);
    expect({ a6DivergentPairs, abortBoundaryPairs, equivalentPairs }).toEqual({
      a6DivergentPairs: 672,
      abortBoundaryPairs: 192,
      equivalentPairs: 5_280,
    });
  }, 120_000);
});
