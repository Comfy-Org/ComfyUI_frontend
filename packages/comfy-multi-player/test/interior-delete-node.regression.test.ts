import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import {
  applyOps,
  mint,
  project,
  type AddNodeOp,
  type DeleteNodeOp,
  type WidgetCatalog,
  type WorkflowJSON,
} from "../src/index.js";

const catalog: WidgetCatalog = { types: { Primitive: { widget_order: [] } } };

function workflow(instances = 1): WorkflowJSON {
  return {
    nodes: Array.from({ length: instances }, (_, index) => ({
      id: 70 + index,
      type: "definition-delete",
      inputs: [],
      outputs: [],
    })),
    links: [],
    definitions: {
      subgraphs: [{
        id: "definition-delete",
        nodes: [
          { id: 21, type: "Primitive", inputs: [], outputs: [{ name: "OUT", type: "*", links: [91] }] },
          { id: 22, type: "Primitive", inputs: [{ name: "IN", type: "*", link: 91 }], outputs: [] },
        ],
        links: [{ id: 91, origin_id: 21, origin_slot: 0, target_id: 22, target_slot: 0, type: "*" }],
      }],
    },
  } as unknown as WorkflowJSON;
}

function remove(overrides: Partial<DeleteNodeOp> = {}): DeleteNodeOp {
  return {
    op: "delete_node",
    op_id: "interiordeletenode00000000000001",
    actor: "agent:a",
    base_version: 2,
    stamp: [2, "agent:a"],
    path: ["70"],
    node_id: 22,
    removed_links: [91],
    ...overrides,
  };
}

function definition(doc: Y.Doc) {
  return (project(doc, catalog).definitions as {
    subgraphs: Array<{ nodes: WorkflowJSON["nodes"]; links: Array<Record<string, unknown>> }>;
  }).subgraphs[0]!;
}

describe("interior delete_node regression", () => {
  it("deletes the addressed interior node and its links without touching a same-id root node", () => {
    const seeded = workflow();
    seeded.nodes.push({ id: 22, type: "Primitive", inputs: [], outputs: [] });
    const doc = mint(seeded, catalog);
    const op = remove();

    expect(applyOps(doc, [op], catalog).outcomes).toEqual([{ op_id: op.op_id, outcome: "applied" }]);
    expect(project(doc, catalog).nodes.some(({ id }) => id === 22)).toBe(true);
    expect(definition(doc).nodes.map(({ id }) => id)).toEqual([21]);
    expect(definition(doc).links).toEqual([]);
    expect((definition(doc).nodes[0]!.outputs![0] as { links: unknown[] }).links).toEqual([]);
  });

  it("refuses to mutate a shared definition", () => {
    const doc = mint(workflow(2), catalog);
    const before = Y.encodeStateAsUpdate(doc);
    const op = remove();

    const trailing: DeleteNodeOp = {
      op: "delete_node",
      op_id: "interiordeletetrailing0000000003",
      actor: "agent:b",
      base_version: 3,
      stamp: [3, "agent:b"],
      node_id: 70,
      removed_links: [],
    };

    expect(applyOps(doc, [op, trailing], catalog).outcomes).toMatchObject([
      { op_id: op.op_id, outcome: "rejected", reason: { code: "shared_definition_unforked" } },
      { op_id: trailing.op_id, outcome: "rejected", reason: { code: "batch_aborted" } },
    ]);
    expect(Y.encodeStateAsUpdate(doc)).toEqual(before);
    expect(applyOps(doc, [op], catalog).outcomes[0]).toMatchObject({
      outcome: "rejected",
      reason: { code: "shared_definition_unforked" },
    });
    expect(Y.encodeStateAsUpdate(doc)).toEqual(before);
  });

  it("replays a successful interior delete as a byte-identical no-op", () => {
    const doc = mint(workflow(), catalog);
    const op = remove();
    applyOps(doc, [op], catalog);
    const after = Y.encodeStateAsUpdate(doc);

    expect(applyOps(doc, [op], catalog).outcomes).toEqual([{ op_id: op.op_id, outcome: "no-op" }]);
    expect(Y.encodeStateAsUpdate(doc)).toEqual(after);
  });

  it("scrubs a removed link from the definition's subgraph input linkIds", () => {
    const seeded = workflow();
    const subgraph = (seeded.definitions as { subgraphs: Array<Record<string, unknown>> }).subgraphs[0]!;
    subgraph.inputs = [{ id: "input-a", name: "a", type: "*", linkIds: [92, 93] }];
    (subgraph.links as unknown[]).push(
      { id: 92, origin_id: -10, origin_slot: 0, target_id: 22, target_slot: 1, type: "*" },
      { id: 93, origin_id: -10, origin_slot: 0, target_id: 21, target_slot: 0, type: "*" },
    );
    const doc = mint(seeded, catalog);

    applyOps(doc, [remove({ removed_links: [91, 92] })], catalog);
    expect(definition(doc).links.map(({ id }) => id)).toEqual([93]);
    expect((definition(doc) as unknown as { inputs: Array<{ linkIds: unknown[] }> }).inputs[0]!.linkIds).toEqual([93]);
  });

  it("shares a path-scoped presence register with an interior re-add", () => {
    const deletion = remove();
    const replacement: AddNodeOp = {
      op: "add_node",
      op_id: "interiorreplacement0000000000002",
      actor: "agent:b",
      base_version: 3,
      stamp: [3, "agent:b"],
      path: ["70"],
      node_id: 22,
      class_type: "Primitive",
      pos: [4, 5],
      node: { id: 22, type: "Primitive", pos: [4, 5], inputs: [], outputs: [] },
    };

    const projections = [[deletion, replacement], [replacement, deletion]].map((ops) => {
      const doc = mint(workflow(), catalog);
      applyOps(doc, ops, catalog);
      return project(doc, catalog);
    });
    expect(projections[0]).toEqual(projections[1]);
    expect((projections[0]!.definitions as { subgraphs: Array<{ nodes: unknown[] }> }).subgraphs[0]!.nodes).toHaveLength(2);
  });

  it("keeps definition node order convergent when a losing delete races a re-add and a new add", () => {
    const interiorAdd = (nodeId: number, counter: number, actor: string, opId: string): AddNodeOp => ({
      op: "add_node",
      op_id: opId,
      actor,
      base_version: counter,
      stamp: [counter, actor],
      path: ["70"],
      node_id: nodeId,
      class_type: "Primitive",
      pos: [4, 5],
      node: { id: nodeId, type: "Primitive", pos: [4, 5], inputs: [], outputs: [] },
    });
    const ops = [
      remove(),
      interiorAdd(22, 4, "agent:b", "interiorreplacement0000000000004"),
      interiorAdd(40, 3, "agent:c", "interioraddition00000000000000005"),
    ];
    const orders = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]];

    const nodeOrders = orders.map((order) => {
      const doc = mint(workflow(), catalog);
      for (const index of order) applyOps(doc, [ops[index]!], catalog);
      return definition(doc).nodes.map(({ id }) => id);
    });
    for (const [index, nodeOrder] of nodeOrders.entries()) {
      expect(nodeOrder, `arrival order ${orders[index]!.join(",")}`).toEqual([21, 22, 40]);
    }
  });
});
