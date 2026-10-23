import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import {
  applyOps,
  mint,
  project,
  type AddNodeOp,
  type DeleteNodeOp,
  type SetWidgetOp,
  type WidgetCatalog,
  type WorkflowJSON,
} from "../src/index.js";
import { appliedMap } from "../src/doc.js";

const catalog: WidgetCatalog = {
  types: {
    Primitive: { widget_order: ["value"] },
  },
};

const workflow = {
  nodes: [{ id: 100, type: "definition-1", inputs: [], outputs: [] }],
  links: [],
  definitions: {
    subgraphs: [{ id: "definition-1", nodes: [], links: [] }],
  },
} as unknown as WorkflowJSON;

function add(overrides: Partial<AddNodeOp> = {}): AddNodeOp {
  return {
    op: "add_node",
    op_id: "interioraddnode0000000000000001",
    actor: "agent:a",
    base_version: 1,
    stamp: [1, "agent:a"],
    path: ["100"],
    node_id: 3,
    class_type: "Primitive",
    pos: [10, 20],
    node: { id: 3, type: "Primitive", pos: [10, 20], inputs: [], outputs: [] },
    ...overrides,
  } as AddNodeOp;
}

function topLevelAdd(nodeId = 9): AddNodeOp {
  const op = add({
    op_id: `topadd${String(nodeId).padStart(26, "0")}`,
    node_id: nodeId,
    node: { id: nodeId, type: "Primitive", pos: [0, 0], inputs: [], outputs: [] },
  });
  delete op.path;
  return op;
}

function definitionNodes(doc: Y.Doc): WorkflowJSON["nodes"] {
  const definitions = project(doc, catalog).definitions as {
    subgraphs: Array<{ nodes: WorkflowJSON["nodes"] }>;
  };
  return definitions.subgraphs[0]!.nodes;
}

describe("interior add_node regression", () => {
  it("applies and projects a node inside the definition owned by an instance path", () => {
    const doc = mint(workflow, catalog);
    const op = add();

    expect(applyOps(doc, [op], catalog).outcomes).toEqual([
      { op_id: op.op_id, outcome: "applied" },
    ]);
    expect(definitionNodes(doc)).toEqual([
      { id: 3, type: "Primitive", pos: [10, 20], inputs: [], outputs: [] },
    ]);
    expect(project(doc, catalog).nodes).toEqual(workflow.nodes);
  });

  it("rejects a missing container path without mutation or consuming op_id", () => {
    const doc = mint(workflow, catalog);
    const op = add({ path: ["missing"] });
    const before = Y.encodeStateAsUpdate(doc);

    const trailing = topLevelAdd();
    expect(applyOps(doc, [op, trailing], catalog).outcomes).toEqual([
      {
        op_id: op.op_id,
        outcome: "rejected",
        reason: {
          code: "interior_container_not_found",
          message: "add_node: interior container missing not found",
        },
      },
      {
        op_id: trailing.op_id,
        outcome: "rejected",
        reason: { code: "batch_aborted", message: expect.any(String) },
      },
    ]);
    expect(Y.encodeStateAsUpdate(doc)).toEqual(before);
    expect(appliedMap(doc).has(op.op_id)).toBe(false);
  });

  it("refuses an interior add when two instances share the definition", () => {
    const shared = structuredClone(workflow) as unknown as WorkflowJSON;
    shared.nodes.push({ id: 101, type: "definition-1", inputs: [], outputs: [] });
    const doc = mint(shared, catalog);
    const op = add();
    const before = Y.encodeStateAsUpdate(doc);

    const trailing = topLevelAdd();
    expect(applyOps(doc, [op, trailing], catalog).outcomes).toEqual([
      {
        op_id: op.op_id,
        outcome: "rejected",
        reason: { code: "shared_definition_unforked", message: expect.any(String) },
      },
      {
        op_id: trailing.op_id,
        outcome: "rejected",
        reason: { code: "batch_aborted", message: expect.any(String) },
      },
    ]);
    expect(Y.encodeStateAsUpdate(doc)).toEqual(before);
    expect(appliedMap(doc).has(op.op_id)).toBe(false);
  });

  it("uses path-scoped presence stamps and deterministically orders concurrent additions", () => {
    const first = add();
    const second = add({
      op_id: "interioraddnode0000000000000002",
      actor: "agent:b",
      base_version: 2,
      stamp: [2, "agent:b"],
      node_id: 4,
      node: { id: 4, type: "Primitive", pos: [30, 40], inputs: [], outputs: [] },
    });

    const projections = [[first, second], [second, first]].map((order) => {
      const doc = mint(workflow, catalog);
      expect(applyOps(doc, order, catalog).outcomes.map(({ outcome }) => outcome)).toEqual([
        "applied",
        "applied",
      ]);
      return definitionNodes(doc);
    });

    expect(projections[0]).toEqual(projections[1]);
    expect(projections[0]!.map(({ id }) => id)).toEqual([3, 4]);
  });

  it("does not contend with a top-level node that has the same id", () => {
    const doc = mint(workflow, catalog);
    const topLevel = add();
    delete topLevel.path;
    const interior = add({
      op_id: "interioraddnode0000000000000002",
      actor: "agent:b",
      base_version: 2,
      stamp: [2, "agent:b"],
      node: { id: 3, type: "Primitive", pos: [30, 40], inputs: [], outputs: [] },
    });

    expect(applyOps(doc, [topLevel, interior], catalog).outcomes.map(({ outcome }) => outcome)).toEqual([
      "applied",
      "applied",
    ]);
    expect(project(doc, catalog).nodes.some(({ id }) => id === 3)).toBe(true);
    expect(definitionNodes(doc)).toEqual([
      { id: 3, type: "Primitive", pos: [30, 40], inputs: [], outputs: [] },
    ]);
  });

  it("treats an identical interior add retry as a byte-identical no-op", () => {
    const doc = mint(workflow, catalog);
    const op = add();
    expect(applyOps(doc, [op], catalog).outcomes[0]?.outcome).toBe("applied");
    const afterFirstApply = Y.encodeStateAsUpdate(doc);

    expect(applyOps(doc, [op], catalog).outcomes).toEqual([
      { op_id: op.op_id, outcome: "no-op" },
    ]);
    expect(Y.encodeStateAsUpdate(doc)).toEqual(afterFirstApply);
  });

  it("converges with container deletion when the container has a non-legacy incarnation", () => {
    const seeded = mint(workflow, catalog);
    const replacement = topLevelAdd(100);
    replacement.op_id = "containerreplacement00000000000001";
    replacement.actor = "agent:seed";
    replacement.base_version = 10;
    replacement.stamp = [10, "agent:seed"];
    replacement.node_incarnation = "container-v2";
    replacement.class_type = "definition-1";
    replacement.node = { id: 100, type: "definition-1", inputs: [], outputs: [] };
    expect(applyOps(seeded, [replacement], catalog).outcomes[0]?.outcome).toBe("applied");
    const snapshot = Y.encodeStateAsUpdate(seeded);
    const interior = add({
      container_incarnation: "container-v2",
      node_incarnation: "interior-v1",
      base_version: 15,
      stamp: [15, "agent:a"],
    });
    const remove: DeleteNodeOp = {
      op: "delete_node",
      op_id: "containerdelete000000000000000001",
      actor: "agent:b",
      base_version: 20,
      stamp: [20, "agent:b"],
      node_id: 100,
      removed_links: [],
    };

    const projections = [[interior, remove], [remove, interior]].map((order) => {
      const doc = new Y.Doc();
      Y.applyUpdate(doc, snapshot);
      expect(applyOps(doc, order, catalog).outcomes.map(({ outcome }) => outcome)).toEqual([
        "applied",
        "applied",
      ]);
      return project(doc, catalog);
    });
    expect(projections[0]).toEqual(projections[1]);
    expect(projections[0]!.nodes).toEqual([]);
    expect((projections[0]!.definitions as { subgraphs: Array<{ nodes: unknown[] }> }).subgraphs[0]!.nodes).toHaveLength(1);
  });

  it("clears canonical interior widget stamps when replacing the same node", () => {
    const doc = mint(workflow, catalog);
    const initial = add({
      node: { id: 3, type: "Primitive", pos: [10, 20], inputs: [], outputs: [], widgets_values: [0] },
    });
    const highWidget: SetWidgetOp = {
      op: "set_widget",
      op_id: "interiorwidgethigh00000000000001",
      actor: "agent:a",
      base_version: 10,
      stamp: [10, "agent:a"],
      node_id: 3,
      widget: "value",
      path: ["100", "3"],
      inner_widget: "value",
      value: 10,
    };
    const replacement = add({
      op_id: "interiorreplacement0000000000001",
      actor: "agent:b",
      base_version: 20,
      stamp: [20, "agent:b"],
      node: { id: 3, type: "Primitive", pos: [10, 20], inputs: [], outputs: [], widgets_values: [0] },
    });
    const lowWidget: SetWidgetOp = {
      ...highWidget,
      op_id: "interiorwidgetlow000000000000002",
      base_version: 5,
      stamp: [5, "agent:a"],
      value: 5,
    };

    expect(applyOps(doc, [initial], catalog).outcomes[0]?.outcome).toBe("applied");
    expect(applyOps(doc, [highWidget], catalog).outcomes[0]?.outcome).toBe("applied");
    expect(applyOps(doc, [replacement], catalog).outcomes[0]?.outcome).toBe("applied");
    expect(applyOps(doc, [lowWidget], catalog).outcomes[0]?.outcome).toBe("applied");
    expect((definitionNodes(doc)[0] as { widgets_values: unknown[] }).widgets_values).toEqual([5]);
  });
});
