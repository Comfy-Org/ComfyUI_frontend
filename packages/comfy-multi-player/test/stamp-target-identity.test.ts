/**
 * Stamp-target identity is node-id-TYPE independent.
 *
 * FINDING (adversarial PR #6725, reproduced against the real applier): the doc
 * resolves nodes with `String(op.node_id)` (`nodesMap` is keyed by string), but
 * `writeTarget` built the `__stamps` key from the RAW `node_id`. An op carrying
 * `7` and an op carrying `"7"` therefore addressed the same node through two
 * different registers — the LWW gate never compared them, and the pair
 * converged on whichever arrived last. Same §2.5 break, same shape as the
 * concrete-input one; interior/subgraph writes already normalized
 * (`op.path.map(String)`) and survived the attack, so this makes every case
 * match their treatment.
 *
 * `NodeId` is `string | number` by contract (types.ts) precisely because
 * historical workflows carry string ids and subgraph addresses are strings like
 * `"57:3"` — so mixed-type traffic is legal, not malformed input.
 */
import * as Y from "yjs";
import { describe, expect, it } from "vitest";
import {
  applyOps,
  mint,
  project,
  writeTarget,
  type ConnectOp,
  type Op,
  type SetWidgetOp,
  type WorkflowJSON,
} from "../src/index.js";
import { canonicalize, loadCatalog } from "./helpers.js";

const catalog = loadCatalog();
const AGENT = "agent:th_8f2c:12";
const HUMAN = "human:u_41ab:tab_2";

function opId(tag: string): string {
  return (tag + "0".repeat(32)).slice(0, 32);
}

/** Node 7 is a NUMBER id; node 8 feeds it. */
function base(): WorkflowJSON {
  return {
    last_node_id: 8,
    last_link_id: 0,
    nodes: [
      {
        id: 7,
        type: "KSampler",
        pos: [0, 0],
        size: [1, 1],
        flags: {},
        order: 1,
        mode: 0,
        inputs: [
          { name: "model", type: "MODEL", link: null },
          { name: "positive", type: "CONDITIONING", link: null },
          { name: "negative", type: "CONDITIONING", link: null },
          { name: "latent_image", type: "LATENT", link: null },
        ],
        outputs: [{ name: "LATENT", type: "LATENT", links: [] }],
        properties: {},
        widgets_values: [0, "fixed", 20, 8.0, "euler", "simple", 1.0],
      },
      {
        id: 8,
        type: "CLIPTextEncode",
        pos: [0, 0],
        size: [1, 1],
        flags: {},
        order: 0,
        mode: 0,
        inputs: [{ name: "clip", type: "CLIP", link: null }],
        outputs: [{ name: "CONDITIONING", type: "CONDITIONING", links: [] }],
        properties: {},
        widgets_values: ["t"],
      },
      {
        id: 9,
        type: "CLIPTextEncode",
        pos: [0, 0],
        size: [1, 1],
        flags: {},
        order: 0,
        mode: 0,
        inputs: [{ name: "clip", type: "CLIP", link: null }],
        outputs: [{ name: "CONDITIONING", type: "CONDITIONING", links: [] }],
        properties: {},
        widgets_values: ["u"],
      },
    ],
    links: [],
    groups: [],
    extra: {},
    version: 0.4,
  };
}

function setSteps(tag: string, actor: string, bv: number, nodeId: string | number, value: number): SetWidgetOp {
  return {
    op: "set_widget",
    op_id: opId(tag),
    actor,
    base_version: bv,
    stamp: [bv, actor],
    node_id: nodeId,
    widget: "steps",
    value,
  };
}

function connectTo(
  tag: string,
  actor: string,
  bv: number,
  linkId: number,
  fromNode: string | number,
  toNode: string | number,
): ConnectOp {
  return {
    op: "connect",
    op_id: opId(tag),
    actor,
    base_version: bv,
    stamp: [bv, actor],
    link_id: linkId,
    from_node: fromNode,
    from_slot: 0,
    to_node: toNode,
    to_slot: 1,
    link_type: "CONDITIONING",
  };
}

function run(ops: Op[]): WorkflowJSON {
  const doc = new Y.Doc();
  Y.applyUpdate(doc, Y.encodeStateAsUpdate(mint(base(), catalog)));
  expect(applyOps(doc, ops, catalog).outcomes.find((outcome) => outcome.outcome === "rejected")).toBeUndefined();
  return project(doc, catalog);
}

function steps(wf: WorkflowJSON): unknown {
  const node = wf.nodes.find((n) => String(n.id) === "7")!;
  const order = catalog.types["KSampler"]!.widget_order;
  return (node.widgets_values as unknown[])[order.indexOf("steps")];
}

describe("stamp targets normalize node ids to strings", () => {
  it("writeTarget: a numeric and a string node id produce the SAME key", () => {
    expect(writeTarget(setSteps("a1", AGENT, 5, 7, 111))).toEqual(
      writeTarget(setSteps("a2", HUMAN, 9, "7", 999)),
    );
    expect(writeTarget(connectTo("b1", AGENT, 5, 1, 8, 7))).toEqual(
      writeTarget(connectTo("b2", HUMAN, 9, 2, 8, "7")),
    );
    const del = {
      op: "delete_node",
      op_id: opId("c1"),
      actor: AGENT,
      base_version: 5,
      stamp: [5, AGENT],
      node_id: 7,
      removed_links: [],
    } as unknown as Op;
    const delStr = { ...del, node_id: "7" } as Op;
    expect(writeTarget(del)).toEqual(writeTarget(delStr));
  });

  it("set_widget: mixed-type node ids converge on the higher stamp in both orders", () => {
    // Before normalization these wrote ["widget",7,"steps"] and
    // ["widget","7","steps"] — two registers — so the LAST arrival won.
    const numeric = setSteps("d1", AGENT, 5, 7, 111);
    const stringy = setSteps("d2", HUMAN, 9, "7", 999);
    const forward = run([numeric, stringy]);
    const reverse = run([stringy, numeric]);
    expect(steps(forward)).toBe(999);
    expect(steps(reverse)).toBe(999);
    expect(JSON.stringify(canonicalize(forward))).toBe(JSON.stringify(canonicalize(reverse)));
  });

  it("set_widget: the lower stamp loses even when it carries the other id type", () => {
    const numericWins = setSteps("e1", HUMAN, 9, 7, 111);
    const stringLoses = setSteps("e2", AGENT, 5, "7", 999);
    expect(steps(run([numericWins, stringLoses]))).toBe(111);
    expect(steps(run([stringLoses, numericWins]))).toBe(111);
  });

  it("connect: mixed-type to_node ids contend for ONE input register", () => {
    const numeric = connectTo("f1", AGENT, 5, 501, 8, 7);
    const stringy = connectTo("f2", HUMAN, 9, 502, 9, "7");
    const link = (wf: WorkflowJSON): unknown =>
      (wf.nodes.find((n) => String(n.id) === "7")!.inputs as { link: unknown }[])[1]!.link;
    const forward = run([numeric, stringy]);
    const reverse = run([stringy, numeric]);
    expect(link(forward)).toBe(502);
    expect(link(reverse)).toBe(502);
    // Exactly one link survives — the loser leaves no record in either order.
    expect(forward.links.map((l) => (l as unknown[])[0])).toEqual([502]);
    expect(reverse.links.map((l) => (l as unknown[])[0])).toEqual([502]);
  });
});
