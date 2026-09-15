import { describe, expect, it } from "vitest";
import {
  applyOps,
  mint,
  project,
  type ConnectOp,
  type WidgetCatalog,
  type WorkflowJSON,
  type WorkflowNode,
} from "../src/index.js";

const catalog: WidgetCatalog = {
  types: {
    Source: { widget_order: [] },
    Multi: { widget_order: ["inputcount"] },
  },
};

const source: WorkflowNode = {
  id: 1,
  type: "Source",
  inputs: [],
  outputs: [{ name: "value", type: "VALUE", links: [] }],
  widgets_values: [],
};

const destination: WorkflowNode = {
  id: 2,
  type: "Multi",
  inputs: [
    { name: "image_1", type: "VALUE", link: null },
    { name: "image_2", type: "VALUE", link: null },
  ],
  outputs: [],
  widgets_values: [2],
};

const base: WorkflowJSON = {
  nodes: [source, destination],
  links: [],
  last_node_id: 2,
  last_link_id: 0,
};

function grow(
  opId: string,
  counter: number,
  linkId: number,
  requestedName: string,
): ConnectOp {
  return {
    op: "connect",
    op_id: opId.padEnd(32, "0"),
    actor: "human:tester:tab",
    // The field retains this wire name, but its current semantics are a
    // creator-owned Lamport counter; stampKey reads the authoritative stamp.
    base_version: counter,
    stamp: [counter, "human:tester:tab"],
    link_id: linkId,
    from_node: 1,
    from_slot: 0,
    to_node: 2,
    to_slot: null,
    link_type: "VALUE",
    grow: {
      name: requestedName,
      type: "VALUE",
      inputcount: { widget: "inputcount", value: 4 },
    },
  };
}

function projection(ops: ConnectOp[]): WorkflowJSON {
  const doc = mint(base, catalog);
  expect(applyOps(doc, ops, catalog).outcomes.every((outcome) => outcome.outcome === "applied")).toBe(true);
  return project(doc, catalog);
}

function sourceRefs(workflow: WorkflowJSON): unknown[] {
  const node = workflow.nodes.find((candidate) => candidate.id === 1)!;
  return ((node.outputs as Array<{ links: unknown[] }>)[0]!.links);
}

function grownSlots(workflow: WorkflowJSON): Array<{ name: string; grow_id: number; link: number }> {
  const node = workflow.nodes.find((candidate) => candidate.id === 2)!;
  return (node.inputs as Array<{ name: string; grow_id?: number; link: number }>)
    .filter((slot): slot is { name: string; grow_id: number; link: number } => slot.grow_id !== undefined);
}

describe("option D canonical multi-link input growth", () => {
  it("projects same-family grows identically in both application orders", () => {
    const lowerStamp = grow("a", 10, 922, "image_3");
    const higherStamp = grow("b", 11, 921, "image_3");

    const forward = projection([lowerStamp, higherStamp]);
    const reverse = projection([higherStamp, lowerStamp]);

    expect(reverse).toEqual(forward);
    expect(sourceRefs(forward)).toEqual([921, 922]);
    expect(grownSlots(forward).map(({ grow_id }) => grow_id)).toEqual([922, 921]);
  });

  it("ranks different bare-name families together by the current op stamp", () => {
    const lowerStamp = grow("c", 20, 922, "image_3");
    const higherStamp = grow("d", 21, 921, "mask_1");

    const forward = projection([lowerStamp, higherStamp]);
    const reverse = projection([higherStamp, lowerStamp]);

    expect(reverse).toEqual(forward);
    expect(sourceRefs(forward)).toEqual([921, 922]);
    expect(grownSlots(forward)).toMatchObject([
      { name: "image_3", grow_id: 922, link: 922 },
      { name: "mask_1", grow_id: 921, link: 921 },
    ]);
    expect(forward.links.map((link) => (link as unknown[])[4])).toEqual([3, 2]);
  });
});
