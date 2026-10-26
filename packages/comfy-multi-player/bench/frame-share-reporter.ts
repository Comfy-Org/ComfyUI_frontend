/**
 * Prints each benchmark's cost as a share of one 60 Hz frame.
 *
 * Vitest's own table reports hz/mean/p99 in milliseconds and has no notion of a
 * frame budget, but the frame share is the figure this baseline exists to give:
 * `applyOps` and `project` sit on the follower's frame path, so "6% of a frame"
 * is a number a reader can act on, where "1.03 ms" invites comparison against
 * nothing.
 *
 * Vitest 5 exposes completed benchmark measurements through the reporter's
 * dedicated `onTestCaseBenchmark` hook. Rows are collected there and printed
 * together at the end of the run.
 *
 * This asserts nothing and fails nothing. A frame share is context for setting
 * a budget later, not a pass mark; see bench/apply-project.bench.ts for why
 * this baseline refuses to invent a threshold.
 */

import type { Reporter } from "vitest/node";

/** One 60 Hz frame, in milliseconds. Must match bench/apply-project.bench.ts. */
const FRAME_MS = 16.6;

interface Row {
  label: string;
  mean: number;
  p99: number;
  rme: number;
}

const rows: Row[] = [];

const reporter = {
  onTestCaseBenchmark(testCase, benchmark): void {
    for (const task of benchmark.tasks) {
      rows.push({
        label: `${testCase.fullName} \u203a ${task.name}`,
        mean: task.latency.mean,
        p99: task.latency.p99,
        rme: task.latency.rme,
      });
    }
  },

  onTestRunEnd(): void {
    if (rows.length === 0) return;

    const share = (ms: number) => (Number.isFinite(ms) ? `${((ms / FRAME_MS) * 100).toFixed(2)}%` : "n/a");
    const width = Math.max(...rows.map((row) => row.label.length));

    console.log(`\n  Share of one ${FRAME_MS} ms frame (60 Hz) — baseline only, nothing is asserted\n`);
    for (const row of rows) {
      console.log(
        `  ${row.label.padEnd(width)}   mean ${row.mean.toFixed(4)} ms = ${share(row.mean).padStart(7)}` +
          `   p99 ${row.p99.toFixed(4)} ms = ${share(row.p99).padStart(7)}` +
          `   ±${row.rme.toFixed(2)}%`,
      );
    }
    console.log("");
    rows.length = 0;
  },
} satisfies Reporter;

export default reporter;
