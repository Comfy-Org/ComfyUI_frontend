import * as Y from "yjs";
import { describe, expect, it } from "vitest";
import {
  applyOps,
  mint,
  type AddNodeOp,
  type DeleteNodeOp,
  type SetWidgetOp,
} from "../src/index.js";
import { loadCatalog, loadLwwVectors } from "./helpers.js";

const catalog = loadCatalog();
const baseWorkflow = loadLwwVectors().base_workflow;
const reusedOpId = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

function setWidget(value: number): SetWidgetOp {
  return {
    op: "set_widget",
    op_id: reusedOpId,
    actor: "human:op-id-reuse",
    base_version: 1,
    stamp: [1, "human:op-id-reuse"],
    node_id: 3308598398221244,
    widget: "steps",
    value,
  };
}

describe("op_id reuse", () => {
  it("treats an identical set_widget replay as a byte-identical no-op", () => {
    const doc = mint(baseWorkflow, catalog);
    const op = setWidget(25);
    expect(applyOps(doc, [op], catalog).outcomes).toEqual([{ op_id: reusedOpId, outcome: "applied" }]);
    const beforeReplay = Buffer.from(Y.encodeStateAsUpdate(doc));

    expect(applyOps(doc, [op], catalog).outcomes).toEqual([{ op_id: reusedOpId, outcome: "no-op" }]);
    expect(Buffer.from(Y.encodeStateAsUpdate(doc)).equals(beforeReplay)).toBe(true);
  });

  it("rejects a changed set_widget payload without mutating the document", () => {
    const doc = mint(baseWorkflow, catalog);
    expect(applyOps(doc, [setWidget(25)], catalog).outcomes[0]).toMatchObject({ outcome: "applied" });
    const beforeReuse = Buffer.from(Y.encodeStateAsUpdate(doc));

    expect(applyOps(doc, [setWidget(30)], catalog).outcomes).toEqual([
      {
        op_id: reusedOpId,
        outcome: "rejected",
        reason: {
          code: "op_id_reuse",
          message: `op_id '${reusedOpId}' was already applied with a different payload`,
        },
      },
    ]);
    expect(Buffer.from(Y.encodeStateAsUpdate(doc)).equals(beforeReuse)).toBe(true);
  });

  it("rejects reuse across add_node and delete_node op kinds", () => {
    const doc = mint(baseWorkflow, catalog);
    const sourceNode = baseWorkflow.nodes[0]!;
    const nodeId = 4444444444444;
    const add: AddNodeOp = {
      op: "add_node",
      op_id: reusedOpId,
      actor: "human:op-id-reuse",
      base_version: 1,
      stamp: [1, "human:op-id-reuse"],
      node_id: nodeId,
      class_type: sourceNode.type,
      pos: [100, 100],
      node: { ...sourceNode, id: nodeId, pos: [100, 100] },
    };
    const remove: DeleteNodeOp = {
      op: "delete_node",
      op_id: reusedOpId,
      actor: "human:op-id-reuse",
      base_version: 2,
      stamp: [2, "human:op-id-reuse"],
      node_id: nodeId,
      removed_links: [],
    };

    expect(applyOps(doc, [add], catalog).outcomes[0]).toMatchObject({ outcome: "applied" });
    const beforeReuse = Buffer.from(Y.encodeStateAsUpdate(doc));
    expect(applyOps(doc, [remove], catalog).outcomes[0]).toMatchObject({
      outcome: "rejected",
      reason: { code: "op_id_reuse" },
    });
    expect(Buffer.from(Y.encodeStateAsUpdate(doc)).equals(beforeReuse)).toBe(true);
  });
});
