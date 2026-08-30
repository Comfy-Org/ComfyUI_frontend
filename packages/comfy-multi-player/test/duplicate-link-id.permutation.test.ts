/**
 * Bounded exhaustive characterization of normalized `link_id` collisions.
 *
 * R-51 / bbc #104: distinct, schema-valid connects can name one links-map key.
 * Until stamped link ownership is implemented, the first arrival owns the
 * tuple while both disjoint endpoint writes survive. This suite deliberately
 * pins that divergence; it does not claim that arrival order is the desired
 * conflict policy.
 */
import * as Y from "yjs";
import { describe, expect, it } from "vitest";
import { applyOps, mint, project, type ConnectOp, type Op, type WorkflowJSON, type WorkflowNode } from "../src/index.js";
import { canonicalize, loadCatalog } from "./helpers.js";

const catalog = loadCatalog();
const LINK_ID_PAIRS = [
  [700, 700],
  [700, "700"],
  ["700", 700],
  ["700", "700"],
] as const;
const ACTORS = ["agent:pbt:0", "agent:pbt:1", "human:pbt:0", "human:pbt:1"] as const;
const VERSION_PAIRS = [[0, 0], [0, 1], [1, 0], [1, 1], [0, 9], [9, 0], [4, 4], [4, 5]] as const;
const ENDPOINT_PAIRS = [
  [[100, 200, 0], [101, 200, 1]],
  [[100, 200, 0], [102, 201, 0]],
  [[100, 200, 1], [103, 201, 1]],
  [[101, 200, 0], [102, 201, 1]],
  [[101, 201, 0], [103, 200, 1]],
  [[102, 200, 0], [103, 201, 0]],
  [[102, 200, 1], [100, 201, 1]],
  [[103, 200, 0], [101, 201, 1]],
] as const;
const EXPECTED_EXECUTIONS = 12_288;

function sourceNode(id: number): WorkflowNode {
  return {
    id,
    type: "CLIPTextEncode",
    pos: [id, 0],
    inputs: [{ name: "clip", type: "CLIP", link: null }],
    outputs: [{ name: "CONDITIONING", type: "CONDITIONING", links: [] }],
    widgets_values: [String(id)],
  };
}

function destinationNode(id: number): WorkflowNode {
  return {
    id,
    type: "KSampler",
    pos: [id, 100],
    inputs: [
      { name: "positive", type: "CONDITIONING", link: null },
      { name: "negative", type: "CONDITIONING", link: null },
    ],
    outputs: [{ name: "LATENT", type: "LATENT", links: [] }],
    widgets_values: [0, "fixed", 20, 8, "euler", "normal", 1],
  };
}

const BASE: WorkflowJSON = {
  nodes: [100, 101, 102, 103].map(sourceNode).concat([200, 201].map(destinationNode)),
  links: [],
  groups: [],
  config: {},
  extra: {},
  version: 0.4,
  last_node_id: 201,
  last_link_id: 0,
};

function opId(serial: number): string {
  return serial.toString(16).padStart(32, "0");
}

function connect(
  serial: number,
  actor: string,
  version: number,
  linkId: number | string,
  endpoint: readonly [number, number, number],
): ConnectOp {
  const [from_node, to_node, to_slot] = endpoint;
  return {
    op: "connect",
    op_id: opId(serial),
    actor,
    base_version: version,
    stamp: [version, actor],
    link_id: linkId,
    from_node,
    from_slot: 0,
    to_node,
    to_slot,
    link_type: "CONDITIONING",
  };
}

function run(ops: readonly Op[], batched: boolean): WorkflowJSON {
  const seed = Y.encodeStateAsUpdate(mint(BASE, catalog));
  const doc = new Y.Doc();
  Y.applyUpdate(doc, seed);
  const results = batched ? [applyOps(doc, [...ops], catalog)] : ops.map((op) => applyOps(doc, [op], catalog));
  expect(results.flatMap((result) => result.outcomes).every((outcome) => outcome.outcome === "applied")).toBe(true);
  return canonicalize(project(doc, catalog));
}

function tuple(wf: WorkflowJSON): unknown[] {
  expect(wf.links).toHaveLength(1);
  return wf.links[0] as unknown[];
}

describe("bounded exhaustive normalized link_id collisions", () => {
  it("covers every declared permutation and characterizes first-arrival tuple ownership", () => {
    let executions = 0;
    let serial = 1;
    for (const linkIds of LINK_ID_PAIRS) {
      for (const actorA of ACTORS) {
        for (const actorB of ACTORS) {
          if (actorA === actorB) continue;
          for (const versions of VERSION_PAIRS) {
            for (const endpoints of ENDPOINT_PAIRS) {
              const a = connect(serial++, actorA, versions[0], linkIds[0], endpoints[0]);
              const b = connect(serial++, actorB, versions[1], linkIds[1], endpoints[1]);
              for (const order of [[a, b], [b, a]] as const) {
                for (const batched of [true, false]) {
                  const repro = JSON.stringify({ linkIds, actors: [actorA, actorB], versions, endpoints, order: order.map((op) => op.op_id), batched });
                  const wf = run(order, batched);
                  expect(String(tuple(wf)[0]), repro).toBe("700");
                  expect(tuple(wf).slice(1, 5), repro).toEqual([
                    order[0].from_node,
                    order[0].from_slot,
                    order[0].to_node,
                    order[0].to_slot,
                  ]);
                  for (const op of [a, b]) {
                    const src = wf.nodes.find((node) => node.id === op.from_node)!;
                    const dst = wf.nodes.find((node) => node.id === op.to_node)!;
                    expect((src.outputs as { links: unknown[] }[])[0]!.links.map(String), repro).toContain("700");
                    expect(typeof op.to_slot, repro).toBe("number");
                    expect(String((dst.inputs as { link: unknown }[])[Number(op.to_slot)]!.link), repro).toBe("700");
                  }
                  executions++;
                }
              }
            }
          }
        }
      }
    }
    expect(executions).toBe(EXPECTED_EXECUTIONS);
  }, 60_000);
});
