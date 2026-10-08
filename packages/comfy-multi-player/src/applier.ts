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
  cloneForMap,
  countDefinitionInstances,
  createNodeMap,
  linkStateMap,
  definitionsMap,
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
import {
  declaresWidgetForm,
  formDeclares,
  formFinalOccurrence,
  formIndexOf,
  storedWidgetFormOf,
} from "./widget-form.js";
import { linkHasMissingEndpoint, remapInsertedWorkflowIds } from "./remap.js";
import { sha256Hex } from "./digest.js";
import { CMP_EVENT_SCHEMA_VERSION, emitCmpEvent, type CmpCallContext } from "./events.js";
import { importedLinkState, mintDefinition } from "./mint.js";
import { projectDefinition } from "./project.js";
import {
  MAX_OP_COST,
  MAX_OPS_PER_BATCH,
  MAX_PAYLOAD_DEPTH,
  opBoundsRefusal,
} from "./limits.js";
import { codePointCompare, compareStampKeys, stampKey, stampTargetKey, widgetTargetKey } from "./stamps.js";
import { widgetIndexOf, widgetStorageKey } from "./widget-identity.js";
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
  type DefineSubgraphOp,
  type DisconnectOp,
  type GrowConnectOp,
  type ImportedLinkState,
  type InteriorSetWidgetOp,
  LINK_STATE_DESCRIPTOR_VERSION,
  type LinkTuple,
  type CanonicalOpInspection,
  type InsertWorkflowOp,
  type Op,
  type OperationLinkDestination,
  type OperationLinkState,
  type SetNodeFieldOp,
  type SetWidgetOp,
  type StampKey,
  type SubgraphDefinition,
  type WidgetCatalog,
  type WireOp,
} from "./types.js";
import { addInteriorLinkOrder, removeInteriorLinkOrder } from "./interior-link-order.js";
import { optionOwnedWidgets, projectedLength, widgetLayoutForWidgets, widgetOrderForValues, widgetOrderForWidgets } from "./dynamic-combos.js";
import { NODE_INCARNATION_KEY, WRITABLE_NODE_FIELDS } from "./types.js";

/**
 * Apply a batch of stamped ops to the doc, one transaction per op.
 * Idempotent per op_id; convergent under reordering via the
 * `[base_version, actor, op_id]` stamp order (schema §3).
 *
 * Untrusted producers supply inert decoded wire data; in-process objects and
 * callbacks must be trusted. Hosts own wire-size limits and JSON decoding
 * without a reviver. Payload limits do not sandbox getters, Proxy traps or
 * iterators, and rejection guarantees do not cover caller-code mutations.
 * See README's input trust boundary and src/limits.ts.
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

  function rejectRemainder(err: unknown, op: Op, index: number): void {
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
      const errorClass = err instanceof Error ? "Error" : "NonError";
      emitCmpEvent(context.eventSink, {
        schema_version: CMP_EVENT_SCHEMA_VERSION,
        type: err instanceof OpRejectedError ? "op_rejected" : "applier_error",
        source: "applyOps",
        code,
        message,
        error_name: err instanceof OpRejectedError ? "OpRejectedError" : errorClass,
        op_id,
        batch_index: index,
      });
    }
  }

  function applyOne(index: number): boolean {
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
        return true;
      }
      let outcome: Exclude<ApplyOutcome["outcome"], "rejected"> = "applied";
      doc.transact(() => {
        outcome = dispatch(doc, op, catalog);
        // comfy-cli records the op_id even for delete-wins/LWW-dropped no-ops.
        mset(bookkeeping, op.op_id, digest);
      }, op.actor);
      outcomes.push({ op_id: op.op_id, outcome });
      if (outcomes.at(-1)?.outcome === "lww-dropped" && context?.eventSink !== undefined) {
        emitCmpEvent(context.eventSink, {
          schema_version: CMP_EVENT_SCHEMA_VERSION,
          type: "op_conflict",
          source: "applyOps",
          code: "lww_dropped",
          message: "operation lost last-writer-wins conflict",
          op_id: op.op_id,
          batch_index: index,
        });
      }
    } catch (err) {
      rejectRemainder(err, op, index);
      return false;
    }
    return true;
  }

  for (let index = 0; index < ops.length; index++) {
    if (!applyOne(index)) break; // abort-remainder (vocabulary §4)
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

function rejectBigIntPayload(value: unknown): void {
  // BigInt classification takes precedence over the generic depth/cost gates.
  // Keep this walk iterative and bounded so even a hostile envelope cannot
  // turn the diagnostic into unbounded work.
  const bigintStack: Array<{ value: unknown; path: string }> = [{ value, path: "$" }];
  const bigintVisited = new Set<object>();
  let bigintVisits = 0;
  function queueChildren(value: object, path: string): void {
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
    queueChildren(value, path);
  }
}

/**
 * Stable, key-order-independent JSON for an op: object keys sorted by code
 * point at every depth, array order preserved, whole envelope included.
 *
 * NOT stored — see {@link opDigest}. Exposed to tests as the definition of
 * what the digest is taken over.
 */
function canonicalJson(value: unknown): string {
  rejectBigIntPayload(value);
  // Amendment A11 extends A8's whole-envelope, pre-idempotency gate with a
  // breadth/size budget. Its iterative depth check keeps A8's
  // `payload_too_deep` vocabulary while avoiding hostile recursion.
  const bounds = opBoundsRefusal(value);
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
  return JSON.stringify(normalize(value, 0, "$"));
}

export function canonicalOp(op: Op): string {
  return canonicalJson(op);
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
 * Validate and inspect stamped operations without reading or mutating a doc.
 *
 * This is the storage preflight boundary from ADR-022. Canonical bytes and
 * their digest are produced together through the same canonicalizer and
 * SHA-256 implementation as {@link applyOps}. Input order is preserved.
 * Identical repeated ids remain inspectable; reuse with different canonical
 * bytes is rejected before a storage caller can perform a lookup.
 */
export function inspectOps(ops: Op[]): CanonicalOpInspection[] {
  if (ops.length > MAX_OPS_PER_BATCH) {
    throw new OpRejectedError(
      "malformed_op",
      `batch of ${ops.length} ops exceeds the ${MAX_OPS_PER_BATCH}-op limit`,
    );
  }

  const canonicalById = new Map<string, string>();
  return ops.map((op, index) => {
    validateEnvelope(op);
    if (op.stamp === undefined) {
      throw new OpRejectedError(
        "malformed_op",
        `${op.op}: stamp is required for canonical inspection`,
      );
    }

    const canonical = canonicalOp(op);
    const prior = canonicalById.get(op.op_id);
    if (prior !== undefined && prior !== canonical) {
      throw new OpRejectedError(
        "op_id_reuse",
        `op_id '${op.op_id}' is reused with a different payload at index ${index}`,
      );
    }
    canonicalById.set(op.op_id, canonical);

    const digestHex = sha256Hex(canonical);
    const canonicalDigest = new Uint8Array(digestHex.length / 2);
    for (let offset = 0; offset < digestHex.length; offset += 2) {
      canonicalDigest[offset / 2] = Number.parseInt(digestHex.slice(offset, offset + 2), 16);
    }

    return {
      index,
      op_id: op.op_id,
      canonical_op: new TextEncoder().encode(canonical),
      canonical_digest: canonicalDigest,
      creator_actor: op.stamp[1],
      creator_lamport: op.stamp[0],
    };
  });
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
  if (op.op !== "define_subgraph") {
    const ordinary = op as WireOp & Record<string, unknown>;
    if ("subgraph_definition" in ordinary || "definitions" in ordinary || "subgraph_id" in ordinary) {
      throw new OpRejectedError("malformed_op", `${op.op}: definition payloads and subgraph_id targets are only valid on define_subgraph`);
    }
  }
  if (typeof op.op_id !== "string" || op.op_id.length === 0) {
    throw new OpRejectedError("malformed_op", `${op.op}: missing op_id`);
  }
  if (
    op.base_version !== undefined &&
    (typeof op.base_version !== "number" ||
      !Number.isSafeInteger(op.base_version) ||
      op.base_version < 0)
  ) {
    throw new OpRejectedError(
      "malformed_op",
      `${op.op}: base_version must be a non-negative safe integer`,
    );
  }
  if (op.actor !== undefined && typeof op.actor !== "string") {
    throw new OpRejectedError(
      "malformed_op",
      `${op.op}: actor must be a string`,
    );
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
    case "set_node_field":
      return applySetNodeField(doc, op);
    case "connect":
      return applyConnect(doc, op, catalog);
    case "disconnect":
      return applyDisconnect(doc, op);
    case "delete_node":
      return applyDeleteNode(doc, op);
    case "clear":
      return applyClear(doc, op);
    case "define_subgraph":
      return applyDefineSubgraph(doc, op, catalog);
    case "insert_workflow":
      return applyInsertWorkflow(doc, op, catalog);
    default:
      // Exhaustiveness guard (issue #21): with every `Op` member cased above,
      // `op` is `never` here. Add a seventh IMPLEMENTED kind to `Op` and this
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

function applyDefineSubgraph(
  doc: Y.Doc,
  op: DefineSubgraphOp,
  catalog?: WidgetCatalog,
): SuccessfulOutcome {
  if (!isUuid(op.subgraph_id) || !isPlainRecord(op.subgraph_definition) || op.subgraph_definition.id !== op.subgraph_id) {
    throw new OpRejectedError(
      "malformed_op",
      "define_subgraph: subgraph_id must be a UUID matching subgraph_definition.id",
    );
  }
  validateSubgraphDefinition(op.subgraph_definition, "subgraph_definition");
  if (!catalog) {
    throw new OpRejectedError("catalog_required", "define_subgraph: the pinned catalog is required to encode interior nodes");
  }
  validateDefinitionWidgets(op.subgraph_definition, catalog);
  const digest = definitionDigest(op.subgraph_definition, catalog);
  const definitions = definitionsMap(doc);
  const existing = definitions.get(op.subgraph_id);
  if (existing !== undefined) {
    const digests = definitionDigests(doc);
    const existingDigest = digests[op.subgraph_id] ?? definitionDigest(existing, catalog);
    if (existingDigest === digest) return "no-op";
    if (digest > existingDigest) {
      assertDefinitionIdsAvailable(doc, op.subgraph_definition, op.subgraph_id);
      const replacement = mintSubmittedDefinition(op, catalog);
      const widgetEdits = definitionWidgetEdits(doc, existing);
      mset(definitions, op.subgraph_id, replacement);
      restoreDefinitionWidgetEdits(doc, replacement, widgetEdits);
      setDefinitionDigest(doc, op.subgraph_id, digest);
      return "applied";
    }
    return "no-op";
  }
  const existingNested = resolveDefinition(doc, op.subgraph_id);
  if (existingNested !== null) {
    throw new OpRejectedError(
      "definition_conflict",
      `define_subgraph: definition id '${op.subgraph_id}' is already registered`,
    );
  }
  assertDefinitionIdsAvailable(doc, op.subgraph_definition);
  const definition = mintSubmittedDefinition(op, catalog);
  mset(definitions, op.subgraph_id, definition);
  setDefinitionDigest(doc, op.subgraph_id, digest);
  return "applied";
}

function mintSubmittedDefinition(op: DefineSubgraphOp, catalog: WidgetCatalog): Y.Map<unknown> {
  try {
    return mintDefinition(op.subgraph_definition, catalog);
  } catch (error) {
    throw new OpRejectedError(
      "malformed_op",
      `define_subgraph(${op.subgraph_id}): ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

function definitionDigest(definition: SubgraphDefinition | Y.Map<unknown>, catalog: WidgetCatalog): string {
  return sha256Hex(canonicalJson(canonicalDefinitionValue(definition, catalog)));
}

/** One digest representation for submitted JSON and stored definitions: their public projection. */
function canonicalDefinitionValue(
  definition: SubgraphDefinition | Y.Map<unknown>,
  catalog: WidgetCatalog,
): Record<string, unknown> {
  if (definition instanceof Y.Map) return projectDefinition(definition, catalog);

  // Projection reads attached Y types (not preliminary content on unattached
  // maps), so integrate the temporary mint before using the authoritative
  // mint/project normalization for widgets, outputs, and nested definitions.
  const temporary = new Y.Doc();
  try {
    const minted = mintDefinition(definition, catalog);
    temporary.getMap<Y.Map<unknown>>("definitions").set(String(definition.id), minted);
    return projectDefinition(minted, catalog);
  } finally {
    temporary.destroy();
  }
}

function definitionDigests(doc: Y.Doc): Record<string, string> {
  const value = metaMap(doc).get("__definition_digests");
  if (!isPlainRecord(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
  );
}

function setDefinitionDigest(doc: Y.Doc, id: string, digest: string): void {
  mset(metaMap(doc), "__definition_digests", { ...definitionDigests(doc), [id]: digest });
}

type DefinitionWidgetEdit = {
  targetKey: string;
  definitionId: string;
  nodeId: string;
  storageKey: string;
  value: unknown;
};

function definitionWidgetEdits(
  doc: Y.Doc,
  existing: Y.Map<unknown>,
): DefinitionWidgetEdit[] {
  const edits: DefinitionWidgetEdit[] = [];
  for (const targetKey of stampsMap(doc).keys()) {
    let target: unknown;
    try {
      target = JSON.parse(targetKey);
    } catch {
      continue;
    }
    if (!Array.isArray(target) || target[0] !== "widget" || !Array.isArray(target[1])) continue;
    const path = target[1].map(String);
    const widget = target[3];
    const occurrence = target[4] === undefined ? 0 : target[4];
    if (
      path.length < 2 ||
      typeof widget !== "string" ||
      !Number.isInteger(occurrence) ||
      (occurrence as number) < 0
    ) continue;
    const resolved = definitionNodeAtPath(doc, existing, path);
    if (!resolved) continue;
    const oldWidgets = resolved.node.get("widgets");
    const storageKey = widgetStorageKey(widget, occurrence as number);
    if (oldWidgets instanceof Y.Map && oldWidgets.has(storageKey)) {
      edits.push({
        targetKey,
        definitionId: resolved.definitionId,
        nodeId: path.at(-1)!,
        storageKey,
        value: structuredClone(oldWidgets.get(storageKey)),
      });
    }
  }
  return edits;
}

function definitionNodeAtPath(
  doc: Y.Doc,
  root: Y.Map<unknown>,
  path: string[],
): { definitionId: string; node: Y.Map<unknown> } | null {
  let definitionId = path[0]!;
  let node = definitionNode(root, definitionId, path[1]!);
  if (!node) {
    const instance = nodesMap(doc).get(definitionId);
    if (!(instance instanceof Y.Map) || String(instance.get("type")) !== String(root.get("id"))) return null;
    definitionId = String(root.get("id"));
    node = definitionNode(root, definitionId, path[1]!);
  }
  if (!node) return null;
  for (const nodeId of path.slice(2)) {
    definitionId = String(node.get("type"));
    node = definitionNode(root, definitionId, nodeId);
    if (!node) return null;
  }
  return { definitionId, node };
}

function restoreDefinitionWidgetEdits(
  doc: Y.Doc,
  replacement: Y.Map<unknown>,
  edits: DefinitionWidgetEdit[],
): void {
  for (const edit of edits) {
    const newNode = definitionNode(replacement, edit.definitionId, edit.nodeId);
    const newWidgets = newNode?.get("widgets");
    if (!(newWidgets instanceof Y.Map)) {
      mdel(stampsMap(doc), edit.targetKey);
      continue;
    }
    mset(newWidgets, edit.storageKey, edit.value);
  }
}

function definitionNode(
  root: Y.Map<unknown>,
  definitionId: string,
  nodeId: string,
): Y.Map<unknown> | null {
  if (String(root.get("id")) === definitionId) {
    const nodes = root.get("nodes");
    const node = nodes instanceof Y.Map ? nodes.get(nodeId) : undefined;
    return node instanceof Y.Map ? node : null;
  }
  const container = root.get("definitions");
  const nested = container instanceof Y.Map ? container.get("subgraphs") : undefined;
  if (!(nested instanceof Y.Map)) return null;
  for (const child of nested.values()) {
    if (child instanceof Y.Map) {
      const node = definitionNode(child, definitionId, nodeId);
      if (node) return node;
    }
  }
  return null;
}

function assertDefinitionIdsAvailable(
  doc: Y.Doc,
  definition: Record<string, unknown>,
  excludedRootId?: string,
  submitted = new Set<string>(),
): void {
  const visit = (candidate: Record<string, unknown>, path: string): void => {
    const id = String(candidate.id);
    if (submitted.has(id)) throw new OpRejectedError("malformed_op", `define_subgraph: duplicate definition id '${id}' at ${path}`);
    submitted.add(id);
    const nested = candidate.definitions;
    if (isPlainRecord(nested) && Array.isArray(nested.subgraphs)) nested.subgraphs.forEach((child, index) => {
      if (isPlainRecord(child)) visit(child, `${path}.definitions.subgraphs[${index}]`);
    });
  };
  visit(definition, "subgraph_definition");
  for (const id of submitted) {
    if (definitionIdExistsOutsideRoot(doc, id, excludedRootId)) {
      throw new OpRejectedError("definition_conflict", `define_subgraph: definition id '${id}' is already registered`);
    }
  }
}

function definitionIdExistsOutsideRoot(
  doc: Y.Doc,
  id: string,
  excludedRootId?: string,
): boolean {
  const containsId = (definition: Y.Map<unknown>): boolean => {
    if (String(definition.get("id")) === id) return true;
    const container = definition.get("definitions");
    const nested = container instanceof Y.Map ? container.get("subgraphs") : undefined;
    if (!(nested instanceof Y.Map)) return false;
    for (const child of nested.values()) {
      if (child instanceof Y.Map && containsId(child)) return true;
    }
    return false;
  };

  for (const [rootId, definition] of definitionsMap(doc)) {
    if (rootId !== excludedRootId && definition instanceof Y.Map && containsId(definition)) return true;
  }
  return false;
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function validateSubgraphDefinition(definition: Record<string, unknown>, path: string): void {
  if (!isUuid(definition.id) || !Array.isArray(definition.nodes) || !Array.isArray(definition.links)) {
    throw new OpRejectedError("malformed_op", `define_subgraph: ${path} needs a UUID id plus nodes and links arrays`);
  }
  for (const key of ["node_order", "link_order", "__definition_digest"]) {
    if (Object.hasOwn(definition, key)) {
      throw new OpRejectedError("malformed_op", `define_subgraph: ${path} contains reserved key '${key}'`);
    }
  }
  assertUniqueNormalizedIds(definition.nodes, `${path}.nodes`, true);
  assertUniqueNormalizedIds(definition.links, `${path}.links`);
  validateSerializableValue(definition, path);

  const nested = definition.definitions;
  if (nested === undefined) return;
  if (!isPlainRecord(nested) || !Array.isArray(nested.subgraphs)) {
    throw new OpRejectedError("malformed_op", `define_subgraph: ${path}.definitions.subgraphs must be an array`);
  }
  const nestedIds = new Set<string>();
  nested.subgraphs.forEach((candidate, index) => {
    const nestedPath = `${path}.definitions.subgraphs[${index}]`;
    if (!isPlainRecord(candidate) || !isUuid(candidate.id)) {
      throw new OpRejectedError("malformed_op", `define_subgraph: ${nestedPath} must be a definition with a UUID id`);
    }
    if (nestedIds.has(candidate.id)) {
      throw new OpRejectedError("malformed_op", `define_subgraph: duplicate definition id '${candidate.id}' at ${nestedPath}`);
    }
    nestedIds.add(candidate.id);
    validateSubgraphDefinition(candidate, nestedPath);
  });
}

function assertUniqueNormalizedIds(
  values: unknown[],
  path: string,
  required = false,
  operation = "define_subgraph",
): void {
  const ids = new Set<string>();
  values.forEach((value, index) => {
    let id: unknown;
    if (Array.isArray(value)) id = value[0];
    else if (isPlainRecord(value)) id = value.id;
    if (id === undefined || id === null) {
      if (required) throw new OpRejectedError("malformed_op", `${operation}: missing id at ${path}[${index}]`);
      return;
    }
    const normalized = String(id);
    if (ids.has(normalized)) {
      throw new OpRejectedError("malformed_op", `${operation}: duplicate normalized id '${normalized}' at ${path}[${index}]`);
    }
    ids.add(normalized);
  });
}

function validateDefinitionWidgets(definition: Record<string, unknown>, catalog: WidgetCatalog): void {
  if (typeof definition.id === "string" && Object.hasOwn(catalog.types, definition.id)) {
    throw new OpRejectedError(
      "malformed_op",
      `define_subgraph: definition id '${definition.id}' shadows a catalog class`,
    );
  }
  (definition.nodes as unknown[]).forEach((candidate) => {
    if (!isPlainRecord(candidate)) {
      throw new OpRejectedError("malformed_op", "define_subgraph: every interior node must be an object");
    }
    rejectUnprojectableWidgets(candidate, candidate.type, candidate.widgets_values, catalogEntry(catalog, candidate.type));
  });
  const nested = definition.definitions;
  if (isPlainRecord(nested) && Array.isArray(nested.subgraphs)) {
    nested.subgraphs.forEach((child) => {
      if (isPlainRecord(child)) validateDefinitionWidgets(child, catalog);
    });
  }
}

function validateSerializableValue(value: unknown, path: string): void {
  if (value === null || typeof value === "string" || typeof value === "boolean") return;
  if (typeof value === "number" && Number.isFinite(value)) return;
  if (Array.isArray(value)) {
    value.forEach((child, index) => validateSerializableValue(child, `${path}[${index}]`));
    return;
  }
  if (isPlainRecord(value)) {
    Object.entries(value).forEach(([key, child]) => validateSerializableValue(child, `${path}.${key}`));
    return;
  }
  throw new OpRejectedError("malformed_op", `define_subgraph: ${path} is not JSON-serializable`);
}

// ---------------------------------------------------------------------------
// insert_workflow
// ---------------------------------------------------------------------------

function numericId(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && /^\d+$/.test(value)) return parseInt(value, 10);
  return undefined;
}

function scrubPrivateKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(scrubPrivateKeys);
  if (typeof value !== "object" || value === null) return value;
  const clean: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    if (!key.startsWith("__")) clean[key] = scrubPrivateKeys(child);
  }
  return clean;
}

function definitionId(value: unknown): string | undefined {
  if (typeof value === "string" && value.length > 0) return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return undefined;
}

function validateRawGraphIds(nodes: unknown[], links: unknown[], path: string): void {
  assertUniqueNormalizedIds(nodes, `${path}.nodes`, true, "insert_workflow");
  assertUniqueNormalizedIds(links, `${path}.links`, true, "insert_workflow");
}

function validateDefinitionInputs(subgraphs: unknown[], path = "workflow.definitions.subgraphs"): void {
  const ids = new Set<string>();
  subgraphs.forEach((candidate, index) => {
    if (typeof candidate !== "object" || candidate === null || Array.isArray(candidate)) {
      throw new OpRejectedError("malformed_op", "insert_workflow: every subgraph definition must be an object");
    }
    const sg = candidate as Record<string, unknown>;
    const id = definitionId(sg["id"]);
    if (id === undefined) {
      throw new OpRejectedError("malformed_op", "insert_workflow: every subgraph definition requires a valid id");
    }
    if (ids.has(id)) {
      throw new OpRejectedError("malformed_op", `insert_workflow: duplicate definition id '${id}' at ${path}[${index}]`);
    }
    ids.add(id);
    if (!Array.isArray(sg["nodes"]) || (sg["links"] !== undefined && !Array.isArray(sg["links"]))) {
      throw new OpRejectedError("malformed_op", "insert_workflow: definition nodes and links must be arrays");
    }
    const definitionPath = `${path}[${index}]`;
    validateRawGraphIds(sg["nodes"], (sg["links"] as unknown[] | undefined) ?? [], definitionPath);
    const nested = (sg["definitions"] as { subgraphs?: unknown } | undefined)?.subgraphs;
    if (nested !== undefined && !Array.isArray(nested)) {
      throw new OpRejectedError("malformed_op", "insert_workflow: nested definitions.subgraphs must be an array");
    }
    if (Array.isArray(nested)) validateDefinitionInputs(nested, `${definitionPath}.definitions.subgraphs`);
  });
}

function prepareInsertedWorkflow(op: InsertWorkflowOp): Record<string, unknown> {
  const workflow = scrubPrivateKeys(op.workflow) as unknown;
  if (typeof workflow !== "object" || workflow === null || Array.isArray(workflow)) {
    throw new OpRejectedError("malformed_op", "insert_workflow: workflow must be an object");
  }
  const wf = workflow as Record<string, unknown>;
  if (!Array.isArray(wf["nodes"]) || (wf["links"] !== undefined && !Array.isArray(wf["links"]))) {
    throw new OpRejectedError("malformed_op", "insert_workflow: nodes and links must be arrays");
  }
  const definitions = wf["definitions"];
  if (definitions !== undefined && (typeof definitions !== "object" || definitions === null || Array.isArray(definitions))) {
    throw new OpRejectedError("malformed_op", "insert_workflow: definitions must be an object");
  }
  const subgraphs = (definitions as { subgraphs?: unknown } | undefined)?.subgraphs;
  if (subgraphs !== undefined && !Array.isArray(subgraphs)) {
    throw new OpRejectedError("malformed_op", "insert_workflow: definitions.subgraphs must be an array");
  }
  if (wf["groups"] !== undefined && !Array.isArray(wf["groups"])) {
    throw new OpRejectedError("malformed_op", "insert_workflow: groups must be an array");
  }
  validateRawGraphIds(wf["nodes"] as unknown[], (wf["links"] as unknown[] | undefined) ?? [], "workflow");
  validateDefinitionInputs((subgraphs as unknown[] | undefined) ?? []);
  // ADR-033 (amended): every id this op derives, including a link's numeric
  // id, is a PURE function of the op's own content — no document state is
  // read here. See `remap.ts`'s `derivedLinkId` for why `LinkId` (a branded
  // `number`, unlike the string-or-number `NodeId`) needed a numeric mint at
  // all, and for why the mint no longer checks the target document (KA-5
  // exception, `docs/decisions/EXCEPTIONS.md`).
  return remapInsertedWorkflowIds(
    wf as unknown as import("./types.js").WorkflowJSON,
    op.op_id,
  ) as unknown as Record<string, unknown>;
}

function applyInsertWorkflow(doc: Y.Doc, op: InsertWorkflowOp, catalog?: WidgetCatalog): SuccessfulOutcome {
  const wf = prepareInsertedWorkflow(op);
  const remappedDefinitions = wf["definitions"] as { subgraphs?: unknown[] } | undefined;
  const remappedSubgraphs = remappedDefinitions?.subgraphs ?? [];

  const nodes = nodesMap(doc);
  const links = linksMap(doc);
  const stamps = stampsMap(doc);
  const stamp = stampKey(op);
  const seenNodes = new Set<string>();
  function acceptsNode(candidate: unknown): boolean {
    if (typeof candidate !== "object" || candidate === null || Array.isArray(candidate)) {
      throw new OpRejectedError("invalid_node_payload", "insert_workflow: every node must be an object");
    }
    const node = candidate as { id?: unknown; type?: unknown };
    if (node.id === undefined || typeof node.type !== "string" || node.type.length === 0) {
      throw new OpRejectedError("invalid_node_payload", "insert_workflow: every node requires id and type");
    }
    const key = String(node.id);
    if (seenNodes.has(key)) {
      throw new OpRejectedError("node_id_collision", `insert_workflow: node id '${key}' collides`);
    }
    const existing = nodes.get(key);
    if (existing) {
      const incumbent = stamps.get(JSON.stringify(["insert_workflow_node", key])) as StampKey | undefined;
      if (incumbent === undefined) {
        throw new OpRejectedError("node_id_collision", `insert_workflow: node id '${key}' collides`);
      }
      if (compareStampKeys(stamp, incumbent) <= 0) return false;
    }
    seenNodes.add(key);
    return true;
  }
  for (const candidate of wf["nodes"] as unknown[]) {
    if (!acceptsNode(candidate)) return "lww-dropped";
  }
  const seenLinks = new Set<string>();
  const linkWrites: unknown[][] = [];
  function acceptsLink(candidate: unknown): boolean {
    if (!Array.isArray(candidate) || candidate[0] === undefined || candidate[1] === undefined || candidate[3] === undefined) {
      throw new OpRejectedError("malformed_op", "insert_workflow: every link must be a tuple with an id and two endpoints");
    }
    const key = String(candidate[0]);
    if (seenLinks.has(key)) {
      throw new OpRejectedError("link_id_collision", `insert_workflow: link id '${key}' collides`);
    }
    if (links.has(key)) {
      const incumbent = stamps.get(JSON.stringify(["insert_workflow_link", key])) as StampKey | undefined;
      if (incumbent === undefined) {
        throw new OpRejectedError("link_id_collision", `insert_workflow: link id '${key}' collides`);
      }
      if (compareStampKeys(stamp, incumbent) <= 0) return false;
    }
    seenLinks.add(key);
    if (linkHasMissingEndpoint(candidate, (id) => nodes.has(String(id)) || seenNodes.has(String(id)))) {
      return true;
    }
    linkWrites.push(candidate);
    return true;
  }
  for (const candidate of (wf["links"] as unknown[] | undefined) ?? []) {
    if (!acceptsLink(candidate)) return "lww-dropped";
  }

  const targetKey = stampTargetKey(op);
  const prior = stamps.get(targetKey) as StampKey | undefined;
  if (prior != null && compareStampKeys(stamp, prior) <= 0) return "lww-dropped";

  if (remappedSubgraphs.length > 0 && !catalog) {
    throw new OpRejectedError("catalog_required", "insert_workflow: the pinned catalog is required to encode definitions");
  }
  const cat = catalog ?? { types: {} };
  const defs = definitionsMap(doc);
  const submittedDefinitionIds = new Set<string>();
  const definitionWrites: Array<[string, Y.Map<unknown>, string]> = [];
  function prepareDefinition(candidate: unknown): void {
    if (typeof candidate !== "object" || candidate === null || Array.isArray(candidate)) {
      throw new OpRejectedError("malformed_op", "insert_workflow: every subgraph definition must be an object");
    }
    const sg = candidate as Record<string, unknown>;
    const id = definitionId(sg["id"])!;
    validateSubgraphDefinition(sg, "workflow.definitions.subgraphs");
    validateDefinitionWidgets(sg, cat);
    assertDefinitionIdsAvailable(doc, sg, undefined, submittedDefinitionIds);
    const digest = definitionDigest(sg as unknown as SubgraphDefinition, cat);
    definitionWrites.push([id, mintDefinition(sg, cat), digest]);
  }
  for (const candidate of remappedSubgraphs) prepareDefinition(candidate);

  const nodeWrites: Array<[string, unknown, Y.Map<unknown>]> = [];
  function prepareNode(candidate: import("./types.js").WorkflowNode): void {
    const node = structuredClone(candidate);
    const wv = node.widgets_values;
    const entry = catalogEntry(catalog, node.type);
    // A24: a declared node needs neither check — see `rejectUnprojectableWidgets`.
    if (!declaresWidgetForm(node)) {
      if (!catalog && Array.isArray(wv) && wv.length > 0) {
        throw new OpRejectedError("catalog_required", `insert_workflow(${node.type}): positional widgets_values needs a catalog`);
      }
      rejectUnprojectableWidgets(node, node.type, wv, entry);
    }
    try {
      nodeWrites.push([String(node.id), node.id, createNodeMap(node, widgetOrderForValues(entry, node.widgets_values))]);
    } catch (err) {
      throw new OpRejectedError("invalid_node_payload", `insert_workflow(${node.type}): ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  for (const candidate of wf["nodes"] as import("./types.js").WorkflowNode[]) prepareNode(candidate);

  const importedLinkStates = new Map<string, ReturnType<typeof importedLinkState>>();
  function prepareLinkState(link: unknown[]): void {
    const key = String(link[0]);
    try {
      importedLinkStates.set(key, importedLinkState(link, wf as unknown as import("./types.js").WorkflowJSON));
    } catch (err) {
      throw new OpRejectedError("malformed_op", `insert_workflow: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  for (const link of linkWrites) prepareLinkState(link);

  function commitPreparedWrites(): void {
    for (const [id, definition, digest] of definitionWrites) {
      mset(defs, id, definition);
      setDefinitionDigest(doc, id, digest);
    }
    for (const link of linkWrites) {
      const key = String((link as unknown[])[0]);
      mset(links, key, cloneForMap(link, "insert_workflow: link"));
      const state = importedLinkStates.get(key) ?? null;
      if (state !== null) mset(linkStateMap(doc), key, cloneForMap(state, `insert_workflow: link state ${key}`));
      mset(stamps, JSON.stringify(["insert_workflow_link", key]), stamp);
    }
    for (const [key, id, nodeMap] of nodeWrites) {
      clearObsoleteWidgetStamps(stamps, key);
      // Legacy life, not a per-op token: the remapped id already encodes the
      // op, and clients (comfy-cli, the frontend) mint writes without
      // node_incarnation and cannot read one back from the projection — a
      // per-op incarnation made every write to an inserted node a no-op.
      mset(nodeMap, NODE_INCARNATION_KEY, LEGACY_NODE_INCARNATION);
      mset(nodes, key, nodeMap);
      mset(stamps, JSON.stringify(["insert_workflow_node", key]), stamp);
      mset(stamps, targetKey, stamp);
      reconcileNodeLinkRefs(doc, id, nodeMap);
    }
    if (nodeWrites.length === 0) mset(stamps, targetKey, stamp);
  }

  commitPreparedWrites();
  updateInsertedWorkflowMeta(doc, wf, nodeWrites);
  return nodeWrites.length > 0 || linkWrites.length > 0 || definitionWrites.length > 0 || ((wf["groups"] as unknown[] | undefined)?.length ?? 0) > 0
    ? "applied"
    : "no-op";
}

function updateInsertedWorkflowMeta(
  doc: Y.Doc,
  wf: Record<string, unknown>,
  nodeWrites: Array<[string, unknown, Y.Map<unknown>]>,
): void {
  const meta = metaMap(doc);
  if (Array.isArray(wf["groups"])) {
    const currentGroups = Array.isArray(meta.get("groups")) ? meta.get("groups") as unknown[] : [];
    const merged = new Map<string, unknown>();
    for (const group of [...currentGroups, ...wf["groups"]]) merged.set(canonicalJson(group), group);
    mset(meta, "groups", [...merged.entries()].sort(([a], [b]) => codePointCompare(a, b)).map(([, group]) => group));
  }
  const currentNode = numericId(meta.get("last_node_id")) ?? 0;
  const maxNode = Math.max(currentNode, ...nodeWrites.map(([, id]) => numericId(id) ?? currentNode));
  if (maxNode > currentNode) mset(meta, "last_node_id", maxNode);
  // `last_link_id` is deliberately NOT advanced from `linkWrites` (KA-5:
  // "document high-water marks are advisory, never allocators"). Every
  // inserted link's own id is now a large, arbitrary-looking derived number
  // (ADR-033 — `remap.ts`'s `derivedLinkId`, needed only because ComfyUI_
  // frontend's `LinkId` is a branded `number`), not a small sequential one,
  // so folding it into the high-water mark would pin the doc's bookkeeping
  // field to that value forever after the FIRST insert_workflow — a new,
  // surprising side effect this line never had before (the pre-fix STRING
  // derived id already failed `numericId` and left this a no-op for every
  // inserted link).
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
 *
 * A24: neither is a payload that DECLARES its own `widgets_values_form`. The
 * whole premise here is that `project()` resolves names through the catalog, so
 * a name the catalog does not describe poisons the document — and a declared
 * node projects without the catalog, so there is nothing for it to be
 * unprojectable against. Its own validation (`deriveWidgetForm`, inside
 * `createNodeMap`) is stricter: the declaration must account for every value.
 * Presence is the right test, not well-formedness; a malformed declaration is
 * refused there rather than quietly judged by a catalog rule the producer
 * never invoked.
 */
function rejectUnprojectableWidgets(
  node: unknown,
  nodeType: unknown,
  wv: unknown,
  entry: WidgetCatalog["types"][string] | undefined,
): void {
  if (declaresWidgetForm(node)) return;
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
  // Selection-aware: the payload's own selector values pick each dynamic
  // combo's option, so a non-default option's sub-widgets are real names.
  const order = widgetOrderForValues(entry, wv) ?? entry.widget_order;
  const owned = optionOwnedWidgets(entry);
  for (const name of names) {
    if (!order.includes(name) && !owned.has(name)) {
      throw new OpRejectedError(
        "unknown_widget",
        `add_node(${type}): widget '${name}' is not in widget_order for ${type}; available: ${order.join(", ") || "(none — all inputs are links)"}`,
      );
    }
  }
}

function requireAddNodeValid(op: AddNodeOp): void {
  if (op.path !== undefined && (!Array.isArray(op.path) || op.path.length === 0)) {
    throw new OpRejectedError("malformed_op", "add_node: path must be a non-empty array when present");
  }
  if (op.container_incarnation !== undefined && (typeof op.container_incarnation !== "string" || op.container_incarnation.length === 0)) {
    throw new OpRejectedError("malformed_op", "add_node: container_incarnation must be a non-empty string");
  }
  if (op.node_incarnation !== undefined && (typeof op.node_incarnation !== "string" || op.node_incarnation.length === 0)) {
    throw new OpRejectedError("malformed_op", "add_node: node_incarnation must be a non-empty string");
  }
  if (op.node_id === undefined || typeof op.node !== "object" || op.node === null) {
    throw new OpRejectedError("malformed_op", "add_node: missing node_id or node payload");
  }
  if (op.node.id !== undefined && String(op.node_id) !== String(op.node.id)) {
    throw new OpRejectedError(
      "malformed_op",
      `add_node: wire node_id '${String(op.node_id)}' does not match payload node.id '${String(op.node.id)}'`,
    );
  }
}

function createAddedNode(op: AddNodeOp, catalog?: WidgetCatalog): Y.Map<unknown> {
  const wv = op.node.widgets_values;
  const entry = catalogEntry(catalog, op.node.type);
  const order = widgetOrderForValues(entry, wv);
  // A24: a payload that declares its own `widgets_values_form` needs neither
  // check. Both exist because a payload the catalog cannot describe would
  // become unprojectable — and a declared node projects WITHOUT the catalog,
  // so there is nothing to be unprojectable against. A malformed declaration
  // is still refused, by `createNodeMap` below, as `invalid_node_payload`.
  if (!declaresWidgetForm(op.node)) {
    if (!catalog && Array.isArray(wv) && wv.length > 0) {
      throw new OpRejectedError(
        "catalog_required",
        `add_node(${op.node.type}): positional widgets_values needs the pinned catalog widget_order to decompose into the name-keyed widgets map (schema §1.2)`,
      );
    }
    rejectUnprojectableWidgets(op.node, op.node.type, wv, entry);
  }
  try {
    return createNodeMap(op.node, order);
  } catch (err) {
    throw new OpRejectedError(
      "invalid_node_payload",
      `add_node(${String(op.node.type)}): ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

function applyAddNode(doc: Y.Doc, op: AddNodeOp, catalog?: WidgetCatalog): SuccessfulOutcome {
  requireAddNodeValid(op);
  const route: Pick<AddNodeOp, "path" | "node_incarnation"> = op.path ? { path: op.path } : {};
  if (op.container_incarnation !== undefined) route.node_incarnation = op.container_incarnation;
  const interiorScope = op.path
    ? resolveInteriorGraphScope(
      doc,
      route,
      catalog,
      "add_node",
      true,
      true,
    )
    : null;
  const nodes = interiorScope?.nodes ?? nodesMap(doc);
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
  // No catalog AT ALL: the host cannot tell an unknown class from a known one,
  // so it cannot decide between name-decomposition and opaque storage — reject
  // rather than guess. A catalog that simply lacks THIS class is a different
  // case: the class is unknown to object_info (frontend-only nodes always are),
  // and `createNodeMap` stores its values opaquely (schema §1.2).
  const nodeMap = createAddedNode(op, catalog);
  clearObsoleteWidgetStamps(
    stamps,
    key,
    interiorScope ? String(interiorScope.definition.get("id") ?? "") : undefined,
  );
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
  if (interiorScope) {
    reconcileInteriorNodeLinkRefs(interiorScope, op.node_id, nodeMap);
    recordInteriorNodeOrder(interiorScope.definition, stamps, key, stamp);
  } else {
    reconcileNodeLinkRefs(doc, op.node_id, nodeMap);
    restoreDurableLinks(doc, op.node_id);
  }

  // last_node_id is a max-register (vocabulary §8.3): write only on increase.
  if (interiorScope) return "applied";
  const meta = metaMap(doc);
  const cur = meta.get("last_node_id");
  const curN = typeof cur === "number" ? cur : 0;
  const idN = numericId(op.node_id);
  if (idN !== undefined && idN > curN) {
    mset(meta, "last_node_id", idN);
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
function clearObsoleteWidgetStamps(
  stamps: Y.Map<unknown>,
  nodeKey: string,
  definitionId?: string,
): void {
  const interiorNodePath = definitionId === undefined ? null : [definitionId, nodeKey];
  for (const targetKey of [...stamps.keys()]) {
    let target: unknown;
    try {
      target = JSON.parse(targetKey);
    } catch {
      continue;
    }
    if (!Array.isArray(target)) continue;
    const targetNode = target[1];
    const isTarget = interiorNodePath
      ? Array.isArray(targetNode)
        && targetNode.length === interiorNodePath.length
        && targetNode.every((segment, index) => String(segment) === interiorNodePath[index])
      : targetNode === nodeKey;
    if (target[0] === "widget" && isTarget) {
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
 *   A known dotted prefix is insufficient: projection needs the exact name's
 *   position, including for dynamic-combo sub-widgets.
 *
 * Skipped entirely when there is NO catalog: the host cannot then tell an
 * unknown class from a known one, which is the same "reject rather than guess"
 * boundary `applyAddNode` draws for a positional payload.
 */
function validateWidgetName(
  catalog: WidgetCatalog | undefined,
  nodeType: string,
  widget: string,
  node?: Y.Map<unknown>,
  occurrence = 0,
): void {
  // A24: a self-described node answers this question itself, from the ordered
  // identity its producer declared, and the catalog is not consulted at all —
  // with or without one. That is the whole unlock: a class the catalog cannot
  // describe is name-addressable when the node carries its own mapping. The
  // declaration is still CLOSED, so a name or occurrence it does not list is
  // `unknown_widget` exactly as a missing `widget_order` entry would be.
  const form = node ? storedWidgetFormOf(node) : null;
  if (form) {
    if (!formDeclares(form, widget, occurrence)) {
      const at = occurrence === 0 ? "" : ` occurrence ${String(occurrence)}`;
      throw new OpRejectedError(
        "unknown_widget",
        `widget '${widget}'${at} is not declared by ${nodeType} node ${String(node?.get("id"))}'s widgets_values_form; declared: ${form.order.join(", ")}`,
      );
    }
    return;
  }
  if (!catalog) return;
  const entry = catalogEntry(catalog, nodeType);
  if (!entry) {
    throw new OpRejectedError(
      "uncatalogued_widget_write",
      `set_widget(${nodeType}): named widget write to a class absent from the pinned catalog cannot be projected (schema §1.2 — projection is catalog-dependent by design)`,
    );
  }
  // Any option's sub-widget is a legal target, selected or not: accepting only
  // the CURRENT selection's would make the outcome depend on whether the
  // selector write arrived first (KA-2). An unselected option's value is
  // stored and not projected until that option is selected.
  const widgets = node?.get("widgets");
  const order = widgetOrderForWidgets(entry, widgets instanceof Y.Map ? widgets : undefined);
  if (widgetIndexOf(order, widget, occurrence) < 0 && !(occurrence === 0 && optionOwnedWidgets(entry).has(widget))) {
    throw new OpRejectedError(
      "unknown_widget",
      `widget '${widget}' not found on ${nodeType}; available: ${order.join(", ") || "(none — all inputs are links)"}`,
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
    case "self":
      // A24: also name-addressable, and against the same `widgets` Y.Map. The
      // name→position mapping came from the node's own declaration, so the
      // reason this guard rejects an `opaque` node — there is no mapping and
      // the write cannot be expressed — does not hold here.
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
 * Is `(name, occurrence)` the FINAL occurrence of `name` in the node's current
 * widget layout? Amendment A23's whole condition, because
 * `widgets_values_named` is keyed by name alone and a serializer writing it in
 * widget order therefore leaves the LAST same-named widget's value in it.
 *
 * The layout is read AFTER the write, exactly as projection will read it, so a
 * dynamic-combo selector that changed the order cannot make the two disagree.
 *
 * Answers `false` whenever the layout cannot be resolved — no catalog, an
 * uncatalogued class, or a legal write to an unselected option's sub-widget
 * (`validateWidgetName`'s carve-out), none of which have a projected position
 * to be the final occurrence of. Conservative on purpose: a node whose layout
 * this package cannot resolve is one `project()` cannot turn back into
 * positional values either, so there is no coherent read to break, and a guess
 * here would overwrite the final occurrence's value with an earlier one's.
 */
function isFinalWidgetOccurrence(
  node: Y.Map<unknown>,
  catalog: WidgetCatalog | undefined,
  name: string,
  occurrence: number,
): boolean {
  // A24: a declared order resolves finality without a catalog, which is
  // exactly the case this function used to have to answer `false` for. A
  // self-described uncatalogued node therefore keeps `widgets_values_named`
  // coherent (A23) instead of leaving the pre-op value in it.
  const form = storedWidgetFormOf(node);
  if (form) return formFinalOccurrence(form, name, occurrence);
  if (!catalog) return false;
  const entry = catalogEntry(catalog, String(node.get("type") ?? ""));
  if (!entry) return false;
  const widgets = node.get("widgets");
  const order = widgetOrderForWidgets(entry, widgets instanceof Y.Map ? widgets : undefined);
  return widgetIndexOf(order, name, occurrence) >= 0 && widgetIndexOf(order, name, occurrence + 1) < 0;
}

/**
 * Keep the frontend's name-keyed `widgets_values_named` passthrough register
 * coherent with the write (Amendment A23).
 *
 * A22 maintained `widgets_values_ordered` and left this sibling register
 * holding the PRE-OP value, so a consumer reading values back by name restored
 * what the write replaced and reverted it. Both registers are ordinary
 * passthrough node fields — `project()` emits them verbatim — so the applier
 * has to maintain them or they go stale.
 *
 * Three gates. The first two mirror `updateOrderedWidgetValue`'s "update, never
 * invent": the register must already be stored as a name-keyed object, and it
 * must already carry this name. A register that does not hold the name is not
 * stale for it, and inventing an entry would publish a value the producer
 * deliberately omitted — including reshaping a foreign producer's array into an
 * object, which `Object.hasOwn(["x"], "0")` would otherwise allow.
 *
 * The third gate is {@link isFinalWidgetOccurrence}: one name-keyed slot cannot
 * hold two values, and the slot belongs to the FINAL occurrence, so an earlier
 * occurrence's write must leave it alone. Writing it there would replace the
 * final occurrence's value with an earlier one's — turning a stale read into a
 * corrupt one.
 *
 * The replacement is built by spread with a COMPUTED key rather than by
 * assignment, which DEFINES an own data property instead of going through a
 * setter. Measured and stated precisely, because it is easy to overclaim: with
 * the name gate above in place the two forms are equivalent today — a register
 * that owns `__proto__` as a data property shadows
 * `Object.prototype`'s accessor, so `next["__proto__"] = v` would hit the own
 * property and not the setter (a hand mutation swapping the forms kills no
 * test, by design rather than for want of coverage). The computed key is here
 * so that the prototype-pollution hazard does not reappear if the name gate is
 * ever relaxed to invent entries.
 */
function updateNamedWidgetValue(
  node: Y.Map<unknown>,
  catalog: WidgetCatalog | undefined,
  name: string,
  occurrence: number,
  value: unknown,
): void {
  const stored = node.get("widgets_values_named");
  if (typeof stored !== "object" || stored === null || Array.isArray(stored)) return;
  if (!Object.hasOwn(stored, name)) return;
  if (!isFinalWidgetOccurrence(node, catalog, name, occurrence)) return;
  const next = { ...(structuredClone(stored) as Record<string, unknown>), [name]: structuredClone(value) };
  mset(node, "widgets_values_named", next);
}

/** Keep the frontend's duplicate-only lossless serialization field coherent. */
function updateOrderedWidgetValue(
  node: Y.Map<unknown>,
  name: string,
  occurrence: number,
  value: unknown,
): void {
  const stored = node.get("widgets_values_ordered");
  if (!Array.isArray(stored)) return;
  const index = stored.findIndex((entry) =>
    typeof entry === "object" &&
    entry !== null &&
    !Array.isArray(entry) &&
    (entry as Record<string, unknown>)["name"] === name &&
    (entry as Record<string, unknown>)["occurrence"] === occurrence,
  );
  if (index < 0) return;
  const next = structuredClone(stored) as Array<Record<string, unknown>>;
  next[index] = { ...next[index], value: structuredClone(value) };
  mset(node, "widgets_values_ordered", next);
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
    case "self":
      // A24: the node declared its own order, so the named path can express
      // the write and `validateWidgetName` checks it against that declaration.
      // A promoted host write carries a `value_index` as well, and both
      // addresses resolve here, so `requirePromotedFormAgreement` refuses a
      // disagreement instead of this silently preferring one.
      return "named";
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
 * A promoted host write carries TWO addresses for one target — the widget
 * NAME and `promoted.value_index` — and on a self-described node (A24) both
 * resolve. Refuse a disagreement rather than silently preferring one.
 *
 * This is the rule `promotedHostWrite` already applies one field over, where
 * `promoted.instance_path` must join to `node_id`: a payload naming a
 * destination two ways must name the same one, or the op is `malformed_op`.
 * Preferring the name would apply a write whose author believed it was editing
 * a different slot — acknowledged, and wrong, which is strictly worse than
 * refused.
 *
 * Nothing to check when the node is not self-described: the A15 path then owns
 * the index and the name is not positionally resolvable at all.
 *
 * The verdict reads the NODE, so it sits below the delete-wins return and
 * joins the documented arrival-order-dependent rejection class (A6 /
 * `EXCEPTIONS.md` KA-4) rather than being hoisted — exactly like
 * `validateWidgetName`, whose verdict it accompanies.
 */
function requirePromotedFormAgreement(
  node: Y.Map<unknown>,
  widget: string,
  occurrence: number,
  valueIndex: number,
): void {
  const form = storedWidgetFormOf(node);
  if (!form) return;
  const declared = formIndexOf(form, widget, occurrence);
  if (declared < 0 || declared === valueIndex) return;
  const at = occurrence === 0 ? "" : ` occurrence ${String(occurrence)}`;
  throw new OpRejectedError(
    "malformed_op",
    `set_widget: promoted.value_index ${String(valueIndex)} names a different slot than widget '${widget}'${at}, which node ${String(node.get("id"))}'s widgets_values_form puts at ${String(declared)}`,
  );
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
  const resolution = resolveInteriorNode(
    doc,
    promoted.instancePath,
    catalog,
    op.node_incarnation ?? LEGACY_NODE_INCARNATION,
    false,
  );
  if (resolution === null) return "no-op"; // no live or retained canonical route
  const target = resolution.node;
  const storage = hostWriteStorage(target, catalog);
  switch (storage) {
    case "named":
      {
        const occurrence = op.widget_occurrence ?? 0;
        requirePromotedFormAgreement(target, op.widget, occurrence, promoted.valueIndex);
        validateWidgetName(catalog, String(target.get("type") ?? ""), op.widget, target, occurrence);
        mset(widgetsOf(target), widgetStorageKey(op.widget, occurrence), structuredClone(op.value));
        updateOrderedWidgetValue(target, op.widget, occurrence, op.value);
        updateNamedWidgetValue(target, catalog, op.widget, occurrence, op.value);
      }
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

function validateWidgetOp(op: SetWidgetOp) {
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
  if (op.widget_occurrence !== undefined && (!Number.isInteger(op.widget_occurrence) || op.widget_occurrence < 0)) {
    throw new OpRejectedError("malformed_op", "set_widget: widget_occurrence must be a non-negative integer");
  }
  assertWritableValue(op.value, "set_widget");
  // Op-only, like the checks above it (A6): the payload's shape is settled
  // before any document read, and a host write that also carries an interior
  // `path` names two destinations — comfy-cli never mints that.
  const promoted = promotedHostWrite(op);
  if (promoted !== null && interior !== null) {
    throw new OpRejectedError("malformed_op", "set_widget: a promoted host write carries no interior path");
  }
  return { interior, promoted };
}

function applySetWidget(doc: Y.Doc, op: SetWidgetOp, catalog?: WidgetCatalog): SuccessfulOutcome {
  const { interior, promoted } = validateWidgetOp(op);
  // Interior paths have several legal spellings (definition id and instance
  // id), but all of them can resolve to the same node. Resolve first
  // so that node owns one register rather than letting each raw alias claim a
  // separate stamp key. `writeTarget` remains the public op-only identity.
  const interiorResolution = interior === null
    ? null
    : resolveInteriorNode(
      doc,
      interior.path.map(String),
      catalog,
      op.node_incarnation ?? LEGACY_NODE_INCARNATION,
    );
  if (interior !== null && interiorResolution === null) return "no-op";

  // LWW gate next (comfy-cli `_apply_set_widget`): a lower-or-equal stamp is
  // dropped — a protocol-level apply that still consumes its op_id. It is no
  // longer literally FIRST: the op-only checks above it must precede it so
  // their verdict cannot depend on which stamp is in the document (A6).
  const stamps = stampsMap(doc);
  const targetKey = interiorResolution === null
    ? stampTargetKey(op)
    : JSON.stringify([
      "widget",
      interiorResolution.canonicalPath,
      op.node_incarnation ?? LEGACY_NODE_INCARNATION,
      interior!.inner_widget,
      ...((op.widget_occurrence ?? 0) === 0 ? [] : [op.widget_occurrence]),
    ]);
  const prior = stamps.get(targetKey) as StampKey | undefined;
  const key = stampKey(op);
  if (prior != null && compareStampKeys(key, prior) <= 0) return "lww-dropped";

  if (promoted !== null) {
    return applyPromotedHostWrite(doc, op, promoted, stamps, targetKey, key, catalog);
  }

  function applyInteriorWidget(target: Y.Map<unknown>, interior: InteriorSetWidgetOp): SuccessfulOutcome {
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
    const occurrence = op.widget_occurrence ?? 0;
    validateWidgetName(catalog, nodeType, widget, target, occurrence);
    // OWN-property lookup (#13): an inherited key such as `__proto__` must read
    // as "absent from the catalog", not resolve to a prototype object.
    const entry = catalogEntry(catalog, nodeType);
    // A24: a self-described node's projected length comes from its OWN
    // declared order, and `validateWidgetName` already held the write against
    // that order. Measuring it against the catalog's `widget_order` instead
    // would reject or admit by a layout this node does not use — and for a
    // declared node the two legitimately differ, which is the point.
    if (entry && !storedWidgetFormOf(target)) {
      const current = target.get("widgets");
      const stored = current instanceof Y.Map ? current : undefined;
      const layout = widgetLayoutForWidgets(entry, stored);
      const idx = widgetIndexOf(layout.order, widget, occurrence);
      // Interior writes never pad (comfy-cli `_write_widget` extend=False):
      // the projected positional index must already be inside the node's
      // current widgets_values length — which counts a selected option's
      // read-time defaults, since the projection shows them.
      const len = Math.max(projectedWidgetsLength(target, layout.order), projectedLength(layout, stored));
      if (idx >= len) {
        throw new OpRejectedError(
          "widget_out_of_range",
          `widget index ${idx} out of range for ${nodeType} (interior writes never pad)`,
        );
      }
    }
    mset(widgetsOf(target), widgetStorageKey(widget, occurrence), structuredClone(op.value));
    updateOrderedWidgetValue(target, widget, occurrence, op.value);
    updateNamedWidgetValue(target, catalog, widget, occurrence, op.value);
    mset(stamps, targetKey, key);
    return "applied";
  }

  if (interior !== null) return applyInteriorWidget(interiorResolution!.node, interior);
  const node = nodesMap(doc).get(String(op.node_id));
  if (!node) return "no-op"; // target concurrently deleted → no-op (delete wins)
  if (nodeIncarnation(node) !== (op.node_incarnation ?? LEGACY_NODE_INCARNATION)) return "no-op";
  rejectIfOpaqueWidgets(node, op.widget);
  const occurrence = op.widget_occurrence ?? 0;
  validateWidgetName(catalog, String(node.get("type") ?? ""), op.widget, node, occurrence);
  // Top-level writes may extend past the current positional length — comfy-cli
  // pads with None; here the name-keyed map makes padding a projection concern.
  mset(widgetsOf(node), widgetStorageKey(op.widget, occurrence), structuredClone(op.value));
  updateOrderedWidgetValue(node, op.widget, occurrence, op.value);
  updateNamedWidgetValue(node, catalog, op.widget, occurrence, op.value);
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
interface InteriorResolution {
  node: Y.Map<unknown>;
  canonicalPath: string[];
}

function interiorRouteKey(instanceId: string, incarnation: string): string {
  return JSON.stringify(["interior_route", instanceId, incarnation]);
}

function resolveInteriorNode(
  doc: Y.Doc,
  path: string[],
  catalog?: WidgetCatalog,
  incarnation = LEGACY_NODE_INCARNATION,
  allowRetainedRoute = true,
): InteriorResolution | null {
  const head = nodesMap(doc).get(path[0]!);
  function resolveMissingHead(): InteriorResolution | null {
    const directDefinition = resolveDefinition(doc, path[0]!);
    const retainedDefinitionId = allowRetainedRoute
      ? stampsMap(doc).get(interiorRouteKey(path[0]!, incarnation))
      : undefined;
    let definition: Y.Map<unknown> | null = null;
    if (directDefinition && String(directDefinition.get("id")) === path[0]) definition = directDefinition;
    else if (typeof retainedDefinitionId === "string") definition = resolveDefinition(doc, retainedDefinitionId);
    if (!definition) return null;
    const definitionId = String(definition.get("id"));
    // A retained route represents the deleted routing instance for authority
    // purposes. Otherwise delete-first could evade the shared-definition
    // guard that edit-first observes.
    const instances = countDefinitionInstances(doc, definitionId, catalog)
      + (typeof retainedDefinitionId === "string" ? 1 : 0);
    if (instances > 1) {
      throw new OpRejectedError(
        "shared_definition_unforked",
        `definition ${definitionId} is instantiated ${instances} times; interior writes to shared definitions are rejected until forking is specced (schema §5.3)`,
      );
    }
    const innerNodes = definition.get("nodes");
    const inner = innerNodes instanceof Y.Map ? innerNodes.get(path[1]!) : undefined;
    if (!(inner instanceof Y.Map)) {
      throw new OpRejectedError(
        "interior_node_not_found",
        `interior node ${path[1]} not found in subgraph ${path[0]}`,
      );
    }
    const canonicalPath = [definitionId, path[1]!];
    if (path.length === 2) return { node: inner, canonicalPath };
    return resolveInteriorDescendants(doc, inner, path.slice(2), canonicalPath, catalog);
  }
  if (!head) return resolveMissingHead();
  const definition = resolveDefinition(doc, String(head.get("type") ?? ""));
  const canonicalPath = definition === null
    ? [path[0]!]
    : [String(definition.get("id") ?? head.get("type"))];
  if (path.length === 1) return { node: head, canonicalPath };
  return resolveInteriorDescendants(doc, head, path.slice(1), canonicalPath, catalog);
}

function resolveInteriorDescendants(
  doc: Y.Doc,
  head: Y.Map<unknown>,
  path: string[],
  canonicalPath: string[],
  catalog?: WidgetCatalog,
): InteriorResolution {
  let cur: Y.Map<unknown> = head;
  for (const seg of path) {
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
    // Identity is the final owning definition and node, not the route used to
    // reach it. This aliases [outerDef, nestedInstance, leaf] with
    // [innerDef, leaf] while keeping equal leaf IDs in other definitions apart.
    canonicalPath.splice(0, canonicalPath.length, defId, seg);
  }
  return { node: cur, canonicalPath };
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

  validateGrowPayload(op);
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

function validateGrowPayload(op: ConnectOp): void {
  if (op.grow?.inputcount != null) {
    if (typeof op.grow.inputcount.widget !== "string") {
      throw new OpRejectedError("malformed_op", "connect: grow.inputcount needs a widget name");
    }
    assertWritableValue(op.grow.inputcount.value, "connect: grow.inputcount");
  }
  if (op.grow != null && (typeof op.grow.name !== "string" || typeof op.grow.type !== "string")) {
    throw new OpRejectedError("malformed_op", "connect: grow payload needs name and type");
  }
}

interface InteriorGraphScope {
  nodes: Y.Map<Y.Map<unknown>>;
  links: Y.Map<unknown>;
  definition: Y.Map<unknown>;
}

function resolveVisibleInteriorHost(
  doc: Y.Doc,
  nodeKey: string,
  routeIncarnation: string,
  requireMatchingIncarnation: boolean,
): Y.Map<unknown> | undefined {
  const host = nodesMap(doc).get(nodeKey);
  if (!(host instanceof Y.Map)) return undefined;
  if (requireMatchingIncarnation && nodeIncarnation(host) !== routeIncarnation) return undefined;
  return host;
}

/** Resolve the definition owned by an instance route for an interior graph edit. */
function resolveInteriorGraphScope(
  doc: Y.Doc,
  op: Pick<ConnectOp | AddNodeOp, "path" | "node_incarnation">,
  catalog?: WidgetCatalog,
  operation = "connect",
  rejectMissingHead = false,
  requireMatchingHeadIncarnation = false,
): InteriorGraphScope | null {
  if (!op.path || op.path.length === 0) return null;
  const path = op.path.map(String);
  const routeIncarnation = op.node_incarnation ?? LEGACY_NODE_INCARNATION;
  let host = resolveVisibleInteriorHost(doc, path[0]!, routeIncarnation, requireMatchingHeadIncarnation);
  if (!(host instanceof Y.Map)) {
    // Connect accepts instance routes only. A missing head must have been a
    // real instance in this incarnation; unlike set_widget, a definition id
    // is never a direct addressing alias for this operation.
    const retainedDefinitionId = stampsMap(doc).get(interiorRouteKey(
      path[0]!,
      routeIncarnation,
    ));
    if (typeof retainedDefinitionId !== "string") return missingInteriorHead(operation, path[0]!, rejectMissingHead);
    const retainedDefinition = resolveDefinition(doc, retainedDefinitionId);
    if (!retainedDefinition) return missingInteriorHead(operation, path[0]!, rejectMissingHead);
    const retainedId = String(retainedDefinition.get("id") ?? retainedDefinitionId);
    const retainedInstances = countDefinitionInstances(doc, retainedId, catalog) + 1;
    rejectSharedInteriorDefinition(retainedId, retainedInstances);
    if (path.length === 1) return interiorConnectScope(retainedDefinition, retainedId);
    const retainedNodes = retainedDefinition.get("nodes");
    host = retainedNodes instanceof Y.Map ? retainedNodes.get(path[1]!) : undefined;
    if (!(host instanceof Y.Map)) {
      throw new OpRejectedError(
        "interior_node_not_found",
        `interior node ${path[1]} not found in subgraph ${retainedId}`,
      );
    }
    path.splice(0, 2);
  } else {
    path.shift();
  }

  for (const segment of path) host = descendInteriorHost(doc, host, segment, catalog);
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
  rejectSharedInteriorDefinition(definitionId, instances);
  return interiorConnectScope(definition, definitionId);
}

function missingInteriorHead(operation: string, head: string, reject: boolean): null {
  if (!reject) return null;
  throw new OpRejectedError(
    "interior_container_not_found",
    `${operation}: interior container ${head} not found`,
  );
}

function descendInteriorHost(
  doc: Y.Doc,
  host: Y.Map<unknown>,
  segment: string,
  catalog?: WidgetCatalog,
): Y.Map<unknown> {
  const ownerType = String(host.get("type") ?? "");
  const owner = resolveDefinition(doc, ownerType);
  if (!owner) {
    throw new OpRejectedError(
      "not_a_subgraph",
      `node ${String(host.get("id"))} is not a subgraph; cannot descend to '${segment}'`,
    );
  }
  const ownerId = String(owner.get("id") ?? ownerType);
  rejectSharedInteriorDefinition(ownerId, countDefinitionInstances(doc, ownerId, catalog));
  const innerNodes = owner.get("nodes");
  const inner = innerNodes instanceof Y.Map ? innerNodes.get(segment) : undefined;
  if (!(inner instanceof Y.Map)) {
    throw new OpRejectedError(
      "interior_node_not_found",
      `interior node ${segment} not found in subgraph ${ownerId}`,
    );
  }
  return inner;
}

function rejectSharedInteriorDefinition(definitionId: string, instances: number): void {
  if (instances <= 1) return;
  throw new OpRejectedError(
    "shared_definition_unforked",
    `definition ${definitionId} is instantiated ${instances} times; interior writes to shared definitions are rejected until forking is specced (schema §5.3)`,
  );
}

function interiorConnectScope(definition: Y.Map<unknown>, definitionId: string): InteriorGraphScope {
  const nodes = definition.get("nodes");
  const links = definition.get("links");
  if (!(nodes instanceof Y.Map) || !(links instanceof Y.Map)) {
    throw new OpRejectedError("malformed_op", `subgraph definition ${definitionId} has malformed graph storage`);
  }
  return { nodes: nodes as Y.Map<Y.Map<unknown>>, links, definition };
}

function applyInteriorConnect(doc: Y.Doc, op: ConnectOp, scope: InteriorGraphScope): SuccessfulOutcome {
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
  recordInteriorLinkOrder(scope.definition, stamps, linkKey, key);
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

function recordInteriorLinkOrder(definition: Y.Map<unknown>, stamps: Y.Map<unknown>, linkKey: string, key: StampKey): void {
  const linkOrder = definition.get("link_order");
  const orderedIds: unknown[] = Array.isArray(linkOrder) ? [...linkOrder] : [];
  const definitionId = String(definition.get("id") ?? "");
  const orderStampKey = (candidate: string) =>
    JSON.stringify(["interior_link_order", definitionId, candidate]);
  const additions: Record<string, StampKey> = Object.create(null) as Record<string, StampKey>;
  for (const candidate of orderedIds.map(String)) {
    const addedStamp = stamps.get(orderStampKey(candidate));
    if (Array.isArray(addedStamp)) additions[candidate] = addedStamp as StampKey;
  }
  const wasAdded = Object.hasOwn(additions, linkKey);
  const wasPresent = orderedIds.some((candidate) => String(candidate) === linkKey);
  const nextOrder = addInteriorLinkOrder(orderedIds, linkKey, key, additions);
  if (!wasPresent || wasAdded) {
    mset(stamps, orderStampKey(linkKey), key);
  }
  if (nextOrder.some((candidate, index) => candidate !== orderedIds[index]) || nextOrder.length !== orderedIds.length) {
    mset(definition, "link_order", nextOrder);
  }
}

function recordInteriorNodeOrder(definition: Y.Map<unknown>, stamps: Y.Map<unknown>, nodeKey: string, key: StampKey): void {
  const nodeOrder = definition.get("node_order");
  const orderedIds: unknown[] = Array.isArray(nodeOrder) ? [...nodeOrder] : [];
  const definitionId = String(definition.get("id") ?? "");
  const orderStampKey = (candidate: string) =>
    JSON.stringify(["interior_node_order", definitionId, candidate]);
  const additions: Record<string, StampKey> = Object.create(null) as Record<string, StampKey>;
  for (const candidate of orderedIds.map(String)) {
    const addedStamp = stamps.get(orderStampKey(candidate));
    if (Array.isArray(addedStamp)) additions[candidate] = addedStamp as StampKey;
  }
  const wasAdded = Object.hasOwn(additions, nodeKey);
  const wasPresent = orderedIds.some((candidate) => String(candidate) === nodeKey);
  const nextOrder = addInteriorLinkOrder(orderedIds, nodeKey, key, additions);
  if (!wasPresent || wasAdded) mset(stamps, orderStampKey(nodeKey), key);
  if (nextOrder.some((candidate, index) => candidate !== orderedIds[index]) || nextOrder.length !== orderedIds.length) {
    mset(definition, "node_order", nextOrder);
  }
}

function reconcileInteriorNodeLinkRefs(
  scope: InteriorGraphScope,
  nodeId: unknown,
  node: Y.Map<unknown>,
): void {
  const id = String(nodeId);
  const inbound = new Map<number, unknown>();
  const outbound = new Map<number, unknown[]>();
  scope.links.forEach((raw: unknown) => {
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return;
    const link = raw as Record<string, unknown>;
    if (String(link.origin_id) === id && typeof link.origin_slot === "number") {
      const port = outbound.get(link.origin_slot) ?? [];
      port.push(link.id);
      outbound.set(link.origin_slot, port);
    }
    if (String(link.target_id) === id && typeof link.target_slot === "number") {
      inbound.set(link.target_slot, link.id);
    }
  });

  const inputs = node.get("inputs");
  if (inputs instanceof Y.Array) {
    inputs.forEach((slot: unknown, index: number) => {
      if (slot instanceof Y.Map) mset(slot, "link", inbound.get(index) ?? null);
    });
  }
  const outputs = node.get("outputs");
  if (outputs instanceof Y.Array) {
    outputs.forEach((slot: unknown, index: number) => {
      if (!(slot instanceof Y.Map)) return;
      const links = new Y.Array<unknown>();
      links.push(outbound.get(index) ?? []);
      mset(slot, "links", links);
    });
  }
}

function applyConnect(doc: Y.Doc, op: ConnectOp, catalog?: WidgetCatalog): SuccessfulOutcome {
  // OP-ONLY validation first, before ANY document read decides the outcome
  // (KA-4, Amendment A6).
  requireOpOnlyValid(op);

  if (op.path && op.path.length > 0) {
    const scope = resolveInteriorGraphScope(doc, op, catalog);
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
  // op-only set above they cannot move any earlier. The widget's type is
  // settled HERE too, not coerced: `String(["inputcount"])` names a real
  // widget, and a guard left to the bump would fire only after
  // `growInputSlot` had written the slot and the grow ledgers (KA-4). The
  // validated name is what the bump writes.
  let count: InputcountWrite | null = null;
  if (op.grow?.inputcount != null) {
    const widget: unknown = op.grow.inputcount.widget;
    if (typeof widget !== "string") {
      throw new OpRejectedError("malformed_op", "connect: grow.inputcount needs a widget name");
    }
    rejectIfOpaqueWidgets(dst, widget);
    validateWidgetName(catalog, String(dst.get("type") ?? ""), widget, dst);
    assertWritableValue(op.grow.inputcount.value, "connect: grow.inputcount");
    count = { widget, value: op.grow.inputcount.value };
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

  function claimDestination(dst: Y.Map<unknown>): number | "lww-dropped" | "no-op" {
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
      return claimed;
    }
    if (op.grow != null) {
      // Autogrow is NOT a shared register: every grow mints its own slot keyed by
      // `grow_id`, so two concurrent grows onto one base both survive and there
      // is nothing to gate (vocabulary §1.2 / amendment v1.2's carve-out).
      if (!claimLinkIdentity(doc, op)) return "lww-dropped";
      if (!src) return "no-op"; // source concurrently deleted → no-op (delete wins)
      return growInputSlot(doc, dst, op, count, catalog);
    }
    // `to_slot`'s type was settled by `requireOpOnlyValid`.
    const toIdx = op.to_slot as number;
    if (!claimConcreteInput(dst, toIdx)) return "lww-dropped";
    return toIdx;
  }

  function claimConcreteInput(dst: Y.Map<unknown>, toIdx: number): boolean {
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

    if (!claimLinkIdentity(doc, op)) return false;

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
    if (prior != null && compareStampKeys(key, prior) <= 0) return false;

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
    return true;
  }

  const toIdx = claimDestination(dst);
  if (typeof toIdx !== "number") return toIdx;
  // Source concurrently deleted → the winning connect leaves the input EMPTY
  // (delete wins over the link, not over the register claim).
  if (!src || !sourceOutputs) return "no-op";
  return installConnect(doc, op, dst, sourceOutputs, toIdx);
}

function installConnect(doc: Y.Doc, op: ConnectOp, dst: Y.Map<unknown>, outs: Y.Array<unknown>, toIdx: number): SuccessfulOutcome {
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
  const tuple = links.get(linkKey) as LinkTuple;
  const destination = operationLinkDestination(ins.get(toIdx)!, toIdx, op);
  const state: OperationLinkState = {
    version: LINK_STATE_DESCRIPTOR_VERSION,
    authority: { kind: "operation", stamp: stampKey(op) },
    tuple: structuredClone(tuple),
    destination,
  };
  mset(linkStateMap(doc), linkKey, state);
  return "applied";
}

/** Capture the destination that was actually installed, without reclassifying it as an import. */
function operationLinkDestination(
  slot: Y.Map<unknown>,
  toSlot: number,
  op: ConnectOp,
): OperationLinkDestination {
  const slotRecord = slot.toJSON() as Record<string, unknown>;
  if (op.grow?.promoted === true) {
    return { kind: "promoted", to_slot: toSlot, name: op.grow.name, slot: slotRecord };
  }
  if (op.grow != null) {
    return {
      kind: "autogrow",
      to_slot: toSlot,
      slot: slotRecord,
      request: structuredClone(op.grow),
    };
  }
  return { kind: "concrete", to_slot: toSlot, slot: slotRecord };
}

/** Claim the normalized complete-tuple link register (schema Amendment A18). */
function claimLinkIdentity(doc: Y.Doc, op: ConnectOp, scope?: InteriorGraphScope): boolean {
  const stamps = stampsMap(doc);
  const normalizedId = String(op.link_id);
  const targetKey = JSON.stringify(["link", ...(scope && op.path ? [op.path.map(String)] : []), normalizedId]);
  const prior = stamps.get(targetKey) as StampKey | undefined;
  const key = stampKey(op);
  if (prior != null && compareStampKeys(key, prior) <= 0) return false;

  const links = scope?.links ?? linksMap(doc);
  if (links.has(normalizedId)) mdel(links, normalizedId);
  if (scope) {
    scrubNodeLinkRefs(scope.nodes, (candidate) => candidate != null && String(candidate) === normalizedId);
  } else {
    scrubLinkRefs(doc, (candidate) => candidate != null && String(candidate) === normalizedId);
    // This connect generation now owns the top-level normalized identity.
    // Interior links belong to a separate scope and cannot retire its intent.
    const linkState = linkStateMap(doc);
    if (linkState.has(normalizedId)) mdel(linkState, normalizedId);
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
  count: InputcountWrite | null,
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

  if (count !== null) {
    applyInputcountBump(doc, dst, op, count);
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
    let name: string;
    if (isInputcount) name = nextInputcountName(inputs, requested, occupied);
    else name = nextAutogrowName(inputs, requested, widget ? null : (templates?.[family] ?? null), occupied);
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

      // This is the same canonical move as the tuple/slot rewrite above, so
      // keep an already-installed generation's durable description in that
      // move. The currently applying generation is described by applyConnect
      // after this function returns; only earlier generations exist here.
      const state = linkStateMap(doc).get(String(linkId));
      if (typeof state === "object" && state !== null && !Array.isArray(state)) {
        const descriptor = state as OperationLinkState;
        mset(linkStateMap(doc), String(linkId), {
          ...structuredClone(descriptor),
          tuple: structuredClone(updated) as LinkTuple,
          destination: {
            ...structuredClone(descriptor.destination),
            to_slot: positions[rank]!,
            slot: structuredClone(desired),
          },
        });
      }
    }
  });
  const wantedRank = snapshots.findIndex(
    (snapshot) => String(snapshot["grow_id"]) === String(currentGrowId),
  );
  return wantedRank >= 0 ? positions[wantedRank]! : appendedIndex;
}

/** A `grow.inputcount` whose widget name `applyConnect` validated before any write. */
interface InputcountWrite {
  widget: string;
  value: unknown;
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
  ic: InputcountWrite,
): void {
  const stamps = stampsMap(doc);
  if (nodeIncarnation(dst) !== (op.node_incarnation ?? LEGACY_NODE_INCARNATION)) return;
  const targetKey = widgetTargetKey(op.to_node, op.node_incarnation ?? LEGACY_NODE_INCARNATION, ic.widget);
  const prior = stamps.get(targetKey) as StampKey | undefined;
  const key = stampKey(op);
  if (prior != null && compareStampKeys(key, prior) <= 0) return; // lww-dropped
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
  let n = /^\d+$/.test(nStr) ? parseInt(nStr, 10) : 1;
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
  const linkState = linkStateMap(doc);
  if (linkState.has(key)) mdel(linkState, key);
}

function removeLinkInScope(scope: InteriorGraphScope, linkId: unknown): void {
  const key = String(linkId);
  if (scope.links.has(key)) mdel(scope.links, key);
  scrubNodeLinkRefs(scope.nodes, (candidate) => candidate != null && String(candidate) === key);
  const linkOrder = scope.definition.get("link_order");
  if (Array.isArray(linkOrder)) {
    mset(scope.definition, "link_order", removeInteriorLinkOrder(linkOrder, key));
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
// ---------------------------------------------------------------------------
// set_node_field
// ---------------------------------------------------------------------------

/**
 * VALIDATE BEFORE MUTATE: the field allowlist, the node id and the value's
 * encodability are all op-only checks and all precede the first write, so a
 * rejected op leaves the document byte-identical.
 */
function validateSetNodeField(op: SetNodeFieldOp): void {
  if (op.node_id === undefined) {
    throw new OpRejectedError("malformed_op", "set_node_field: missing node_id");
  }
  if (!(WRITABLE_NODE_FIELDS as readonly string[]).includes(op.field)) {
    throw new OpRejectedError(
      "malformed_op",
      `set_node_field: '${String(op.field)}' is not a writable field; expected one of ${WRITABLE_NODE_FIELDS.join(", ")}`,
    );
  }
  if (op.node_incarnation !== undefined && (typeof op.node_incarnation !== "string" || op.node_incarnation.length === 0)) {
    throw new OpRejectedError("malformed_op", "set_node_field: node_incarnation must be a non-empty string");
  }
  validateSetNodeFieldValue(op);
}

function validateSetNodeFieldValue(op: SetNodeFieldOp): void {
  if (op.value === null) return;
  switch (op.field) {
    case "title":
      if (typeof op.value !== "string") {
        throw new OpRejectedError("malformed_op", "set_node_field: title must be a string or null");
      }
      break;
    case "mode":
      if (!Number.isInteger(op.value) || op.value < 0) {
        throw new OpRejectedError("malformed_op", "set_node_field: mode must be a non-negative integer or null");
      }
      break;
    case "flags.collapsed":
    case "flags.pinned":
      if (typeof op.value !== "boolean") {
        throw new OpRejectedError("malformed_op", `set_node_field: ${op.field} must be a boolean or null`);
      }
      break;
    default:
      assertNever(op, "applier.validateSetNodeFieldValue");
  }
}

function applySetNodeField(doc: Y.Doc, op: SetNodeFieldOp): SuccessfulOutcome {
  validateSetNodeField(op);

  const stamps = stampsMap(doc);
  const targetKey = stampTargetKey(op);
  const prior = stamps.get(targetKey) as StampKey | undefined;
  const stamp = stampKey(op);
  if (prior != null && compareStampKeys(stamp, prior) <= 0) return "lww-dropped";

  const node = nodesMap(doc).get(String(op.node_id));
  // Delete-wins: the target is gone, so the write is a silent no-op that
  // still consumes its op_id.
  if (!(node instanceof Y.Map)) return "no-op";
  if (nodeIncarnation(node) !== (op.node_incarnation ?? LEGACY_NODE_INCARNATION)) return "no-op";

  const [head, leaf] = op.field.split(".");
  if (leaf === undefined) {
    writeNodeField(node, head!, op.value);
  } else {
    // `createNodeMap` stores `flags` as a nested Y.Map, but a node minted
    // without flags has no such key at all.
    const nested = node.get(head!);
    const flags = nested instanceof Y.Map ? nested : new Y.Map<unknown>();
    if (!(nested instanceof Y.Map)) mset(node, head!, flags);
    writeNodeField(flags, leaf, op.value);
  }
  mset(stamps, targetKey, stamp);
  return "applied";
}

/** `null` clears the key so the field round-trips as absent in workflow JSON. */
function writeNodeField(target: Y.Map<unknown>, key: string, value: unknown): void {
  if (value === null) mdel(target, key);
  else mset(target, key, value);
}

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
  function deletePresence(): void {
    const node = nodes.get(key);
    if (node instanceof Y.Map) {
      const definition = resolveDefinition(doc, String(node.get("type") ?? ""));
      if (definition) {
        mset(
          stamps,
          interiorRouteKey(key, nodeIncarnation(node)),
          String(definition.get("id")),
        );
      }
    }
    mset(stamps, targetKey, stamp);
    if (nodes.has(key)) mdel(nodes, key); // absent target → no-op-with-cleanup (delete wins)
  }
  if (presenceWon) deletePresence();

  const links = linksMap(doc);
  const removed = new Set<unknown>(removedLinks);
  const removedIds = new Set([...removed].map(String));
  const toDelete: Array<{ key: string; retire: boolean }> = [];
  links.forEach((ln: unknown, k: string) => {
    const tuple = ln as unknown[];
    if (removed.has(tuple[0])) {
      toDelete.push({ key: k, retire: true });
      return;
    }
    if (!presenceWon) return;
    if (String(tuple[1]) === key || String(tuple[3]) === key) toDelete.push({ key: k, retire: false });
  });
  for (const entry of toDelete) {
    mdel(links, entry.key);
    if (entry.retire && linkStateMap(doc).has(entry.key)) mdel(linkStateMap(doc), entry.key);
  }
  // An earlier endpoint deletion can already have removed the live tuple. The
  // explicit target list still retires that stranded intent.
  const retiredStranded = retireStrandedLinks(doc, removedIds);

  scrubDanglingLinkRefs(doc);
  if (!presenceWon && toDelete.length === 0 && !retiredStranded) return "lww-dropped";
  return nodeWasPresent || toDelete.length > 0 || retiredStranded ? "applied" : "no-op";
}

function retireStrandedLinks(doc: Y.Doc, removedIds: Set<string>): boolean {
  let retiredStranded = false;
  for (const [linkKey, raw] of linkStateMap(doc).entries()) {
    if (typeof raw !== "object" || raw === null) continue;
    const tuple = (raw as OperationLinkState | ImportedLinkState).tuple;
    if (Array.isArray(tuple) && removedIds.has(String(tuple[0]))) {
      mdel(linkStateMap(doc), linkKey);
      retiredStranded = true;
    }
  }
  return retiredStranded;
}

/**
 * Reinstall coherent live topology from retained first-class descriptors after
 * an endpoint is re-added. Endpoint deletion strands intent but does not
 * retire it; explicit disconnect/replacement/delete removed_links do.
 * Descriptors are retained indefinitely, including across compaction, until
 * one of those semantic retirement operations wins.
 */
function restoreDurableLinks(doc: Y.Doc, nodeId: unknown): void {
  const restoredEndpoint = String(nodeId);
  const nodes = nodesMap(doc);
  linkStateMap(doc).forEach((raw, linkKey) => {
    if (typeof raw !== "object" || raw === null) return;
    const state = raw as OperationLinkState;
    const tuple = state.tuple;
    if (!Array.isArray(tuple) || tuple.length !== 6) return;
    if (String(tuple[1]) !== restoredEndpoint && String(tuple[3]) !== restoredEndpoint) return;
    const src = nodes.get(String(tuple[1]));
    const dst = nodes.get(String(tuple[3]));
    if (!src || !dst) return;

    const outs = src.get("outputs");
    if (!(outs instanceof Y.Array) || !(outs.get(tuple[2]) instanceof Y.Map)) return;
    const slot = restoreDestinationInput(dst, state);
    if (slot === null) return;
    const incumbent = slot.get("link");
    if (incumbent != null && String(incumbent) !== String(tuple[0])) return;

    const links = linksMap(doc);
    if (!links.has(linkKey)) mset(links, linkKey, structuredClone(tuple));
    mset(slot, "link", tuple[0]);
    const outPort = outs.get(tuple[2]) as Y.Map<unknown>;
    let outLinks = outPort.get("links");
    if (!(outLinks instanceof Y.Array)) {
      outLinks = new Y.Array<unknown>();
      mset(outPort, "links", outLinks);
    }
    if (!(outLinks as Y.Array<unknown>).toArray().some(value => String(value) === String(tuple[0]))) {
      apush(outLinks as Y.Array<unknown>, tuple[0]);
    }
  });
}

function restoreDestinationInput(dst: Y.Map<unknown>, state: OperationLinkState): Y.Map<unknown> | null {
  let ins = dst.get("inputs");
  if (!(ins instanceof Y.Array)) {
    ins = new Y.Array<unknown>();
    mset(dst, "inputs", ins);
  }
  const inputArray = ins as Y.Array<unknown>;
  const destination = state.destination;
  if (!destination || typeof destination.to_slot !== "number") return null;
  while (inputArray.length <= destination.to_slot) {
    const slotIndex = inputArray.length;
    if (slotIndex !== destination.to_slot) return null;
    const slot = new Y.Map<unknown>();
    for (const [key, value] of Object.entries(destination.slot)) slot.set(key, structuredClone(value));
    inputArray.insert(slotIndex, [slot]);
  }
  const slot = inputArray.get(destination.to_slot);
  return slot instanceof Y.Map ? slot : null;
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
  if (!dst) return retireStrandedLink(doc, op) ? "applied" : "no-op";

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
  if (prev == null && retireStrandedLink(doc, op)) return "applied";
  const stamps = stampsMap(doc);
  const targetKey = disconnectTargetKey(doc, op, prev);
  const prior = stamps.get(targetKey) as StampKey | undefined;
  const key = stampKey(op);
  if (prior != null && compareStampKeys(key, prior) <= 0) return "lww-dropped";

  mset(stamps, targetKey, key);
  if (prev != null) removeLink(doc, prev);
  return prev != null ? "applied" : "no-op";
}

/** A disconnect addresses the durable destination register that created the occupied slot. */
function disconnectTargetKey(doc: Y.Doc, op: DisconnectOp, linkId: unknown): string {
  const raw = linkId == null ? undefined : linkStateMap(doc).get(String(linkId));
  if (typeof raw === "object" && raw !== null) {
    const destination = (raw as OperationLinkState).destination;
    if (destination?.kind === "promoted") {
      return JSON.stringify(["input", String(op.to_node), "grow", destination.name]);
    }
    if (destination?.kind === "autogrow" && "request" in destination) {
      return JSON.stringify(["input", String(op.to_node), "grow", destination.request.name.split(".", 1)[0]]);
    }
  }
  return stampTargetKey(op);
}

/** Retire retained intent even when its destination endpoint is currently absent. */
function retireStrandedLink(doc: Y.Doc, op: DisconnectOp): boolean {
  // Disconnect addresses a destination register; link_id is advisory and may
  // mismatch the occupant under the established live-slot semantics.
  let match: { key: string; state: OperationLinkState | ImportedLinkState } | undefined;
  for (const [key, raw] of linkStateMap(doc).entries()) {
    if (typeof raw !== "object" || raw === null) continue;
    const state = raw as OperationLinkState | ImportedLinkState;
    if (!Array.isArray(state.tuple) || !state.destination) continue;
    if (String(state.tuple[3]) === String(op.to_node) && state.destination.to_slot === op.to_slot) {
      match = { key, state };
      break;
    }
  }
  if (match === undefined) return false;
  const targetKey = disconnectTargetKey(doc, op, match.state.tuple[0]);
  const stamps = stampsMap(doc);
  const prior = stamps.get(targetKey) as StampKey | undefined;
  const stamp = stampKey(op);
  if (prior != null && compareStampKeys(stamp, prior) <= 0) return false;
  mset(stamps, targetKey, stamp);
  mdel(linkStateMap(doc), match.key);
  return true;
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
  if (applied) return "applied";
  return dropped ? "lww-dropped" : "no-op";
}
