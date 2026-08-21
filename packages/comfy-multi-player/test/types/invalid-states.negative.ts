/**
 * Negative type tests for issue #17 — the states the op types must NOT be able
 * to represent.
 *
 * Every `@ts-expect-error` below is an assertion in both directions: if the
 * construction beneath it stops being an error, `tsc` fails ON THE
 * `@ts-expect-error` LINE ("Unused '@ts-expect-error' directive"). So this file
 * compiling cleanly means every listed invalid state is still uncompilable,
 * and a regression that reopens one of them turns the gate red rather than
 * silently passing. `test/type-negatives.test.ts` runs `tsc` over this file.
 *
 * The POSITIVE cases at the bottom are load-bearing too: without them a change
 * that made EVERY op literal fail to type-check would still leave this file
 * compiling, and the gate would be vacuous.
 *
 * Scope note. These constrain THIS repo's call sites only. Ops arrive over a
 * wire from other implementations, so the runtime validator is what protects
 * the document; `test/invalid-op-states.test.ts` is the matching runtime
 * audit, including the states the wire still accepts.
 */
import type {
  AddNodeOp,
  ClearOp,
  ConcreteConnectOp,
  ConnectOp,
  DeleteNodeOp,
  GrowConnectOp,
  InteriorSetWidgetOp,
  Op,
  ResetDocOp,
  SetWidgetOp,
  TopLevelSetWidgetOp,
  WireOp,
} from "../../src/index.js";

const env = {
  op_id: "0".repeat(32),
  actor: "agent:t:1",
  base_version: 1,
  stamp: [1, "agent:t:1"] as [number, string],
};

// ---------------------------------------------------------------------------
// connect: `grow` and a concrete `to_slot` are mutually exclusive
// ---------------------------------------------------------------------------

// A grow connect names a slot the applier will not wire: the index comes from
// `grow_id`, and `to_slot` is never read on this path.
const growWithConcreteSlot: GrowConnectOp = {
  op: "connect",
  ...env,
  link_id: 1,
  from_node: 2,
  from_slot: 0,
  to_node: 3,
  // @ts-expect-error #17: a grown slot has no concrete index.
  to_slot: 0,
  link_type: "X",
  grow: { name: "images.image0", type: "X" },
};

// The same op assigned to the union, rather than to one variant: the union
// must reject it too, or the split would only bind callers who already knew
// which variant they meant.
// @ts-expect-error #17: `grow` + numeric `to_slot` is not a `ConnectOp`.
const growWithConcreteSlotUnion: ConnectOp = {
  op: "connect",
  ...env,
  link_id: 1,
  from_node: 2,
  from_slot: 0,
  to_node: 3,
  to_slot: 0,
  link_type: "X",
  grow: { name: "images.image0", type: "X" },
};

// A concrete connect with no slot at all: nothing tells the applier where to
// wire, and there is no grow payload to compute it from.
// @ts-expect-error #17: `to_slot: null` requires a `grow` payload.
const nullSlotWithoutGrow: ConnectOp = {
  op: "connect",
  ...env,
  link_id: 1,
  from_node: 2,
  from_slot: 0,
  to_node: 3,
  to_slot: null,
  link_type: "X",
};

const concreteWithGrow: ConcreteConnectOp = {
  op: "connect",
  ...env,
  link_id: 1,
  from_node: 2,
  from_slot: 0,
  to_node: 3,
  to_slot: 0,
  link_type: "X",
  // @ts-expect-error #17: a concrete connect may not carry a `grow` payload.
  grow: { name: "images.image0", type: "X" },
};

// ---------------------------------------------------------------------------
// set_widget: `path` and `inner_widget` are required together, path non-empty
// ---------------------------------------------------------------------------

// An `inner_widget` with no `path` is not an interior write. The applier
// ignores it and writes `widget` at the TOP level — a different widget than
// the one the op names.
// @ts-expect-error #17: `inner_widget` without `path` is not a `SetWidgetOp`.
const innerWidgetWithoutPath: SetWidgetOp = {
  op: "set_widget",
  ...env,
  node_id: 1,
  widget: "steps",
  value: 5,
  inner_widget: "seed",
};

// @ts-expect-error #17: an interior write must carry `inner_widget`.
const pathWithoutInnerWidget: InteriorSetWidgetOp = {
  op: "set_widget",
  ...env,
  node_id: 1,
  widget: "steps",
  value: 5,
  path: ["57", "27"],
};

// And the same shape is not a `SetWidgetOp` either — it matches neither
// variant, so no caller can smuggle it in by widening to the union.
const pathWithoutInnerWidgetUnion: SetWidgetOp = {
  op: "set_widget",
  ...env,
  node_id: 1,
  widget: "steps",
  value: 5,
  // @ts-expect-error #17: a path with no `inner_widget` matches neither variant.
  path: ["57", "27"],
};

// An empty path reads as "no interior address" at runtime, so pairing it with
// an `inner_widget` is the same lie as omitting the path entirely.
const emptyPathInterior: InteriorSetWidgetOp = {
  op: "set_widget",
  ...env,
  node_id: 1,
  widget: "steps",
  value: 5,
  // @ts-expect-error #17: an interior path must have at least one segment.
  path: [],
  inner_widget: "seed",
};

const topLevelWithPath: TopLevelSetWidgetOp = {
  op: "set_widget",
  ...env,
  node_id: 1,
  widget: "steps",
  value: 5,
  // @ts-expect-error #17: a top-level write may not carry an interior path.
  path: ["57", "27"],
  // @ts-expect-error #17: a top-level write may not carry an `inner_widget`.
  inner_widget: "seed",
};

// A `string[]` cannot be proven non-empty, so it is not an interior path.
declare const unprovenPath: string[];
const unprovenInteriorPath: InteriorSetWidgetOp = {
  op: "set_widget",
  ...env,
  node_id: 1,
  widget: "steps",
  value: 5,
  // @ts-expect-error #17: `string[]` may be empty; an interior path may not.
  path: unprovenPath,
  inner_widget: "seed",
};

// ---------------------------------------------------------------------------
// reset_doc is not something `applyOps` can be asked to do
// ---------------------------------------------------------------------------

const reset: ResetDocOp = {
  op: "reset_doc",
  ...env,
  workflow: { nodes: [], links: [] },
};

// @ts-expect-error #17: `reset_doc` is deferred; it is a `WireOp`, not an `Op`.
const resetAsOp: Op = reset;

declare function applyOpsSignature(ops: Op[]): void;
// @ts-expect-error #17: the applier cannot be handed an op it always refuses.
applyOpsSignature([reset]);

// ---------------------------------------------------------------------------
// Positive controls — these MUST compile, or the gate above is vacuous
// ---------------------------------------------------------------------------

const okAddNode: AddNodeOp = {
  op: "add_node",
  ...env,
  node_id: 9,
  class_type: "KSampler",
  pos: [0, 0],
  node: { id: 9, type: "KSampler" },
};

const okConcreteConnect: Op = {
  op: "connect",
  ...env,
  link_id: 1,
  from_node: 2,
  from_slot: 0,
  to_node: 3,
  to_slot: 0,
  link_type: "X",
};

// Both shapes comfy-cli mints for a grow: explicit `to_slot: null`, and absent.
const okGrowConnectExplicitNull: Op = {
  op: "connect",
  ...env,
  link_id: 1,
  from_node: 2,
  from_slot: 0,
  to_node: 3,
  to_slot: null,
  link_type: "X",
  grow: { name: "images.image0", type: "X" },
};

const okGrowConnectOmitted: Op = {
  op: "connect",
  ...env,
  link_id: 1,
  from_node: 2,
  from_slot: 0,
  to_node: 3,
  link_type: "X",
  grow: { name: "image_1", type: "X", inputcount: { widget: "inputcount", value: 2 } },
};

// Explicit `grow: null`, the mirror of the explicit-nulls set_widget control
// below: a peer that emits every field must still be modellable as concrete.
const okConcreteConnectExplicitNullGrow: Op = {
  op: "connect",
  ...env,
  link_id: 1,
  from_node: 2,
  from_slot: 0,
  to_node: 3,
  to_slot: 0,
  link_type: "X",
  grow: null,
};

const okTopLevelSetWidget: Op = {
  op: "set_widget",
  ...env,
  node_id: 1,
  widget: "steps",
  value: 5,
  old: 4,
};

// Explicit nulls, the way a peer that always emits every field would send it.
const okTopLevelSetWidgetExplicitNulls: Op = {
  op: "set_widget",
  ...env,
  node_id: 1,
  widget: "steps",
  value: 5,
  path: null,
  inner_widget: null,
};

const okInteriorSetWidget: Op = {
  op: "set_widget",
  ...env,
  node_id: 57,
  widget: "text",
  value: "a cat in a hat",
  path: ["57", "27"],
  inner_widget: "text",
};

const okDeleteNode: Op = { op: "delete_node", ...env, node_id: 1, removed_links: [4, 5] };
const okClear: Op = { op: "clear", ...env, removed_nodes: [1, 2] };

// `WireOp` still models everything the vocabulary declares, deferred included.
const okResetAsWireOp: WireOp = reset;

// Keep every binding used so `noUnusedLocals` (if ever enabled) stays quiet and
// nothing here is dead.
export const checked = [
  growWithConcreteSlot,
  growWithConcreteSlotUnion,
  nullSlotWithoutGrow,
  concreteWithGrow,
  innerWidgetWithoutPath,
  pathWithoutInnerWidget,
  pathWithoutInnerWidgetUnion,
  emptyPathInterior,
  topLevelWithPath,
  unprovenInteriorPath,
  resetAsOp,
  okAddNode,
  okConcreteConnect,
  okGrowConnectExplicitNull,
  okGrowConnectOmitted,
  okConcreteConnectExplicitNullGrow,
  okTopLevelSetWidget,
  okTopLevelSetWidgetExplicitNulls,
  okInteriorSetWidget,
  okDeleteNode,
  okClear,
  okResetAsWireOp,
] satisfies (WireOp | ClearOp | DeleteNodeOp)[];
