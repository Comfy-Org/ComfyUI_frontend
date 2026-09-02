import * as Y from "yjs";
import { describe, expect, it } from "vitest";
import { applyOps, mint, project, type Op, type WorkflowJSON, type WorkflowNode } from "../src/index.js";
import { appliedMap, stampsMap } from "../src/doc.js";
import { loadCatalog } from "./helpers.js";

const catalog = loadCatalog();
const id = (tag: string) => (tag + "0".repeat(32)).slice(0, 32);

const source: WorkflowNode = {
  id: 10,
  type: "LoadImage",
  inputs: [],
  outputs: [{ name: "IMAGE", type: "IMAGE", links: [] }],
  widgets_values: [],
};

const destination: WorkflowNode = {
  id: 20,
  type: "PreviewImage",
  inputs: [{ name: "images", type: "IMAGE", link: null }],
  outputs: [],
  widgets_values: [],
};

const workflow: WorkflowJSON = {
  nodes: [source, destination],
  links: [],
  groups: [],
  extra: {},
  last_node_id: 20,
  last_link_id: 0,
};

function envelope(tag: string, actor: string, version: number) {
  return {
    op_id: id(tag),
    actor,
    base_version: version,
    stamp: [version, actor] as [number, string],
  };
}

describe("delete_node LWW loser with empty removed_links", () => {
  it("characterizes the accepted drop as projection-neutral and retry-idempotent", () => {
    // Current semantics record an accepted LWW drop in the op-id ledger, but
    // an empty removed_links list leaves node presence and wiring untouched.
    const doc = mint(workflow, catalog);
    const connect: Op = {
      op: "connect",
      ...envelope("connect", "human:seed", 1),
      link_id: 1,
      from_node: 10,
      from_slot: 0,
      to_node: 20,
      to_slot: 0,
      link_type: "IMAGE",
    };
    const winner: Op = {
      op: "add_node",
      ...envelope("winning-add", "agent:a", 9),
      node_id: 10,
      class_type: "LoadImage",
      pos: [],
      node: source,
    };
    const loser: Op = {
      op: "delete_node",
      ...envelope("losing-delete-empty", "human:z", 5),
      node_id: 10,
      removed_links: [],
    };

    expect(applyOps(doc, [connect, winner], catalog).outcomes.map(({ outcome }) => outcome)).toEqual([
      "applied",
      "applied",
    ]);
    const projectionBefore = project(doc, catalog);
    const stampsBefore = stampsMap(doc).toJSON();
    const bytesBefore = Y.encodeStateAsUpdate(doc);

    const first = applyOps(doc, [loser], catalog);

    expect(first.outcomes).toEqual([{ op_id: loser.op_id, outcome: "lww-dropped" }]);
    expect(project(doc, catalog)).toEqual(projectionBefore);
    expect(project(doc, catalog).nodes.some(({ id: nodeId }) => nodeId === 10)).toBe(true);
    expect(project(doc, catalog).links).toEqual([[1, 10, 0, 20, 0, "IMAGE"]]);
    expect(stampsMap(doc).toJSON()).toEqual(stampsBefore);
    expect(appliedMap(doc).has(loser.op_id)).toBe(true);

    const bytesAfterFirst = Y.encodeStateAsUpdate(doc);
    expect(bytesAfterFirst).not.toEqual(bytesBefore);

    expect(applyOps(doc, [loser], catalog).outcomes).toEqual([{ op_id: loser.op_id, outcome: "no-op" }]);
    expect(Y.encodeStateAsUpdate(doc)).toEqual(bytesAfterFirst);
    expect(project(doc, catalog)).toEqual(projectionBefore);
  });
});
