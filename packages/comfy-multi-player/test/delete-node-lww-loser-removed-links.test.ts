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

function winningPresence(): Op {
  return {
    op: "add_node",
    ...envelope("winning-add", "agent:a", 9),
    node_id: 10,
    class_type: "LoadImage",
    pos: [],
    node: source,
  };
}

function seededDoc(): Y.Doc {
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

  expect(applyOps(doc, [connect, winningPresence()], catalog).outcomes.map(({ outcome }) => outcome)).toEqual([
    "applied",
    "applied",
  ]);
  expect(project(doc, catalog).links).toHaveLength(1);
  return doc;
}

function losingDelete(removedLinks: number[]): Op {
  return {
    op: "delete_node",
    ...envelope(`losing-delete-${removedLinks[0] ?? "none"}`, "human:z", 5),
    node_id: 10,
    removed_links: removedLinks,
  };
}

describe("delete_node LWW loser removed_links cleanup", () => {
  it("characterizes named-link cleanup as independent of the lost presence gate", () => {
    // Current semantics deliberately treat node presence and explicitly named
    // link severance as independent registers. A losing delete therefore keeps
    // the node and its presence stamp while still removing the named live link.
    const doc = seededDoc();
    const stampBefore = stampsMap(doc).toJSON();
    const bytesBefore = Y.encodeStateAsUpdate(doc);

    const result = applyOps(doc, [losingDelete([1])], catalog);

    expect(result.outcomes[0]?.outcome).toBe("applied");
    expect(project(doc, catalog).nodes.some(({ id }) => id === 10)).toBe(true);
    expect(stampsMap(doc).toJSON()).toEqual(stampBefore);
    expect(project(doc, catalog).links).toEqual([]);
    expect(Y.encodeStateAsUpdate(doc)).not.toEqual(bytesBefore);
  });

  it("returns lww-dropped when the losing delete names no installed link", () => {
    const base = mint(workflow, catalog);
    const snapshot = Y.encodeStateAsUpdate(base);
    const fork = () => {
      const doc = new Y.Doc();
      Y.applyUpdate(doc, snapshot);
      return doc;
    };

    const doc = fork();
    const reverse = fork();
    const winner = winningPresence();
    const op = losingDelete([999]);
    expect(applyOps(doc, [winner], catalog).outcomes.map(({ outcome }) => outcome)).toEqual(["applied"]);
    const stampBefore = stampsMap(doc).toJSON();
    const bytesBefore = Y.encodeStateAsUpdate(doc);

    const result = applyOps(doc, [op], catalog);

    expect(result.outcomes[0]).toEqual({ op_id: op.op_id, outcome: "lww-dropped" });
    expect(project(doc, catalog).nodes.some(({ id }) => id === 10)).toBe(true);
    expect(stampsMap(doc).toJSON()).toEqual(stampBefore);
    expect(project(doc, catalog).links).toEqual([]);
    expect(appliedMap(doc).has(op.op_id)).toBe(true);
    const bytesAfter = Y.encodeStateAsUpdate(doc);
    expect(bytesAfter).not.toEqual(bytesBefore);

    expect(applyOps(doc, [winner, op], catalog).outcomes).toEqual([
      { op_id: winner.op_id, outcome: "no-op" },
      { op_id: op.op_id, outcome: "no-op" },
    ]);
    expect(Y.encodeStateAsUpdate(doc)).toEqual(bytesAfter);

    expect(applyOps(reverse, [op, winner], catalog).outcomes.map(({ outcome }) => outcome)).toEqual([
      "applied",
      "applied",
    ]);
    expect(project(reverse, catalog)).toEqual(project(doc, catalog));
    const reverseBytes = Y.encodeStateAsUpdate(reverse);
    expect(applyOps(reverse, [op, winner], catalog).outcomes.map(({ outcome }) => outcome)).toEqual([
      "no-op",
      "no-op",
    ]);
    expect(Y.encodeStateAsUpdate(reverse)).toEqual(reverseBytes);
  });
});
