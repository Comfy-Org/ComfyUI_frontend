import * as Y from "yjs";
import { describe, expect, it } from "vitest";
import {
  applyOps,
  mint,
  project,
  readLinkState,
  type AddNodeOp,
  type DeleteNodeOp,
  type DisconnectOp,
  type Op,
  type WidgetCatalog,
  type WorkflowJSON,
  type WorkflowNode,
} from "../src/index.js";

const catalog: WidgetCatalog = {
  types: { Source: { widget_order: [] }, Destination: { widget_order: [] } },
};
const opId = (serial: number) => serial.toString(16).padStart(32, "0");
const env = (serial: number) => ({
  op_id: opId(serial),
  actor: "agent:regression",
  base_version: serial,
  stamp: [serial, "agent:regression"] as [number, string],
});
const source: WorkflowNode = {
  id: 1,
  type: "Source",
  inputs: [],
  outputs: [{ name: "out", type: "IMAGE", links: [10] }],
  widgets_values: [],
};
const destination: WorkflowNode = {
  id: 2,
  type: "Destination",
  inputs: [{ name: "images.image0", type: "IMAGE", link: 10, grow_id: 10 }],
  outputs: [],
  widgets_values: [],
};

function workflow(): WorkflowJSON {
  return { nodes: [structuredClone(source), structuredClone(destination)], links: [[10, 1, 0, 2, 0, "IMAGE"]] };
}

function deletion(node_id: number, serial: number, removed_links: number[] = []): DeleteNodeOp {
  return { op: "delete_node", ...env(serial), node_id, removed_links };
}

function readd(node: WorkflowNode, serial: number): AddNodeOp {
  return { op: "add_node", ...env(serial), node_id: node.id, class_type: node.type, pos: [], node };
}

function disconnect(serial: number, link_id = 999, to_slot = 0): DisconnectOp {
  return { op: "disconnect", ...env(serial), link_id, to_node: 2, to_slot };
}

function snapshot(doc: Y.Doc): Y.Doc {
  const restored = new Y.Doc();
  Y.applyUpdate(restored, Y.encodeStateAsUpdate(doc));
  return restored;
}

function apply(doc: Y.Doc, ops: Op[]): void {
  expect(applyOps(doc, ops, catalog).outcomes).not.toContainEqual(expect.objectContaining({ outcome: "rejected" }));
}

describe("durable link retirement regressions", () => {
  it("regression: disconnect retires a source-stranded descriptor while its destination slot is null", () => {
    let doc = mint(workflow(), catalog);
    apply(doc, [deletion(1, 1)]);
    expect(project(doc, catalog).nodes[0]?.inputs?.[0]).toMatchObject({ link: null });
    doc = snapshot(doc);

    apply(doc, [disconnect(2)]);
    expect(readLinkState(doc)).toEqual({});
    apply(doc, [readd(source, 3)]);
    expect(project(snapshot(doc), catalog).links).toEqual([]);
  });

  it("regression: absent-destination disconnect follows slot semantics despite a mismatched link_id", () => {
    for (const order of ["delete-first", "disconnect-first"] as const) {
      let doc = mint(workflow(), catalog);
      if (order === "delete-first") {
        apply(doc, [deletion(2, 1)]);
        doc = snapshot(doc);
        apply(doc, [disconnect(2)]);
      } else {
        apply(doc, [disconnect(2), deletion(2, 1)]);
      }
      expect(readLinkState(doc), order).toEqual({});
      apply(doc, [readd(destination, 3)]);
      expect(project(snapshot(doc), catalog).links, order).toEqual([]);
    }
  });

  it("regression: absent-destination disconnect does not retire a different destination slot", () => {
    const doc = mint(workflow(), catalog);
    apply(doc, [deletion(2, 1)]);
    apply(doc, [disconnect(2, 10, 1)]);
    expect(readLinkState(doc)["10"]).toBeDefined();
  });

  it("regression: imported autogrow descriptors disconnect without an operation request", () => {
    const doc = mint(workflow(), catalog);
    expect(() => apply(doc, [disconnect(1, 10)])).not.toThrow();
    expect(project(doc, catalog).links).toEqual([]);
    expect(readLinkState(doc)).toEqual({});
  });

  it("regression: explicit removed_links retires an already stranded descriptor", () => {
    let doc = mint(workflow(), catalog);
    apply(doc, [deletion(1, 1)]);
    doc = snapshot(doc);
    apply(doc, [deletion(2, 2, [10])]);
    expect(readLinkState(doc)).toEqual({});
    apply(doc, [readd(source, 3), readd(destination, 4)]);
    expect(project(snapshot(doc), catalog).links).toEqual([]);
  });
});
