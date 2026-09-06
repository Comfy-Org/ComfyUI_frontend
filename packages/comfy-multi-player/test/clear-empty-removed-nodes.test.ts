import * as Y from "yjs";
import { describe, expect, it } from "vitest";
import { applyOps, mint, project, type ClearOp, type DeleteNodeOp, type WorkflowJSON } from "../src/index.js";
import { appliedMap } from "../src/doc.js";
import { loadCatalog } from "./helpers.js";

const catalog = loadCatalog();

function threeNodeWorkflow(withGroups: boolean): WorkflowJSON {
  const workflow: WorkflowJSON = {
    nodes: [
      {
        id: 1, type: "LoadImage", inputs: [],
        outputs: [{ name: "IMAGE", type: "IMAGE", links: [10] }], widgets_values: [],
      },
      {
        id: 2, type: "PreviewImage",
        inputs: [{ name: "images", type: "IMAGE", link: 10 }],
        outputs: [{ name: "IMAGE", type: "IMAGE", links: [11] }], widgets_values: [],
      },
      {
        id: 3, type: "PreviewImage",
        inputs: [{ name: "images", type: "IMAGE", link: 11 }], outputs: [], widgets_values: [],
      },
    ],
    links: [[10, 1, 0, 2, 0, "IMAGE"], [11, 2, 0, 3, 0, "IMAGE"]],
    last_node_id: 3,
    last_link_id: 11,
    extra: {},
  };
  if (withGroups) {
    workflow.groups = [
      {
        id: 1,
        title: "nodes 1-2",
        bounding: [0, 0, 640, 320],
        color: "#3f789e",
        font_size: 24,
        flags: {},
      },
    ];
  } else {
    delete workflow.groups;
  }
  return workflow;
}

function clearEmpty(baseVersion: number): ClearOp {
  return {
    op: "clear",
    op_id: String(baseVersion).padStart(32, "0"),
    actor: "alice",
    base_version: baseVersion,
    stamp: [baseVersion, "alice"],
    removed_nodes: [],
  };
}

describe("clear([]) current-behavior characterization", () => {
  it("keeps nodes and links when the document has no groups key", () => {
    const workflow = threeNodeWorkflow(false);
    expect(workflow.nodes).toHaveLength(3);
    expect(workflow.links).toHaveLength(2);
    const doc = mint(workflow, catalog);
    const before = project(doc, catalog);
    const beforeBytes = JSON.stringify(before);

    const op = clearEmpty(1);
    const result = applyOps(doc, [op], catalog);

    expect(result.outcomes).toEqual([{ op_id: "00000000000000000000000000000001", outcome: "no-op" }]);
    expect(JSON.stringify(project(doc, catalog))).toBe(beforeBytes);
    expect(appliedMap(doc).has(op.op_id)).toBe(true);

    const afterFirstApply = Y.encodeStateAsUpdate(doc);
    const retry = applyOps(doc, [op], catalog);
    expect(retry.outcomes).toEqual([{ op_id: op.op_id, outcome: "no-op" }]);
    expect(Y.encodeStateAsUpdate(doc)).toEqual(afterFirstApply);
  });

  it("resets an existing groups array even though removed_nodes is empty", () => {
    const workflow = threeNodeWorkflow(true);
    const doc = mint(workflow, catalog);
    const before = project(doc, catalog);
    const op = clearEmpty(2);

    const result = applyOps(doc, [op], catalog);
    const projected = project(doc, catalog);

    expect(result.outcomes).toEqual([{ op_id: "00000000000000000000000000000002", outcome: "applied" }]);
    expect(projected.nodes).toEqual(before.nodes);
    expect(projected.links).toEqual(before.links);
    expect(projected.groups).toEqual([]);

    const afterFirstApply = Y.encodeStateAsUpdate(doc);
    const retry = applyOps(doc, [op], catalog);
    expect(retry.outcomes).toEqual([{ op_id: op.op_id, outcome: "no-op" }]);
    expect(project(doc, catalog)).toEqual(projected);
    expect(Y.encodeStateAsUpdate(doc)).toEqual(afterFirstApply);

    const deleteNode: DeleteNodeOp = {
      op: "delete_node",
      op_id: "00000000000000000000000000000004",
      actor: "bob",
      base_version: 4,
      stamp: [4, "bob"],
      node_id: 3,
      removed_links: [11],
    };
    const snapshot = Y.encodeStateAsUpdate(mint(workflow, catalog));
    const projections = [[op, deleteNode], [deleteNode, op]].map((order) => {
      const fork = new Y.Doc();
      Y.applyUpdate(fork, snapshot);
      for (const orderedOp of order) {
        expect(applyOps(fork, [orderedOp], catalog).outcomes[0]?.outcome).not.toBe("rejected");
      }
      return project(fork, catalog);
    });
    expect(projections[0]).toEqual(projections[1]);
  });

  it("does not invent a missing groups key", () => {
    const workflow = threeNodeWorkflow(false);
    const doc = mint(workflow, catalog);

    const result = applyOps(doc, [clearEmpty(3)], catalog);
    const projected = project(doc, catalog);

    expect(result.outcomes).toEqual([{ op_id: "00000000000000000000000000000003", outcome: "no-op" }]);
    expect(projected.groups).toBeUndefined();
    expect("groups" in projected).toBe(false);
  });
});
