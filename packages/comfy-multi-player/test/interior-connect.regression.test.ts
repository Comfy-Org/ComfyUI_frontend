import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import {
  applyOps,
  mint,
  project,
  type ConnectOp,
  type DeleteNodeOp,
  type WidgetCatalog,
  type WorkflowJSON,
} from "../src/index.js";
import { appliedMap } from "../src/doc.js";

const catalog: WidgetCatalog = {
  types: {
    Source: { widget_order: [] },
    Sink: { widget_order: [] },
  },
};

const workflow = {
  nodes: [{ id: 100, type: "definition-1", inputs: [], outputs: [] }],
  links: [],
  definitions: {
    subgraphs: [
      {
        id: "definition-1",
        nodes: [
          {
            id: 1,
            type: "Source",
            inputs: [],
            outputs: [{ name: "text", type: "STRING", links: null }],
          },
          {
            id: 2,
            type: "Sink",
            inputs: [{ name: "text", type: "STRING", link: null }],
            outputs: [],
          },
        ],
        links: [],
      },
    ],
  },
} as unknown as WorkflowJSON;

function connect(overrides: Partial<ConnectOp> = {}): ConnectOp {
  return {
    op: "connect",
    op_id: "interiorconnect0000000000000001",
    actor: "human:a",
    base_version: 1,
    stamp: [1, "human:a"],
    path: ["100"],
    link_id: 41,
    from_node: 1,
    from_slot: 0,
    to_node: 2,
    to_slot: 0,
    link_type: "STRING",
    ...overrides,
  } as ConnectOp;
}

function remove(node_id = 100): DeleteNodeOp {
  return {
    op: "delete_node",
    op_id: `delete${node_id}0000000000000000000000`,
    actor: "human:b",
    base_version: 2,
    stamp: [2, "human:b"],
    node_id,
    removed_links: [],
  };
}

function definitionOf(doc: Y.Doc) {
  return (project(doc, catalog).definitions as {
    subgraphs: Array<{
      nodes: Array<{
        id: number;
        inputs?: Array<{ link: number | null }>;
        outputs?: Array<{ links: number[] | null }>;
      }>;
      links: Array<{ id: number }>;
    }>;
  }).subgraphs[0]!;
}

describe("interior connect regression", () => {
  it("regression: retained host connect projects identically in both connect/delete orders", () => {
    const snapshot = Y.encodeStateAsUpdate(mint(workflow, catalog));
    const projections = [[connect(), remove()], [remove(), connect()]].map((order) => {
      const doc = new Y.Doc();
      Y.applyUpdate(doc, snapshot);
      const outcomes = order.flatMap((op) => applyOps(doc, [op], catalog).outcomes);
      expect(outcomes.map(({ outcome }) => outcome)).toEqual(["applied", "applied"]);
      expect(project(doc, catalog).nodes).toEqual([]);
      const definition = definitionOf(doc);
      expect(definition.links).toEqual([{ id: 41, origin_id: 1, origin_slot: 0, target_id: 2, target_slot: 0, type: "STRING" }]);
      expect(definition.nodes.find(({ id }) => id === 1)?.outputs?.[0]?.links).toEqual([41]);
      expect(definition.nodes.find(({ id }) => id === 2)?.inputs?.[0]?.link).toBe(41);
      return definition;
    });
    expect(projections[0]).toEqual(projections[1]);
  });

  it("regression: retained shared definitions reject without mutation in both orders", () => {
    const shared = structuredClone(workflow) as unknown as WorkflowJSON;
    shared.nodes.push({ id: 101, type: "definition-1", inputs: [], outputs: [] });
    const snapshot = Y.encodeStateAsUpdate(mint(shared, catalog));
    const projections = [[connect(), remove()], [remove(), connect()]].map((order) => {
      const doc = new Y.Doc();
      Y.applyUpdate(doc, snapshot);
      for (const op of order) {
        const before = Y.encodeStateAsUpdate(doc);
        const outcome = applyOps(doc, [op], catalog).outcomes[0]!;
        if (op.op === "connect") {
          expect(outcome).toMatchObject({ outcome: "rejected", reason: { code: "shared_definition_unforked" } });
          expect(Y.encodeStateAsUpdate(doc)).toEqual(before);
          expect(appliedMap(doc).has(op.op_id)).toBe(false);
        } else {
          expect(outcome.outcome).toBe("applied");
        }
      }
      return definitionOf(doc);
    });
    expect(projections[0]).toEqual(projections[1]);
  });

  it("regression: retained outer route supports a nested instance host path", () => {
    const nested = structuredClone(workflow) as unknown as WorkflowJSON & {
      definitions: { subgraphs: Array<Record<string, unknown>> };
    };
    const leafNodes = nested.definitions.subgraphs[0]!.nodes;
    nested.definitions.subgraphs[0]!.nodes = [{ id: 10, type: "definition-2", inputs: [], outputs: [] }];
    nested.definitions.subgraphs.push({
      id: "definition-2",
      nodes: leafNodes,
      links: [],
    });
    const doc = mint(nested, catalog);
    expect(applyOps(doc, [remove()], catalog).outcomes[0]?.outcome).toBe("applied");
    const op = connect({ path: [100, "10"] });
    expect(applyOps(doc, [op], catalog).outcomes).toEqual([{ op_id: op.op_id, outcome: "applied" }]);
    const definitions = (project(doc, catalog).definitions as { subgraphs: Array<{ id: string; links: unknown[] }> }).subgraphs;
    expect(definitions.find(({ id }) => id === "definition-2")?.links).toEqual([
      { id: 41, origin_id: 1, origin_slot: 0, target_id: 2, target_slot: 0, type: "STRING" },
    ]);
  });

  it("regression: direct definition connect remains an unsupported no-op", () => {
    const doc = mint(workflow, catalog);
    expect(applyOps(doc, [remove()], catalog).outcomes[0]?.outcome).toBe("applied");
    const op = connect({ path: ["definition-1"] });
    const before = definitionOf(doc);
    expect(applyOps(doc, [op], catalog).outcomes).toEqual([{ op_id: op.op_id, outcome: "no-op" }]);
    expect(definitionOf(doc)).toEqual(before);
  });

  it("normalizes numeric and string instance/link aliases across both arrival orders", () => {
    const low = connect({ path: [100], link_id: 41 });
    const high = connect({ op_id: "alias-high", actor: "human:b", base_version: 2, stamp: [2, "human:b"], path: ["100"], link_id: "41" });
    const projections = [[low, high], [high, low]].map((order) => {
      const doc = mint(workflow, catalog);
      for (const op of order) expect(applyOps(doc, [op], catalog).outcomes[0]?.outcome).not.toBe("rejected");
      return definitionOf(doc);
    });
    expect(projections[0]).toEqual(projections[1]);
    expect(projections[0]!.links).toHaveLength(1);
  });

  it("applies and projects a concrete link inside one subgraph definition", () => {
    const doc = mint(workflow, catalog);
    const op = connect();

    expect(applyOps(doc, [op], catalog).outcomes).toEqual([
      { op_id: op.op_id, outcome: "applied" },
    ]);

    const definitions = project(doc, catalog).definitions as {
      subgraphs: Array<{
        nodes: Array<{
          id: number;
          inputs?: Array<{ link: number | null }>;
          outputs?: Array<{ links: number[] | null }>;
        }>;
        links: unknown[];
      }>;
    };
    const definition = definitions.subgraphs[0]!;

    expect(definition.links).toEqual([
      {
        id: 41,
        origin_id: 1,
        origin_slot: 0,
        target_id: 2,
        target_slot: 0,
        type: "STRING",
      },
    ]);
    expect(definition.nodes.find(({ id }) => id === 1)?.outputs?.[0]?.links).toEqual([41]);
    expect(definition.nodes.find(({ id }) => id === 2)?.inputs?.[0]?.link).toBe(41);
  });

  it.each([
    ["empty path", { path: [] }],
    [
      "interior autogrow",
      {
        grow: { name: "text", type: "STRING", grow_id: "grow-1" },
        to_slot: undefined,
      },
    ],
  ])("rejects %s before changing document bytes or consuming op_id", (_name, invalid) => {
    const doc = mint(workflow, catalog);
    const op = connect(invalid as unknown as Partial<ConnectOp>);
    const before = Y.encodeStateAsUpdate(doc);

    const result = applyOps(doc, [op], catalog);

    expect(result.outcomes).toEqual([
      {
        op_id: op.op_id,
        outcome: "rejected",
        reason: { code: "malformed_op", message: expect.any(String) },
      },
    ]);
    expect(Y.encodeStateAsUpdate(doc)).toEqual(before);
    expect(appliedMap(doc).has(op.op_id)).toBe(false);
  });

  it("refuses an interior write when two instances share the definition", () => {
    const shared = structuredClone(workflow) as unknown as WorkflowJSON;
    shared.nodes.push({ id: 101, type: "definition-1", inputs: [], outputs: [] });
    const doc = mint(shared, catalog);
    const op = connect();
    const before = Y.encodeStateAsUpdate(doc);

    const result = applyOps(doc, [op], catalog);

    expect(result.outcomes).toEqual([
      {
        op_id: op.op_id,
        outcome: "rejected",
        reason: { code: "shared_definition_unforked", message: expect.any(String) },
      },
    ]);
    expect(Y.encodeStateAsUpdate(doc)).toEqual(before);
    expect(appliedMap(doc).has(op.op_id)).toBe(false);
  });

  it("uses path-scoped input stamps and converges on the higher-stamped link", () => {
    const low = connect();
    const high = connect({
      op_id: "interiorconnect0000000000000002",
      stamp: [2, "human:b"],
      actor: "human:b",
      base_version: 2,
      link_id: 42,
    });

    for (const order of [[low, high], [high, low]]) {
      const doc = mint(workflow, catalog);
      applyOps(doc, order, catalog);
      const definition = definitionOf(doc);
      expect(definition.links.map(({ id }) => id)).toEqual([42]);
      expect(definition.nodes.find(({ id }) => id === 1)?.outputs?.[0]?.links).toEqual([42]);
      expect(definition.nodes.find(({ id }) => id === 2)?.inputs?.[0]?.link).toBe(42);
    }
  });

  it("treats an identical interior-connect retry as a byte-identical no-op", () => {
    const doc = mint(workflow, catalog);
    const op = connect();
    expect(applyOps(doc, [op], catalog).outcomes[0]?.outcome).toBe("applied");
    const afterFirstApply = Y.encodeStateAsUpdate(doc);

    expect(applyOps(doc, [op], catalog).outcomes).toEqual([
      { op_id: op.op_id, outcome: "no-op" },
    ]);
    expect(Y.encodeStateAsUpdate(doc)).toEqual(afterFirstApply);
  });

  // Recovery PR 198 must preserve KA-4 for independent links, not just one contested input.
  it("regression: independent interior connects project identically in both arrival orders", () => {
    const independent = structuredClone(workflow);
    const definitions = independent.definitions as {
      subgraphs: Array<{ nodes: WorkflowJSON["nodes"] }>;
    };
    definitions.subgraphs[0]!.nodes.push({
      id: 3,
      type: "Sink",
      inputs: [{ name: "text", type: "STRING", link: null }],
      outputs: [],
    });
    const seed = mint(independent, catalog);
    const snapshot = Y.encodeStateAsUpdate(seed);
    const first = connect();
    const second = connect({
      op_id: "independentconnect0000000000002",
      stamp: [2, "human:b"],
      actor: "human:b",
      link_id: 42,
      to_node: 3,
    });
    const projections = [[first, second], [second, first]].map((order) => {
      const doc = new Y.Doc();
      Y.applyUpdate(doc, snapshot);
      expect(applyOps(doc, order, catalog).outcomes.map(({ outcome }) => outcome)).toEqual([
        "applied",
        "applied",
      ]);
      const projection = definitionOf(doc);
      expect(projection.links.map(({ id }) => id).sort()).toEqual([41, 42]);
      expect(projection.nodes.find(({ id }) => id === 2)?.inputs?.[0]?.link).toBe(41);
      expect(projection.nodes.find(({ id }) => id === 3)?.inputs?.[0]?.link).toBe(42);
      return project(doc, catalog);
    });
    expect(projections[0]).toEqual(projections[1]);
  });

  // https://github.com/Comfy-Org/comfy-multi-player/pull/198
  it("regression: a winning same-id rewrite updates addition order in all six permutations", () => {
    const independent = structuredClone(workflow);
    const definitions = independent.definitions as {
      subgraphs: Array<{ nodes: WorkflowJSON["nodes"] }>;
    };
    definitions.subgraphs[0]!.nodes.push({
      id: 3, type: "Sink", inputs: [{ name: "text", type: "STRING", link: null }], outputs: [],
    });
    const snapshot = Y.encodeStateAsUpdate(mint(independent, catalog));
    const early = connect();
    const middle = connect({ op_id: "middle", stamp: [2, "human:a"], link_id: 42, to_node: 3 });
    const late = connect({ op_id: "late", stamp: [3, "human:a"] });
    const orders = [[early, middle, late], [early, late, middle], [middle, early, late],
      [middle, late, early], [late, early, middle], [late, middle, early]];
    expect(orders).toHaveLength(6);
    for (const order of orders) {
      let doc = new Y.Doc();
      Y.applyUpdate(doc, snapshot);
      for (const op of order) {
        expect(applyOps(doc, [op], catalog).outcomes[0]?.outcome).not.toBe("rejected");
        // Resume on a new replica after every op: ordering metadata must persist.
        const resumed = new Y.Doc();
        Y.applyUpdate(resumed, Y.encodeStateAsUpdate(doc));
        doc.destroy();
        doc = resumed;
      }
      expect.soft(definitionOf(doc).links.map(({ id }) => id), order.map((op) => op.op_id).join(","))
        .toEqual([42, 41]);
      const storedDefinition = doc.getMap<Y.Map<unknown>>("definitions").get("definition-1");
      const rawOrder = storedDefinition?.get("link_order");
      expect.soft(rawOrder, order.map((op) => op.op_id).join(",")).toEqual(["42", "41"]);
      expect.soft((rawOrder as unknown[]).every((entry) => typeof entry === "string")).toBe(true);
    }
  });

  it("preserves asymmetric imported order ahead of deterministically ordered additions", () => {
    const imported = structuredClone(workflow) as unknown as WorkflowJSON & {
      definitions: { subgraphs: Array<{ nodes: WorkflowJSON["nodes"]; links: Array<Record<string, unknown>> }> };
    };
    const definition = imported.definitions.subgraphs[0]!;
    (definition.nodes[0]!.outputs as Array<{ links: number[] | null }>)[0]!.links = [90, 7];
    (definition.nodes[1]!.inputs as Array<{ link: number | null }>)[0]!.link = 90;
    definition.nodes.push(
      {
        id: 3,
        type: "Sink",
        inputs: [{ name: "text", type: "STRING", link: 7 }],
        outputs: [],
      },
      {
        id: 4,
        type: "Sink",
        inputs: [{ name: "text", type: "STRING", link: null }],
        outputs: [],
      },
      {
        id: 5,
        type: "Sink",
        inputs: [{ name: "text", type: "STRING", link: null }],
        outputs: [],
      },
    );
    definition.links = [
      { id: 90, origin_id: 1, origin_slot: 0, target_id: 2, target_slot: 0, type: "STRING" },
      { id: 7, origin_id: 1, origin_slot: 0, target_id: 3, target_slot: 0, type: "STRING" },
    ];
    const snapshot = Y.encodeStateAsUpdate(mint(imported, catalog));
    const first = connect({ to_node: 4, link_id: 41 });
    const second = connect({
      op_id: "independentconnect0000000000002",
      stamp: [2, "human:b"],
      actor: "human:b",
      base_version: 2,
      to_node: 5,
      link_id: 42,
    });

    for (const order of [[first, second], [second, first]]) {
      const doc = new Y.Doc();
      Y.applyUpdate(doc, snapshot);
      applyOps(doc, order, catalog);
      expect(definitionOf(doc).links.map(({ id }) => id)).toEqual([90, 7, 41, 42]);
    }
  });

  it("removes a replaced imported link without disturbing surviving imported order", () => {
    const imported = structuredClone(workflow) as unknown as WorkflowJSON & {
      definitions: { subgraphs: Array<{ nodes: WorkflowJSON["nodes"]; links: Array<Record<string, unknown>> }> };
    };
    const definition = imported.definitions.subgraphs[0]!;
    (definition.nodes[0]!.outputs as Array<{ links: number[] | null }>)[0]!.links = [90, 7];
    (definition.nodes[1]!.inputs as Array<{ link: number | null }>)[0]!.link = 90;
    definition.nodes.push({
      id: 3,
      type: "Sink",
      inputs: [{ name: "text", type: "STRING", link: 7 }],
      outputs: [],
    });
    definition.links = [
      { id: 90, origin_id: 1, origin_slot: 0, target_id: 2, target_slot: 0, type: "STRING" },
      { id: 7, origin_id: 1, origin_slot: 0, target_id: 3, target_slot: 0, type: "STRING" },
    ];
    const doc = mint(imported, catalog);

    expect(applyOps(doc, [connect()], catalog).outcomes[0]?.outcome).toBe("applied");

    expect(definitionOf(doc).links.map(({ id }) => id)).toEqual([7, 41]);
    expect(definitionOf(doc).nodes.find(({ id }) => id === 1)?.outputs?.[0]?.links).toEqual([7, 41]);
  });

  // https://github.com/Comfy-Org/comfy-multi-player/pull/198
  it("regression: prototype-named imported link ids retain their original order", () => {
    const imported = {
      ...workflow,
      definitions: {
        subgraphs: [{
          id: "definition-1",
          nodes: [],
          links: [
            { id: "constructor", origin_id: 1, origin_slot: 0, target_id: 2, target_slot: 0, type: "STRING" },
            { id: "ordinary", origin_id: 1, origin_slot: 0, target_id: 3, target_slot: 0, type: "STRING" },
          ],
        }],
      },
    } as unknown as WorkflowJSON;
    expect(definitionOf(mint(imported, catalog)).links.map(({ id }) => id))
      .toEqual(["constructor", "ordinary"]);
  });

  it("keeps top-level and interior bookkeeping distinct when link ids collide", () => {
    const withRootGraph = structuredClone(workflow) as unknown as WorkflowJSON;
    withRootGraph.nodes.push(
      {
        id: 1,
        type: "Source",
        inputs: [],
        outputs: [{ name: "text", type: "STRING", links: null }],
      },
      {
        id: 2,
        type: "Sink",
        inputs: [{ name: "text", type: "STRING", link: null }],
        outputs: [],
      },
    );
    const doc = mint(withRootGraph, catalog);
    const root = connect({ op_id: "rootconnect000000000000000001" });
    delete root.path;
    const interior = connect({ op_id: "interiorconnect0000000000000003", stamp: [2, "human:a"] });

    expect(applyOps(doc, [root, interior], catalog).outcomes.map(({ outcome }) => outcome)).toEqual([
      "applied",
      "applied",
    ]);

    const projected = project(doc, catalog);
    expect(projected.links).toEqual([[41, 1, 0, 2, 0, "STRING"]]);
    expect(definitionOf(doc).links.map(({ id }) => id)).toEqual([41]);
  });
});
