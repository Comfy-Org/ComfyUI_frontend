#!/usr/bin/env node
/**
 * Import-graph gate for @comfyorg/comfy-multi-player.
 *
 * Runs dependency-cruiser over `src` with the repo's `.dependency-cruiser.cjs`
 * rules and reports violations — but its FIRST job is to refuse to report a
 * vacuous pass.
 *
 * Why that guard exists: `npx --yes dependency-cruiser` installs the tool
 * OUTSIDE this project, where `typescript` is not resolvable. dependency-cruiser
 * enables an extension only when its transpiler is resolvable from the tool's
 * own install location, so `.ts` is silently DISABLED, a directory scan of a
 * 100%-TypeScript `src/` matches zero files, and the run prints
 * "✔ no dependency violations found (0 modules, 0 dependencies cruised)" and
 * exits 0. That green says nothing was analyzed, not that the graph is clean.
 *
 * Hence: dependency-cruiser is a devDependency of THIS package (so it resolves
 * the project's own `typescript`), and a run that cruises fewer than
 * MIN_MODULES modules fails as inconclusive.
 *
 * Exit codes: 0 clean, 1 violations, 2 inconclusive (tool missing, unparseable
 * output, or a vacuous run).
 */

import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// IMPORT_GRAPH_ROOT overrides the repo root this gate cruises, and
// IMPORT_GRAPH_MIN_MODULES overrides the work-unit floor. Both exist so
// `test/check-import-graph.test.ts` can drive the gate against an isolated
// fixture tree — a gate whose own anti-vacuity floor is unverified is the
// defect this gate exists to prevent. Neither is set in normal use or in CI.
const root = process.env.IMPORT_GRAPH_ROOT || dirname(dirname(fileURLToPath(import.meta.url)));

/**
 * Floor for a run to count as real. The pure op layer is `applier`, `doc`,
 * `exhaustive`, `index`, `migrate`, `mint`, `project`, `schema-version`,
 * `stamps`, `types` — ten modules as of #38 (`schema-version` is the KA-11
 * read gate; it was nine as of #64) (a healthy run also cruises
 * `node_modules/yjs`, so the real count is 11) — so anything below that means the scan missed files
 * rather than that the package shrank. Raise it when the layer grows; never
 * lower it to make a run pass. Deliberately NOT derived from a directory
 * listing: a floor computed from the thing it is checking is a self-referential
 * oracle and would shrink silently along with the scan.
 *
 * KNOWN LIMIT — this floor bounds VACUITY, not RULE ADEQUACY. It proves the
 * scan saw a plausible amount of work; it does not prove every rule could have
 * fired on what it saw. Worked counter-example: restore `includeOnly: "^src"`
 * to `.dependency-cruiser.cjs` and plant `import "node:fs"` in `src/doc.ts` —
 * the run cruises 9 modules / 22 dependencies, clears this floor, and exits 0
 * green over a real violation, because the filter removed every external
 * module the purity rules target. (A healthy run is 10 modules / 27
 * dependencies; the missing external layer is visible only in the dependency
 * count, which this floor does not look at.) The floor cannot catch that
 * class, and raising it does not help — the filtered run loses externals, not
 * source modules. Only mutating each rule
 * separately and confirming the NAMED rule goes red can — one mutant per rule,
 * not one per change. See `.agents/checks/import-graph.md` and the config's own
 * "NO includeOnly" comment.
 */
const MIN_MODULES = Number(process.env.IMPORT_GRAPH_MIN_MODULES ?? 10);

const cli = join(root, "node_modules", ".bin", "depcruise");
const run = spawnSync(cli, ["--output-type", "json", "src"], {
  cwd: root,
  encoding: "utf8",
  maxBuffer: 64 * 1024 * 1024,
});

if (run.error) {
  console.error(run.error.message);
  console.error(
    "import-graph check INCONCLUSIVE: dependency-cruiser is not installed — run `npm ci` (it is a devDependency; do NOT substitute `npx --yes dependency-cruiser`, which cannot see this project's typescript and silently cruises 0 modules)",
  );
  process.exit(2);
}

let report;
try {
  report = JSON.parse(run.stdout);
} catch {
  process.stderr.write(run.stderr ?? "");
  console.error("import-graph check INCONCLUSIVE: could not parse dependency-cruiser JSON output");
  process.exit(2);
}

const { totalCruised, totalDependenciesCruised, violations } = report.summary;

// --------------------------------------------------------------------------
// 1. Non-vacuousness. A green with nothing analyzed is the defect, not a pass.
// --------------------------------------------------------------------------
if (totalCruised < MIN_MODULES) {
  console.error(
    `import-graph check INCONCLUSIVE: cruised ${totalCruised} modules, expected at least ${MIN_MODULES}.`,
  );
  console.error(
    "Nothing meaningful was analyzed, so 'no violations' proves nothing. Check that `.ts` is an enabled extension (`npx depcruise --info`); it requires typescript resolvable from dependency-cruiser's install location.",
  );
  process.exit(2);
}

// --------------------------------------------------------------------------
// 2. Rule violations.
// --------------------------------------------------------------------------
if (violations.length > 0) {
  console.error(
    `import-graph check FAILED: ${violations.length} violation(s) over ${totalCruised} modules / ${totalDependenciesCruised} dependencies\n`,
  );
  for (const v of violations.slice(0, 20)) {
    const where = v.to && v.to !== v.from ? `${v.from} → ${v.to}` : v.from;
    console.error(`  ${v.rule.severity} ${v.rule.name}: ${where}`);
    if (v.cycle) console.error(`    cycle: ${v.cycle.map((s) => s.name ?? s).join(" → ")}`);
  }
  if (violations.length > 20) console.error(`  … and ${violations.length - 20} more`);
  console.error("\nRules live in .dependency-cruiser.cjs; see docs/INVARIANTS.md (KA-3, FC-3).");
  process.exit(1);
}

console.log(
  `import-graph check PASSED (${totalCruised} modules, ${totalDependenciesCruised} dependencies cruised, 0 violations)`,
);
