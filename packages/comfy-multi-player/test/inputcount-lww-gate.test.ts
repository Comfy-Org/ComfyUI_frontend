import { describe, expect, it } from "vitest";
import { stampsMap } from "../src/doc.js";
import {
  applyOps,
  mint,
  project,
  type ConnectOp,
  type SetWidgetOp,
  type WidgetCatalog,
  type WorkflowJSON,
} from "../src/index.js";
import { loadCatalog } from "./helpers.js";

const catalog: WidgetCatalog = {
  types: {
    ...loadCatalog().types,
    LoadImage: { widget_order: ["count"] },
  },
};

const base: WorkflowJSON = {
  nodes: [
    {
      id: 1,
      type: "LoadImage",
      inputs: [],
      outputs: [{ name: "IMAGE", type: "IMAGE", links: [] }],
      widgets_values: [0],
    },
  ],
  links: [],
  last_node_id: 1,
  last_link_id: 0,
};

const stampTarget = JSON.stringify(["widget", "1", "0", "count"]);

function envelope(opId: string, counter: number, actor: string) {
  return {
    op_id: opId.padEnd(32, "0"),
    actor,
    base_version: counter,
    stamp: [counter, actor] as [number, string],
  };
}

function setCount(opId: string, counter: number, actor: string, value: number): SetWidgetOp {
  return {
    op: "set_widget",
    ...envelope(opId, counter, actor),
    node_id: 1,
    widget: "count",
    value,
  };
}

function growCount(opId: string, counter: number, actor: string, linkId: number, value: number): ConnectOp {
  return {
    op: "connect",
    ...envelope(opId, counter, actor),
    link_id: linkId,
    from_node: 1,
    from_slot: 0,
    to_node: 1,
    to_slot: null,
    link_type: "IMAGE",
    grow: {
      name: "image_1",
      type: "IMAGE",
      inputcount: { widget: "count", value },
    },
  };
}

function expectApplied(op: ConnectOp | SetWidgetOp, doc: ReturnType<typeof mint>): void {
  expect(applyOps(doc, [op], catalog).outcomes).toEqual([{ op_id: op.op_id, outcome: "applied" }]);
}

function expectIdempotentReplay(op: ConnectOp, doc: ReturnType<typeof mint>): void {
  const before = project(doc, catalog);
  expect(applyOps(doc, [op], catalog).outcomes).toEqual([{ op_id: op.op_id, outcome: "no-op" }]);
  expect(project(doc, catalog)).toEqual(before);
}

function projectedNode(doc: ReturnType<typeof mint>) {
  return project(doc, catalog).nodes[0]!;
}

describe("current inputcount bump LWW gate behavior", () => {
  it("writes the count widget and stamp when no prior widget stamp exists", () => {
    const doc = mint(base, catalog);
    const connect = growCount("connect-first", 5, "agent:a", 101, 1);

    expectApplied(connect, doc);

    const node = projectedNode(doc);
    expect(node.widgets_values).toEqual([1]);
    expect(node.inputs).toEqual([
      expect.objectContaining({ name: "image_1", link: 101, grow_id: 101 }),
    ]);
    expect(stampsMap(doc).get(stampTarget)).toEqual([5, "agent:a", connect.op_id]);
    expectIdempotentReplay(connect, doc);
  });

  it("grows the slot but preserves a higher prior count-widget stamp", () => {
    const doc = mint(base, catalog);
    const prior = setCount("prior-high", 10, "agent:a", 7);
    const connect = growCount("connect-low", 5, "agent:b", 102, 2);
    expectApplied(prior, doc);

    expectApplied(connect, doc);

    const node = projectedNode(doc);
    expect(node.inputs).toEqual([
      expect.objectContaining({ name: "image_1", link: 102, grow_id: 102 }),
    ]);
    expect(node.widgets_values).toEqual([7]);
    expect(stampsMap(doc).get(stampTarget)).toEqual([10, "agent:a", prior.op_id]);

    const reverse = mint(base, catalog);
    expectApplied(connect, reverse);
    expectApplied(prior, reverse);
    expect(project(reverse, catalog)).toEqual(project(doc, catalog));
    expectIdempotentReplay(connect, doc);
    expectIdempotentReplay(connect, reverse);
  });

  it("updates the count widget and stamp when the grow has the higher stamp", () => {
    const doc = mint(base, catalog);
    const prior = setCount("prior-low", 3, "human:z", 1);
    const connect = growCount("connect-high", 8, "agent:a", 103, 4);
    expectApplied(prior, doc);

    expectApplied(connect, doc);

    const node = projectedNode(doc);
    expect(node.inputs).toEqual([
      expect.objectContaining({ name: "image_1", link: 103, grow_id: 103 }),
    ]);
    expect(node.widgets_values).toEqual([4]);
    expect(stampsMap(doc).get(stampTarget)).toEqual([8, "agent:a", connect.op_id]);

    const reverse = mint(base, catalog);
    expectApplied(connect, reverse);
    expect(applyOps(reverse, [prior], catalog).outcomes).toEqual([
      { op_id: prior.op_id, outcome: "lww-dropped" },
    ]);
    expect(project(reverse, catalog)).toEqual(project(doc, catalog));
    expectIdempotentReplay(connect, doc);
    expectIdempotentReplay(connect, reverse);
  });
});
