import * as Y from "yjs";
import { describe, expect, it } from "vitest";
import {
  applyOps,
  mint,
  readLinkState,
  type ConnectOp,
  type DeleteNodeOp,
  type GrowSpec,
  type WidgetCatalog,
  type WorkflowJSON,
  type WorkflowNode,
} from "../src/index.js";

const catalog: WidgetCatalog = { types: { Source: { widget_order: [] }, Destination: { widget_order: [] } } };
const stamp = (n: number): [number, string] => [n, "agent:test"];
const id = (n: number) => n.toString(16).padStart(32, "0");

function node(idValue: number, type: string, inputs: Record<string, unknown>[], outputs: Record<string, unknown>[]): WorkflowNode {
  return { id: idValue, type, pos: [0, 0], size: [100, 100], flags: {}, order: 0, mode: 0, inputs, outputs, properties: {}, widgets_values: [] };
}

function workflow(promoted = false): WorkflowJSON {
  return {
    last_node_id: 2, last_link_id: 0,
    nodes: [node(1, "Source", [], [{ name: "out", type: "IMAGE", links: [] }]), node(2, promoted ? "def.with.dots" : "Destination", [{ name: "fixed", type: "IMAGE", link: null }], [])],
    links: [], groups: [], config: {}, extra: {}, version: 0.4,
    ...(promoted ? { definitions: { subgraphs: [{ id: "def.with.dots", inputs: [{ name: "nested.dynamic.image", type: "IMAGE" }], outputs: [], nodes: [], links: [] }] } } : {}),
  } as WorkflowJSON;
}

function connect(linkId: string | number, n: number, grow?: GrowSpec): ConnectOp {
  const base = { op: "connect" as const, op_id: id(n), actor: "agent:test", base_version: n, stamp: stamp(n), link_id: linkId, from_node: 1, from_slot: 0, to_node: 2, link_type: "IMAGE" };
  return grow == null ? { ...base, to_slot: 0 } : { ...base, grow };
}

function expected(linkId: string | number, n: number, destination: Record<string, unknown>) {
  return { version: 1, authority: { kind: "operation", stamp: [n, "agent:test", id(n)] }, tuple: [linkId, 1, 0, 2, destination.to_slot, "IMAGE"], destination };
}

describe("connect generation writes first-class durable link state", () => {
  it.each([undefined, { name: "", type: "" }])("reads records produced by accepted fallback envelopes and grow strings: %j", (grow) => {
    const doc = mint(workflow(), catalog);
    const op = connect(31, 8, grow);
    delete (op as Partial<ConnectOp>).stamp;
    op.actor = "";
    op.op_id = "cli:connect";
    expect(applyOps(doc, [op]).outcomes[0]?.outcome).toBe("applied");
    expect(readLinkState(doc)["31"]).toEqual({
      version: 1,
      authority: { kind: "operation", stamp: [8, "", "cli:connect"] },
      tuple: [31, 1, 0, 2, grow ? 1 : 0, "IMAGE"],
      destination: grow
        ? { kind: "autogrow", to_slot: 1, slot: { name: "", type: "", link: 31, grow_id: 31 }, request: { name: "", type: "" } }
        : { kind: "concrete", to_slot: 0, slot: { name: "fixed", type: "IMAGE", link: 31 } },
    });
  });

  it("records the actual concrete tuple and replaces a normalized identity in both orders", () => {
    const low = connect(7, 1);
    const high = connect("7", 2);
    const want = expected("7", 2, { kind: "concrete", to_slot: 0, slot: { name: "fixed", type: "IMAGE", link: "7" } });
    for (const order of [[low, high], [high, low]]) {
      const doc = mint(workflow(), catalog);
      applyOps(doc, order);
      expect(readLinkState(doc)).toEqual({ "7": want });
    }
  });

  it("preserves the full promoted name and classifies autogrow with its complete request", () => {
    const promoted = mint(workflow(true), catalog);
    const promotedGrow: GrowSpec = { name: "nested.dynamic.image", type: "IMAGE", promoted: true };
    applyOps(promoted, [connect(8, 3, promotedGrow)]);
    expect(readLinkState(promoted)["8"]).toEqual(expected(8, 3, {
      kind: "promoted", to_slot: 1, name: "nested.dynamic.image",
      slot: { name: "nested.dynamic.image", type: "IMAGE", link: 8, grow_id: 8 },
    }));

    const autogrow = mint(workflow(), catalog);
    const request: GrowSpec = { name: "images.image0", type: "IMAGE", widget: "upload" };
    applyOps(autogrow, [connect(9, 4, request)]);
    expect(readLinkState(autogrow)["9"]).toEqual(expected(9, 4, {
      kind: "autogrow", to_slot: 1,
      slot: { name: "images.image0", type: "IMAGE", link: 9, grow_id: 9, widget: { name: "upload" } },
      request,
    }));
  });

  it("keeps distinct autogrow descriptors synchronized with canonical slots in both orders", () => {
    const request: GrowSpec = { name: "images.image0", type: "IMAGE", widget: "upload" };
    const first = connect(21, 1, request);
    const second = connect(22, 2, request);
    for (const order of [[first, second], [second, first]]) {
      const doc = mint(workflow(), catalog);
      applyOps(doc, order);
      expect(readLinkState(doc)).toEqual({
        "21": expected(21, 1, {
          kind: "autogrow", to_slot: 1,
          slot: { name: "images.image0", type: "IMAGE", link: 21, grow_id: 21, widget: { name: "upload" } },
          request,
        }),
        "22": expected(22, 2, {
          kind: "autogrow", to_slot: 2,
          slot: { name: "images.image1", type: "IMAGE", link: 22, grow_id: 22, widget: { name: "upload" } },
          request,
        }),
      });
    }
  });

  it("is byte-identical on exact replay and rejection", () => {
    const doc = mint(workflow(), catalog);
    const op = connect(10, 5);
    applyOps(doc, [op]);
    const installed = Y.encodeStateAsUpdate(doc);
    applyOps(doc, [op]);
    expect(Y.encodeStateAsUpdate(doc)).toEqual(installed);

    const rejected = { ...connect(11, 6), to_slot: 99 } as ConnectOp;
    const beforeReject = Y.encodeStateAsUpdate(doc);
    expect(applyOps(doc, [rejected]).outcomes[0]?.outcome).toBe("rejected");
    expect(Y.encodeStateAsUpdate(doc)).toEqual(beforeReject);
    expect(readLinkState(doc)["11"]).toBeUndefined();
  });

  it("removes the prior generation when identity is claimed before a consumed source-delete no-op", () => {
    const doc = mint(workflow(), catalog);
    applyOps(doc, [connect(12, 1)]);
    const deletion: DeleteNodeOp = { op: "delete_node", op_id: id(2), actor: "agent:test", base_version: 2, stamp: stamp(2), node_id: 1, removed_links: [] };
    applyOps(doc, [deletion]);
    const result = applyOps(doc, [connect("12", 3)]);
    expect(result.outcomes[0]?.outcome).toBe("no-op");
    expect(readLinkState(doc)["12"]).toBeUndefined();
  });

  it("does not retain an older descriptor after identity advances but the destination gate loses", () => {
    const doc = mint(workflow(), catalog);
    applyOps(doc, [connect(13, 1), connect(14, 3)]);
    const result = applyOps(doc, [connect("13", 2)]);
    expect(result.outcomes[0]?.outcome).toBe("lww-dropped");
    expect(readLinkState(doc)["13"]).toBeUndefined();
  });
});
