import { describe, expect, it } from "vitest";
import { stampsMap } from "../src/doc.js";
import {
  applyOps,
  mint,
  project,
  type ClearOp,
  type WidgetCatalog,
  type WorkflowJSON,
} from "../src/index.js";

const catalog: WidgetCatalog = {
  types: {
    LoadImage: { widget_order: [] },
    PreviewImage: { widget_order: [] },
  },
};

const stampTarget = (nodeId: number) => JSON.stringify(["node", String(nodeId)]);

function envelope(opId: string, baseVersion: number): Pick<ClearOp, "op_id" | "actor" | "base_version" | "stamp"> {
  return {
    op_id: opId,
    actor: "agent:clear-test",
    base_version: baseVersion,
    stamp: [baseVersion, "agent:clear-test"],
  };
}

function twoNodeWorkflow(): WorkflowJSON {
  return {
    nodes: [
      {
        id: 1,
        type: "LoadImage",
        inputs: [],
        outputs: [{ name: "IMAGE", type: "IMAGE", links: [7] }],
        widgets_values: [],
      },
      {
        id: 2,
        type: "PreviewImage",
        inputs: [{ name: "images", type: "IMAGE", link: 7 }],
        outputs: [],
        widgets_values: [],
      },
    ],
    links: [[7, 1, 0, 2, 0, "IMAGE"]],
    last_node_id: 2,
    last_link_id: 7,
  } as WorkflowJSON;
}

describe("clear with missing removed_nodes entries", () => {
  it("records a presence stamp for a nonexistent target while reporting no-op current behavior", () => {
    const doc = mint(twoNodeWorkflow(), catalog);
    const beforeStampKeys = Array.from(stampsMap(doc).keys());
    const clear: ClearOp = { op: "clear", ...envelope("a".repeat(32), 1), removed_nodes: [999] };

    expect(applyOps(doc, [clear], catalog).outcomes).toEqual([{ op_id: clear.op_id, outcome: "no-op" }]);

    expect(project(doc, catalog)).toEqual(twoNodeWorkflow());
    expect(Array.from(stampsMap(doc).keys()).sort()).toEqual([...beforeStampKeys, stampTarget(999)].sort());
    expect(stampsMap(doc).get(stampTarget(999))).toEqual([1, "agent:clear-test", clear.op_id]);
  });

  it("deletes present targets, records all listed target stamps, and leaves the missing target uninvented", () => {
    const doc = mint(twoNodeWorkflow(), catalog);
    const clear: ClearOp = { op: "clear", ...envelope("b".repeat(32), 2), removed_nodes: [1, 999, 2] };

    expect(applyOps(doc, [clear], catalog).outcomes).toEqual([{ op_id: clear.op_id, outcome: "applied" }]);

    const wf = project(doc, catalog);
    expect(wf.nodes).toEqual([]);
    expect(wf.links).toEqual([]);
    expect(stampsMap(doc).get(stampTarget(1))).toEqual([2, "agent:clear-test", clear.op_id]);
    expect(stampsMap(doc).get(stampTarget(2))).toEqual([2, "agent:clear-test", clear.op_id]);
    expect(stampsMap(doc).get(stampTarget(999))).toEqual([2, "agent:clear-test", clear.op_id]);
  });

  it("scrubs links incident to deleted nodes without creating links for missing node ids", () => {
    const doc = mint(twoNodeWorkflow(), catalog);
    const clear: ClearOp = { op: "clear", ...envelope("c".repeat(32), 3), removed_nodes: [1, 999] };

    expect(applyOps(doc, [clear], catalog).outcomes).toEqual([{ op_id: clear.op_id, outcome: "applied" }]);

    const wf = project(doc, catalog);
    expect(wf.nodes.map((node) => node.id)).toEqual([2]);
    expect(wf.links).toEqual([]);
    expect((wf.nodes[0]?.inputs?.[0] as { link?: number | null } | undefined)?.link).toBeNull();
    expect(stampsMap(doc).get(stampTarget(999))).toEqual([3, "agent:clear-test", clear.op_id]);
  });
});
