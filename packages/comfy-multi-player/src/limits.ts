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
 * Termination is a hard invariant, not a hope: every visited value adds at
 * least 1 unit, so the walk performs at most {@link MAX_OP_COST} iterations
 * regardless of input shape — a DAG of shared references (billion-laughs) is
 * re-walked per reference and trips the budget; a lazily-infinite getter tree
 * runs out of budget the same way.
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

type Frame =
  | { readonly kind: "enter"; readonly value: unknown; readonly depth: number }
  | { readonly kind: "leave"; readonly container: object };

/**
 * Why an op exceeds the untrusted-payload budget, or `null` to accept it.
 * Iterative (no recursion on hostile depth), cycle-tolerant (back-edges are
 * skipped and left to A8's canonicalizer), and O({@link MAX_OP_COST}) in all
 * cases. Called by A8's canonicalizer on the whole op object, so envelope
 * fields are inside the budget too. Depth and cycles remain canonicalizer-owned.
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

    if (typeof value === "string") {
      cost += value.length;
    } else if (typeof value === "object" && value !== null) {
      if (onPath.has(value)) {
        // Back-edge: termination handled, refusal deferred to A8 canonicalization.
      } else if (ArrayBuffer.isView(value)) {
        cost += value.byteLength;
      } else if (value instanceof ArrayBuffer) {
        cost += value.byteLength;
      } else if (Array.isArray(value)) {
        if (value.length > MAX_COLLECTION_ENTRIES) {
          return `an array of ${value.length} entries exceeds the ${MAX_COLLECTION_ENTRIES}-entry limit (#14)`;
        }
        cost += 4;
        onPath.add(value);
        stack.push({ kind: "leave", container: value });
        for (const item of value) stack.push({ kind: "enter", value: item, depth: depth + 1 });
      } else {
        // Any other object is walked as a bag of its own enumerable keys —
        // the same shape `structuredClone` and `writeAny` would traverse.
        const keys = Object.keys(value);
        if (keys.length > MAX_COLLECTION_ENTRIES) {
          return `an object of ${keys.length} keys exceeds the ${MAX_COLLECTION_ENTRIES}-entry limit (#14)`;
        }
        cost += 4;
        onPath.add(value);
        stack.push({ kind: "leave", container: value });
        for (const key of keys) {
          cost += key.length;
          stack.push({
            kind: "enter",
            value: (value as Record<string, unknown>)[key],
            depth: depth + 1,
          });
        }
      }
    } else {
      cost += 8; // number, bigint, boolean, undefined, symbol, function
    }

    if (cost > MAX_OP_COST) {
      return `payload exceeds the ${MAX_OP_COST}-unit cost budget (#14)`;
    }
  }
  return null;
}
