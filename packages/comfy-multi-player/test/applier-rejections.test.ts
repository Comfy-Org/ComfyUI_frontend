/**
 * Rejection/error-branch coverage for the applier. The existing suite pins the
 * happy paths, idempotency, LWW, and a couple of rejections; this file targets
 * the `OpRejectedError` arms that v8 coverage showed uncovered, asserting the
 * `failed.code` returned by `applyOps` (abort-remainder; the doc is left
 * untouched by a rejected op — KA-4 / the "rejected op leaves doc untouched"
 * property).
 */
import { describe, expect, it } from "vitest";
import { rejectedOutcome } from "./apply-result-helpers.js";
import * as Y from "yjs";
import {
  OPAQUE_WIDGETS_KEY,
  type AddNodeOp,
  type ConcreteConnectOp,
  type Op,
  type SetWidgetOp,
  type WidgetCatalog,
  type WorkflowJSON,
  applyOps,
  mint,
  project,
} from "../src/index.js";

const catalog: WidgetCatalog = {
  types: {
    KSampler: { widget_order: ["seed", "steps", "cfg", "sampler_name", "scheduler", "denoise"] },
    Note: { widget_order: ["text"] },
    CheckpointLoaderSimple: { widget_order: ["ckpt_name"] },
  },
};

let seq = 0;
const opId = () => ("z" + String(seq++).padStart(4, "0")).padEnd(32, "0");
const env = (actor: string, baseVersion: number) => ({
  op_id: opId(),
  actor,
  base_version: baseVersion,
  stamp: [baseVersion, actor] as [number, string],
});

/** Base doc: a KSampler with one input + one output slot, and a source node. */
function baseDoc(): Y.Doc {
  const wf: WorkflowJSON = {
    nodes: [
      {
        id: 1,
        type: "KSampler",
        inputs: [{ name: "model", type: "MODEL", link: null }],
        outputs: [{ name: "LATENT", type: "LATENT", links: [] }],
      },
      {
        id: 2,
        type: "CheckpointLoaderSimple",
        inputs: [],
        outputs: [{ name: "MODEL", type: "MODEL", links: [] }],
      },
    ],
    links: [],
    last_node_id: 2,
    last_link_id: 0,
  } as unknown as WorkflowJSON;
  return mint(wf, catalog);
}

const codeOf = (r: ReturnType<typeof applyOps>) => rejectedOutcome(r)?.reason.code;

/** Deterministic workflow projection; excludes op_id / `__`-prefixed metadata. */
const snap = (doc: Y.Doc) => project(doc, catalog);

describe("applier rejections — add_node", () => {
  it("malformed_op when node_id/node payload is missing, leaving the doc untouched", () => {
    const doc = baseDoc();
    const before = snap(doc);
    const op = { op: "add_node", ...env("a", 1) } as unknown as Op; // no node_id/node
    expect(codeOf(applyOps(doc, [op], catalog))).toBe("malformed_op");
    expect(snap(doc)).toEqual(before);
  });

  it("invalid_node_payload when the node carries the reserved opaque-widgets key, leaving the doc untouched", () => {
    const doc = baseDoc();
    const before = snap(doc);
    const op: AddNodeOp = {
      op: "add_node",
      ...env("a", 1),
      node_id: 9,
      class_type: "Note",
      pos: [0, 0],
      node: { id: 9, type: "Note", [OPAQUE_WIDGETS_KEY]: [1, 2] } as never,
    };
    expect(codeOf(applyOps(doc, [op], catalog))).toBe("invalid_node_payload");
    expect(snap(doc)).toEqual(before);
  });

  it("is not a failure when the id already exists, and the winning payload is authoritative (#11)", () => {
    const doc = baseDoc();
    const before = snap(doc);
    const op: AddNodeOp = {
      op: "add_node",
      ...env("a", 1),
      node_id: 1,
      class_type: "KSampler",
      pos: [0, 0],
      node: { id: 1, type: "KSampler" } as never,
    };
    const r = applyOps(doc, [op], catalog);
    expect(rejectedOutcome(r)).toBeUndefined();
    // Node presence is resolved through the `["node", id]` stamp register, not
    // by arrival order (#11). The base doc's node 1 carries no stamp, so the
    // op wins and its payload replaces it verbatim (FC-8). The old
    // `nodes.has(key)` early return made delete->add and add->delete diverge.
    expect(snap(doc).nodes.find((n) => n.id === 1)).toEqual({ id: 1, type: "KSampler" });
    expect(snap(doc).nodes.map((n) => n.id)).toEqual(before.nodes.map((n) => n.id));
  });

  it("leaves the projection untouched when a lower-stamped add loses the node register (#11)", () => {
    const doc = baseDoc();
    const winner: AddNodeOp = {
      op: "add_node",
      ...env("z", 9),
      node_id: 5,
      class_type: "Note",
      pos: [0, 0],
      node: { id: 5, type: "Note" } as never,
    };
    expect(rejectedOutcome(applyOps(doc, [winner], catalog))).toBeUndefined();
    const before = snap(doc);
    const loser: AddNodeOp = {
      op: "add_node",
      ...env("a", 1),
      node_id: 5,
      class_type: "KSampler",
      pos: [0, 0],
      node: { id: 5, type: "KSampler" } as never,
    };
    // An LWW-dropped op is an accepted no-op that still consumes its op_id, so
    // it is projection-identical rather than byte-identical.
    const r = applyOps(doc, [loser], catalog);
    expect(rejectedOutcome(r)).toBeUndefined();
    expect(snap(doc)).toEqual(before);
  });

  it("aborts the remainder: a valid op after a rejected op does not apply (KA-4)", () => {
    const doc = baseDoc();
    const before = snap(doc);
    const bad = { op: "add_node", ...env("a", 1) } as unknown as Op; // malformed, rejected first
    const good: AddNodeOp = {
      op: "add_node",
      ...env("a", 1),
      node_id: 9,
      class_type: "Note",
      pos: [0, 0],
      node: { id: 9, type: "Note" } as never,
    };
    expect(codeOf(applyOps(doc, [bad, good], catalog))).toBe("malformed_op");
    // The trailing valid op must not have been applied.
    expect(snap(doc)).toEqual(before);
    expect(snap(doc).nodes.some((n) => n.id === 9)).toBe(false);
  });
});

describe("applier rejections — set_widget", () => {
  it("malformed_op for an interior write without inner_widget, leaving the doc untouched", () => {
    const doc = baseDoc();
    const before = snap(doc);
    const op = { op: "set_widget", ...env("a", 1), node_id: 1, widget: "steps", value: 5, path: ["1", "2"] } as unknown as SetWidgetOp;
    expect(codeOf(applyOps(doc, [op], catalog))).toBe("malformed_op");
    expect(snap(doc)).toEqual(before);
  });

  it("malformed_op for a top-level write with no widget name, leaving the doc untouched", () => {
    const doc = baseDoc();
    const before = snap(doc);
    const op = { op: "set_widget", ...env("a", 1), node_id: 1, value: 5 } as unknown as SetWidgetOp;
    expect(codeOf(applyOps(doc, [op], catalog))).toBe("malformed_op");
    expect(snap(doc)).toEqual(before);
  });

  it("not_a_subgraph when an interior path descends through a plain node, leaving the doc untouched", () => {
    const doc = baseDoc();
    const before = snap(doc);
    const op: SetWidgetOp = {
      op: "set_widget",
      ...env("a", 1),
      node_id: 1,
      widget: "steps",
      value: 5,
      path: ["1", "27"], // node 1 is a KSampler, not a subgraph
      inner_widget: "steps",
    };
    expect(codeOf(applyOps(doc, [op], catalog))).toBe("not_a_subgraph");
    expect(snap(doc)).toEqual(before);
  });
});

describe("applier rejections — connect", () => {
  const connect = (over: Partial<ConcreteConnectOp> = {}): ConcreteConnectOp => ({
    op: "connect",
    ...env("a", 1),
    link_id: 1000 + seq,
    from_node: 2,
    from_slot: 0,
    to_node: 1,
    to_slot: 0,
    link_type: "MODEL",
    ...over,
  });

  /**
   * A `connect` shape the {@link ConnectOp} union no longer permits (#17):
   * only a peer implementation can put it on the wire, so it is built as wire
   * data and cast at the boundary. The cast is the point — it marks the ops
   * this repo can no longer construct by accident but the applier must still
   * refuse.
   */
  const wireConnect = (over: Record<string, unknown>): Op =>
    ({ ...connect(), ...over }) as unknown as Op;

  it("output_slot_missing when from_slot is out of range, leaving nodes and links unchanged", () => {
    const doc = baseDoc();
    const before = snap(doc);
    expect(codeOf(applyOps(doc, [connect({ from_slot: 99 })], catalog))).toBe("output_slot_missing");
    const after = snap(doc);
    expect(after.nodes).toEqual(before.nodes);
    expect(after.links).toEqual(before.links);
  });

  it("input_slot_missing when to_slot is out of range, leaving nodes and links unchanged", () => {
    const doc = baseDoc();
    const before = snap(doc);
    expect(codeOf(applyOps(doc, [connect({ to_slot: 99 })], catalog))).toBe("input_slot_missing");
    const after = snap(doc);
    expect(after.nodes).toEqual(before.nodes);
    expect(after.links).toEqual(before.links);
  });

  it("malformed_op when to_slot is null and there is no grow, leaving nodes and links unchanged", () => {
    const doc = baseDoc();
    const before = snap(doc);
    expect(codeOf(applyOps(doc, [wireConnect({ to_slot: null })], catalog))).toBe("malformed_op");
    const after = snap(doc);
    expect(after.nodes).toEqual(before.nodes);
    expect(after.links).toEqual(before.links);
  });

  it("delete-wins no-op (not a failure) when the destination node is gone, leaving nodes and links unchanged", () => {
    const doc = baseDoc();
    const before = snap(doc);
    const r = applyOps(doc, [connect({ to_node: 987654321 })], catalog);
    expect(rejectedOutcome(r)).toBeUndefined();
    // Projection excludes the recorded op_id, so nodes/links must be identical.
    const after = snap(doc);
    expect(after.nodes).toEqual(before.nodes);
    expect(after.links).toEqual(before.links);
  });
});
