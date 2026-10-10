// Growth matrix (risk 3, unbounded doc growth): pins WHICH root grows under
// WHICH op shape, using the same harness `scripts/bench-growth.mjs` runs.
// Runs against src/ (no dist dependency; the first CI job has no build step).
import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import { MAX_OPS_PER_BATCH, applyOps, mint } from "../src/index.js";
import { ROOT_APPLIED, ROOT_NODES, ROOT_STAMPS } from "../src/doc.js";
import {
  MAX_OPS_PER_BATCH as HARNESS_MAX_OPS_PER_BATCH,
  formatMatrix,
  runGrowthMatrix,
  runWorkload,
  type WorkloadResult,
} from "../scripts/growth-matrix.mjs";

const OPS = 280; // divisible by 7 widgets, by 2 (add/delete pairs) and by 4 (checkpoint spacing)
const cmp = { Y, mint, applyOps };
const matrix = runGrowthMatrix(cmp, { opCount: OPS, checkpoints: 5 });
const single = matrix.single_target_churn!;
const distinct = matrix.distinct_target_churn!;
const addDelete = matrix.add_delete_churn!;
const baseline = matrix.large_workflow_baseline!;

function last(r: WorkloadResult) {
  return r.samples[r.samples.length - 1]!;
}

describe("growth matrix: measurement invariants", () => {
  it("re-encoded live bytes never exceed the total, at every checkpoint of every workload", () => {
    for (const r of Object.values(matrix)) {
      for (const s of r.samples) {
        expect(s.liveAll, `${r.name}@${s.ops} liveAll`).toBeLessThanOrEqual(
          s.total,
        );
        expect(s.history, `${r.name}@${s.ops} history`).toBeGreaterThanOrEqual(
          0,
        );
        for (const [root, bytes] of Object.entries(s.live)) {
          expect(bytes, `${r.name}@${s.ops} live:${root}`).toBeLessThanOrEqual(
            s.total,
          );
        }
      }
    }
  });

  it("every op-driven workload actually applied all requested ops", () => {
    expect(single.opCount).toBe(OPS);
    expect(distinct.opCount).toBe(OPS);
    expect(addDelete.opCount).toBe(OPS);
    expect(baseline.opCount).toBe(0);
  });

  it("a freshly minted doc carries no history", () => {
    for (const r of Object.values(matrix))
      expect(r.samples[0]!.history, r.name).toBe(0);
  });
});

describe("growth matrix: which root grows under which op shape", () => {
  it("__applied grows once per op, independent of target (digest ledger)", () => {
    const perOp = single.slopes.live[ROOT_APPLIED]!;
    // op_id (32 hex) + sha256 hex digest (64) + Y.Map item framing.
    expect(perOp).toBeGreaterThan(96);
    expect(perOp).toBeLessThan(130);
    // Same ledger cost whether the ops churn one target or many. Separate docs
    // carry different random clientIDs (1-5 byte varuint per item), so allow a
    // few bytes of cross-doc noise.
    expect(Math.abs(distinct.slopes.live[ROOT_APPLIED]! - perOp)).toBeLessThan(
      perOp * 0.05,
    );
    expect(Math.abs(addDelete.slopes.live[ROOT_APPLIED]! - perOp)).toBeLessThan(
      perOp * 0.05,
    );
  });

  it("__stamps live bytes stay flat when one target is rewritten, but grow once per distinct target", () => {
    const stampsStart = single.samples[1]!.live[ROOT_STAMPS]!; // after the first batch, the target exists
    const stampsEnd = last(single).live[ROOT_STAMPS]!;
    // Rewriting the same target replaces its stamp; only the version digits can widen.
    expect(stampsEnd - stampsStart).toBeLessThanOrEqual(8);
    expect(distinct.slopes.live[ROOT_STAMPS]).toBeGreaterThan(40);
    expect(distinct.slopes.live[ROOT_STAMPS]).toBeGreaterThan(
      single.slopes.live[ROOT_STAMPS]! * 20,
    );
  });

  it("rewriting one target leaves a tombstone per op (history grows) even though live bytes do not", () => {
    expect(single.slopes.history).toBeGreaterThan(5);
    expect(single.slopes.live[ROOT_NODES]).toBeLessThan(1);
    // Distinct targets also tombstone the widget cell they replace, but far less per op
    // than the digest ledger costs; history stays a minority of total growth.
    expect(distinct.slopes.history).toBeLessThan(distinct.slopes.total * 0.25);
  });

  it("add_node/delete_node pairs return nodes to baseline while tombstones and per-node-id stamps accumulate", () => {
    const nodesAtMint = addDelete.samples[0]!.live[ROOT_NODES]!;
    for (const s of addDelete.samples) {
      // Checkpoints land after a delete, so live nodes must be back at the mint size.
      expect(
        Math.abs(s.live[ROOT_NODES]! - nodesAtMint),
        `nodes@${s.ops}`,
      ).toBeLessThanOrEqual(4);
    }
    expect(addDelete.slopes.history).toBeGreaterThan(distinct.slopes.history);
    // delete_node keeps the node's stamp so a late concurrent add_node loses LWW:
    // __stamps therefore grows with every node id ever created, ~one stamp per pair.
    const stampsPerPair = addDelete.slopes.live[ROOT_STAMPS]! * 2;
    expect(stampsPerPair).toBeGreaterThan(40);
    expect(stampsPerPair).toBeLessThan(
      distinct.slopes.live[ROOT_STAMPS]! * 1.5,
    );
  });

  it("mint cost is dominated by nodes and is linear in node count", () => {
    expect(baseline.unit).toBe("node");
    const perNode = baseline.slopes.total;
    expect(baseline.slopes.live[ROOT_NODES]! / perNode).toBeGreaterThan(0.9);
    const half = runGrowthMatrix(cmp, {
      opCount: OPS / 2,
      workloads: ["large_workflow_baseline"],
    }).large_workflow_baseline!;
    // Two mints, two clientIDs: up to one byte per item of encoding noise.
    expect(Math.abs(half.slopes.total - perNode)).toBeLessThan(perNode * 0.1);
  });
});

describe("growth matrix: harness guards", () => {
  it("mirrors the applier batch cap and splits wide checkpoint intervals", () => {
    expect(HARNESS_MAX_OPS_PER_BATCH).toBe(MAX_OPS_PER_BATCH);
    // One interval of MAX_OPS_PER_BATCH + 2 ops would be rejected by applyOps
    // if fed as a single batch; the harness must split it and still sample.
    const wide = runWorkload(cmp, "single_target_churn", {
      opCount: MAX_OPS_PER_BATCH + 2,
      checkpoints: 2,
    });
    expect(wide.opCount).toBe(MAX_OPS_PER_BATCH + 2);
    expect(wide.samples).toHaveLength(2);
    expect(wide.samples[1]!.ops).toBe(MAX_OPS_PER_BATCH + 2);
  });

  it("refuses an odd op count for add/delete churn (unmatched trailing add)", () => {
    expect(() =>
      runWorkload(cmp, "add_delete_churn", { opCount: 7, checkpoints: 2 }),
    ).toThrow(/multiple of 2/);
    // Even counts still land every checkpoint with zero live nodes added.
    const even = runWorkload(cmp, "add_delete_churn", {
      opCount: 8,
      checkpoints: 3,
    });
    for (const s of even.samples.slice(1))
      expect(s.live[ROOT_NODES]).toBe(even.samples[0]!.live[ROOT_NODES]);
  });
});

describe("growth matrix: report rendering", () => {
  it("formats one row per workload with every root as a column", () => {
    const table = formatMatrix(matrix);
    for (const name of Object.keys(matrix)) expect(table).toContain(name);
    for (const root of [ROOT_APPLIED, ROOT_STAMPS, ROOT_NODES])
      expect(table).toContain(`live:${root}`);
  });
});
