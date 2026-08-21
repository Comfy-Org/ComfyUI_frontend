/**
 * The op applier — a faithful TypeScript port of comfy-cli
 * `workflow_ops.apply_op` (op-vocabulary-v1.md §1–§4, §8) onto the v1 Y.Doc
 * layout (docs/multiplayer-schema.md), with the widget write path adapted to
 * the name-keyed widgets Y.Map (schema §1.2 — the one deliberate departure
 * from the positional-array spike prototype).
 *
 * Guarantees (spike-verified semantics, pinned by the test suite):
 *  - idempotent per `op_id` (`__applied`, checked before ANY mutation so a
 *    duplicate apply is a byte-level no-op);
 *  - LWW for widget writes via `__stamps` with the exact
 *    `[base_version, actor, op_id]` code-point comparison (vocabulary §8.1);
 *  - delete-wins: an op whose target is gone is a silent no-op that still
 *    consumes its op_id; malformed/unknown ops are rejected loudly;
 *  - abort-remainder batches (vocabulary §4): on failure, ops after the
 *    failing index are not applied and the applied prefix is retained;
 *  - one Y transaction per op (schema §2.4), preconditions validated before
 *    the first mutation so a rejected op leaves the doc untouched.
 */

import * as Y from "yjs";
import { assertNever } from "./exhaustive.js";
import {
  adel,
  appliedMap,
  apush,
  countDefinitionInstances,
  createNodeMap,
  linksMap,
  mdel,
  metaMap,
  mset,
  nodesMap,
  resolveDefinition,
  stampsMap,
  widgetStorageOf,
} from "./doc.js";
import { compareStampKeys, stampKey, stampTargetKey } from "./stamps.js";
import {
  DEFERRED_OPS,
  FROZEN_OPS,
  OpRejectedError,
  type AddNodeOp,
  type ApplyFailure,
  type ApplyResult,
  type ConnectOp,
  type DeleteNodeOp,
  type GrowConnectOp,
  type GrowSpec,
  type InteriorSetWidgetOp,
  type Op,
  type SetWidgetOp,
  type StampKey,
  type WidgetCatalog,
  type WireOp,
} from "./types.js";

/**
 * Apply a batch of stamped ops to the doc, one transaction per op.
 * Idempotent per op_id; convergent under reordering via the
 * `[base_version, actor, op_id]` stamp order (schema §3).
 *
 * `catalog` (the pinned object_info projection) is needed to decompose an
 * `add_node` payload's positional `widgets_values` into the name-keyed
 * widgets map, for autogrow collision renames, and to validate widget names;
 * without it, catalog-dependent ops that can degrade safely do (widget-name
 * validation is skipped — writes are name-keyed either way) and ops that
 * cannot are rejected with `catalog_required`.
 */
export function applyOps(doc: Y.Doc, ops: Op[], catalog?: WidgetCatalog): ApplyResult {
  const bookkeeping = appliedMap(doc);
  const applied: string[] = [];
  const skipped: string[] = [];
  let failed: ApplyFailure | null = null;

  for (let index = 0; index < ops.length; index++) {
    const op = ops[index]!;
    try {
      validateEnvelope(op);
      if (bookkeeping.has(op.op_id)) {
        // Idempotency gate BEFORE any mutation/transaction: a duplicate apply
        // is a true no-op (byte-identical encodeStateAsUpdate).
        skipped.push(op.op_id);
        continue;
      }
      doc.transact(() => {
        dispatch(doc, op, catalog);
        // comfy-cli records the op_id even for delete-wins/LWW-dropped no-ops.
        mset(bookkeeping, op.op_id, 1);
      }, op.actor);
      applied.push(op.op_id);
    } catch (err) {
      failed = {
        index,
        op,
        code: err instanceof OpRejectedError ? err.code : "apply_failed",
        message: err instanceof Error ? err.message : String(err),
      };
      break; // abort-remainder (vocabulary §4)
    }
  }

  return { applied, skipped, failed, applied_count: applied.length, version: bookkeeping.size };
}

const FROZEN = new Set<string>(FROZEN_OPS);
const DEFERRED = new Set<string>(DEFERRED_OPS);

/**
 * Resolve a node type to its catalog entry by OWN property only. Bracket
 * indexing walks the prototype chain, so an untrusted `type` of `__proto__`
 * (or `constructor`, `toString`, …) resolves to an inherited object and is
 * mistaken for a catalog entry with a garbage `widget_order` (#13).
 */
function catalogEntry(
  catalog: WidgetCatalog | undefined,
  nodeType: unknown,
): WidgetCatalog["types"][string] | undefined {
  if (!catalog || typeof nodeType !== "string") return undefined;
  return Object.hasOwn(catalog.types, nodeType) ? catalog.types[nodeType] : undefined;
}

/**
 * The wire boundary (issue #17). THIS, not the type system, is what protects
 * the document: the `op` argument is typed for this repo's own call sites, but
 * every real caller decoded it from JSON a peer implementation produced, so
 * every branch below must assume the value is arbitrary.
 *
 * It is also the ONLY owner of the deferred-kind rejection. `dispatch` handles
 * exactly {@link Op}; `reset_doc` never reaches it because this runs first,
 * before the idempotency gate and before any transaction, so the rejected op
 * itself mutates nothing and consumes no `op_id`.
 *
 * Scoped deliberately to THAT OP: `applyOps` is abort-remainder, not
 * all-or-nothing (vocabulary §4), so ops earlier in the batch stay applied and
 * the DOCUMENT is byte-identical only when the rejected op is the first one.
 * See the README's "an op kind this build does not know" paragraph and
 * `test/exhaustiveness.test.ts`.
 */
function validateEnvelope(op: WireOp): void {
  if (typeof op !== "object" || op === null || typeof op.op !== "string") {
    throw new OpRejectedError("malformed_op", "op is not an object with a string 'op' kind");
  }
  if (DEFERRED.has(op.op)) {
    throw new OpRejectedError(
      "op_deferred",
      `unknown op '${op.op}' — defined by the vocabulary but deferred (op-vocabulary-v1.md §1.6); rejected until un-deferred by amendment`,
    );
  }
  if (!FROZEN.has(op.op)) {
    throw new OpRejectedError("unknown_op", `unknown op '${op.op}'`);
  }
  if (typeof op.op_id !== "string" || op.op_id.length === 0) {
    throw new OpRejectedError("malformed_op", `${op.op}: missing op_id`);
  }
}

function dispatch(doc: Y.Doc, op: Op, catalog?: WidgetCatalog): void {
  switch (op.op) {
    case "add_node":
      applyAddNode(doc, op, catalog);
      return;
    case "set_widget":
      applySetWidget(doc, op, catalog);
      return;
    case "connect":
      applyConnect(doc, op, catalog);
      return;
    case "delete_node":
      applyDeleteNode(doc, op);
      return;
    case "clear":
      applyClear(doc);
      return;
    default:
      // Exhaustiveness guard (issue #21): with every `Op` member cased above,
      // `op` is `never` here. Add a sixth IMPLEMENTED kind to `Op` and this
      // line stops compiling until it gets a `case`.
      //
      // Issue #17 removed the `case "reset_doc"` that used to sit here. It was
      // unreachable — `validateEnvelope` rejects every DEFERRED_OPS kind
      // before dispatch — and `reset_doc` is no longer an `Op` member, so
      // there is nothing to case. The "un-deferring surfaces as implement me"
      // property is preserved and sharpened: un-deferring means moving
      // `ResetDocOp` from `DeferredOp` into `Op`, which breaks this guard AND
      // the `FROZEN_OPS`/`DEFERRED_OPS` partition assertions in `types.ts`.
      // The deferred rejection itself keeps exactly one owner
      // (`validateEnvelope`), pinned by `test/exhaustiveness.test.ts`.
      return assertNever(op, "applier.dispatch");
  }
}

// ---------------------------------------------------------------------------
// add_node
// ---------------------------------------------------------------------------

/**
 * Refuse an `add_node` payload whose NAME-KEYED `widgets_values` record could
 * never be projected, before it is stored (#13).
 *
 * A name-keyed record bypasses `widget_order` decomposition, so nothing else
 * checks it. If the class is absent from the pinned catalog, or a name is not
 * in its `widget_order`, `project()` throws for the WHOLE document on every
 * later read — one accepted op permanently poisons the doc, exactly the
 * failure `rejectIfOpaqueWidgets` exists to prevent (schema §1.2, §3 pin 4).
 * A positional array for an uncatalogued class is NOT this case: it is stored
 * opaquely and round-trips verbatim.
 */
function rejectUnprojectableWidgets(
  nodeType: unknown,
  wv: unknown,
  entry: WidgetCatalog["types"][string] | undefined,
): void {
  if (typeof wv !== "object" || wv === null || Array.isArray(wv)) return;
  const names = Object.keys(wv);
  if (names.length === 0) return;
  const type = String(nodeType);
  if (!entry) {
    throw new OpRejectedError(
      "uncatalogued_widget_write",
      `add_node(${type}): named widgets_values for a class absent from the pinned catalog cannot be projected (schema §1.2 — projection is catalog-dependent by design)`,
    );
  }
  for (const name of names) {
    if (!entry.widget_order.includes(name)) {
      throw new OpRejectedError(
        "unknown_widget",
        `add_node(${type}): widget '${name}' is not in widget_order for ${type}; available: ${entry.widget_order.join(", ") || "(none — all inputs are links)"}`,
      );
    }
  }
}

function applyAddNode(doc: Y.Doc, op: AddNodeOp, catalog?: WidgetCatalog): void {
  if (op.node_id === undefined || typeof op.node !== "object" || op.node === null) {
    throw new OpRejectedError("malformed_op", "add_node: missing node_id or node payload");
  }
  const nodes = nodesMap(doc);
  const key = String(op.node_id);
  if (nodes.has(key)) return; // structural idempotency: id already present → no-op

  // The op.node payload is authoritative (vocabulary §8.5) — inserted
  // verbatim, never re-derived from the catalog. The catalog IS needed here,
  // unlike in Python: decomposing the payload's positional widgets_values
  // into the name-keyed widgets map (schema §1.2) requires widget_order.
  const wv = op.node.widgets_values;
  // OWN-property lookup: `catalog.types['__proto__']` (and any other inherited
  // key) otherwise resolves to a prototype object and is mistaken for a real
  // catalog entry (#13).
  const entry = catalogEntry(catalog, op.node.type);
  const order = entry?.widget_order;
  // No catalog AT ALL: the host cannot tell an unknown class from a known one,
  // so it cannot decide between name-decomposition and opaque storage — reject
  // rather than guess. A catalog that simply lacks THIS class is a different
  // case: the class is unknown to object_info (frontend-only nodes always are),
  // and `createNodeMap` stores its values opaquely (schema §1.2).
  if (!catalog && Array.isArray(wv) && wv.length > 0) {
    throw new OpRejectedError(
      "catalog_required",
      `add_node(${op.node.type}): positional widgets_values needs the pinned catalog widget_order to decompose into the name-keyed widgets map (schema §1.2)`,
    );
  }
  rejectUnprojectableWidgets(op.node.type, wv, entry);
  let nodeMap: Y.Map<unknown>;
  try {
    nodeMap = createNodeMap(op.node, order);
  } catch (err) {
    throw new OpRejectedError(
      "invalid_node_payload",
      `add_node(${String(op.node.type)}): ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  mset(nodes, key, nodeMap);

  // last_node_id is a max-register (vocabulary §8.3): write only on increase.
  const meta = metaMap(doc);
  const cur = meta.get("last_node_id");
  const curN = typeof cur === "number" ? cur : 0;
  if (typeof op.node_id === "number" && op.node_id > curN) {
    mset(meta, "last_node_id", op.node_id);
  }
}

// ---------------------------------------------------------------------------
// set_widget
// ---------------------------------------------------------------------------

/**
 * Reject a name-keyed widget write the pinned catalog cannot describe
 * (comfy-cli `_widget_index` raises). Two rejections, and they are the SAME
 * pair `add_node` applies via `rejectUnprojectableWidgets` — the two op kinds
 * must agree about what a name-keyed widget write may say, or the stricter one
 * merely relocates the poisoning to the laxer one (#13).
 *
 * - class absent from the pinned catalog → `uncatalogued_widget_write`. A
 *   name-keyed write creates the `widgets` map that `project()` then cannot
 *   turn back into positional values, so the write makes the WHOLE document
 *   unprojectable on every later read. A class stored opaquely never reaches
 *   here — `rejectIfOpaqueWidgets` runs first and owns that case (§1.2).
 * - name absent from the class's `widget_order` → `unknown_widget`.
 *
 * Skipped entirely when there is NO catalog: the host cannot then tell an
 * unknown class from a known one, which is the same "reject rather than guess"
 * boundary `applyAddNode` draws for a positional payload.
 */
function validateWidgetName(
  catalog: WidgetCatalog | undefined,
  nodeType: string,
  widget: string,
): void {
  if (!catalog) return;
  const entry = catalogEntry(catalog, nodeType);
  if (!entry) {
    throw new OpRejectedError(
      "uncatalogued_widget_write",
      `set_widget(${nodeType}): named widget write to a class absent from the pinned catalog cannot be projected (schema §1.2 — projection is catalog-dependent by design)`,
    );
  }
  if (!entry.widget_order.includes(widget)) {
    throw new OpRejectedError(
      "unknown_widget",
      `widget '${widget}' not found on ${nodeType}; available: ${entry.widget_order.join(", ") || "(none — all inputs are links)"}`,
    );
  }
}

/**
 * Refuse a name-addressed widget write against a node whose `widgets_values`
 * is stored opaquely (schema §1.2 — a class the pinned catalog does not
 * describe, e.g. the frontend-only `Note`/`MarkdownNote`).
 *
 * REJECTED, not silently skipped, and deliberately: the opaque array has no
 * name→position mapping, so the write cannot be expressed. Silently no-oping
 * it is exactly the failure this whole change exists to kill — the writer is
 * told "applied" while nothing changed. Delete-wins silence is justified
 * because the target genuinely no longer exists; here the target exists and
 * the op is unsatisfiable, which schema §3 pin 4 puts in the "reject loudly"
 * bucket.
 *
 * Writing anyway would be worse than a lie: it would create a name-keyed
 * `widgets` map alongside the opaque key, and `project()` would then throw for
 * the unknown class on EVERY subsequent read — one bad op poisoning the whole
 * document.
 */
function rejectIfOpaqueWidgets(node: Y.Map<unknown>, widget: string): void {
  const storage = widgetStorageOf(node);
  switch (storage) {
    case "named":
      // Name-addressable: the write proceeds against the `widgets` Y.Map.
      return;
    case "opaque": {
      const type = String(node.get("type") ?? "");
      throw new OpRejectedError(
        "opaque_widgets",
        `widget write '${widget}' on node ${String(node.get("id"))} (${type}): ${type} is absent from the pinned catalog, so its widgets_values is stored opaquely (schema §1.2) and is not name-addressable`,
      );
    }
    default:
      // Issue #21: a third storage strategy must decide explicitly whether a
      // name-addressed write is expressible against it. Falling through to
      // "allowed" is the silent-mishandling failure this guard exists to stop.
      return assertNever(storage, "applier.rejectIfOpaqueWidgets");
  }
}

/**
 * The node's name-keyed `widgets` Y.Map, created on first write.
 *
 * `named`-storage path only — every caller runs `rejectIfOpaqueWidgets` first,
 * which is where the storage-strategy decision is made and guarded.
 */
function widgetsOf(node: Y.Map<unknown>): Y.Map<unknown> {
  let widgets = node.get("widgets");
  if (!(widgets instanceof Y.Map)) {
    // comfy-cli creates widgets_values on first write; mirror by creating the map.
    widgets = new Y.Map<unknown>();
    mset(node, "widgets", widgets);
  }
  return widgets as Y.Map<unknown>;
}

/**
 * Is this an INTERIOR (subgraph-scoped) write? The predicate is the runtime
 * half of the {@link SetWidgetOp} union split (issue #17): the type says a
 * non-empty `path` comes with an `inner_widget`, and this says what the
 * applier does when a wire op disagrees.
 *
 * A non-empty `path` alone selects the interior branch — `inner_widget` is
 * then validated separately and its absence is `malformed_op`, exactly as
 * before. The narrowing is a convenience for this repo; the check that
 * follows it is the guarantee.
 */
function isInteriorWrite(op: SetWidgetOp): op is InteriorSetWidgetOp {
  return Array.isArray(op.path) && op.path.length > 0;
}

function applySetWidget(doc: Y.Doc, op: SetWidgetOp, catalog?: WidgetCatalog): void {
  const interior: InteriorSetWidgetOp | null = isInteriorWrite(op) ? op : null;
  if (interior !== null && typeof interior.inner_widget !== "string") {
    throw new OpRejectedError("malformed_op", "set_widget: interior write without inner_widget");
  }
  if (interior === null && typeof op.widget !== "string") {
    throw new OpRejectedError("malformed_op", "set_widget: missing widget name");
  }

  // LWW gate first (comfy-cli `_apply_set_widget`): a lower-or-equal stamp is
  // dropped — a protocol-level apply that still consumes its op_id.
  const stamps = stampsMap(doc);
  const targetKey = stampTargetKey(op);
  const prior = stamps.get(targetKey) as StampKey | undefined;
  const key = stampKey(op);
  if (prior != null && compareStampKeys(key, prior) <= 0) return; // lww-dropped

  if (interior !== null) {
    const target = resolveInteriorNode(doc, interior.path.map(String), catalog);
    if (target === null) return; // head instance concurrently deleted → no-op (delete wins)
    const nodeType = String(target.get("type") ?? "");
    const widget = interior.inner_widget;
    rejectIfOpaqueWidgets(target, widget);
    // Same catalogue rules as a top-level write, and for the same reason: an
    // interior node projects through `projectDefinition` -> `projectNode` ->
    // `widgetsToPositional`, so a named write the catalogue cannot describe
    // makes the WHOLE document unprojectable exactly as it would at top level.
    // Runs BEFORE the range check so an uncatalogued class is refused rather
    // than falling through the `if (entry)` block as an accepted write (#13).
    validateWidgetName(catalog, nodeType, widget);
    // OWN-property lookup (#13): an inherited key such as `__proto__` must read
    // as "absent from the catalog", not resolve to a prototype object.
    const entry = catalogEntry(catalog, nodeType);
    if (entry) {
      const idx = entry.widget_order.indexOf(widget);
      // Interior writes never pad (comfy-cli `_write_widget` extend=False):
      // the projected positional index must already be inside the node's
      // current widgets_values length.
      const len = projectedWidgetsLength(target, entry.widget_order);
      if (idx >= len) {
        throw new OpRejectedError(
          "widget_out_of_range",
          `widget index ${idx} out of range for ${nodeType} (interior writes never pad)`,
        );
      }
    }
    mset(widgetsOf(target), widget, structuredClone(op.value));
    mset(stamps, targetKey, key);
    return;
  }

  const node = nodesMap(doc).get(String(op.node_id));
  if (!node) return; // target concurrently deleted → no-op (delete wins)
  rejectIfOpaqueWidgets(node, op.widget);
  validateWidgetName(catalog, String(node.get("type") ?? ""), op.widget);
  // Top-level writes may extend past the current positional length — comfy-cli
  // pads with None; here the name-keyed map makes padding a projection concern.
  mset(widgetsOf(node), op.widget, structuredClone(op.value));
  mset(stamps, targetKey, key);
}

/** The node's current projected widgets_values length: 1 + highest widget_order index present in the name-keyed map. `named`-storage path only (see `widgetsOf`). */
function projectedWidgetsLength(node: Y.Map<unknown>, order: readonly string[]): number {
  const widgets = node.get("widgets");
  if (!(widgets instanceof Y.Map)) return 0;
  let max = -1;
  widgets.forEach((_v: unknown, name: string) => {
    const i = order.indexOf(name);
    if (i > max) max = i;
  });
  return max + 1;
}

/**
 * Walk a resolved interior path (["57","27",…]) into (possibly nested)
 * subgraph definitions. Returns the interior node Y.Map, or null when the
 * head instance is gone (delete wins). Mirrors comfy-cli
 * `engine._resolve_node_path` — except that a shared definition is REJECTED,
 * not forked: schema §5.3 pins that a conforming applier must reject interior
 * writes to shared definitions until forking is specced and fixtured.
 */
function resolveInteriorNode(doc: Y.Doc, path: string[], catalog?: WidgetCatalog): Y.Map<unknown> | null {
  const head = nodesMap(doc).get(path[0]!);
  if (!head) return null;
  let cur: Y.Map<unknown> = head;
  for (const seg of path.slice(1)) {
    const curType = String(cur.get("type") ?? "");
    const def = resolveDefinition(doc, curType);
    if (!def) {
      throw new OpRejectedError(
        "not_a_subgraph",
        `node ${String(cur.get("id"))} is not a subgraph; cannot descend to '${seg}'`,
      );
    }
    const defId = String(def.get("id") ?? curType);
    const instances = countDefinitionInstances(doc, defId, catalog);
    if (instances > 1) {
      throw new OpRejectedError(
        "shared_definition_unforked",
        `definition ${defId} is instantiated ${instances} times; interior writes to shared definitions are rejected until forking is specced (schema §5.3)`,
      );
    }
    const innerNodes = def.get("nodes");
    const inner = innerNodes instanceof Y.Map ? innerNodes.get(seg) : undefined;
    if (!(inner instanceof Y.Map)) {
      throw new OpRejectedError(
        "interior_node_not_found",
        `interior node ${seg} not found in subgraph ${defId}`,
      );
    }
    cur = inner;
  }
  return cur;
}

// ---------------------------------------------------------------------------
// connect
// ---------------------------------------------------------------------------

/** The source node's `outputs` array, with `from_slot` validated before any mutation. */
function requireOutputSlot(src: Y.Map<unknown>, op: ConnectOp): Y.Array<unknown> {
  const outs = src.get("outputs");
  if (!(outs instanceof Y.Array) || typeof op.from_slot !== "number" || op.from_slot >= outs.length) {
    throw new OpRejectedError(
      "output_slot_missing",
      `connect: output slot ${op.from_slot} not found on node ${String(op.from_node)}`,
    );
  }
  return outs as Y.Array<unknown>;
}

function applyConnect(doc: Y.Doc, op: ConnectOp, catalog?: WidgetCatalog): void {
  const nodes = nodesMap(doc);
  const dst = nodes.get(String(op.to_node));
  // The destination is gone → the target slot does not exist and never will
  // (ids are never reused), so there is no register to claim: delete wins.
  if (!dst) return;

  // The §8.4 inputcount grow carries a widget write; if that write is
  // impossible (opaque destination) the whole op is refused HERE, before the
  // slot append, so a rejected op still leaves the doc untouched.
  if (op.grow?.inputcount != null) {
    rejectIfOpaqueWidgets(dst, String(op.grow.inputcount.widget));
  }

  let toIdx: number;
  // Issue #17: this is the discriminant of the `ConnectOp` union. The type now
  // says a `grow` op has no numeric `to_slot` and a concrete op has no `grow`;
  // this branch is where a wire op that says otherwise is disposed of — and it
  // is disposed of exactly as before, `grow` winning and `to_slot` unread.
  if (op.grow != null) {
    // Autogrow is NOT a shared register: every grow mints its own slot keyed by
    // `grow_id`, so two concurrent grows onto one base both survive and there
    // is nothing to gate (vocabulary §1.2 / amendment v1.2's carve-out).
    const src = nodes.get(String(op.from_node));
    if (!src) return; // source concurrently deleted → no-op (delete wins)
    requireOutputSlot(src, op);
    toIdx = growInputSlot(doc, dst, op, catalog);
  } else {
    if (typeof op.to_slot !== "number") {
      throw new OpRejectedError("malformed_op", "connect: to_slot must be a number unless grow is present");
    }
    toIdx = op.to_slot;
    const ins = dst.get("inputs");
    if (!(ins instanceof Y.Array) || toIdx >= ins.length) {
      throw new OpRejectedError(
        "input_slot_missing",
        `connect: input slot ${toIdx} not found on node ${String(op.to_node)}`,
      );
    }
    const slot = ins.get(toIdx);
    if (!(slot instanceof Y.Map)) {
      throw new OpRejectedError("input_slot_missing", `connect: input slot ${toIdx} is not a slot record`);
    }

    // ---- The concrete-input LWW register (op-vocabulary-v1.md amendment v1.2)
    //
    // A concrete input holds at most one link, so "who occupies this slot" is a
    // SCALAR target — `("input", to_node, to_slot)` — gated by exactly the
    // `[base_version, actor, op_id]` comparison `set_widget` uses. Without this
    // gate the occupant was decided by ARRIVAL ORDER, and composed with
    // delete-wins that produced graphs where a link exists in one interleaving
    // and not in another (schema §2.5 violated; found adversarially, cloud
    // PR #6722 FINDING 1).
    const stamps = stampsMap(doc);
    const targetKey = stampTargetKey(op);
    const prior = stamps.get(targetKey) as StampKey | undefined;
    const key = stampKey(op);
    if (prior != null && compareStampKeys(key, prior) <= 0) return; // lww-dropped

    // Claiming the register is UNCONDITIONAL once the gate passes — the prior
    // occupant is retired even if this op then turns out to be a delete-wins
    // no-op below. Deferring the retirement until the link is known to be
    // installable would reintroduce order dependence: whether the incumbent
    // survives would depend on whether the concurrent delete of THIS op's
    // source had arrived yet.
    mset(stamps, targetKey, key);
    const prev = slot.get("link");
    if (prev != null && prev !== op.link_id) removeLink(doc, prev);
  }

  const src = nodes.get(String(op.from_node));
  // Source concurrently deleted → the winning connect leaves the input EMPTY
  // (delete wins over the link, not over the register claim).
  if (!src) return;
  const outs = requireOutputSlot(src, op);

  const links = linksMap(doc);
  const linkKey = String(op.link_id);
  if (!links.has(linkKey)) {
    mset(links, linkKey, [op.link_id, op.from_node, op.from_slot, op.to_node, toIdx, op.link_type]);
  }
  const ins = dst.get("inputs") as Y.Array<Y.Map<unknown>>;
  mset(ins.get(toIdx)!, "link", op.link_id);
  const outPort = outs.get(op.from_slot) as Y.Map<unknown>;
  let outLinks = outPort.get("links");
  if (!(outLinks instanceof Y.Array)) {
    // Mirrors the `"links": null` guard in `_apply_connect`: a never-wired
    // output serialized as null gets a fresh list on first wire.
    outLinks = new Y.Array<unknown>();
    mset(outPort, "links", outLinks);
  }
  if (!(outLinks as Y.Array<unknown>).toArray().includes(op.link_id)) {
    apush(outLinks as Y.Array<unknown>, op.link_id);
  }
}

/**
 * Autogrow: find or append the grown input slot, keyed by `grow_id` (the
 * link id) so replay is idempotent AND non-clobbering. Returns the slot index.
 * The inputcount family (§8.4) additionally performs the stamped count-widget
 * write when (and only when) the slot is actually grown.
 */
function growInputSlot(
  doc: Y.Doc,
  dst: Y.Map<unknown>,
  op: GrowConnectOp,
  catalog?: WidgetCatalog,
): number {
  const grow = op.grow;
  if (typeof grow.name !== "string" || typeof grow.type !== "string") {
    throw new OpRejectedError("malformed_op", "connect: grow payload needs name and type");
  }
  let ins = dst.get("inputs");
  if (!(ins instanceof Y.Array)) {
    ins = new Y.Array<unknown>();
    mset(dst, "inputs", ins);
  }
  const insArr = ins as Y.Array<unknown>;
  let existing = -1;
  insArr.forEach((slot: unknown, idx: number) => {
    if (slot instanceof Y.Map && slot.get("grow_id") === op.link_id) existing = idx;
  });
  if (existing >= 0) return existing;

  let name: string;
  if (grow.inputcount != null) {
    // Bare-key family: collision grows the next free BARE `{elem}_N` key,
    // never the dotted autogrow shape (comfy-cli `_next_inputcount_name`).
    name = nextInputcountName(insArr, grow.name);
  } else {
    const base = grow.name.split(".", 1)[0]!;
    const template = grow.widget
      ? null
      : (catalogEntry(catalog, String(dst.get("type") ?? ""))?.autogrow_templates?.[base] ?? null);
    name = nextAutogrowName(insArr, grow.name, template);
  }
  const slot = new Y.Map<unknown>();
  slot.set("name", name);
  slot.set("type", grow.type);
  slot.set("link", null);
  slot.set("grow_id", op.link_id);
  if (grow.widget) slot.set("widget", { name: grow.widget });
  apush(insArr, slot);
  const toIdx = insArr.length - 1;

  if (grow.inputcount != null) {
    applyInputcountBump(doc, dst, op, grow.inputcount, catalog);
  }
  return toIdx;
}

/**
 * §8.4 second register: a stamped write of the family's count widget, sharing
 * the connect's op_id/stamp, through the SAME LWW gate as an explicit
 * set_widget on `("widget", to_node, widget)`. The written value is the
 * mint-time-planned count carried by the op — never re-derived post-collision.
 *
 * Deviation from Python, documented: comfy-cli skips the bump when it has no
 * catalog (it cannot resolve name→index without one); this applier's widget
 * writes are name-keyed and need no index, so the bump is unconditional.
 */
function applyInputcountBump(
  doc: Y.Doc,
  dst: Y.Map<unknown>,
  op: GrowConnectOp,
  ic: NonNullable<GrowSpec["inputcount"]>,
  catalog?: WidgetCatalog,
): void {
  if (typeof ic.widget !== "string") {
    throw new OpRejectedError("malformed_op", "connect: grow.inputcount needs a widget name");
  }
  const pseudo: SetWidgetOp = {
    op: "set_widget",
    op_id: op.op_id,
    actor: op.actor,
    base_version: op.base_version,
    stamp: op.stamp,
    node_id: op.to_node,
    widget: ic.widget,
    value: ic.value,
  };
  const stamps = stampsMap(doc);
  const targetKey = stampTargetKey(pseudo);
  const prior = stamps.get(targetKey) as StampKey | undefined;
  const key = stampKey(pseudo);
  if (prior != null && compareStampKeys(key, prior) <= 0) return; // lww-dropped
  validateWidgetName(catalog, String(dst.get("type") ?? ""), ic.widget);
  mset(widgetsOf(dst), ic.widget, structuredClone(ic.value));
  mset(stamps, targetKey, key);
}

function slotNames(ins: Y.Array<unknown>): Set<unknown> {
  const taken = new Set<unknown>();
  ins.forEach((slot: unknown) => {
    if (slot instanceof Y.Map) taken.add(slot.get("name"));
  });
  return taken;
}

/** comfy-cli `_next_autogrow_name` + `_first_free_autogrow_index`: prefer the requested name; on collision, the lowest free `{base}.{elem(N)}`. */
function nextAutogrowName(
  ins: Y.Array<unknown>,
  requested: string,
  template: { prefix?: string; names?: string[] } | null | undefined,
): string {
  const taken = slotNames(ins);
  if (!taken.has(requested)) return requested;
  const base = requested.split(".", 1)[0]!;
  const elem = (n: number): string => {
    if (template?.names?.length) {
      return n < template.names.length
        ? template.names[n]!
        : `${template.names[template.names.length - 1]!}${n}`;
    }
    if (template?.prefix) return `${template.prefix}${n}`;
    const stem = base.endsWith("s") ? base.slice(0, -1) : base;
    return `${stem}${n}`;
  };
  let n = 0;
  while (taken.has(`${base}.${elem(n)}`)) n++;
  return `${base}.${elem(n)}`;
}

/** comfy-cli `_next_inputcount_name`: bare `{elem}_N` keys, next free N on collision. */
function nextInputcountName(ins: Y.Array<unknown>, requested: string): string {
  const taken = slotNames(ins);
  if (!taken.has(requested)) return requested;
  const sep = requested.lastIndexOf("_");
  const elem = sep >= 0 ? requested.slice(0, sep) : "";
  const nStr = sep >= 0 ? requested.slice(sep + 1) : requested;
  let n = /^[0-9]+$/.test(nStr) ? parseInt(nStr, 10) : 1;
  let name = `${elem}_${n}`;
  while (taken.has(name)) {
    n++;
    name = `${elem}_${n}`;
  }
  return name;
}

/** Drop a link tuple and scrub every input/output reference to it (comfy-cli `_remove_link`). */
function removeLink(doc: Y.Doc, linkId: unknown): void {
  const links = linksMap(doc);
  const key = String(linkId);
  if (links.has(key)) mdel(links, key);
  nodesMap(doc).forEach((node) => {
    const ins = node.get("inputs");
    if (ins instanceof Y.Array) {
      ins.forEach((slot: unknown) => {
        if (slot instanceof Y.Map && slot.get("link") === linkId) mset(slot, "link", null);
      });
    }
    const outs = node.get("outputs");
    if (outs instanceof Y.Array) {
      outs.forEach((port: unknown) => {
        if (!(port instanceof Y.Map)) return;
        const outLinks = port.get("links");
        if (outLinks instanceof Y.Array) {
          const arr = outLinks.toArray();
          for (let i = arr.length - 1; i >= 0; i--) {
            if (arr[i] === linkId) adel(outLinks, i);
          }
        }
      });
    }
  });
}

// ---------------------------------------------------------------------------
// delete_node
// ---------------------------------------------------------------------------

function applyDeleteNode(doc: Y.Doc, op: DeleteNodeOp): void {
  if (op.node_id === undefined) {
    throw new OpRejectedError("malformed_op", "delete_node: missing node_id");
  }
  const nodes = nodesMap(doc);
  const key = String(op.node_id);
  if (nodes.has(key)) mdel(nodes, key); // absent target → still a no-op-with-cleanup (delete wins)

  const links = linksMap(doc);
  const removed = new Set<unknown>(op.removed_links ?? []);
  const toDelete: string[] = [];
  links.forEach((ln: unknown, k: string) => {
    const tuple = ln as unknown[];
    if (removed.has(tuple[0]) || tuple[1] === op.node_id || tuple[3] === op.node_id) toDelete.push(k);
  });
  for (const k of toDelete) mdel(links, k);

  const keptIds = new Set<unknown>();
  links.forEach((ln: unknown) => keptIds.add((ln as unknown[])[0]));
  // Scrub dangling references (write count bounded by the deleted node's degree;
  // the scan is O(nodes) read cost, accepted — schema §11).
  nodes.forEach((node) => {
    const ins = node.get("inputs");
    if (ins instanceof Y.Array) {
      ins.forEach((slot: unknown) => {
        if (!(slot instanceof Y.Map)) return;
        const l = slot.get("link");
        if (l != null && !keptIds.has(l)) mset(slot, "link", null);
      });
    }
    const outs = node.get("outputs");
    if (outs instanceof Y.Array) {
      outs.forEach((port: unknown) => {
        if (!(port instanceof Y.Map)) return;
        const outLinks = port.get("links");
        if (outLinks instanceof Y.Array) {
          const arr = outLinks.toArray();
          for (let i = arr.length - 1; i >= 0; i--) {
            if (!keptIds.has(arr[i])) adel(outLinks, i);
          }
        }
      });
    }
  });
}

// ---------------------------------------------------------------------------
// clear
// ---------------------------------------------------------------------------

/**
 * Empty nodes and links; reset `groups` to `[]` ONLY if the key already
 * exists (schema §6). Preserves `extra`, `definitions`,
 * `last_node_id`/`last_link_id` (id-reuse guard), and `__stamps` (post-clear
 * writes still LWW correctly). O(doc) writes — inherent, standalone-only.
 */
function applyClear(doc: Y.Doc): void {
  const nodes = nodesMap(doc);
  for (const k of [...nodes.keys()]) mdel(nodes, k);
  const links = linksMap(doc);
  for (const k of [...links.keys()]) mdel(links, k);
  const meta = metaMap(doc);
  if (meta.has("groups")) mset(meta, "groups", []);
}
