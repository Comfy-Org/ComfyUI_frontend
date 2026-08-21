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
 *    the first mutation so a rejected op leaves the doc untouched — with the
 *    exceptions enumerated under VALIDATE BEFORE MUTATE below, which is the
 *    qualified statement of this bullet, not a footnote to it. That block owns
 *    the count; this bullet deliberately does not repeat it, because the two
 *    have disagreed twice.
 *
 * VALIDATE BEFORE MUTATE (issue #10). Yjs does NOT roll a `transact` body back
 * when it throws, so "the doc is untouched on reject" is a property of write
 * ORDER inside each handler, not something the transaction gives us. A handler
 * that mutates and then throws also skips its `__applied` record, so it is
 * silently non-idempotent on retry as well; that combination is a blocking
 * KA-4 defect, not a nit.
 *
 * The preconditions moved ahead of the first `mset`/`apush` here are: source
 * and destination slot resolution over the full numeric domain (a slot index
 * must be a non-negative integer in range addressing a real slot record, not
 * merely `< length`), the inputcount widget name and its cloneability, the
 * grow payload shape, and opaque destinations.
 *
 * NOT "every precondition that can throw" — that claim was false when this
 * file first made it, and stating it accurately is the point. FOUR holes are
 * known and open:
 *  - a value `structuredClone` ACCEPTS but Yjs cannot store (`Map`, `Set`,
 *    `RegExp`, `ArrayBuffer`, `Error`) still mutates and then throws
 *    `Unexpected content type` mid-handler (#59, #61);
 *  - and a REFERENCE CYCLE passes `structuredClone` (which preserves cycles by
 *    design) and `Y.Map.set` alike, then makes `encodeStateAsUpdate` throw
 *    permanently — the document is unrecoverable (#68). Entry points MEASURED
 *    so far: `set_widget.value`, `grow.inputcount.value`, `add_node`'s
 *    `widgets_values`, `connect.link_type`, `connect.link_id`, and
 *    `connect.grow.widget` (the one `grow` field nothing type-checks);
 *  - `applyDeleteNode` reads `op.removed_links` — an OP-ONLY value — only
 *    AFTER `mdel(nodes, key)`, so a non-array (`5`, `{}`, `true`) deletes the
 *    node and then throws, and a string is accepted and iterated character by
 *    character;
 *  - and `connect.link_id`/`link_type` are copied in with NO validation at all,
 *    so an `undefined` `link_id` mutates and then throws a raw `TypeError` —
 *    structurally identical to `removed_links` — while a `Symbol` `link_id`
 *    leaves the document permanently UNPROJECTABLE. An earlier revision of this
 *    file excluded it as "not a rejection path"; that criterion does not
 *    separate it from `removed_links`, which is counted, so it is counted too.
 *    All four are identical on `main`. Treat
 *    this as a lower bound, not a closed set: every op field copied into the
 *    doc without a storability check is a candidate, and #68's gate must be
 *    written against the WRITE sites rather than against this list.
 *
 * Separately, "validated before the first write" is about WRITE ORDER, not
 * about arrival order. A precondition that must READ the document resolves
 * differently on a replica that has already applied a concurrent
 * `delete_node`; only the OP-ONLY preconditions are hoisted above the
 * delete-wins returns for that reason. Schema §2.5 items 4-8 carve out
 * what remains.
 *
 * `assertCloneableValue` is a `structuredClone` predicate, not a Yjs-storable
 * one; closing the class needs the latter.
 *
 * A further hole USED to be listed here: `stampKey`'s `Number(stamp[0])` was
 * evaluated after the autogrow slot append, so a `Symbol` or throwing-`valueOf`
 * `base_version` mutated and then threw. Hoisting `stampKey` into
 * `requireOpOnlyValid` — done for a convergence reason, not this one — closed it
 * on every `connect` path as a side effect. Measured byte-identical on the grow
 * path afterwards and pinned by
 * `test/reject-no-mutation.regression.test.ts`. Recorded because an
 * enumeration that keeps listing a closed hole is the same defect as one that
 * omits an open one.
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
      applyClear(doc, op);
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
  const stamps = stampsMap(doc);
  const targetKey = stampTargetKey(op);
  const prior = stamps.get(targetKey) as StampKey | undefined;
  const stamp = stampKey(op);
  if (prior != null && compareStampKeys(stamp, prior) <= 0) return;

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
  mset(stamps, targetKey, stamp);
  // The payload's slot-level link references are mint-time state; the `links`
  // map is the live authority and belongs to `connect` / `delete_node`. Left
  // verbatim they let an add disown a link the doc still holds (source port
  // empty while the destination still consumes it) or resurrect a severed one,
  // and the outcome then depended on whether the concurrent delete had
  // arrived. Everything else in the payload is still copied verbatim (FC-8) —
  // only `inputs[].link` / `outputs[].links` are re-derived.
  reconcileNodeLinkRefs(doc, op.node_id, nodeMap);

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

/**
 * `structuredClone` throws `DataCloneError` on values JSON never carries
 * (functions, symbols, most class instances). Every widget write clones, and
 * the clone is evaluated as an argument to `mset` — after `widgetsOf` may have
 * created the widgets map, and after an autogrow may have appended its slot.
 * Checking up front keeps a rejected op byte-identical (D4) for in-process
 * callers as well as for ops that arrived as JSON.
 */
function assertCloneableValue(value: unknown, what: string): void {
  try {
    structuredClone(value);
  } catch {
    throw new OpRejectedError("malformed_op", `${what}: value is not structured-cloneable`);
  }
}

function applySetWidget(doc: Y.Doc, op: SetWidgetOp, catalog?: WidgetCatalog): void {
  const interior: InteriorSetWidgetOp | null = isInteriorWrite(op) ? op : null;
  if (interior !== null && typeof interior.inner_widget !== "string") {
    throw new OpRejectedError("malformed_op", "set_widget: interior write without inner_widget");
  }
  if (interior === null && typeof op.widget !== "string") {
    throw new OpRejectedError("malformed_op", "set_widget: missing widget name");
  }
  assertCloneableValue(op.value, "set_widget");

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

/**
 * `from_slot` validation splits in two, and the split is LOAD-BEARING for
 * convergence (KA-4, schema Amendment A6). Read both halves together.
 *
 * THIS half is OP-ONLY: it reads nothing but the op, so every replica reaches
 * the same verdict no matter what else it has already applied. It therefore
 * runs UNCONDITIONALLY, before the register claim and before the source is
 * looked up — including when the source node is already gone.
 *
 * Folding it into {@link requireOutputSlot} (which is reachable only when the
 * source still exists) made rejection depend on document state: a replica that
 * had already applied `delete_node(from_node)` could not see the malformation,
 * accepted the op and retired the incumbent link, while a replica that had not
 * rejected it and kept the link. Same op-set, two arrival orders, two
 * documents. Measured on `-1`, `0.5` and `NaN`; the valid-slot control
 * converged, which is what made it a real divergence rather than a probe
 * artifact.
 */
function requireOutputSlotDomain(op: ConnectOp): void {
  if (!Number.isInteger(op.from_slot) || op.from_slot < 0) {
    throw new OpRejectedError(
      "output_slot_missing",
      `connect: output slot ${String(op.from_slot)} not found on node ${String(op.from_node)}`,
    );
  }
}

/**
 * The source node's `outputs` array, with the STATE-DEPENDENT half of
 * `from_slot` validated before any mutation: in range, and addressing a real
 * slot record. Both facts are properties of the source node, so this is
 * reachable only while the source exists.
 *
 * `from_slot >= outs.length` alone let `-1`, `0.5` and `NaN` through; each then
 * reached `outs.get(from_slot)` returning `undefined` and threw a raw
 * `TypeError` — reported as the generic `apply_failed` — only AFTER the link
 * tuple and the input slot had been written, and with `__applied` unwritten so
 * a retry re-mutated (issue #10). That domain is now {@link
 * requireOutputSlotDomain}'s, and it runs whether or not the source survives.
 *
 * What remains here CANNOT be made order-independent: "is 5 in range" is
 * unanswerable once the source is deleted. Schema Amendment A6 records that
 * residual and narrows §2.5's convergence claim to match it, rather than
 * leaving the doc asserting a property the applier does not have.
 */
function requireOutputSlot(src: Y.Map<unknown>, op: ConnectOp): Y.Array<unknown> {
  const outs = src.get("outputs");
  if (
    !(outs instanceof Y.Array) ||
    op.from_slot >= outs.length ||
    !(outs.get(op.from_slot) instanceof Y.Map)
  ) {
    throw new OpRejectedError(
      "output_slot_missing",
      `connect: output slot ${String(op.from_slot)} not found on node ${String(op.from_node)}`,
    );
  }
  return outs as Y.Array<unknown>;
}

/**
 * Every `connect` precondition THIS APPLIER ENFORCES that depends on the OP
 * ALONE.
 *
 * Read BOTH qualifiers literally: "this applier enforces", and "`connect`".
 *
 * SCOPE. This is `applyConnect`'s op-only set. It is not a general property of
 * the applier, and the surrounding prose is scoped to `connect`'s delete-wins
 * returns for that reason. `applyAddNode` formerly had the same shape behind
 * structural idempotency. Amendment A7's node-presence stamp gate closes that
 * case: the same winning payload reaches validation in both arrival orders.
 *
 * It is a statement about WHERE the existing checks run, not a claim that every
 * op-only PROPERTY is checked. `link_id` and
 * `link_type` are copied into the document with no validation at all — an
 * `undefined` `link_id` still reaches `outPort.get("links")` and throws a raw
 * `TypeError` mid-write, and a `null` or object `link_id` is accepted outright.
 * Pre-existing and identical on `main`. Adding a check would be a new rejection
 * needing its own G8 vocabulary analysis, so it is disclosed and ENUMERATED
 * (hole 4 above) rather than fixed in passing. It belongs with #61/#68/#71.
 *
 * Runs before the applier reads the document at all, so two replicas in
 * different states cannot disagree about whether the op is well formed. That
 * matters as much for the DESTINATION as for the source: `if (!dst) return` is
 * a delete-wins no-op that CONSUMES the `op_id`, so a malformed op evaluated
 * below it would be "applied" on a replica that had seen the delete and
 * "rejected" on one that had not — and under §4 abort-remainder that is a
 * projection divergence, not merely an `__applied` difference, because the
 * rejection also discards the rest of the batch on only one side.
 *
 * Checks that need `dst` or `src` (opaque-widget storage, the catalogue
 * lookup, slot ranges) are NOT op-only and deliberately stay below; schema
 * §2.5 items 4-8 carve out what that costs.
 */
function requireOpOnlyValid(op: ConnectOp): void {
  requireOutputSlotDomain(op);

  if (op.grow?.inputcount != null) {
    if (typeof op.grow.inputcount.widget !== "string") {
      throw new OpRejectedError("malformed_op", "connect: grow.inputcount needs a widget name");
    }
    assertCloneableValue(op.grow.inputcount.value, "connect: grow.inputcount");
  }
  if (op.grow != null && (typeof op.grow.name !== "string" || typeof op.grow.type !== "string")) {
    throw new OpRejectedError("malformed_op", "connect: grow payload needs name and type");
  }
  // `stampKey` is op-only — `Number(stamp[0])`, `String(stamp[1])`, no document
  // read — but the concrete branch used to evaluate it BELOW `if (!dst) return`,
  // so a `base_version` that throws on conversion (a `Symbol`, or an object with
  // a throwing `valueOf`) was rejected on a replica that still held the
  // destination and delete-wins-APPLIED on one that did not. Measured with the
  // same abort-remainder signature as §2.5 item 5. `applySetWidget` already
  // computed its stamp above its node lookup, so the two handlers disagreed.
  // Evaluated here for its throw; the value is recomputed at the gate.
  stampKey(op);

  if (op.grow == null) {
    if (typeof op.to_slot !== "number") {
      throw new OpRejectedError("malformed_op", "connect: to_slot must be a number unless grow is present");
    }
    // The SAME op-only domain as `from_slot`, and for the same reason. Hoisting
    // only the `typeof` half left `-1`, `0.5` and `NaN` to be judged below the
    // delete-wins return, which reproduced the very divergence this function
    // exists to prevent — one node over, on the axis §2.5 item 5 describes.
    if (!Number.isInteger(op.to_slot) || op.to_slot < 0) {
      throw new OpRejectedError(
        "input_slot_missing",
        `connect: input slot ${String(op.to_slot)} not found on node ${String(op.to_node)}`,
      );
    }
  }
}

function applyConnect(doc: Y.Doc, op: ConnectOp, catalog?: WidgetCatalog): void {
  // OP-ONLY validation first, before ANY document read decides the outcome
  // (KA-4, Amendment A6).
  requireOpOnlyValid(op);

  const nodes = nodesMap(doc);
  const dst = nodes.get(String(op.to_node));
  // The destination is gone → the target slot does not exist and never will
  // (ids are never reused), so there is no register to claim: delete wins.
  if (!dst) return;

  // The §8.4 inputcount grow carries a widget write; if that write is
  // impossible (opaque destination, or a widget the catalogue cannot describe)
  // the whole op is refused HERE, before the slot append, so a rejected op
  // still leaves the doc untouched. Both checks read `dst`, so unlike the
  // op-only set above they cannot move any earlier.
  if (op.grow?.inputcount != null) {
    rejectIfOpaqueWidgets(dst, String(op.grow.inputcount.widget));
    validateWidgetName(
      catalog,
      String(dst.get("type") ?? ""),
      String(op.grow.inputcount.widget),
    );
  }

  // A present source must be fully valid before a concrete-input register is
  // claimed or its incumbent link is retired. A missing source remains the
  // intentional delete-wins no-op handled below.
  const src = nodes.get(String(op.from_node));
  const sourceOutputs = src ? requireOutputSlot(src, op) : null;

  let toIdx: number;
  // Issue #17: this is the discriminant of the `ConnectOp` union. The type now
  // says a `grow` op has no numeric `to_slot` and a concrete op has no `grow`;
  // this branch is where a wire op that says otherwise is disposed of — and it
  // is disposed of exactly as before, `grow` winning and `to_slot` unread.
  if (op.grow != null) {
    // Autogrow is NOT a shared register: every grow mints its own slot keyed by
    // `grow_id`, so two concurrent grows onto one base both survive and there
    // is nothing to gate (vocabulary §1.2 / amendment v1.2's carve-out).
    if (!src) return; // source concurrently deleted → no-op (delete wins)
    toIdx = growInputSlot(doc, dst, op, catalog);
  } else {
    // `to_slot`'s type was settled by `requireOpOnlyValid`.
    toIdx = op.to_slot as number;
    const ins = dst.get("inputs");
    // STATE-DEPENDENT half only: the op-only domain (integer, non-negative) was
    // settled by `requireOpOnlyValid` above, before any document read.
    if (!(ins instanceof Y.Array) || toIdx >= ins.length) {
      throw new OpRejectedError(
        "input_slot_missing",
        `connect: input slot ${String(toIdx)} not found on node ${String(op.to_node)}`,
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
    //
    // QUALIFIED by Amendment A6: that order-independence now holds for the
    // OP-ONLY domain only. `requireOutputSlot` above IS deferred in the sense
    // that it runs only when the source still exists, so an in-domain but
    // out-of-range `from_slot` racing its source's deletion does still resolve
    // differently by arrival order — schema §2.5 item 4, deliberately carved
    // out because closing it means either re-opening issue #10 or changing this
    // register's semantics. Do not "fix" the asymmetry here without reading A6.
    mset(stamps, targetKey, key);
    const prev = slot.get("link");
    if (prev != null && prev !== op.link_id) removeLink(doc, prev);
  }

  // Source concurrently deleted → the winning connect leaves the input EMPTY
  // (delete wins over the link, not over the register claim).
  if (!src || !sourceOutputs) return;
  const outs = sourceOutputs;

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
  const family = grow.name.split(".", 1)[0]!;
  const growStampKey = JSON.stringify(["grow", String(op.to_node), String(op.link_id), family]);
  const stamps = stampsMap(doc);
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
  mset(stamps, growStampKey, stampKey(op));
  // Each grow's own REQUESTED name and shape ride alongside its stamp, in the
  // `__` ledger rather than on the slot (the slot is projected). Canonical
  // renaming has to replay every racing grow's own request; deriving them all
  // from whichever op is currently executing made two grows that asked for
  // different names in one family settle differently per arrival order.
  mset(stamps, growRequestKey(op.to_node, op.link_id, family), [
    grow.name,
    grow.widget ?? null,
    grow.inputcount != null,
  ]);
  const toIdx = normalizeGrowFamily(
    { doc, inputs: insArr, dst, catalog, family },
    op.to_node,
    op.link_id,
    insArr.length - 1,
  );

  if (grow.inputcount != null) {
    applyInputcountBump(doc, dst, op, grow.inputcount, catalog);
  }
  return toIdx;
}

/** The destination-side context one autogrow family is canonicalized within. */
interface GrowFamilyContext {
  doc: Y.Doc;
  inputs: Y.Array<unknown>;
  dst: Y.Map<unknown>;
  catalog: WidgetCatalog | undefined;
  family: string;
}

/** What one grow ASKED for, recorded next to its stamp: `[name, widget, isInputcount]`. */
type GrowRequest = [string, string | null, boolean];

/** `__stamps` key holding a grow's own request, companion to its `["grow", ...]` stamp. */
function growRequestKey(toNode: unknown, growId: unknown, family: string): string {
  return JSON.stringify(["grow_request", String(toNode), String(growId), family]);
}

/**
 * Canonicalize concurrent grown slots of one family by their op stamp,
 * including the slot index recorded in each link tuple, so two replicas that
 * saw the grows in different orders agree on names and indexes (#11).
 *
 * Returns the index this op's own slot ended up at; `appendedIndex` is the
 * index it was appended to, used when the family holds a single grow or when
 * the caller's grow somehow has no stamped record to rank.
 */
function normalizeGrowFamily(
  ctx: GrowFamilyContext,
  toNode: unknown,
  currentGrowId: unknown,
  appendedIndex: number,
): number {
  const { doc, inputs, dst, catalog, family } = ctx;
  const stamps = stampsMap(doc);
  const records: {
    index: number;
    slot: Y.Map<unknown>;
    stamp: StampKey;
    request: GrowRequest;
  }[] = [];
  inputs.forEach((value, index) => {
    if (!(value instanceof Y.Map) || value.get("grow_id") == null) return;
    const growId = value.get("grow_id");
    const key = JSON.stringify(["grow", String(toNode), String(growId), family]);
    const stamp = stamps.get(key) as StampKey | undefined;
    const request = stamps.get(growRequestKey(toNode, growId, family)) as GrowRequest | undefined;
    if (stamp && request) records.push({ index, slot: value, stamp, request });
  });
  if (records.length <= 1) return records[0]?.index ?? appendedIndex;
  records.sort((a, b) => compareStampKeys(a.stamp, b.stamp));
  const positions = records.map((record) => record.index).sort((a, b) => a - b);
  const snapshots = records.map(({ slot }) => Object.fromEntries(slot.entries()));
  const occupied = new Set<unknown>();
  inputs.forEach((value) => {
    if (value instanceof Y.Map && !records.some(({ slot }) => slot === value)) occupied.add(value.get("name"));
  });
  const templates = catalog?.types[String(dst.get("type") ?? "")]?.autogrow_templates;
  const names: string[] = [];
  for (const { request } of records) {
    const [requested, widget, isInputcount] = request;
    const name = isInputcount
      ? nextInputcountName(inputs, requested, occupied)
      : nextAutogrowName(inputs, requested, widget ? null : (templates?.[family] ?? null), occupied);
    names.push(name);
    occupied.add(name);
  }
  snapshots.forEach((snapshot, rank) => {
    const target = records.find((record) => record.index === positions[rank])!.slot;
    const desired = { ...snapshot, name: names[rank]! };
    for (const key of [...target.keys()]) {
      if (!(key in desired)) mdel(target, key);
    }
    for (const [key, value] of Object.entries(desired)) {
      if (target.get(key) !== value) mset(target, key, value);
    }
    const linkId = snapshot["grow_id"];
    const link = linksMap(doc).get(String(linkId));
    if (Array.isArray(link)) {
      const updated = [...link];
      updated[4] = positions[rank];
      mset(linksMap(doc), String(linkId), updated);
    }
  });
  const wantedRank = snapshots.findIndex(
    (snapshot) => String(snapshot["grow_id"]) === String(currentGrowId),
  );
  return wantedRank >= 0 ? positions[wantedRank]! : appendedIndex;
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
  occupied?: Set<unknown>,
): string {
  const taken = occupied ?? slotNames(ins);
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
function nextInputcountName(
  ins: Y.Array<unknown>,
  requested: string,
  occupied?: Set<unknown>,
): string {
  const taken = occupied ?? slotNames(ins);
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

/**
 * `delete_node` writes TWO independent registers, and conflating them is a
 * convergence bug:
 *
 * 1. **Node presence** — `("node", id)`, LWW-gated against a concurrent
 *    re-add (issue #11).
 * 2. **Link severance** — the link ids the op explicitly names in
 *    `removed_links`. Removing a named link is monotonic (a link id is never
 *    reissued) and concerns OTHER nodes' slots, so it commutes with a re-add
 *    and must run even when the presence gate is lost. Gating it made
 *    `[delete, add]` end with `links: []` and `[add, delete]` end with the
 *    link still installed.
 *
 * Links merely INCIDENT to the node — not named by the op — are severed only
 * when the node actually goes away, because a node that survives the gate
 * keeps its own wiring.
 */
function applyDeleteNode(doc: Y.Doc, op: DeleteNodeOp): void {
  if (op.node_id === undefined) {
    throw new OpRejectedError("malformed_op", "delete_node: missing node_id");
  }
  const nodes = nodesMap(doc);
  const key = String(op.node_id);
  const stamps = stampsMap(doc);
  const targetKey = stampTargetKey(op);
  const prior = stamps.get(targetKey) as StampKey | undefined;
  const stamp = stampKey(op);
  const presenceWon = prior == null || compareStampKeys(stamp, prior) > 0;
  if (presenceWon) {
    mset(stamps, targetKey, stamp);
    if (nodes.has(key)) mdel(nodes, key); // absent target → no-op-with-cleanup (delete wins)
  }

  const links = linksMap(doc);
  const removed = new Set<unknown>(op.removed_links ?? []);
  const toDelete: string[] = [];
  links.forEach((ln: unknown, k: string) => {
    const tuple = ln as unknown[];
    if (removed.has(tuple[0])) {
      toDelete.push(k);
      return;
    }
    if (!presenceWon) return;
    if (String(tuple[1]) === key || String(tuple[3]) === key) toDelete.push(k);
  });
  for (const k of toDelete) mdel(links, k);

  scrubDanglingLinkRefs(doc);
}

/**
 * Rewrite ONE node's slot-level link references from the live `links` map:
 * `inputs[i].link` is the link whose tuple lands on slot `i`, and
 * `outputs[j].links` is every link leaving slot `j`. Used after `add_node`
 * replaces a node that was already present, where the payload's link
 * references are mint-time state that the live links map has moved past.
 * Writes are bounded by the node's degree.
 */
function reconcileNodeLinkRefs(doc: Y.Doc, nodeId: unknown, node: Y.Map<unknown>): void {
  const id = String(nodeId);
  const inbound = new Map<number, unknown>();
  const outbound = new Map<number, unknown[]>();
  linksMap(doc).forEach((ln: unknown) => {
    const tuple = ln as unknown[];
    if (String(tuple[1]) === id && typeof tuple[2] === "number") {
      const port = outbound.get(tuple[2]) ?? [];
      port.push(tuple[0]);
      outbound.set(tuple[2], port);
    }
    if (String(tuple[3]) === id && typeof tuple[4] === "number") inbound.set(tuple[4], tuple[0]);
  });

  const ins = node.get("inputs");
  if (ins instanceof Y.Array) {
    ins.forEach((slot: unknown, idx: number) => {
      if (!(slot instanceof Y.Map)) return;
      const want = inbound.get(idx) ?? null;
      if (slot.get("link") !== want) mset(slot, "link", want);
    });
  }
  const outs = node.get("outputs");
  if (outs instanceof Y.Array) {
    outs.forEach((port: unknown, idx: number) => {
      if (!(port instanceof Y.Map)) return;
      const want = outbound.get(idx) ?? [];
      const have = port.get("links");
      const haveArr = have instanceof Y.Array ? have.toArray() : [];
      if (haveArr.length === want.length && haveArr.every((v, i) => v === want[i])) return;
      const replacement = new Y.Array<unknown>();
      replacement.push(want);
      mset(port, "links", replacement);
    });
  }
}

/**
 * Drop input `link` / output `links` references to link ids that no longer
 * exist. Write count is bounded by the removed links' degree; the scan is
 * O(nodes) read cost, accepted — schema §11.
 */
function scrubDanglingLinkRefs(doc: Y.Doc): void {
  const keptIds = new Set<unknown>();
  linksMap(doc).forEach((ln: unknown) => keptIds.add((ln as unknown[])[0]));
  nodesMap(doc).forEach((node) => {
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
 *
 * `removed_nodes` is the AUTHORITATIVE target set (schema §6 amendment A7,
 * FC-8: payloads are copied verbatim, never re-derived). Deriving the target
 * set from `nodes.keys()` when the list was empty made the outcome depend on
 * which concurrent `add_node` happened to arrive first (#11): a `clear([])`
 * that outranks a concurrent add removed that add when it arrived second and
 * kept it when it arrived first. A node the clear never saw is outside its
 * scope and survives in both arrival orders.
 *
 * Links follow node presence exactly as `delete_node` does, rather than being
 * wiped wholesale, so link survival is a function of the (now convergent)
 * node set rather than of arrival order.
 */
function applyClear(doc: Y.Doc, op: Extract<Op, { op: "clear" }>): void {
  if (!Array.isArray(op.removed_nodes)) {
    throw new OpRejectedError("malformed_op", "clear: missing removed_nodes");
  }
  const nodes = nodesMap(doc);
  const stamps = stampsMap(doc);
  const stamp = stampKey(op);
  for (const nodeId of op.removed_nodes) {
    const k = String(nodeId);
    const targetKey = JSON.stringify(["node", k]);
    const prior = stamps.get(targetKey) as StampKey | undefined;
    if (prior != null && compareStampKeys(stamp, prior) <= 0) continue;
    mset(stamps, targetKey, stamp);
    if (nodes.has(k)) mdel(nodes, k);
  }
  const links = linksMap(doc);
  const toDelete: string[] = [];
  links.forEach((ln: unknown, k: string) => {
    const tuple = ln as unknown[];
    if (!nodes.has(String(tuple[1])) || !nodes.has(String(tuple[3]))) toDelete.push(k);
  });
  for (const k of toDelete) mdel(links, k);
  scrubDanglingLinkRefs(doc);
  const meta = metaMap(doc);
  if (meta.has("groups")) mset(meta, "groups", []);
}
