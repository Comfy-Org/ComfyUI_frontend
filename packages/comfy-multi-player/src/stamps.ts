/**
 * Stamp machinery — mirrors comfy_cli/workflow_ops.py `_stamp_key` /
 * `_lww_gate` / `_write_target` with the cross-language pins of
 * op-vocabulary-v1.md §8.1/§8.2 (code-point string order, op_id tiebreak).
 */

import type { Op, StampKey } from "./types.js";

/**
 * Unicode CODE POINT comparison (vocabulary §8.1: Python `str <` semantics).
 *
 * JS `<` compares UTF-16 code units, which diverges from code-point order
 * above the Basic Multilingual Plane (surrogates sort below U+E000..U+FFFF).
 * Actors and op_ids are contractually ASCII — where the two orders agree —
 * but this comparator is code-point-exact regardless, so a non-conforming
 * actor string cannot silently produce a different winner than Python.
 * No locale, no case folding, no normalization; a strict prefix sorts before
 * its extension.
 */
export function codePointCompare(a: string, b: string): -1 | 0 | 1 {
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    const ca = a.codePointAt(i)!;
    const cb = b.codePointAt(j)!;
    if (ca !== cb) return ca < cb ? -1 : 1;
    i += ca > 0xffff ? 2 : 1;
    j += cb > 0xffff ? 2 : 1;
  }
  const ra = a.length - i;
  const rb = b.length - j;
  return ra === rb ? 0 : ra < rb ? -1 : 1;
}

/**
 * Total-order comparison of two stamp keys `[base_version, actor, op_id]`:
 * element-wise, first difference decides — numeric on `base_version`,
 * code-point order on `actor` and `op_id` (vocabulary §3 / §8.1). Two keys
 * compare equal only if they are the same op.
 */
export function compareStampKeys(a: StampKey, b: StampKey): -1 | 0 | 1 {
  if (a[0] !== b[0]) return a[0] < b[0] ? -1 : 1;
  const byActor = codePointCompare(a[1], b[1]);
  if (byActor !== 0) return byActor;
  return codePointCompare(a[2], b[2]);
}

/**
 * The LWW comparison key for an op — comfy-cli `_stamp_key` verbatim:
 * `op.stamp` when present (and non-empty), else `[base_version, actor]`,
 * always extended with the unique `op_id` tiebreak.
 */
export function stampKey(op: Op): StampKey {
  const stamp =
    Array.isArray(op.stamp) && op.stamp.length >= 2
      ? op.stamp
      : ([op.base_version ?? 0, op.actor ?? ""] as const);
  return [Number(stamp[0] ?? 0), String(stamp[1] ?? ""), op.op_id];
}

/**
 * The conflict/write target of an op — comfy-cli `_write_target` (schema §3
 * table). Gated and committed through `__stamps`: the `set_widget` rows, the
 * connect-embedded inputcount bump (§8.4), and — since op-vocabulary-v1.md
 * amendment v1.2 — a concrete `connect`'s `("input", to_node, to_slot)`. The
 * `add_node`/`delete_node` rows define conflict identity for
 * `detect_conflict`-style consumers and reserve the key shapes.
 *
 * NODE IDS ARE NORMALIZED WITH `String()` (amendment v1.2). `NodeId` is
 * `string | number` by contract — historical workflows carry string ids and
 * subgraph addresses are strings like `"57:3"` — while the doc resolves every
 * node through `String(node_id)`. Building the target key from the raw value
 * gave `7` and `"7"` two different registers for one node, so the LWW gate
 * never compared them and the pair converged by arrival order (adversarial
 * finding, PR #6725). Interior writes already normalized (`path.map(String)`);
 * every case now matches them.
 */
export function writeTarget(op: Op): unknown[] {
  switch (op.op) {
    case "set_widget":
      if (op.path && op.path.length > 0) {
        return ["widget", op.path.map(String), op.inner_widget];
      }
      return ["widget", String(op.node_id), op.widget];
    case "add_node":
    case "delete_node":
      return ["node", String(op.node_id)];
    case "connect":
      if (op.grow != null) {
        return ["input", String(op.to_node), "grow", String(op.grow.name).split(".", 1)[0]];
      }
      return ["input", String(op.to_node), op.to_slot];
    default:
      return [op.op];
  }
}

/** The `__stamps` map key for an op's write target (stable JSON serialization). */
export function stampTargetKey(op: Op): string {
  return JSON.stringify(writeTarget(op));
}
