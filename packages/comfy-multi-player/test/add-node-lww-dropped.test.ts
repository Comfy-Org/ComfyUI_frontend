import * as Y from "yjs";
import { describe, expect, it } from "vitest";
import {
  appliedOpIds,
  applyOps,
  mint,
  project,
  readStamps,
  type AddNodeOp,
  type WorkflowJSON,
  type WorkflowNode,
} from "../src/index.js";
import { loadCatalog } from "./helpers.js";

const catalog = loadCatalog();
const id = (tag: string) => (tag + "0".repeat(32)).slice(0, 32);
const nodeStampKey = JSON.stringify(["node", "10"]);

function baseNode(): WorkflowNode {
  return {
    id: 10,
    type: "LoadImage",
    title: "original",
    inputs: [],
    outputs: [{ name: "IMAGE", type: "IMAGE", links: [] }],
    widgets_values: ["original.png"],
    pos: [10, 20],
  };
}

function base(): WorkflowJSON {
  return {
    nodes: [baseNode()],
    links: [],
    groups: [],
    extra: {},
    last_node_id: 10,
    last_link_id: 0,
  };
}

function addNode(tag: string, actor: string, version: number, node: WorkflowNode): AddNodeOp {
  return {
    op: "add_node",
    op_id: id(tag),
    actor,
    base_version: version,
    stamp: [version, actor],
    node_id: 10,
    class_type: "LoadImage",
    pos: node.pos ?? [],
    node,
  };
}

describe("add_node presence LWW gate", () => {
  it("drops a lower-or-equal re-add without mutating the existing node or stamp", () => {
    const snapshot = Y.encodeStateAsUpdate(mint(base(), catalog));
    const fork = () => {
      const forked = new Y.Doc();
      Y.applyUpdate(forked, snapshot);
      return forked;
    };
    const doc = fork();
    const winner = addNode("winner", "agent:a", 5, {
      ...baseNode(),
      title: "winner",
      widgets_values: ["winner.png"],
      pos: [30, 40],
    });
    expect(applyOps(doc, [winner], catalog).outcomes).toEqual([{ op_id: winner.op_id, outcome: "applied" }]);

    const projectedWinner = project(doc, catalog).nodes[0];
    const winningStamp = readStamps(doc)[nodeStampKey];
    expect(projectedWinner).toMatchObject({
      id: 10,
      title: "winner",
      type: "LoadImage",
      widgets_values: ["winner.png"],
      pos: [30, 40],
    });
    expect(winningStamp).toEqual([5, "agent:a", winner.op_id]);

    const lower = addNode("lower", "human:z", 3, {
      ...baseNode(),
      title: "lower loser",
      widgets_values: ["lower.png"],
      pos: [50, 60],
    });
    const beforeLower = Buffer.from(Y.encodeStateAsUpdate(doc));
    expect(applyOps(doc, [lower], catalog).outcomes).toEqual([{ op_id: lower.op_id, outcome: "lww-dropped" }]);
    expect(Buffer.from(Y.encodeStateAsUpdate(doc)).equals(beforeLower)).toBe(false);
    expect(project(doc, catalog).nodes).toEqual([projectedWinner]);
    expect(readStamps(doc)[nodeStampKey]).toEqual(winningStamp);
    expect(appliedOpIds(doc)).toContain(lower.op_id);

    const beforeLowerRetry = Buffer.from(Y.encodeStateAsUpdate(doc));
    expect(applyOps(doc, [lower], catalog).outcomes).toEqual([{ op_id: lower.op_id, outcome: "no-op" }]);
    expect(Buffer.from(Y.encodeStateAsUpdate(doc)).equals(beforeLowerRetry)).toBe(true);
    expect(project(doc, catalog).nodes).toEqual([projectedWinner]);
    expect(readStamps(doc)[nodeStampKey]).toEqual(winningStamp);

    const equal = addNode("equal", "agent:a", 5, {
      ...baseNode(),
      title: "equal loser",
      widgets_values: ["equal.png"],
      pos: [70, 80],
    });
    const beforeEqual = Buffer.from(Y.encodeStateAsUpdate(doc));
    expect(applyOps(doc, [equal], catalog).outcomes).toEqual([{ op_id: equal.op_id, outcome: "lww-dropped" }]);
    expect(Buffer.from(Y.encodeStateAsUpdate(doc)).equals(beforeEqual)).toBe(false);
    expect(project(doc, catalog).nodes).toEqual([projectedWinner]);
    expect(readStamps(doc)[nodeStampKey]).toEqual(winningStamp);
    expect(appliedOpIds(doc)).toContain(equal.op_id);

    const reverse = fork();
    expect(applyOps(reverse, [equal, lower, winner], catalog).outcomes).toEqual([
      { op_id: equal.op_id, outcome: "applied" },
      { op_id: lower.op_id, outcome: "lww-dropped" },
      { op_id: winner.op_id, outcome: "applied" },
    ]);
    expect(project(reverse, catalog)).toEqual(project(doc, catalog));
  });
});
