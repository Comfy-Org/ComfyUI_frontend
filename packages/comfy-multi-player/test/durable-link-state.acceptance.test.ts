import * as Y from "yjs";
import { describe, expect, it } from "vitest";
import {
  applyOps,
  mint,
  project,
  readLinkState,
  type AddNodeOp,
  type ClearOp,
  type ConnectOp,
  type DeleteNodeOp,
  type DisconnectOp,
  type Op,
  type WorkflowJSON,
  type WorkflowNode,
} from "../src/index.js";
import { loadCatalog } from "./helpers.js";

const catalog = loadCatalog();
const definitionId = "f2fdebf6-dfaf-43b6-9eb2-7f70613cfdc1";

const source: WorkflowNode = {
  id: 10,
  type: "LoadImage",
  inputs: [],
  outputs: [{ name: "IMAGE", type: "IMAGE", links: [] }],
  widgets_values: [],
};
const concreteTarget: WorkflowNode = {
  id: 20,
  type: "PreviewImage",
  inputs: [{ name: "images", type: "IMAGE", link: null }],
  outputs: [],
  widgets_values: [],
};
const promotedInstance: WorkflowNode = {
  id: 57,
  type: definitionId,
  inputs: [],
  outputs: [{ name: "IMAGE", type: "IMAGE", links: [] }],
  widgets_values: [],
};
const workflow: WorkflowJSON = {
  nodes: [source, concreteTarget, promotedInstance],
  links: [],
  groups: [],
  extra: {},
  last_node_id: 57,
  last_link_id: 0,
  definitions: {
    subgraphs: [{
      id: definitionId,
      name: "Stored image subgraph",
      inputs: [{ name: "nested.dynamic.image", type: "IMAGE" }],
      outputs: [{ name: "IMAGE", type: "IMAGE" }],
      nodes: [{ id: 1, type: "PreviewImage", inputs: [{ name: "images", type: "IMAGE", link: null }], outputs: [], widgets_values: [] }],
      links: [],
    }],
  },
};

const seededSnapshot = Y.encodeStateAsUpdate(mint(workflow, catalog));
const opId = (serial: number) => serial.toString(16).padStart(32, "0");
const envelope = (serial: number, version: number, actor = "agent:reviewer") => ({
  op_id: opId(serial),
  actor,
  base_version: version,
  stamp: [version, actor] as [number, string],
});

function fork() {
  const doc = new Y.Doc();
  Y.applyUpdate(doc, seededSnapshot);
  return doc;
}

function applyAccepted(ops: Op[]) {
  const doc = fork();
  const result = applyOps(doc, ops, catalog);
  expect(result.outcomes).toHaveLength(ops.length);
  expect(result.outcomes, "valid acceptance operations must reach semantic assertions").not.toContainEqual(
    expect.objectContaining({ outcome: "rejected" }),
  );
  for (const op of ops) {
    const before = Y.encodeStateAsUpdate(doc);
    expect(applyOps(doc, [op], catalog).outcomes).toEqual([{ op_id: op.op_id, outcome: "no-op" }]);
    expect(Y.encodeStateAsUpdate(doc), `duplicate ${op.op_id} must be byte-identical`).toEqual(before);
  }
  return project(doc, catalog);
}

function applyToDoc(ops: Op[]) {
  const doc = fork();
  const result = applyOps(doc, ops, catalog);
  expect(result.outcomes).toHaveLength(ops.length);
  expect(result.outcomes).not.toContainEqual(expect.objectContaining({ outcome: "rejected" }));
  return doc;
}

function permutations<T>(values: T[]): T[][] {
  if (values.length <= 1) return [values];
  return values.flatMap((value, index) =>
    permutations(values.filter((_, candidate) => candidate !== index)).map(rest => [value, ...rest]),
  );
}

const promotedConnect = (linkId: 911 | 912, serial: number, version: number): ConnectOp => ({
  op: "connect",
  ...envelope(serial, version),
  link_id: linkId,
  from_node: 10,
  from_slot: 0,
  to_node: 57,
  link_type: "IMAGE",
  grow: { name: "nested.dynamic.image", type: "IMAGE", promoted: true },
});
const deletePromoted: DeleteNodeOp = {
  op: "delete_node",
  ...envelope(0xd1, 3),
  node_id: 57,
  removed_links: [],
};
const readdPromoted: AddNodeOp = {
  op: "add_node",
  ...envelope(0xa1, 4),
  node_id: 57,
  class_type: definitionId,
  pos: [],
  node: promotedInstance,
};

describe("ADR-022 bounded durable-link acceptance", () => {
  it("restores concrete intent and the exact endpoint references after delete/re-add", () => {
    const connect: ConnectOp = {
      op: "connect", ...envelope(0xc1, 1), link_id: 100, from_node: 10, from_slot: 0,
      to_node: 20, to_slot: 0, link_type: "IMAGE",
    };
    const remove: DeleteNodeOp = { op: "delete_node", ...envelope(0xd2, 2), node_id: 20, removed_links: [] };
    const readd: AddNodeOp = { op: "add_node", ...envelope(0xa2, 3), node_id: 20, class_type: concreteTarget.type, pos: [], node: concreteTarget };
    const out = applyAccepted([connect, remove, readd]);
    expect(out.links).toEqual([[100, 10, 0, 20, 0, "IMAGE"]]);
    expect(out.nodes.find(node => node.id === 10)).toMatchObject({ outputs: [{ links: [100] }] });
    expect(out.nodes.find(node => node.id === 20)).toMatchObject({ inputs: [{ link: 100 }] });
  });

  it("reproduces reviewer 911/912: only the winning promoted generation returns with its full-name slot", () => {
    const out = applyAccepted([
      promotedConnect(911, 0x911, 1),
      promotedConnect(912, 0x912, 2),
      deletePromoted,
      readdPromoted,
    ]);
    expect(out.links).toEqual([[912, 10, 0, 57, 0, "IMAGE"]]);
    expect(out.nodes.find(node => node.id === 57)).toMatchObject({
      inputs: [{ name: "nested.dynamic.image", type: "IMAGE", link: 912, grow_id: 912 }],
    });
  });

  it("orders a promoted replacement against a same-stamp disconnect", () => {
    const first = promotedConnect(911, 0x911, 1);
    const disconnect: DisconnectOp = {
      op: "disconnect", ...envelope(0x910, 2), link_id: 911, to_node: 57, to_slot: 0,
    };
    const replacement = promotedConnect(912, 0x912, 2);
    const orderA = applyAccepted([first, disconnect, replacement]);
    const orderB = applyAccepted([first, replacement, disconnect]);
    expect(orderA).toEqual(orderB);
    expect(orderA.links).toEqual([[912, 10, 0, 57, 0, "IMAGE"]]);
  });

  it("preserves the pass-7 scalar reuse and mismatched-disconnect counterexample", () => {
    const first: ConnectOp = {
      op: "connect", ...envelope(0xa, 0), link_id: 100, from_node: 10,
      from_slot: 0, to_node: 20, to_slot: 0, link_type: "IMAGE",
    };
    const sever: DisconnectOp = {
      op: "disconnect", ...envelope(0xb, 0), link_id: 101, to_node: 20, to_slot: 0,
    };
    const winner: ConnectOp = { ...first, ...envelope(0xc, 0) };
    const arrivals = permutations([first, sever, winner]);
    expect(arrivals).toHaveLength(6);
    const projections = arrivals.map((arrival, index) => {
      const out = applyAccepted(arrival);
      expect(out.links, `permutation ${index}: ${arrival.map(op => op.op_id).join(",")}`).toEqual([
        [100, 10, 0, 20, 0, "IMAGE"],
      ]);
      return out;
    });
    for (const [index, out] of projections.entries()) {
      expect(out, `full projection permutation ${index}`).toEqual(projections[0]);
    }
  });

  it("restores operation-owned autogrow metadata, reconstructed slot, and exact endpoint references", () => {
    const grow = { name: "images.image0", type: "IMAGE", widget: "upload" };
    const connect: ConnectOp = {
      op: "connect", ...envelope(0xe1, 1), link_id: 913, from_node: 10, from_slot: 0,
      to_node: 20, link_type: "IMAGE", grow,
    };
    const remove: DeleteNodeOp = { op: "delete_node", ...envelope(0xe2, 2), node_id: 20, removed_links: [] };
    const readd: AddNodeOp = { op: "add_node", ...envelope(0xe3, 3), node_id: 20, class_type: concreteTarget.type, pos: [], node: concreteTarget };
    const doc = applyToDoc([connect, remove]);
    expect(readLinkState(doc)["913"]).toMatchObject({
      authority: { kind: "operation" }, tuple: [913, 10, 0, 20, 1, "IMAGE"],
      destination: {
        kind: "autogrow", to_slot: 1, request: grow,
        slot: { name: "images.image0", type: "IMAGE", link: 913, grow_id: 913, widget: { name: "upload" } },
      },
    });
    expect(applyOps(doc, [readd], catalog).outcomes[0]?.outcome).not.toBe("rejected");
    const out = project(doc, catalog);
    expect(out.links).toEqual([[913, 10, 0, 20, 1, "IMAGE"]]);
    expect(out.nodes.find(node => node.id === 10)).toMatchObject({ outputs: [{ links: [913] }] });
    expect(out.nodes.find(node => node.id === 20)).toMatchObject({
      inputs: [
        { name: "images", link: null },
        { name: "images.image0", type: "IMAGE", link: 913, grow_id: 913, widget: { name: "upload" } },
      ],
    });
  });

  it("clear strands durable intent without retiring it and re-add restores the link", () => {
    const connect: ConnectOp = {
      op: "connect", ...envelope(0xf1, 1), link_id: 914, from_node: 10, from_slot: 0,
      to_node: 20, to_slot: 0, link_type: "IMAGE",
    };
    const clear: ClearOp = { op: "clear", ...envelope(0xf2, 2), removed_nodes: [20] };
    const readd: AddNodeOp = { op: "add_node", ...envelope(0xf3, 3), node_id: 20, class_type: concreteTarget.type, pos: [], node: concreteTarget };
    const doc = applyToDoc([connect, clear]);
    expect(project(doc, catalog).links).toEqual([]);
    expect(readLinkState(doc)["914"]).toBeDefined();
    expect(applyOps(doc, [readd], catalog).outcomes[0]?.outcome).not.toBe("rejected");
    expect(project(doc, catalog).links).toEqual([[914, 10, 0, 20, 0, "IMAGE"]]);
    expect(readLinkState(doc)["914"]).toBeDefined();
  });

  const lifecycleKinds = [
    { name: "concrete", connect: { op: "connect", ...envelope(0x201, 1), link_id: 921, from_node: 10, from_slot: 0, to_node: 20, to_slot: 0, link_type: "IMAGE" } as ConnectOp, target: concreteTarget },
    { name: "promoted", connect: promotedConnect(911, 0x202, 1), target: promotedInstance },
    { name: "autogrow", connect: { op: "connect", ...envelope(0x203, 1), link_id: 923, from_node: 10, from_slot: 0, to_node: 20, link_type: "IMAGE", grow: { name: "images.image0", type: "IMAGE" } } as ConnectOp, target: concreteTarget },
  ];
  const retirementModes = ["restore", "disconnect", "explicit removed_links"] as const;

  it.each(lifecycleKinds.flatMap(kind => retirementModes.map(mode => ({ ...kind, mode }))))(
    "$name durable intent: $mode",
    ({ connect, target, mode }) => {
      const targetId = target.id;
      const remove: DeleteNodeOp = { op: "delete_node", ...envelope(0x210, 2), node_id: targetId, removed_links: [] };
      const doc = applyToDoc([connect, remove]);
      const descriptor = readLinkState(doc)[String(connect.link_id)] as { destination: { to_slot: number } };
      expect(descriptor).toBeDefined();
      if (mode === "disconnect") {
        const disconnect: DisconnectOp = { op: "disconnect", ...envelope(0x211, 3), link_id: connect.link_id, to_node: targetId, to_slot: descriptor.destination.to_slot };
        expect(applyOps(doc, [disconnect], catalog).outcomes[0]?.outcome).not.toBe("rejected");
      } else if (mode === "explicit removed_links") {
        const retire: DeleteNodeOp = { op: "delete_node", ...envelope(0x212, 3), node_id: targetId, removed_links: [connect.link_id] };
        expect(applyOps(doc, [retire], catalog).outcomes[0]?.outcome).not.toBe("rejected");
      }
      const readd: AddNodeOp = { op: "add_node", ...envelope(0x213, 4), node_id: targetId, class_type: target.type, pos: [], node: target };
      expect(applyOps(doc, [readd], catalog).outcomes[0]?.outcome).not.toBe("rejected");
      if (mode === "restore") {
        expect(project(doc, catalog).links).toEqual([[connect.link_id, 10, 0, targetId, descriptor.destination.to_slot, "IMAGE"]]);
        expect(readLinkState(doc)[String(connect.link_id)]).toBeDefined();
      } else {
        expect(project(doc, catalog).links).toEqual([]);
        expect(readLinkState(doc)[String(connect.link_id)]).toBeUndefined();
      }
    },
  );
});
