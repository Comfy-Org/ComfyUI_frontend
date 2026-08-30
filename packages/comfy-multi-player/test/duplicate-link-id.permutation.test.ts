/**
 * Bounded exhaustive characterization of normalized `link_id` collisions.
 *
 * RUL-104 option B: the greatest embedded stamp for one normalized link id
 * owns the complete tuple and every coherent endpoint reference.
 */
import * as Y from "yjs";
import { readFileSync } from "node:fs";
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
const fixture = JSON.parse(readFileSync(new URL("../fixtures/golden-vectors/link-identity.json", import.meta.url), "utf8")) as {
  cases: Array<{ name: string; a: FixtureOp; b: FixtureOp; winner: "a" | "b" }>;
};
type FixtureOp = { link_id: number | string; base_version: number; actor: string; envelope_base_version?: number; envelope_actor?: string; op_id: string; endpoint: [number, number, number] };

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
  expect(results.flatMap((result) => result.outcomes).every((outcome) => ["applied", "lww-dropped"].includes(outcome.outcome))).toBe(true);
  return canonicalize(project(doc, catalog));
}

function tuple(wf: WorkflowJSON): unknown[] {
  expect(wf.links).toHaveLength(1);
  return wf.links[0] as unknown[];
}

function winner(a: ConnectOp, b: ConnectOp): ConnectOp {
  const left = [Number(a.stamp?.[0]), String(a.stamp?.[1]), a.op_id] as const;
  const right = [Number(b.stamp?.[0]), String(b.stamp?.[1]), b.op_id] as const;
  if (left[0] !== right[0]) return left[0] > right[0] ? a : b;
  if (left[1] !== right[1]) return left[1] > right[1] ? a : b;
  return left[2] > right[2] ? a : b;
}

function assertCoherentGraph(wf: WorkflowJSON, owner: ConnectOp, repro: string): void {
  expect(tuple(wf).slice(1, 6), repro).toEqual([owner.from_node, owner.from_slot, owner.to_node, owner.to_slot, owner.link_type]);
  const tupleIds = (wf.links as unknown[][]).map((link) => String(link[0]));
  expect(new Set(tupleIds).size, repro).toBe(tupleIds.length);
  const live = new Set(tupleIds);
  const refs: string[] = [];
  for (const node of wf.nodes) {
    for (const input of (node.inputs ?? []) as Array<{ link?: unknown }>) if (input.link != null) {
      refs.push(String(input.link));
      expect(live.has(String(input.link)), repro).toBe(true);
    }
    for (const output of (node.outputs ?? []) as Array<{ links?: unknown[] }>) for (const linkId of output.links ?? []) {
      refs.push(String(linkId));
      expect(live.has(String(linkId)), repro).toBe(true);
    }
  }
  expect(refs, repro).toEqual(["700", "700"]);
}

describe("bounded exhaustive normalized link_id collisions", () => {
  it("replays every language-neutral parity vector in both arrival orders", () => {
    let executions = 0;
    const make = (value: FixtureOp): ConnectOp => ({
      op: "connect", op_id: value.op_id, actor: value.envelope_actor ?? value.actor, base_version: value.envelope_base_version ?? value.base_version,
      stamp: [value.base_version, value.actor], link_id: value.link_id, from_node: value.endpoint[0],
      from_slot: 0, to_node: value.endpoint[1], to_slot: value.endpoint[2], link_type: "CONDITIONING",
    });
    for (const vector of fixture.cases) {
      const a = make(vector.a);
      const b = make(vector.b);
      for (const order of [[a, b], [b, a]] as const) {
        const repro = JSON.stringify({ fixture: vector.name, order: order.map((op) => op.op_id) });
        assertCoherentGraph(run(order, false), vector.winner === "a" ? a : b, repro);
        executions++;
      }
    }
    expect(executions).toBe(6);
  });

  it("covers every declared permutation with stamped complete-tuple ownership", () => {
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
                  assertCoherentGraph(wf, winner(a, b), repro);
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
