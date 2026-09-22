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
 * The preconditions this change actually MOVED ahead of the first
 * `mset`/`apush` are: source and destination slot resolution over the full
 * numeric domain; the inputcount widget name, its cloneability and its
 * CATALOGUE check (`validateWidgetName`, the substance of the Amendment A4
 * repair); the grow payload shape; `set_widget`'s value cloneability; and
 * `stampKey`'s evaluation.
 *
 * NOT in that list, deliberately: opaque destinations. `rejectIfOpaqueWidgets`
 * already ran above `growInputSlot` beforehand — an earlier version of this
 * paragraph claimed it as moved AND omitted `validateWidgetName`, i.e. it was
 * wrong in both directions at once, which is the defect the rule at the end of
 * this block names.
 *
 * The digest canonicalizer first bounds the depth and shape of the WHOLE op
 * envelope before the idempotency gate. Separately, a value that reaches a
 * write must be encodable by its destination Yjs type, not merely
 * structured-cloneable ({@link mapValueRefusal} /
 * {@link arrayItemRefusal}), and `delete_node`'s `removed_links` must be
 * iterable before the node is deleted. The first gate protects canonical op
 * identity; the latter gates define what may enter Yjs maps and arrays.
 *
 * The value gates also reject reference cycles at the WRITE sites. This is
 * independently necessary for `mint`; in `applyOps`, A8's whole-op depth gate
 * encounters a cycle first and reports `payload_too_deep`. A cycle passes
 * `structuredClone` and Yjs storage but would make every later
 * `encodeStateAsUpdate` throw permanently (#14).
 *
 * The write predicate is encodability rather than storability: `Date` and
 * oversized `BigInt` values are storable but do not survive the wire. The
 * predicate deliberately remains shallow apart from the cycle walk; broader
 * nested-loss policy remains decision D4.
 *
 * Separately, "validated before the first write" is about WRITE ORDER, not
 * about arrival order. A precondition that must READ the document resolves
 * differently on a replica that has already applied a concurrent
 * `delete_node`; only the OP-ONLY preconditions are hoisted above the
 * delete-wins returns for that reason. Schema §2.5 items 4-8 carve out
 * what remains.
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
  OPAQUE_WIDGETS_KEY,
  adel,
  appliedMap,
  apush,
  arrayItemRefusal,
  countDefinitionInstances,
  createNodeMap,
  linksMap,
  mapValueRefusal,
  mdel,
  metaMap,
  mset,
  nodesMap,
  nodeIncarnation,
  resolveDefinition,
  stampsMap,
  widgetStorageOf,
} from "./doc.js";
import { sha256Hex } from "./digest.js";
import { CMP_EVENT_SCHEMA_VERSION, emitCmpEvent, type CmpCallContext } from "./events.js";
import {
  MAX_OP_COST,
  MAX_OPS_PER_BATCH,
  MAX_PAYLOAD_DEPTH,
  opBoundsRefusal,
} from "./limits.js";
import { codePointCompare, compareStampKeys, stampKey, stampTargetKey, widgetTargetKey } from "./stamps.js";
import {
  DEFERRED_OPS,
  FROZEN_OPS,
  LEGACY_NODE_INCARNATION,
  OpRejectedError,
  type AddNodeOp,
  type ApplyOutcome,
  type ApplyResult,
  type ConnectOp,
  type DeleteNodeOp,
  type DisconnectOp,
  type GrowConnectOp,
  type GrowSpec,
  type InteriorSetWidgetOp,
  type Op,
  type SetWidgetOp,
  type StampKey,
  type WidgetCatalog,
  type WireOp,
} from "./types.js";
import { NODE_INCARNATION_KEY } from "./types.js";

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
export function applyOps(doc: Y.Doc, ops: Op[], catalog?: WidgetCatalog, context?: CmpCallContext): ApplyResult {
  const bookkeeping = appliedMap(doc);
  const outcomes: ApplyOutcome[] = [];
  const duplicateIds = new Set<string>();

  if (ops.length > MAX_OPS_PER_BATCH) {
    const message = `batch of ${ops.length} ops exceeds the ${MAX_OPS_PER_BATCH}-op limit; rejected before any op was processed (#14)`;
    const result = makeResult({
      outcomes: ops.map((op) => ({
        op_id: opIdentity(op),
        outcome: "rejected" as const,
        reason: { code: "malformed_op", message },
      })),
      ops_seen: bookkeeping.size,
    }, ops, duplicateIds);
    if (context?.eventSink !== undefined) {
      emitCmpEvent(context.eventSink, {
        schema_version: CMP_EVENT_SCHEMA_VERSION,
        type: "limit_violation",
        source: "applyOps",
        code: "max_ops_per_batch",
        message,
      });
    }
    return result;
  }

  for (let index = 0; index < ops.length; index++) {
    const op = ops[index]!;
    try {
      validateEnvelope(op);
      // Digested BEFORE the dedupe gate and before the transaction: the
      // canonicalizer walks attacker-controlled payload and can reject, and a
      // rejection must not be able to land after a mutation (KA-4 / issue #10).
      const digest = opDigest(op);
      if (bookkeeping.has(op.op_id)) {
        const recorded = bookkeeping.get(op.op_id);
        if (typeof recorded === "string" && recorded !== digest) {
          throw new OpRejectedError(
            "op_id_reuse",
            `op_id '${op.op_id}' was already applied with a different payload`,
          );
        }
        // Idempotency gate BEFORE any mutation/transaction: a duplicate apply
        // is a true no-op (byte-identical encodeStateAsUpdate).
        outcomes.push({ op_id: op.op_id, outcome: "no-op" });
        duplicateIds.add(op.op_id);
        continue;
      }
      let outcome: Exclude<ApplyOutcome["outcome"], "rejected"> = "applied";
      doc.transact(() => {
        outcome = dispatch(doc, op, catalog);
        // comfy-cli records the op_id even for delete-wins/LWW-dropped no-ops.
        mset(bookkeeping, op.op_id, digest);
      }, op.actor);
      outcomes.push({ op_id: op.op_id, outcome });
    } catch (err) {
      const op_id = opIdentity(op);
      const code = err instanceof OpRejectedError ? err.code : "apply_failed";
      const message = err instanceof Error ? err.message : String(err);
      outcomes.push({ op_id, outcome: "rejected", reason: { code, message } });
      for (const remainder of ops.slice(index + 1)) {
        outcomes.push({
          op_id: opIdentity(remainder),
          outcome: "rejected",
          reason: { code: "batch_aborted", message: `not processed because op at index ${index} was rejected` },
        });
      }
      if (context?.eventSink !== undefined) {
        emitCmpEvent(context.eventSink, {
          schema_version: CMP_EVENT_SCHEMA_VERSION,
          type: err instanceof OpRejectedError ? "op_rejected" : "applier_error",
          source: "applyOps",
          code,
          message,
          error_name: err instanceof OpRejectedError ? "OpRejectedError" : err instanceof Error ? "Error" : "NonError",
          op_id,
          batch_index: index,
        });
      }
      break; // abort-remainder (vocabulary §4)
    }
  }

  return makeResult({ outcomes, ops_seen: bookkeeping.size }, ops, duplicateIds);
}

/** Remove in 0.3: non-enumerable accessors keep the pre-0.2 test corpus readable during migration. */
function makeResult(result: ApplyResult, ops: Op[], duplicateIds: Set<string>): ApplyResult {
  const legacy = result as ApplyResult & Record<string, unknown>;
  Object.defineProperties(legacy, {
    applied: { get: () => result.outcomes.filter((o) => o.outcome !== "rejected" && !duplicateIds.has(o.op_id)).map((o) => o.op_id) },
    skipped: { get: () => result.outcomes.filter((o) => duplicateIds.has(o.op_id)).map((o) => o.op_id) },
    failed: {
      get: () => {
        const index = result.outcomes.findIndex((o) => o.outcome === "rejected" && o.reason.code !== "batch_aborted");
        const outcome = result.outcomes[index];
        if (index < 0 || outcome?.outcome !== "rejected") return null;
        return { index, op: ops[index], ...outcome.reason };
      },
    },
    applied_count: { get: () => result.outcomes.filter((o) => o.outcome !== "rejected" && !duplicateIds.has(o.op_id)).length },
    version: { get: () => result.ops_seen },
  });
  return result;
}

function opIdentity(op: unknown): string {
  return typeof op === "object" && op !== null && typeof (op as { op_id?: unknown }).op_id === "string"
    ? (op as { op_id: string }).op_id
    : "";
}

/**
 * Stable, key-order-independent JSON for an op: object keys sorted by code
 * point at every depth, array order preserved, whole envelope included.
 *
 * NOT stored — see {@link opDigest}. Exposed to tests as the definition of
 * what the digest is taken over.
 */
export function canonicalOp(op: Op): string {
  // BigInt classification takes precedence over the generic depth/cost gates.
  // Keep this walk iterative and bounded so even a hostile envelope cannot
  // turn the diagnostic into unbounded work.
  const bigintStack: Array<{ value: unknown; path: string }> = [{ value: op, path: "$" }];
  const bigintVisited = new Set<object>();
  let bigintVisits = 0;
  while (bigintStack.length > 0 && bigintVisits++ <= MAX_OP_COST) {
    const { value, path } = bigintStack.pop()!;
    if (typeof value === "bigint") {
      throw new OpRejectedError(
        "malformed_op",
        `op payload at ${path} is a BigInt and cannot be encoded as JSON`,
      );
    }
    if (typeof value !== "object" || value === null || bigintVisited.has(value)) continue;
    bigintVisited.add(value);
    if (Array.isArray(value)) {
      const firstIndex = Math.max(0, value.length - (MAX_OP_COST - bigintVisits));
      for (let index = value.length - 1; index >= firstIndex; index--) {
        bigintStack.push({ value: value[index], path: `${path}[${index}]` });
      }
    } else {
      const keys = Object.keys(value);
      const firstIndex = Math.max(0, keys.length - (MAX_OP_COST - bigintVisits));
      for (let index = keys.length - 1; index >= firstIndex; index--) {
        const key = keys[index]!;
        const segment = /^[A-Za-z_$][\w$]*$/.test(key) ? `.${key}` : `[${JSON.stringify(key)}]`;
        bigintStack.push({
          value: (value as Record<string, unknown>)[key],
          path: `${path}${segment}`,
        });
      }
    }
  }

  // Amendment A11 extends A8's whole-envelope, pre-idempotency gate with a
  // breadth/size budget. Its iterative depth check keeps A8's
  // `payload_too_deep` vocabulary while avoiding hostile recursion.
  const bounds = opBoundsRefusal(op);
  if (bounds !== null) {
    throw new OpRejectedError(
      bounds.includes("nests deeper") ? "payload_too_deep" : "malformed_op",
      bounds,
    );
  }

  const normalize = (value: unknown, depth: number, path: string): unknown => {
    if (depth > MAX_PAYLOAD_DEPTH) {
      throw new OpRejectedError(
        "payload_too_deep",
        `op payload nests deeper than ${MAX_PAYLOAD_DEPTH} levels`,
      );
    }
    if (Array.isArray(value)) {
      return value.map((child, index) => normalize(child, depth + 1, `${path}[${index}]`));
    }
    if (typeof value === "object" && value !== null) {
      return Object.fromEntries(
        Object.entries(value)
          .sort(([a], [b]) => codePointCompare(a, b))
          .map(([key, child]) => {
            const segment = /^[A-Za-z_$][\w$]*$/.test(key)
              ? `.${key}`
              : `[${JSON.stringify(key)}]`;
            return [key, normalize(child, depth + 1, `${path}${segment}`)];
          }),
      );
    }
    return value;
  };
  return JSON.stringify(normalize(op, 0, "$"));
}

/**
 * The value `__applied` records for an op: `sha256(canonicalOp(op))`.
 *
 * Storing the canonical payload itself is exact but unbounded — measured at
 * ~326 bytes/op against schema §4's ≈64 byte budget, which pushes a doc past
 * §4's 25%-of-bytes compaction trigger after a few dozen ops and turns every
 * crossing into a doc-epoch bump plus a full follower re-fetch. A 64-hex
 * digest is ~96 bytes/op and still satisfies ADR-007's "existing `op_id`
 * accepted only if canonical bytes are identical": a false accept needs two
 * different payloads under the SAME `op_id` whose SHA-256 also collides.
 */
export function opDigest(op: Op): string {
  return sha256Hex(canonicalOp(op));
}

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
  if ((DEFERRED_OPS as readonly string[]).includes(op.op)) {
    throw new OpRejectedError(
      "op_deferred",
      `unknown op '${op.op}' — defined by the vocabulary but deferred (op-vocabulary-v1.md §1.6); rejected until un-deferred by amendment`,
    );
  }
  if (!(FROZEN_OPS as readonly string[]).includes(op.op)) {
    throw new OpRejectedError("unknown_op", `unknown op '${op.op}'`);
  }
  if (typeof op.op_id !== "string" || op.op_id.length === 0) {
    throw new OpRejectedError("malformed_op", `${op.op}: missing op_id`);
  }
  if (
    op.stamp !== undefined &&
    (!Array.isArray(op.stamp) ||
      op.stamp.length !== 2 ||
      typeof op.stamp[0] !== "number" ||
      !Number.isSafeInteger(op.stamp[0]) ||
      op.stamp[0] < 0 ||
      typeof op.stamp[1] !== "string" ||
      op.stamp[1].length === 0)
  ) {
    throw new OpRejectedError(
      "malformed_op",
      `${op.op}: stamp must be [non_negative_safe_integer, non_empty_string]`,
    );
  }
}

type SuccessfulOutcome = "applied" | "no-op" | "lww-dropped";

function dispatch(doc: Y.Doc, op: Op, catalog?: WidgetCatalog): SuccessfulOutcome {
  switch (op.op) {
    case "add_node":
      return applyAddNode(doc, op, catalog);
    case "set_widget":
      return applySetWidget(doc, op, catalog);
    case "connect":
      return applyConnect(doc, op, catalog);
    case "disconnect":
      return applyDisconnect(doc, op);
    case "delete_node":
      return applyDeleteNode(doc, op);
    case "clear":
      return applyClear(doc, op);
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

function applyAddNode(doc: Y.Doc, op: AddNodeOp, catalog?: WidgetCatalog): SuccessfulOutcome {
  if (op.node_incarnation !== undefined && (typeof op.node_incarnation !== "string" || op.node_incarnation.length === 0)) {
    throw new OpRejectedError("malformed_op", "add_node: node_incarnation must be a non-empty string");
  }
  if (op.node_id === undefined || typeof op.node !== "object" || op.node === null) {
    throw new OpRejectedError("malformed_op", "add_node: missing node_id or node payload");
  }
  const nodes = nodesMap(doc);
  const key = String(op.node_id);
  const stamps = stampsMap(doc);
  const targetKey = stampTargetKey(op);
  const prior = stamps.get(targetKey) as StampKey | undefined;
  const stamp = stampKey(op);
  if (prior != null && compareStampKeys(stamp, prior) <= 0) return "lww-dropped";

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
  clearObsoleteWidgetStamps(stamps, key);
  mset(nodeMap, NODE_INCARNATION_KEY, op.node_incarnation ?? LEGACY_NODE_INCARNATION);
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
  return "applied";
}

/**
 * A winning re-add starts a new node lifetime. Remove only the old
 * top-level-widget namespaces for that id; keeping them would be harmless for
 * LWW but would make the logical stamp ledger depend on whether an old write
 * arrived before or after the delete. The add is the deterministic convergence
 * point, so both arrival orders retain the same current-life ledger.
 */
function clearObsoleteWidgetStamps(stamps: Y.Map<unknown>, nodeKey: string): void {
  for (const targetKey of [...stamps.keys()]) {
    let target: unknown;
    try {
      target = JSON.parse(targetKey);
    } catch {
      continue;
    }
    if (Array.isArray(target) && target[0] === "widget" && target[1] === nodeKey) {
      mdel(stamps, targetKey);
    }
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
 * A widget value has to survive TWO gates before it may be written, and both
 * used to be evaluated as arguments to `mset` — after `widgetsOf` may have
 * created the widgets map, and after an autogrow may have appended its slot.
 *
 *  1. `structuredClone` throws `DataCloneError` on values JSON never carries
 *     (functions, symbols). It does NOT throw on a reference cycle — it
 *     faithfully reproduces one — which is why gate 2 has to look for it.
 *  2. {@link mapValueRefusal}: yjs stores only a fixed set of shapes and
 *     throws `Unexpected content type` on the rest (`Map`, `Set`, `RegExp`,
 *     `Error` and `ArrayBuffer` clone happily on their way to that throw, so
 *     gate 1 alone let them reach the document); a reference cycle is accepted
 *     by yjs and bricks every later `encodeStateAsUpdate` (#14); and a `Date`
 *     or an oversized `BigInt` is accepted and then does not come back off the
 *     wire.
 *
 * Checking both up front keeps a rejected op byte-identical (D4) for
 * in-process callers as well as for ops that arrived as JSON. The gate runs on
 * the CLONE, because `structuredClone` is what normalizes a class instance or a
 * prototype-less object into a storable, faithfully encodable plain object.
 */
function assertWritableValue(value: unknown, what: string): void {
  let cloned: unknown;
  try {
    cloned = structuredClone(value);
  } catch {
    throw new OpRejectedError("malformed_op", `${what}: value is not structured-cloneable`);
  }
  const refusal = mapValueRefusal(cloned);
  if (refusal !== null) {
    throw new OpRejectedError("malformed_op", `${what}: ${refusal}`);
  }
}

/**
 * The validated, op-only reading of a promoted host write's `promoted` payload
 * (Amendment A15), or `null` when the op is not one. Every check here reads
 * NOTHING BUT THE OP, so it runs above the LWW gate and above the delete-wins
 * return and cannot resolve differently on two replicas (A6).
 *
 * The payload shape is comfy-cli's (`_set_widget_impl`, PR #815): a
 * non-negative integer `value_index`, an optional non-empty `instance_path`
 * (defaulting to `[String(node_id)]`, and REQUIRED to spell the node
 * `node_id` names — joined with `/` — so the register and the mutated node
 * cannot diverge), and `host_widgets_values` — the FULL materialized array —
 * which must be an array covering `value_index`, because it is what a stored
 * array shorter than the index is extended FROM.
 */
function promotedHostWrite(op: SetWidgetOp): { valueIndex: number; instancePath: string[]; hostValues: unknown[] } | null {
  const promoted = (op as { promoted?: unknown }).promoted;
  if (promoted == null) return null;
  if (typeof promoted !== "object" || Array.isArray(promoted)) {
    throw new OpRejectedError("malformed_op", "set_widget: promoted must be an object");
  }
  const { value_index, instance_path, host_widgets_values } = promoted as Record<string, unknown>;
  if (!Number.isInteger(value_index) || (value_index as number) < 0) {
    throw new OpRejectedError(
      "malformed_op",
      `set_widget: promoted.value_index must be a non-negative integer, got ${String(value_index)}`,
    );
  }
  if (!Array.isArray(host_widgets_values)) {
    throw new OpRejectedError("malformed_op", "set_widget: promoted.host_widgets_values must be an array");
  }
  if (host_widgets_values.length <= (value_index as number)) {
    throw new OpRejectedError(
      "malformed_op",
      `set_widget: promoted.host_widgets_values has ${host_widgets_values.length} entries and does not cover value_index ${String(value_index)}`,
    );
  }
  if (instance_path !== undefined && (!Array.isArray(instance_path) || instance_path.length === 0)) {
    throw new OpRejectedError("malformed_op", "set_widget: promoted.instance_path must be a non-empty array when present");
  }
  assertWritableValue(host_widgets_values, "set_widget: promoted.host_widgets_values");
  const instancePath = (instance_path as unknown[] | undefined)?.map(String) ?? [String(op.node_id)];
  // The LWW register comes from `node_id` (`stampTargetKey`) and the mutated
  // node from `instance_path`; nothing else ties them together, and two ops
  // naming one instance under two `node_id`s would claim two registers and
  // both write it. comfy-cli mints `node_id` as the instance id for a
  // top-level host and as the joined path (`"57/61"`) for a nested one, so the
  // two must agree under that spelling. Op-only, hence above the gate (A6).
  if (instancePath.join("/") !== String(op.node_id)) {
    throw new OpRejectedError(
      "malformed_op",
      `set_widget: promoted.instance_path [${instancePath.join(", ")}] does not name node_id ${String(op.node_id)} (expected node_id "${instancePath.join("/")}")`,
    );
  }
  return { valueIndex: value_index as number, instancePath, hostValues: host_widgets_values };
}

/** How a promoted host write must land on the instance it resolved to (Amendment A15). */
type HostWriteStorage = "positional" | "named";

/**
 * Decide whether a promoted host write is a POSITIONAL write into the opaque
 * array or falls back to the ordinary NAMED path. Reads the node and the
 * catalogue, so it sits below the delete-wins return (§2.5 item 6's class).
 *
 * - opaque storage → positional. The document already decided this node is
 *   not name-addressable; no catalogue is needed to honour that.
 * - a class the catalogue DESCRIBES → named. comfy-cli never mints a host write
 *   for such a node (a subgraph instance's `type` is a definition UUID), but
 *   the behaviour is defined rather than left to fall through: the write is
 *   exactly a top-level named `set_widget`.
 * - no catalogue at all → `catalog_required`. The same "reject rather than
 *   guess" boundary `applyAddNode` draws: without a catalogue the host cannot
 *   tell a subgraph instance from an unseen class, and converting a real
 *   class's storage to opaque would be a silent layout change for that node.
 * - the class is absent from the catalogue and the node already holds NAMED
 *   values → `uncatalogued_widget_write`. That document is unprojectable with
 *   this catalogue (KA-12 catalog drift); an opaque array laid over the named
 *   map would shadow it and heal the symptom silently.
 * - otherwise → positional, converting an empty named map into opaque storage
 *   on first write (the instance was minted with `widgets_values: []`).
 */
function hostWriteStorage(node: Y.Map<unknown>, catalog: WidgetCatalog | undefined): HostWriteStorage {
  const storage = widgetStorageOf(node);
  switch (storage) {
    case "opaque":
      return "positional";
    case "named": {
      const type = String(node.get("type") ?? "");
      if (catalogEntry(catalog, type)) return "named";
      if (!catalog) {
        throw new OpRejectedError(
          "catalog_required",
          `set_widget(${type}): a promoted host write needs the pinned catalog to tell a subgraph instance from an unseen class (schema Amendment A15)`,
        );
      }
      const widgets = node.get("widgets");
      if (widgets instanceof Y.Map && widgets.size > 0) {
        throw new OpRejectedError(
          "uncatalogued_widget_write",
          `set_widget(${type}): node ${String(node.get("id"))} holds named widget values for a class absent from the pinned catalog; a positional host write cannot be laid over them (schema §1.2 / Amendment A15)`,
        );
      }
      return "positional";
    }
    default:
      return assertNever(storage, "applier.hostWriteStorage");
  }
}

/**
 * The promoted HOST write (Amendment A15): `widgets_values[value_index] =
 * value` on the instance, stored as ONE whole-value opaque array (Amendment
 * A2 — never merged element-wise, so §1.2's positional corruption cannot
 * arise; two writes to different indexes each read-modify-write the whole
 * array and commute). Entries the document already holds win; a stored array
 * shorter than the index is extended from `host_widgets_values`, comfy-cli's
 * materialization, so the array stays aligned with the definition's inputs.
 * `project()` hands the array back verbatim.
 */
function applyPromotedHostWrite(
  doc: Y.Doc,
  op: SetWidgetOp,
  promoted: NonNullable<ReturnType<typeof promotedHostWrite>>,
  stamps: Y.Map<unknown>,
  targetKey: string,
  key: StampKey,
  catalog?: WidgetCatalog,
): SuccessfulOutcome {
  const target = resolveInteriorNode(doc, promoted.instancePath, catalog);
  if (target === null) return "no-op"; // head instance concurrently deleted → no-op (delete wins)
  const storage = hostWriteStorage(target, catalog);
  switch (storage) {
    case "named":
      validateWidgetName(catalog, String(target.get("type") ?? ""), op.widget);
      mset(widgetsOf(target), op.widget, structuredClone(op.value));
      mset(stamps, targetKey, key);
      return "applied";
    case "positional": {
      const current = target.get(OPAQUE_WIDGETS_KEY);
      const next: unknown[] = Array.isArray(current) ? structuredClone(current) : [];
      if (next.length <= promoted.valueIndex) {
        for (let i = next.length; i < promoted.hostValues.length; i++) {
          next.push(structuredClone(promoted.hostValues[i]));
        }
      }
      next[promoted.valueIndex] = structuredClone(op.value);
      // First conversion: retire the empty name-keyed map so the node carries
      // exactly one storage key (`widgetStorageOf` reads the opaque key first
      // either way; this keeps the layout honest rather than shadowed).
      const widgets = target.get("widgets");
      if (widgets instanceof Y.Map && widgets.size === 0) mdel(target, "widgets");
      mset(target, OPAQUE_WIDGETS_KEY, next);
      mset(stamps, targetKey, key);
      return "applied";
    }
    default:
      return assertNever(storage, "applier.applyPromotedHostWrite");
  }
}

function applySetWidget(doc: Y.Doc, op: SetWidgetOp, catalog?: WidgetCatalog): SuccessfulOutcome {
  const interior: InteriorSetWidgetOp | null = isInteriorWrite(op) ? op : null;
  if (interior !== null && typeof interior.inner_widget !== "string") {
    throw new OpRejectedError("malformed_op", "set_widget: interior write without inner_widget");
  }
  if (interior === null && typeof op.widget !== "string") {
    throw new OpRejectedError("malformed_op", "set_widget: missing widget name");
  }
  if (op.node_incarnation !== undefined && (typeof op.node_incarnation !== "string" || op.node_incarnation.length === 0)) {
    throw new OpRejectedError("malformed_op", "set_widget: node_incarnation must be a non-empty string");
  }
  assertWritableValue(op.value, "set_widget");
  // Op-only, like the checks above it (A6): the payload's shape is settled
  // before any document read, and a host write that also carries an interior
  // `path` names two destinations — comfy-cli never mints that.
  const promoted = promotedHostWrite(op);
  if (promoted !== null && interior !== null) {
    throw new OpRejectedError("malformed_op", "set_widget: a promoted host write carries no interior path");
  }

  // LWW gate next (comfy-cli `_apply_set_widget`): a lower-or-equal stamp is
  // dropped — a protocol-level apply that still consumes its op_id. It is no
  // longer literally FIRST: the op-only checks above it must precede it so
  // their verdict cannot depend on which stamp is in the document (A6).
  const stamps = stampsMap(doc);
  const targetKey = stampTargetKey(op);
  const prior = stamps.get(targetKey) as StampKey | undefined;
  const key = stampKey(op);
  if (prior != null && compareStampKeys(key, prior) <= 0) return "lww-dropped";

  if (promoted !== null) {
    return applyPromotedHostWrite(doc, op, promoted, stamps, targetKey, key, catalog);
  }

  if (interior !== null) {
    const target = resolveInteriorNode(doc, interior.path.map(String), catalog);
    if (target === null) return "no-op"; // head instance concurrently deleted → no-op (delete wins)
    if (nodeIncarnation(target) !== (op.node_incarnation ?? LEGACY_NODE_INCARNATION)) return "no-op";
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
    return "applied";
  }

  const node = nodesMap(doc).get(String(op.node_id));
  if (!node) return "no-op"; // target concurrently deleted → no-op (delete wins)
  if (nodeIncarnation(node) !== (op.node_incarnation ?? LEGACY_NODE_INCARNATION)) return "no-op";
  rejectIfOpaqueWidgets(node, op.widget);
  validateWidgetName(catalog, String(node.get("type") ?? ""), op.widget);
  // Top-level writes may extend past the current positional length — comfy-cli
  // pads with None; here the name-keyed map makes padding a projection concern.
  mset(widgetsOf(node), op.widget, structuredClone(op.value));
  mset(stamps, targetKey, key);
  return "applied";
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
 * op-only PROPERTY is checked. Amendment A14 adds `link_type`'s shape check
 * here without imposing catalogue membership validation.
 *
 * `link_id` WAS in that list until #59 added its write-site check, now expressed
 * by A10's `arrayItemRefusal`/`mapValueRefusal` encodability predicates. That
 * check reads nothing but the op, yet a `connect` it rejects STILL resolves
 * differently by arrival order, because it sits below the destination
 * delete-wins return — measured. It is the cleanest demonstration that this
 * function is about POSITION, not about what a check reads: moving that check
 * into here would close it. Until then it is disclosed and ENUMERATED
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

  if (op.path !== undefined) {
    if (!Array.isArray(op.path) || op.path.length === 0) {
      throw new OpRejectedError("malformed_op", "connect: path must be a non-empty array when present");
    }
    if (op.grow != null) {
      throw new OpRejectedError("malformed_op", "connect: interior autogrow is not supported");
    }
  }

  if (op.node_incarnation !== undefined && (typeof op.node_incarnation !== "string" || op.node_incarnation.length === 0)) {
    throw new OpRejectedError("malformed_op", "connect: node_incarnation must be a non-empty string");
  }

  // Amendment A14: shape-only validation. Arbitrary string link types remain
  // legal; rejecting non-strings here keeps both destination-delete arrival
  // orders fail-closed before any document write (KA-1, KA-3, KA-4, FC-7).
  if (typeof op.link_type !== "string") {
    throw new OpRejectedError("malformed_op", "connect: link_type must be a string");
  }

  if (op.grow?.inputcount != null) {
    if (typeof op.grow.inputcount.widget !== "string") {
      throw new OpRejectedError("malformed_op", "connect: grow.inputcount needs a widget name");
    }
    assertWritableValue(op.grow.inputcount.value, "connect: grow.inputcount");
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

interface InteriorConnectScope {
  nodes: Y.Map<Y.Map<unknown>>;
  links: Y.Map<unknown>;
  definition: Y.Map<unknown>;
}

/** Resolve the definition addressed by an interior connect's instance path. */
function resolveInteriorConnectScope(
  doc: Y.Doc,
  op: ConnectOp,
  catalog?: WidgetCatalog,
): InteriorConnectScope | null {
  if (!op.path || op.path.length === 0) return null;
  const host = resolveInteriorNode(doc, op.path.map(String), catalog);
  if (host === null) return null;
  const hostType = String(host.get("type") ?? "");
  const definition = resolveDefinition(doc, hostType);
  if (!definition) {
    throw new OpRejectedError(
      "not_a_subgraph",
      `node ${String(host.get("id"))} is not a subgraph; cannot connect inside it`,
    );
  }
  const definitionId = String(definition.get("id") ?? hostType);
  const instances = countDefinitionInstances(doc, definitionId, catalog);
  if (instances > 1) {
    throw new OpRejectedError(
      "shared_definition_unforked",
      `definition ${definitionId} is instantiated ${instances} times; interior writes to shared definitions are rejected until forking is specced (schema §5.3)`,
    );
  }
  const nodes = definition.get("nodes");
  const links = definition.get("links");
  if (!(nodes instanceof Y.Map) || !(links instanceof Y.Map)) {
    throw new OpRejectedError("malformed_op", `subgraph definition ${definitionId} has malformed graph storage`);
  }
  return { nodes: nodes as Y.Map<Y.Map<unknown>>, links, definition };
}

function applyInteriorConnect(
  doc: Y.Doc,
  op: ConnectOp,
  scope: InteriorConnectScope,
): SuccessfulOutcome {
  const linkRefusal = arrayItemRefusal(op.link_id) ?? mapValueRefusal(op.link_id);
  if (linkRefusal !== null) {
    throw new OpRejectedError("malformed_op", `connect: link_id: ${linkRefusal}`);
  }

  const src = scope.nodes.get(String(op.from_node));
  const dst = scope.nodes.get(String(op.to_node));
  if (!dst) return "no-op";
  const sourceOutputs = src ? requireOutputSlot(src, op) : null;
  const toIdx = op.to_slot as number;
  const inputs = dst.get("inputs");
  if (!(inputs instanceof Y.Array) || toIdx >= inputs.length) {
    throw new OpRejectedError(
      "input_slot_missing",
      `connect: input slot ${String(toIdx)} not found on node ${String(op.to_node)}`,
    );
  }
  const input = inputs.get(toIdx);
  if (!(input instanceof Y.Map)) {
    throw new OpRejectedError("input_slot_missing", `connect: input slot ${toIdx} is not a slot record`);
  }

  if (!claimLinkIdentity(doc, op, scope)) return "lww-dropped";
  const stamps = stampsMap(doc);
  const targetKey = stampTargetKey(op);
  const prior = stamps.get(targetKey) as StampKey | undefined;
  const key = stampKey(op);
  if (prior != null && compareStampKeys(key, prior) <= 0) return "lww-dropped";
  mset(stamps, targetKey, key);

  const previous = input.get("link");
  if (previous != null && previous !== op.link_id) removeLinkInScope(scope, previous);
  if (!src || !sourceOutputs) return "no-op";

  const linkKey = String(op.link_id);
  if (!scope.links.has(linkKey)) {
    mset(scope.links, linkKey, {
      id: op.link_id,
      origin_id: op.from_node,
      origin_slot: op.from_slot,
      target_id: op.to_node,
      target_slot: toIdx,
      type: op.link_type,
    });
  }
  const linkOrder = scope.definition.get("link_order");
  const orderedIds = Array.isArray(linkOrder) ? [...linkOrder] : [];
  if (!orderedIds.some((id) => String(id) === linkKey)) {
    orderedIds.push(linkKey);
    mset(scope.definition, "link_order", orderedIds);
  }
  mset(input, "link", op.link_id);
  const output = sourceOutputs.get(op.from_slot) as Y.Map<unknown>;
  let outputLinks = output.get("links");
  if (!(outputLinks instanceof Y.Array)) {
    outputLinks = new Y.Array<unknown>();
    mset(output, "links", outputLinks);
  }
  if (!(outputLinks as Y.Array<unknown>).toArray().includes(op.link_id)) {
    apush(outputLinks as Y.Array<unknown>, op.link_id);
  }
  return "applied";
}

function applyConnect(doc: Y.Doc, op: ConnectOp, catalog?: WidgetCatalog): SuccessfulOutcome {
  // OP-ONLY validation first, before ANY document read decides the outcome
  // (KA-4, Amendment A6).
  requireOpOnlyValid(op);

  if (op.path && op.path.length > 0) {
    const scope = resolveInteriorConnectScope(doc, op, catalog);
    if (scope === null) return "no-op";
    return applyInteriorConnect(doc, op, scope);
  }

  const nodes = nodesMap(doc);
  const dst = nodes.get(String(op.to_node));
  // The destination is gone → the target slot does not exist and never will
  // (ids are never reused), so there is no register to claim: delete wins.
  if (!dst) return "no-op";

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
    assertWritableValue(op.grow.inputcount.value, "connect: grow.inputcount");
  }

  // `link_id` is written THREE ways — the links-map key (via String()), the
  // destination slot's `link` (a Y.Map value) and an item of the source port's
  // `links` (a Y.Array insert) — so it must satisfy the INTERSECTION of the
  // two domains, neither of which contains the other: the array insert refuses
  // `undefined`/`Date`/`BigInt` that a map accepts, and the map refuses an
  // `ArrayBuffer` that an array accepts. The last of those writes is also the
  // last write of the handler, so an id Yjs cannot hold threw with the
  // register claimed, the incumbent severed and the link tuple written.
  const linkRefusal = arrayItemRefusal(op.link_id) ?? mapValueRefusal(op.link_id);
  if (linkRefusal !== null) {
    throw new OpRejectedError("malformed_op", `connect: link_id: ${linkRefusal}`);
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
  if (op.grow != null && op.grow.promoted === true) {
    if (!claimLinkIdentity(doc, op)) return "lww-dropped";
    // A promoted subgraph input (Amendment A15) is ONE register named by the
    // definition, so it is gated and claimed like a concrete input — before the
    // source is consulted, for the same reason the concrete branch does it.
    const claimed = claimPromotedInput(doc, dst, op);
    if (claimed === null) return "lww-dropped";
    toIdx = claimed;
  } else if (op.grow != null) {
    // Autogrow is NOT a shared register: every grow mints its own slot keyed by
    // `grow_id`, so two concurrent grows onto one base both survive and there
    // is nothing to gate (vocabulary §1.2 / amendment v1.2's carve-out).
    if (!claimLinkIdentity(doc, op)) return "lww-dropped";
    if (!src) return "no-op"; // source concurrently deleted → no-op (delete wins)
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

    if (!claimLinkIdentity(doc, op)) return "lww-dropped";

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
    if (prior != null && compareStampKeys(key, prior) <= 0) return "lww-dropped";

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
  if (!src || !sourceOutputs) return "no-op";
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
  return "applied";
}

/** Claim the normalized complete-tuple link register (schema Amendment A18). */
function claimLinkIdentity(doc: Y.Doc, op: ConnectOp, scope?: InteriorConnectScope): boolean {
  const stamps = stampsMap(doc);
  const normalizedId = String(op.link_id);
  const targetKey = JSON.stringify([
    "link",
    ...(scope && op.path ? [op.path.map(String)] : []),
    normalizedId,
  ]);
  const prior = stamps.get(targetKey) as StampKey | undefined;
  const key = stampKey(op);
  if (prior != null && compareStampKeys(key, prior) <= 0) return false;

  const links = scope?.links ?? linksMap(doc);
  if (links.has(normalizedId)) mdel(links, normalizedId);
  if (scope) {
    scrubNodeLinkRefs(scope.nodes, (candidate) => candidate != null && String(candidate) === normalizedId);
  } else {
    scrubLinkRefs(doc, (candidate) => candidate != null && String(candidate) === normalizedId);
  }
  mset(stamps, targetKey, key);
  return true;
}

/**
 * Promoted input (Amendment A15; comfy-cli `_apply_connect` with
 * `grow.promoted`, PR #815 at `ba0b0b92abcc86b01e8a6704d07088f92afe7aa7`):
 * the destination is a subgraph instance and `grow.name` is
 * one of its definition's declared inputs. The frontend rebuilds those
 * `inputs[]` entries from the definition on load, so the instance may not
 * carry one yet — materialize it, or reuse the entry that already carries the
 * name. Returns the slot index, or `null` when the op lost the LWW gate.
 *
 * ONE register, gated. Two connects into one declared input contend for one
 * slot exactly as two concrete connects do, so the register
 * `("input", to_node, "grow", <full declared name>)` — comfy-cli's
 * `_write_target` for a promoted grow since amendment v1.5 (PR #818), which
 * also gates it — is claimed under the `[base_version, actor, op_id]` order,
 * the prior occupant retired whole, and the loser dropped. The FULL name, not
 * the autogrow base: declared names may contain dots.
 *
 * The slot is materialized ONCE THE GATE PASSES, whether or not the source
 * still exists: `[connect, delete src]` and `[delete src, connect]` then both
 * end with the input present and empty, rather than present in one order and
 * absent in the other (the autogrow source-delete race, §2.5 item 2, does not
 * recur here).
 */
function claimPromotedInput(doc: Y.Doc, dst: Y.Map<unknown>, op: GrowConnectOp): number | null {
  const grow = op.grow;
  if (typeof grow.name !== "string" || typeof grow.type !== "string") {
    throw new OpRejectedError("malformed_op", "connect: grow payload needs name and type");
  }
  const stamps = stampsMap(doc);
  const targetKey = stampTargetKey(op);
  const prior = stamps.get(targetKey) as StampKey | undefined;
  const key = stampKey(op);
  if (prior != null && compareStampKeys(key, prior) <= 0) return null; // lww-dropped
  mset(stamps, targetKey, key);

  let ins = dst.get("inputs");
  if (!(ins instanceof Y.Array)) {
    ins = new Y.Array<unknown>();
    mset(dst, "inputs", ins);
  }
  const insArr = ins as Y.Array<unknown>;
  let existing = -1;
  insArr.forEach((slot: unknown, idx: number) => {
    if (existing >= 0 || !(slot instanceof Y.Map)) return;
    if (slot.get("grow_id") === op.link_id || slot.get("name") === grow.name) existing = idx;
  });
  if (existing >= 0) {
    const slot = insArr.get(existing) as Y.Map<unknown>;
    const prev = slot.get("link");
    if (prev != null && prev !== op.link_id) removeLink(doc, prev);
    // A slot this applier materialized carries the `grow_id` of the grow that
    // won it; the register's winner owns the slot, so the id follows the
    // winner. Left as the FIRST arrival's id, `[low, high]` and `[high, low]`
    // projected different `grow_id`s for one converged link. An entry the
    // instance carried at mint has no `grow_id` and is not given one.
    if (slot.has("grow_id") && slot.get("grow_id") !== op.link_id) mset(slot, "grow_id", op.link_id);
    return existing;
  }
  // Appended VERBATIM under the declared name — no collision numbering, no
  // family template (comfy-cli: `name = grow["name"]` for a promoted grow).
  const slot = new Y.Map<unknown>();
  slot.set("name", grow.name);
  slot.set("type", grow.type);
  slot.set("link", null);
  slot.set("grow_id", op.link_id);
  if (grow.widget) slot.set("widget", { name: grow.widget });
  apush(insArr, slot);
  return insArr.length - 1;
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
  // Inputcount grows use bare names. Their canonical rank is destination-wide,
  // not one independent rank per requested bare-name family (#156 / option D).
  const rankScope = grow.inputcount != null && !grow.name.includes(".") ? "__inputcount__" : family;
  const growStampKey = JSON.stringify(["grow", String(op.to_node), String(op.link_id), rankScope]);
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
  mset(stamps, growRequestKey(op.to_node, op.link_id, rankScope), [
    grow.name,
    grow.widget ?? null,
    grow.inputcount != null,
  ]);
  const toIdx = normalizeGrowFamily(
    { doc, inputs: insArr, dst, catalog, family, rankScope },
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
  rankScope: string;
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
  const { doc, inputs, dst, catalog, family, rankScope } = ctx;
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
    const key = JSON.stringify(["grow", String(toNode), String(growId), rankScope]);
    const stamp = stamps.get(key) as StampKey | undefined;
    const request = stamps.get(growRequestKey(toNode, growId, rankScope)) as GrowRequest | undefined;
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
  const stamps = stampsMap(doc);
  if (nodeIncarnation(dst) !== (op.node_incarnation ?? LEGACY_NODE_INCARNATION)) return;
  const targetKey = widgetTargetKey(op.to_node, op.node_incarnation ?? LEGACY_NODE_INCARNATION, ic.widget);
  const prior = stamps.get(targetKey) as StampKey | undefined;
  const key = stampKey(op);
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
  scrubLinkRefs(doc, (candidate) => candidate != null && String(candidate) === key);
}

function removeLinkInScope(scope: InteriorConnectScope, linkId: unknown): void {
  const key = String(linkId);
  if (scope.links.has(key)) mdel(scope.links, key);
  scrubNodeLinkRefs(scope.nodes, (candidate) => candidate != null && String(candidate) === key);
  const linkOrder = scope.definition.get("link_order");
  if (Array.isArray(linkOrder)) {
    mset(scope.definition, "link_order", linkOrder.filter((id) => String(id) !== key));
  }
}

/** Scrub input/output references selected by one shared link-id predicate. */
function scrubLinkRefs(doc: Y.Doc, shouldRemove: (linkId: unknown) => boolean): void {
  scrubNodeLinkRefs(nodesMap(doc), shouldRemove);
}

function scrubNodeLinkRefs(
  nodes: Y.Map<Y.Map<unknown>>,
  shouldRemove: (linkId: unknown) => boolean,
): void {
  nodes.forEach((node) => {
    const ins = node.get("inputs");
    if (ins instanceof Y.Array) {
      ins.forEach((slot: unknown) => {
        if (slot instanceof Y.Map && shouldRemove(slot.get("link"))) mset(slot, "link", null);
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
            if (shouldRemove(arr[i])) adel(outLinks, i);
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
function applyDeleteNode(doc: Y.Doc, op: DeleteNodeOp): SuccessfulOutcome {
  if (op.node_id === undefined) {
    throw new OpRejectedError("malformed_op", "delete_node: missing node_id");
  }
  // `new Set(op.removed_links ?? [])` throws on anything non-iterable, and it
  // used to be evaluated AFTER the node had been deleted: the op reported
  // `apply_failed` with `applied_count: 0` while the node was gone, and left
  // its op_id unrecorded so the retry deleted again (KA-4 / D4). Iterability,
  // not array-ness, is the precondition being hoisted — a caller passing a Set
  // works today and must keep working.
  const removedLinks = op.removed_links ?? [];
  if (typeof (removedLinks as { [Symbol.iterator]?: unknown })[Symbol.iterator] !== "function") {
    throw new OpRejectedError(
      "malformed_op",
      `delete_node: removed_links must be iterable, got ${typeof removedLinks}`,
    );
  }
  const nodes = nodesMap(doc);
  const key = String(op.node_id);
  const stamps = stampsMap(doc);
  const targetKey = stampTargetKey(op);
  const prior = stamps.get(targetKey) as StampKey | undefined;
  const stamp = stampKey(op);
  const presenceWon = prior == null || compareStampKeys(stamp, prior) > 0;
  const nodeWasPresent = nodes.has(key);
  if (presenceWon) {
    mset(stamps, targetKey, stamp);
    if (nodes.has(key)) mdel(nodes, key); // absent target → no-op-with-cleanup (delete wins)
  }

  const links = linksMap(doc);
  const removed = new Set<unknown>(removedLinks);
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
  if (!presenceWon && toDelete.length === 0) return "lww-dropped";
  return nodeWasPresent || toDelete.length > 0 ? "applied" : "no-op";
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
  scrubLinkRefs(doc, (linkId) => linkId != null && !keptIds.has(linkId));
}

// ---------------------------------------------------------------------------
// disconnect
// ---------------------------------------------------------------------------

function validateDisconnectOp(op: DisconnectOp): void {
  if (!Number.isInteger(op.to_slot) || op.to_slot < 0) {
    throw new OpRejectedError(
      "input_slot_missing",
      `disconnect: input slot ${String(op.to_slot)} not found on node ${String(op.to_node)}`,
    );
  }
  const linkRefusal = arrayItemRefusal(op.link_id) ?? mapValueRefusal(op.link_id);
  if (linkRefusal !== null) {
    throw new OpRejectedError("malformed_op", `disconnect: link_id: ${linkRefusal}`);
  }
  stampKey(op);
}

function applyDisconnect(doc: Y.Doc, op: DisconnectOp): SuccessfulOutcome {
  validateDisconnectOp(op);

  const nodes = nodesMap(doc);
  const dst = nodes.get(String(op.to_node));
  if (!dst) return "no-op";

  const ins = dst.get("inputs");
  if (!(ins instanceof Y.Array) || op.to_slot >= ins.length) {
    throw new OpRejectedError(
      "input_slot_missing",
      `disconnect: input slot ${String(op.to_slot)} not found on node ${String(op.to_node)}`,
    );
  }
  const slot = ins.get(op.to_slot);
  if (!(slot instanceof Y.Map)) {
    throw new OpRejectedError("input_slot_missing", `disconnect: input slot ${op.to_slot} is not a slot record`);
  }

  const prev = slot.get("link");
  const stamps = stampsMap(doc);
  const targetKey = stampTargetKey(op);
  const prior = stamps.get(targetKey) as StampKey | undefined;
  const key = stampKey(op);
  if (prior != null && compareStampKeys(key, prior) <= 0) return "lww-dropped";

  mset(stamps, targetKey, key);
  if (prev != null) removeLink(doc, prev);
  return prev != null ? "applied" : "no-op";
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
function applyClear(doc: Y.Doc, op: Extract<Op, { op: "clear" }>): SuccessfulOutcome {
  if (!Array.isArray(op.removed_nodes)) {
    throw new OpRejectedError("malformed_op", "clear: missing removed_nodes");
  }
  const nodes = nodesMap(doc);
  const stamps = stampsMap(doc);
  const stamp = stampKey(op);
  let applied = false;
  let dropped = false;
  for (const nodeId of op.removed_nodes) {
    const k = String(nodeId);
    const targetKey = JSON.stringify(["node", k]);
    const prior = stamps.get(targetKey) as StampKey | undefined;
    if (prior != null && compareStampKeys(stamp, prior) <= 0) {
      dropped = true;
      continue;
    }
    mset(stamps, targetKey, stamp);
    if (nodes.has(k)) {
      mdel(nodes, k);
      applied = true;
    }
  }
  const links = linksMap(doc);
  const toDelete: string[] = [];
  links.forEach((ln: unknown, k: string) => {
    const tuple = ln as unknown[];
    if (!nodes.has(String(tuple[1])) || !nodes.has(String(tuple[3]))) toDelete.push(k);
  });
  for (const k of toDelete) {
    mdel(links, k);
    applied = true;
  }
  scrubDanglingLinkRefs(doc);
  const meta = metaMap(doc);
  if (meta.has("groups")) {
    mset(meta, "groups", []);
    applied = true;
  }
  return applied ? "applied" : dropped ? "lww-dropped" : "no-op";
}
