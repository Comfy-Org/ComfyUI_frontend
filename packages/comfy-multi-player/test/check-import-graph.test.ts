/**
 * Tests for the import-graph gate (`scripts/check-import-graph.mjs`).
 *
 * The gate exists to stop a run that analyzed nothing from reporting a clean
 * graph, so the thing that most needs a regression test is its own
 * anti-vacuity floor: if `MIN_MODULES` were deleted, every assertion about
 * exit `2` below must go red. Each case drives the real `depcruise` binary
 * against an isolated fixture tree via `IMPORT_GRAPH_ROOT`, so the exit codes
 * are produced the same way CI produces them.
 *
 * One case per rule, not one per file: the gate has four rules and one exit
 * code, so a single planted violation would prove one rule and say nothing
 * about the other three.
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync, chmodSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const script = join(repoRoot, "scripts", "check-import-graph.mjs");

/** Run the gate against a fixture root, with an optional floor override. */
function runAgainst(root: string, minModules?: number) {
  const env: Record<string, string> = { ...process.env, IMPORT_GRAPH_ROOT: root };
  if (minModules !== undefined) env.IMPORT_GRAPH_MIN_MODULES = String(minModules);
  return spawnSync("node", [script], { encoding: "utf8", env });
}

describe("check-import-graph gate", () => {
  let root: string;
  let src: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "importgraph-"));
    src = join(root, "src");
    mkdirSync(src, { recursive: true });
    mkdirSync(join(root, "node_modules"), { recursive: true });

    // Borrow the real toolchain: `depcruise` must resolve this project's
    // `typescript`, which is exactly the property the gate is about.
    symlinkSync(join(repoRoot, "node_modules", ".bin"), join(root, "node_modules", ".bin"), "dir");
    for (const pkg of ["yjs", "typescript", "dependency-cruiser"]) {
      symlinkSync(join(repoRoot, "node_modules", pkg), join(root, "node_modules", pkg), "dir");
    }

    writeFileSync(
      join(root, "package.json"),
      JSON.stringify({ name: "fixture", type: "module", dependencies: { yjs: "*" } }),
    );
    writeFileSync(
      join(root, "tsconfig.json"),
      // No `include`: one case deliberately leaves `src/` empty, and an
      // `include` that matches nothing makes tsc error before the gate runs.
      JSON.stringify({
        compilerOptions: { module: "NodeNext", moduleResolution: "NodeNext", strict: true },
      }),
    );
    symlinkSync(join(repoRoot, ".dependency-cruiser.cjs"), join(root, ".dependency-cruiser.cjs"));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  /** A clean two-module fixture that imports yjs, so externals are in the graph. */
  function writeCleanFixture() {
    writeFileSync(join(src, "a.ts"), `import { b } from "./b.js";\nexport const a = b;\n`);
    writeFileSync(
      join(src, "b.ts"),
      `import * as Y from "yjs";\nexport const b = new Y.Doc().guid;\n`,
    );
  }

  it("PASSES (exit 0) and reports its work count when the graph is clean", () => {
    writeCleanFixture();
    const run = runAgainst(root, 2);
    expect(run.status).toBe(0);
    expect(run.stdout).toContain("import-graph check PASSED");
    // The count is the point: a pass that does not say what it analyzed is the
    // shape of the original defect.
    expect(run.stdout).toMatch(/PASSED \((\d+) modules, (\d+) dependencies cruised, 0 violations\)/);
    const cruised = Number(run.stdout.match(/PASSED \((\d+) modules/)![1]);
    expect(cruised).toBeGreaterThanOrEqual(3); // a.ts, b.ts, and yjs
  });

  it("is INCONCLUSIVE (exit 2), not green, when it cruises fewer modules than the floor", () => {
    writeCleanFixture();
    const run = runAgainst(root, 500);
    expect(run.status).toBe(2);
    expect(run.stderr).toContain("INCONCLUSIVE");
    expect(run.stderr).toMatch(/cruised \d+ modules, expected at least 500/);
    expect(run.stdout).not.toContain("PASSED");
  });

  it("is INCONCLUSIVE (exit 2) when the scan matches no source files — the original defect", () => {
    // `src/` holds nothing dependency-cruiser will cruise, which is exactly
    // what a 100%-TypeScript tree looks like when `.ts` is a disabled
    // extension. Left to itself the tool prints "no dependency violations
    // found (0 modules, 0 dependencies cruised)" and exits 0.
    writeFileSync(join(src, "notes.txt"), "not source\n");
    writeFileSync(join(root, "keep-tsc-happy.ts"), "export const keep = 1;\n");
    const run = runAgainst(root, 2);
    expect(run.status).toBe(2);
    expect(run.stderr).toMatch(/cruised 0 modules, expected at least 2/);
    expect(run.stdout).not.toContain("PASSED");
  });

  it("is INCONCLUSIVE (exit 2) when dependency-cruiser is not installed", () => {
    writeCleanFixture();
    rmSync(join(root, "node_modules", ".bin"), { recursive: true, force: true });
    const run = runAgainst(root, 2);
    expect(run.status).toBe(2);
    expect(run.stderr).toContain("INCONCLUSIVE");
    expect(run.stderr).toContain("not installed");
  });

  it("is INCONCLUSIVE (exit 2) when dependency-cruiser output is not parseable", () => {
    writeCleanFixture();
    rmSync(join(root, "node_modules", ".bin"), { recursive: true, force: true });
    mkdirSync(join(root, "node_modules", ".bin"), { recursive: true });
    const fake = join(root, "node_modules", ".bin", "depcruise");
    writeFileSync(fake, "#!/bin/sh\necho 'not json'\n");
    chmodSync(fake, 0o755);
    const run = runAgainst(root, 2);
    expect(run.status).toBe(2);
    expect(run.stderr).toContain("could not parse");
  });

  // --- one mutant per rule -------------------------------------------------

  it("FAILS (exit 1) naming src-no-node-builtins on a Node builtin import (FC-3)", () => {
    writeCleanFixture();
    writeFileSync(join(src, "bad.ts"), `import { existsSync } from "node:fs";\nexport const p = existsSync;\n`);
    const run = runAgainst(root, 2);
    expect(run.status).toBe(1);
    expect(run.stderr).toContain("import-graph check FAILED");
    expect(run.stderr).toContain("src-no-node-builtins");
    expect(run.stderr).toContain("src/bad.ts");
  });

  it("FAILS (exit 1) naming src-runtime-dep-is-yjs-only on a non-yjs package import (KA-3)", () => {
    writeCleanFixture();
    writeFileSync(join(src, "bad.ts"), `import * as ts from "typescript";\nexport const p = ts;\n`);
    const run = runAgainst(root, 2);
    expect(run.status).toBe(1);
    expect(run.stderr).toContain("src-runtime-dep-is-yjs-only");
    expect(run.stderr).toContain("src/bad.ts");
  });

  it("FAILS (exit 1) naming no-unresolvable on an import that does not resolve", () => {
    writeCleanFixture();
    writeFileSync(join(src, "bad.ts"), `import { x } from "./nope.js";\nexport const p = x;\n`);
    const run = runAgainst(root, 2);
    expect(run.status).toBe(1);
    expect(run.stderr).toContain("no-unresolvable");
    expect(run.stderr).toContain("./nope.js");
  });

  it("FAILS (exit 1) naming no-circular on a cycle, and prints the cycle", () => {
    writeFileSync(join(src, "a.ts"), `import { b } from "./b.js";\nexport const a = b;\n`);
    writeFileSync(join(src, "b.ts"), `import { a } from "./a.js";\nexport const b = a;\n`);
    const run = runAgainst(root, 2);
    expect(run.status).toBe(1);
    expect(run.stderr).toContain("no-circular");
    expect(run.stderr).toContain("cycle:");
  });

  it("distinguishes all three outcomes with the same fixture shape", () => {
    // PASS / FAIL / INCONCLUSIVE must be three distinct codes, not two.
    writeCleanFixture();
    const pass = runAgainst(root, 2).status;
    const inconclusive = runAgainst(root, 500).status;
    writeFileSync(join(src, "bad.ts"), `import { existsSync } from "node:fs";\nexport const p = existsSync;\n`);
    const fail = runAgainst(root, 2).status;
    expect(new Set([pass, fail, inconclusive])).toEqual(new Set([0, 1, 2]));
  });
});
