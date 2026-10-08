/** R-93: the wire `node_id` is authoritative at the add-node identity boundary. */
import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import { appliedMap } from "../src/doc.js";
import { applyOps, mint, project, type Op, type WidgetCatalog, type WorkflowJSON } from "../src/index.js";

const catalog: WidgetCatalog = {
  types: {
    LoadImage: { widget_order: [] },
  },
};

const base = (): WorkflowJSON => ({
  nodes: [],
  links: [],
  groups: [],
  extra: {},
  last_node_id: 0,
  last_link_id: 0,
});

const bytes = (doc: Y.Doc) => Buffer.from(Y.encodeStateAsUpdate(doc));
const id = (tag: string) => (tag + "0".repeat(32)).slice(0, 32);

function addNode(nodeId: number, payloadId: number | string | undefined, tag: string): Op {
  const node = {
    ...(payloadId === undefined ? {} : { id: payloadId }),
    type: "LoadImage",
    inputs: [],
    outputs: [{ name: "IMAGE", type: "IMAGE", links: [] }],
    widgets_values: [],
  };
  return {
    op: "add_node",
    op_id: id(tag),
    actor: "human:a",
    base_version: 1,
    stamp: [1, "human:a"],
    node_id: nodeId,
    class_type: "LoadImage",
    pos: [],
    node: node as typeof node & { id: number | string },
  } satisfies Op;
}

describe("R-93 add_node identity boundary", () => {
  it("rejects contradictory wire and payload identities without mutation or a dangling target", () => {
    const doc = mint(base(), catalog);
    const before = bytes(doc);

    // applyOps converts OpRejectedError into the public rejected outcome.
    const rejected = addNode(9, 77, "contradictory");
    const trailing = addNode(10, 10, "trailing");
    const result = applyOps(doc, [rejected, trailing], catalog);

    expect(result.outcomes[0]).toMatchObject({
      outcome: "rejected",
      reason: { code: "malformed_op" },
    });
    expect(result.outcomes[1]).toMatchObject({ outcome: "rejected", reason: { code: "batch_aborted" } });
    expect(bytes(doc)).toEqual(before);
    expect(appliedMap(doc).has(rejected.op_id)).toBe(false);
    expect(appliedMap(doc).has(trailing.op_id)).toBe(false);
    expect(doc.getMap("nodes").has("9")).toBe(false);
    expect(project(doc, catalog).nodes.some((node) => node.id === 77)).toBe(false);

    const connect = {
      op: "connect",
      op_id: id("connect-missing"),
      actor: "human:a",
      base_version: 2,
      stamp: [2, "human:a"],
      link_id: 90,
      from_node: 9,
      from_slot: 0,
      to_node: 9,
      to_slot: 0,
      link_type: "IMAGE",
    } as Op;
    expect(applyOps(doc, [connect], catalog).outcomes[0]).toMatchObject({ outcome: "no-op" });
  });

  it.each([
    { label: "matching numeric", nodeId: 10, payloadId: 10, projectedId: 10 },
    { label: "numeric/string normalized", nodeId: 11, payloadId: "11" },
    { label: "absent payload id", nodeId: 12, payloadId: undefined },
  ])("accepts $label identity", ({ nodeId, payloadId, projectedId }) => {
    const doc = mint(base(), catalog);

    const result = applyOps(doc, [addNode(nodeId, payloadId, `accepted-${nodeId}`)], catalog);

    expect(result.outcomes[0]).toMatchObject({ outcome: "applied" });
    const projected = project(doc, catalog).nodes[0];
    if (projectedId !== undefined) expect(projected?.id).toBe(projectedId);
    if (payloadId === "11") expect(projected?.id).toBe("11");
    if (payloadId === undefined) expect(projected).not.toHaveProperty("id");
  });
});
