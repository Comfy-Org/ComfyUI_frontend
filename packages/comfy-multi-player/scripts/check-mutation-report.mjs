#!/usr/bin/env node
/**
 * Mutation-report sanity gate.
 *
 * Stryker's headline score counts a `Timeout` outcome as DETECTED. That is
 * defensible for a genuinely non-terminating mutant (`while (…)` mutated to
 * `while (true)`), and indefensible for a mutant that merely ran slowly on a
 * busy machine — the two are the same symbol in the report. With `timeoutMS`
 * and `concurrency` unpinned, the score therefore RISES with host load:
 * measured on this repo, one commit, unpinned, 80.00% idle against 81.41%
 * under 20 CPU spinners — 13 real survivors reclassified as timeouts and
 * scored as kills (docs/mutation-testing.md).
 *
 * `stryker.config.mjs` pins those knobs so the number is a property of the
 * tests. This gate is the fail-closed half: it re-derives the score from
 * `reports/mutation/mutation.json`, reports `Timeout` as its own outcome, and
 * refuses to call the run conclusive when timeouts are material — because in
 * that regime the headline score is inflated by an unknown amount.
 *
 * Exit codes: 0 conclusive, 1 below the pinned break threshold, 2 INCONCLUSIVE
 * (no report, too few mutants, too many timeouts, or no threshold to judge
 * against). INCONCLUSIVE is not a pass.
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const reportPath = join(root, "reports", "mutation", "mutation.json");

/** Timeouts above this share of detected mutants make the score untrustworthy. */
const TIMEOUT_BUDGET = 0.02;
/** A run that mutated fewer than this many mutants did not examine the op layer. */
const MIN_MUTANTS = 500;

function inconclusive(msg) {
  console.error(`\nmutation report INCONCLUSIVE: ${msg}`);
  console.error("INCONCLUSIVE is not a pass. Re-run; do not record the score.");
  process.exit(2);
}

if (!existsSync(reportPath)) {
  inconclusive(`no report at ${reportPath} — run \`npm run test:mutation\` first`);
}

const report = JSON.parse(readFileSync(reportPath, "utf8"));
const files = report.files ?? {};
const counts = { Killed: 0, Timeout: 0, Survived: 0, NoCoverage: 0, RuntimeError: 0, CompileError: 0, Ignored: 0 };
for (const file of Object.values(files)) {
  for (const mutant of file.mutants ?? []) {
    counts[mutant.status] = (counts[mutant.status] ?? 0) + 1;
  }
}

const total = Object.values(counts).reduce((a, b) => a + b, 0);
if (total === 0) inconclusive("the report contains 0 mutants");
if (total < MIN_MUTANTS) {
  inconclusive(`only ${total} mutants in the report, expected at least ${MIN_MUTANTS}`);
}

const detected = counts.Killed + counts.Timeout;
const valid = detected + counts.Survived + counts.NoCoverage;
const score = (detected / valid) * 100;
// The same run scored with every Timeout treated as a survivor: the floor the
// score cannot fall below no matter how the timeouts are really classified.
const floor = (counts.Killed / valid) * 100;
const timeoutShare = detected === 0 ? 0 : counts.Timeout / detected;
// `break` is NOT a required field of mutation-testing-report-schema (only
// `high` and `low` are), so a Stryker version or config that stops emitting it
// would leave this gate with nothing to compare against. Treat that as
// INCONCLUSIVE rather than skipping the comparison and printing PASSED — a
// check that did not run is never green.
const breakAt = report.thresholds?.break;
if (typeof breakAt !== "number") {
  inconclusive("the report carries no numeric `thresholds.break` — there is nothing to judge the score against");
}

console.log(`mutants        ${total} (${Object.keys(files).length} files)`);
console.log(`killed         ${counts.Killed}`);
console.log(`timeout        ${counts.Timeout}   <- scored as detected by Stryker`);
console.log(`survived       ${counts.Survived}`);
console.log(`no coverage    ${counts.NoCoverage}`);
if (counts.RuntimeError || counts.CompileError) {
  console.log(`errors         ${counts.RuntimeError + counts.CompileError}`);
}
console.log(`score          ${score.toFixed(2)}%`);
console.log(`timeouts-as-survivors floor  ${floor.toFixed(2)}%`);

if (timeoutShare > TIMEOUT_BUDGET) {
  inconclusive(
    `${counts.Timeout} of ${detected} detected mutants (${(timeoutShare * 100).toFixed(1)}%) ` +
      `are timeouts, over the ${(TIMEOUT_BUDGET * 100).toFixed(0)}% budget. ` +
      `The score is inflated by up to ${(score - floor).toFixed(2)} points and is not comparable ` +
      `to a clean run. Usual cause: a loaded host, or timeoutMS/concurrency unpinned.`,
  );
}

if (score < breakAt) {
  console.error(`\nmutation report FAILED: ${score.toFixed(2)}% is below the break threshold ${breakAt}`);
  process.exit(1);
}

console.log("\nmutation report PASSED (timeouts within budget, score at or above threshold)");
