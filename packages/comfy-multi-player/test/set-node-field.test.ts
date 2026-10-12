/**
 * `set_node_field` — a per-field LWW write to a node's durable scalar state
 * (`title`, `mode`, `flags.collapsed`, `flags.pinned`).
 *
 * The vocabulary can already express "this node now looks like THIS" with an
 * `add_node` upsert, but only by replacing the whole node: the write clears
 * the node's widget stamps and rewrites its widget values, so a flag toggle
 * concurrent with a remote widget write on the same node loses that write.
 * A field-addressed register removes the hazard and lets two collaborators
 * toggle two different fields on one node without contending.
 */
import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import { applyOps, mint, project, type AddNodeOp, type DeleteNodeOp, type Op, type WidgetCatalog, type WorkflowJSON } from "../src/index.js";
import { rejectedOutcome } from "./apply-result-helpers.js";
import { loadCatalog } from "./helpers.js";

const catalog: WidgetCatalog = loadCatalog();
const NODE_ID = 11;

const base: WorkflowJSON = {
  nodes: [
    {
      id: NODE_ID,
      type: "LoadImage",
      pos: [10, 20],
      size: [200, 100],
      title: "Load Image",
      mode: 0,
      flags: {},
      inputs: [],
      outputs: [],
      widgets_values: [],
    },
  ],
  links: [],
};

let opSeq = 0;
function testOpId(prefix = "f"): string {
  return (prefix + String(opSeq++).padStart(4, "0")).padEnd(32, "0");
}

/**
 * Wire-shaped op. The cast mirrors `test/applier.test.ts`'s unknown-kind
 * case: these tests exercise the APPLIER's treatment of a wire payload, so
 * they build the payload the way the wire carries it.
 */
function setNodeField(actor: string, baseVersion: number, field: string, value: unknown, nodeId: unknown = NODE_ID): Op {
  return {
    op: "set_node_field",
    op_id: testOpId(),
    actor,
    base_version: baseVersion,
    stamp: [baseVersion, actor],
    node_id: nodeId,
    field,
    value,
  } as unknown as Op;
}

function node(doc: Parameters<typeof project>[0]) {
  return project(doc, catalog).nodes.find((candidate) => candidate.id === NODE_ID);
}

describe("set_node_field", () => {
  it.each([
    { field: "flags.collapsed", value: true, read: (n: Record<string, unknown>) => (n["flags"] as Record<string, unknown>)["collapsed"] },
    { field: "flags.pinned", value: true, read: (n: Record<string, unknown>) => (n["flags"] as Record<string, unknown>)["pinned"] },
    { field: "title", value: "Renamed", read: (n: Record<string, unknown>) => n["title"] },
    { field: "mode", value: 4, read: (n: Record<string, unknown>) => n["mode"] },
  ])("writes $field", ({ field, value, read }) => {
    const doc = mint(base, catalog);

    const result = applyOps(doc, [setNodeField("alice", 1, field, value)], catalog);

    expect(rejectedOutcome(result)).toBeUndefined();
    expect(result.outcomes[0]).toMatchObject({ outcome: "applied" });
    expect(read(node(doc) as unknown as Record<string, unknown>)).toEqual(value);
    doc.destroy();
  });

  it("keeps two fields on one node independent (no whole-node clobber)", () => {
    const doc = mint(base, catalog);

    applyOps(doc, [setNodeField("alice", 1, "flags.collapsed", true)], catalog);
    applyOps(doc, [setNodeField("bob", 1, "title", "Bob's node")], catalog);

    const projected = node(doc) as unknown as Record<string, unknown>;
    expect((projected["flags"] as Record<string, unknown>)["collapsed"]).toBe(true);
    expect(projected["title"]).toBe("Bob's node");
    doc.destroy();
  });

  it.each([
    { field: "title", value: "Renamed", property: "title" },
    { field: "flags.pinned", value: true, property: "pinned" },
  ])("deletes $field when value is null", ({ field, value, property }) => {
    const doc = mint(base, catalog);
    expect(rejectedOutcome(applyOps(doc, [setNodeField("alice", 1, field, value)], catalog))).toBeUndefined();

    expect(rejectedOutcome(applyOps(doc, [setNodeField("alice", 2, field, null)], catalog))).toBeUndefined();

    const projected = node(doc) as unknown as Record<string, unknown>;
    const owner = field === "title" ? projected : projected["flags"] as Record<string, unknown>;
    expect(owner).not.toHaveProperty(property);
    doc.destroy();
  });

  it("resolves two writers of one field by stamp, in either arrival order", () => {
    const early = setNodeField("alice", 1, "title", "alice");
    const late = setNodeField("bob", 2, "title", "bob");

    for (const order of [
      [early, late],
      [late, early],
    ]) {
      const doc = mint(base, catalog);
      applyOps(doc, order, catalog);
      expect((node(doc) as unknown as Record<string, unknown>)["title"]).toBe("bob");
      doc.destroy();
    }
  });

  it("is idempotent: a replayed op is a no-op", () => {
    const doc = mint(base, catalog);
    const op = setNodeField("alice", 1, "flags.collapsed", true);

    applyOps(doc, [op], catalog);
    const replay = applyOps(doc, [op], catalog);

    expect(replay.outcomes).toEqual([{ op_id: op.op_id, outcome: "no-op" }]);
    doc.destroy();
  });

  it("delete-wins: a write to a missing node is a no-op that consumes its op_id", () => {
    const doc = mint(base, catalog);

    const result = applyOps(doc, [setNodeField("alice", 1, "title", "ghost", 999)], catalog);

    expect(result.outcomes).toEqual([expect.objectContaining({ outcome: "no-op" })]);
    doc.destroy();
  });

  it.each(["widgets", "widgets_values", "inputs", "type", "id", "flags", "flags.collapsed.nested"])(
    "rejects %s as an unwritable field",
    (field) => {
      const doc = mint(base, catalog);

      const result = applyOps(doc, [setNodeField("alice", 1, field, 1)], catalog);

      expect(rejectedOutcome(result)).toMatchObject({ reason: { code: "malformed_op" } });
      doc.destroy();
    },
  );

  it.each([
    { field: "title", value: 1 },
    { field: "mode", value: "4" },
    { field: "mode", value: -1 },
    { field: "flags.collapsed", value: "yes" },
    { field: "flags.pinned", value: 1 },
  ])("rejects invalid $field value $value without mutating the document", ({ field, value }) => {
    const doc = mint(base, catalog);
    const before = Buffer.from(Y.encodeStateAsUpdate(doc));

    const result = applyOps(doc, [setNodeField("alice", 1, field, value)], catalog);

    expect(rejectedOutcome(result)).toMatchObject({ reason: { code: "malformed_op" } });
    expect(Buffer.from(Y.encodeStateAsUpdate(doc)).equals(before)).toBe(true);
    doc.destroy();
  });

  it("does not let a stale lifetime write mutate a replacement node", () => {
    const doc = mint(base, catalog);
    const remove: DeleteNodeOp = {
      op: "delete_node",
      op_id: testOpId("d"),
      actor: "alice",
      base_version: 1,
      stamp: [1, "alice"],
      node_id: NODE_ID,
      removed_links: [],
    };
    const replacementIncarnation = testOpId("life");
    const replacement: AddNodeOp = {
      op: "add_node",
      op_id: testOpId("a"),
      actor: "alice",
      base_version: 2,
      stamp: [2, "alice"],
      node_id: NODE_ID,
      node_incarnation: replacementIncarnation,
      class_type: "LoadImage",
      pos: [10, 20],
      node: base.nodes[0]!,
    };
    expect(rejectedOutcome(applyOps(doc, [remove, replacement], catalog))).toBeUndefined();
    const stale = setNodeField("bob", 3, "title", "wrong lifetime") as Op & { node_incarnation: string };
    stale.node_incarnation = "0";

    expect(applyOps(doc, [stale], catalog).outcomes[0]).toMatchObject({ outcome: "no-op" });
    expect(node(doc)?.title).toBe("Load Image");
    doc.destroy();
  });
});
