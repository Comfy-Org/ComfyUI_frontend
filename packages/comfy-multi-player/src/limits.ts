/**
 * Issue #14 — the payload budget for untrusted ops.
 *
 * `applyOps` accepts ops from an untrusted producer (the agent), and before
 * this gate the cost of PROCESSING an op was unbounded even when the op was
 * ultimately rejected. Amendment A8 already bounds depth while canonicalizing
 * the whole envelope; this companion budget bounds breadth and total size in
 * that same pre-idempotency canonicalization path, before any clone or write.
 *
 * The budget is deliberately approximate — it mirrors the SHAPE of yjs's
 * `writeAny` cost (strings by length, binary by byteLength, containers by
 * entry count and key length) without promising encoded-byte accuracy. The
 * constants are orders of magnitude above any workflow op comfy-cli mints
 * (a `set_widget` is tens of units; a full `add_node` payload is hundreds),
 * so a refusal is always an attack or a bug, never a working producer.
 *
 * What this gate deliberately does NOT own:
 *
 *  - reference cycles. A back-edge is skipped here; A8's canonicalizer owns
 *    the refusal and preserves its `payload_too_deep` rejection code.
 *  - storability. A `Date`, a function, a boxed primitive each cost a few
 *    units here and are then refused (or accepted) by the storability gates,
 *    which own that boundary.
 *
 * This budget covers inert decoded wire data and trusted in-process values.
 * Every visited value adds at least 1 unit, so repeated shared references
 * (billion-laughs) consume the budget too. The bound assumes enumeration,
 * iteration, and property access terminate: a caller-created getter, Proxy,
 * or custom iterator can execute arbitrary code before the next budget check.
 * This function is not an execution sandbox. Hosts must decode untrusted
 * wire bytes before calling the package; copying an arbitrary JavaScript
 * object here cannot guarantee trap-free traversal. Bound wire bytes before
 * JSON.parse without a reviver; parsing/allocation costs belong to the host.
 * structuredClone reads getters and JSON.stringify can invoke toJSON, so
 * neither sanitizes an arbitrary caller-controlled object without executing it.
 */
/** Ops per `applyOps` batch. Checked before ANY op is processed (#14). */
export const MAX_OPS_PER_BATCH = 1024;

/**
 * Deepest object/array nesting an op payload may carry. The frozen vocabulary
 * bottoms out around four levels (`op.node.inputs[i].widget.name`); this is a
 * bound on untrusted input, not a modelling limit. Without it a hostile
 * payload turns the canonicalizer into a stack-exhaustion `RangeError` (#14).
 */
export const MAX_PAYLOAD_DEPTH = 64;

/** Entries in any single array (length) or object (own enumerable keys). */
export const MAX_COLLECTION_ENTRIES = 4096;

/**
 * Total approximate cost units per op: string chars + binary bytes + 8 per
 * numeric/leaf + 4 per container + key lengths + 1 per visited value.
 * 262144 (256 Ki units) is roughly a 256 KiB op — orders of magnitude above
 * any minted op, and small enough that a hostile batch of 1024 maximal ops
 * is still bounded work.
 */
export const MAX_OP_COST = 262_144;

/**
 * BE-17528 — the exclusive upper bound on an overflow slot's index
 * (`_extra_<n>`, BE-9176), and therefore on the length of the
 * `widgets_values` array a projection will allocate.
 *
 * Unlike every other bound in this file, this one guards a value that arrives
 * in the caller's DOCUMENT rather than in an op, so `opBoundsRefusal` never
 * sees it. `widgetsToPositional` allocates through the highest index a stored
 * widget name encodes, and that index was attacker-chosen and unbounded: a
 * 216-byte Yjs snapshot carrying one widget named `_extra_1000000` projected a
 * 1,000,001-element array, needing no privileged write (measured; the doc-host
 * review that found it reproduced the same shape end to end through `/project`
 * at roughly 400-550 bytes).
 *
 * ABSOLUTE, not relative to the node's `widget_order`, and that is the load-
 * bearing property rather than a simplification. A dynamic-combo order expands
 * and contracts with the node's own selector value, so a bound of the form
 * `order.length + N` MOVES when an ordinary `set_widget` changes the selection.
 * Measured on the first version of this guard: a node minted with
 * `_extra_4097` under a two-name expanded order projected fine, and one applied
 * selector write shrank the order to one name, dropped the bound to 4097, and
 * left the document permanently unprojectable — exactly the mint-then-refuse
 * failure this bound exists to avoid, now caused by the bound itself. An
 * absolute cap cannot be moved by any document write, so mint and projection
 * agree for the life of the document.
 *
 * Equal to {@link MAX_COLLECTION_ENTRIES} ON PURPOSE: an op payload's
 * `widgets_values` array is already capped at that many entries, so the widest
 * overrun any op can carry names `_extra_<MAX_COLLECTION_ENTRIES - 1>` and
 * stays inside the cap. It is the tightest absolute value that cannot refuse an
 * overrun this package would itself mint from an op.
 *
 * The one case it does refuse is a class whose `widget_order` is itself longer
 * than this cap. Such a class has no reachable overflow region: its
 * `widgets_values` already exceeds the op-payload array cap, so no op can write
 * it, and no `_extra_<n>` name below the cap can sit past the end of its order.
 *
 * A HOST may choose a stricter bound of its own (`cloud`'s doc-host uses 1024
 * in `catalogpins.ts`, measured against the current order) — this is the
 * package-level floor under every caller, not a replacement for it.
 */
export const MAX_OVERFLOW_WIDGETS = MAX_COLLECTION_ENTRIES;

type Frame =
  | { readonly kind: "enter"; readonly value: unknown; readonly depth: number }
  | { readonly kind: "leave"; readonly container: object };

/** Charge one value and queue its children in the original traversal order. */
function queuePayloadChildren(value: unknown, depth: number, onPath: Set<object>, stack: Frame[], cost: number): { cost: number } | { refusal: string } {
  if (typeof value === "string") return { cost: cost + value.length };
  if (typeof value !== "object" || value === null) return { cost: cost + 8 };
  // Back-edge: termination handled, refusal deferred to A8 canonicalization.
  if (onPath.has(value)) return { cost };
  if (ArrayBuffer.isView(value)) return { cost: cost + value.byteLength };
  if (value instanceof ArrayBuffer) return { cost: cost + value.byteLength };
  if (Array.isArray(value)) {
    if (value.length > MAX_COLLECTION_ENTRIES) {
      return { refusal: `an array of ${value.length} entries exceeds the ${MAX_COLLECTION_ENTRIES}-entry limit (#14)` };
    }
    onPath.add(value);
    stack.push({ kind: "leave", container: value });
    for (const item of value) stack.push({ kind: "enter", value: item, depth: depth + 1 });
    return { cost: cost + 4 };
  }
  // Any other object is walked as a bag of its own enumerable keys —
  // the same shape `structuredClone` and `writeAny` would traverse.
  const keys = Object.keys(value);
  if (keys.length > MAX_COLLECTION_ENTRIES) {
    return { refusal: `an object of ${keys.length} keys exceeds the ${MAX_COLLECTION_ENTRIES}-entry limit (#14)` };
  }
  cost += 4;
  onPath.add(value);
  stack.push({ kind: "leave", container: value });
  for (const key of keys) {
    cost += key.length;
    stack.push({ kind: "enter", value: (value as Record<string, unknown>)[key], depth: depth + 1 });
  }
  return { cost };
}

/**
 * Why an op exceeds the untrusted-payload budget, or `null` to accept it.
 * Iterative (no recursion on hostile depth), cycle-tolerant (back-edges are
 * skipped and left to A8's canonicalizer). The budget limits visited payload
 * values, not time spent executing caller-defined accessors or enumerating
 * an object's keys. Called by A8's canonicalizer on the whole op object, so
 * envelope fields are inside the budget too. Depth and cycles remain
 * canonicalizer-owned.
 */
export function opBoundsRefusal(op: unknown): string | null {
  let cost = 0;
  const onPath = new Set<object>();
  const stack: Frame[] = [{ kind: "enter", value: op, depth: 0 }];

  while (stack.length > 0) {
    const frame = stack.pop()!;
    if (frame.kind === "leave") {
      onPath.delete(frame.container);
      continue;
    }
    const { value, depth } = frame;
    if (depth > MAX_PAYLOAD_DEPTH) {
      return `op payload nests deeper than ${MAX_PAYLOAD_DEPTH} levels`;
    }
    cost += 1; // every visit costs ≥1 → the walk is bounded by MAX_OP_COST

    const visit = queuePayloadChildren(value, depth, onPath, stack, cost);
    if ("refusal" in visit) return visit.refusal;
    cost = visit.cost;

    if (cost > MAX_OP_COST) {
      return `payload exceeds the ${MAX_OP_COST}-unit cost budget (#14)`;
    }
  }
  return null;
}
