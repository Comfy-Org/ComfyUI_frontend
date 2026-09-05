/**
 * Two-doc convergence (schema §2.5): for any set of ops and two arrival
 * orders at the host, `project(apply(fork(mint(base)), o₁))` byte-equals
 * `project(apply(fork(mint(base)), o₂))` — provided each order respects the
 * ops' causal structure (an op that targets an entity created earlier in the
 * stream cannot arrive before its creation; delete-wins would then LEGALLY
 * drop it — that is the vocabulary's answer, not divergence).
 *
 * Order generation: the recorded stream is partitioned into REORDERABLE
 * WINDOWS — maximal runs whose ops touch pairwise-disjoint entities and
 * write targets — and the second doc applies each window's interior
 * reversed (and, in a second pass, rotated). Windows never span a
 * clear/delete (window breakers) or two ops sharing a node/target, so every
 * permutation inside a window is a genuinely concurrent arrival order.
 * The LWW vectors (test/lww.test.ts) cover the CONTESTED-target both-order
 * cases; this suite covers order-independence at stream scale.
 */
import * as Y from "yjs";
import { describe, expect, it } from "vitest";
import { applyOps, mint, project, writeTarget, type Op, type WireOp } from "../src/index.js";
import { assertNever } from "../src/exhaustive.js";
import { canonicalize, loadCatalog, loadSession, sessionFiles } from "./helpers.js";
import { checkGraphInvariants } from "./graph-invariant-oracle.js";

const catalog = loadCatalog();

/**
 * Op kinds that touch unbounded/graph-wide state and therefore break a
 * reorderable window. A runtime set, not a type-narrowed `if`: the stream is
 * wire data, so a kind this build does not implement (`reset_doc`) must still
 * break the window rather than be silently reordered (#21 site 6, #17).
 */
const WINDOW_BREAKERS = new Set<string>(["clear", "delete_node", "reset_doc"]);

/**
 * Node ids an op reads or writes structurally (conservative).
 *
 * Takes `WireOp`, not `Op`: session streams are recorded wire data and may
 * legally contain a deferred kind, which since #17 is not an `Op`.
 *
 * The `assertNever` arm below is documentation, NOT a gate: nothing
 * type-checks `test/**` — `tsconfig.json` includes only `src`, and
 * `test/types/tsconfig.json` includes only the negative-type file. A kind
 * added to either union fails `tsc` at the `src/` sites, not here.
 */
function touchedNodes(op: WireOp): string[] {
  switch (op.op) {
    case "add_node":
      return [String(op.node_id)];
    case "set_widget":
      return [String(op.path && op.path.length > 0 ? op.path[0] : op.node_id)];
    case "connect":
      return [String(op.from_node), String(op.to_node)];
    case "disconnect":
      return [String(op.to_node)];
    case "clear":
    case "delete_node":
    case "reset_doc":
      // Graph-wide / unbounded ops. `reorderableWindows` treats them as window
      // breakers and never calls this helper for them; listed explicitly so
      // the guard below is a guard and not a catch-all (#21).
      return [];
    default:
      return assertNever(op, "convergence.touchedNodes");
  }
}

/** Partition the stream into windows that are safe to permute internally. */
function reorderableWindows(ops: Op[]): Op[][] {
  const windows: Op[][] = [];
  let current: Op[] = [];
  let nodesInWindow = new Set<string>();
  let targetsInWindow = new Set<string>();
  const flush = () => {
    if (current.length > 0) windows.push(current);
    current = [];
    nodesInWindow = new Set();
    targetsInWindow = new Set();
  };
  for (const op of ops) {
    // clear/delete_node touch unbounded/graph-wide state: window breakers.
    if (WINDOW_BREAKERS.has(op.op)) {
      flush();
      windows.push([op]);
      continue;
    }
    const nodes = touchedNodes(op);
    const target = JSON.stringify(writeTarget(op));
    if (nodes.some((n) => nodesInWindow.has(n)) || targetsInWindow.has(target)) flush();
    current.push(op);
    for (const n of nodes) nodesInWindow.add(n);
    targetsInWindow.add(target);
  }
  flush();
  return windows;
}

describe("two-doc convergence through the single-applier discipline", () => {
  for (const file of sessionFiles()) {
    const { header, ops } = loadSession(file);
    const windows = reorderableWindows(ops);
    const reorderable = windows.filter((w) => w.length > 1);
    const permuted = (variant: "reverse" | "rotate"): Op[] =>
      windows.flatMap((w) =>
        w.length === 1 ? w : variant === "reverse" ? [...w].reverse() : [...w.slice(1), w[0]!],
      );

    it(`${file}: interleaved orders converge to byte-equal projections (${reorderable.length} windows, ${reorderable.reduce((n, w) => n + w.length, 0)} reordered ops)`, () => {
      expect(reorderable.length, "corpus must actually exercise reordering").toBeGreaterThan(0);

      // One common snapshot, forks via applyUpdate (schema §9 — never re-seed).
      const minted = mint(header.base_workflow, catalog);
      const snapshot = Y.encodeStateAsUpdate(minted);
      const fork = () => {
        const d = new Y.Doc();
        Y.applyUpdate(d, snapshot);
        return d;
      };

      const recorded = fork();
      expect(applyOps(recorded, ops, catalog).outcomes.find((outcome) => outcome.outcome === "rejected")).toBeUndefined();
      const recordedViolations = checkGraphInvariants(recorded);
      expect(recordedViolations, `graph invariant violation: ${JSON.stringify(recordedViolations)}`).toEqual([]);
      const want = JSON.stringify(canonicalize(project(recorded, catalog)));

      for (const variant of ["reverse", "rotate"] as const) {
        const other = fork();
        const reordered = permuted(variant);
        expect(reordered.length).toBe(ops.length);
        expect(applyOps(other, reordered, catalog).outcomes.find((outcome) => outcome.outcome === "rejected")).toBeUndefined();
        const violations = checkGraphInvariants(other);
        expect(violations, `graph invariant violation: ${JSON.stringify(violations)}`).toEqual([]);
        expect(
          JSON.stringify(canonicalize(project(other, catalog))),
          `${variant} order diverged`,
        ).toBe(want);
      }

      // And the recorded order still lands on the fixture final.
      expect(canonicalize(project(recorded, catalog))).toEqual(canonicalize(header.workflow_final));
    });
  }
});
