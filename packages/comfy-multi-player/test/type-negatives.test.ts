/**
 * Runs the issue #17 negative type tests as a real gate.
 *
 * `test/` is outside `tsconfig.json`'s `include`, so `npm run build` cannot see
 * anything in it (noted as finding 2 of the #21 report). A type-level
 * constraint that nothing type-checks is a constraint that quietly rots, so
 * `test/types/invalid-states.negative.ts` gets its own `tsc` invocation here.
 *
 * That file is built entirely out of `@ts-expect-error` directives plus
 * positive controls, so `tsc` exiting 0 means BOTH that every invalid state is
 * still rejected (a directive with no error underneath it is itself an error,
 * TS2578) and that valid ops still compile.
 *
 * A green `tsc` is NOT on its own evidence that anything was checked, and this
 * gate shipped with exactly that hole: `test/types/tsconfig.json` originally
 * listed `../../src` in `include` alongside the negative file, so DELETING the
 * negative file left a non-empty project and the gate exited 0 — green over
 * nothing (`.agents/checks/README.md`, non-vacuousness rule: "a tool that did
 * not run is INCONCLUSIVE, never green"). Two things close it, and both are
 * load-bearing:
 *
 *  1. `include` names only the negative file, so a missing file is TS18003
 *     ("No inputs were found in config file") and the gate goes red. `src` is
 *     still type-checked — the file imports it.
 *  2. the directive census below, so a file that still exists but has had its
 *     assertions stripped or commented out also goes red. `tsc` cannot tell
 *     "every directive is used" from "there are no directives".
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const tsc = join(root, "node_modules", "typescript", "bin", "tsc");
const project = join(root, "test", "types", "tsconfig.json");
const negatives = join(root, "test", "types", "invalid-states.negative.ts");

/**
 * Every invalid state the file is required to still be asserting.
 *
 * Matched with an ANCHORED pattern and compared with `toBe`, not
 * `toBeGreaterThanOrEqual` over a bare `/@ts-expect-error/g`. The loose
 * version had three assertions of slack, because the file's own docblock says
 * the words "@ts-expect-error" three times — so three real directives could be
 * deleted while the census stayed happy. Demonstrated: removing
 * `topLevelWithPath`'s two directives and `unprovenInteriorPath`'s left both
 * tests green. An exact count also means ADDING a state without updating this
 * constant fails, which is the reminder you want.
 */
const EXPECTED_DIRECTIVES = 13;
const DIRECTIVE = /^[ \t]*\/\/ @ts-expect-error\b/gm;

describe("invalid op states are unrepresentable (issue #17)", () => {
  it("still asserts every invalid state — the census that keeps the tsc run non-vacuous", () => {
    const source = readFileSync(negatives, "utf8");
    const directives = source.match(DIRECTIVE) ?? [];
    expect(
      directives.length,
      "test/types/invalid-states.negative.ts no longer carries exactly " +
        `${EXPECTED_DIRECTIVES} @ts-expect-error directives. Fewer means an invalid state ` +
        "stopped being asserted and a `tsc` exit 0 over it is a vacuous green; more means a " +
        "state was added — update EXPECTED_DIRECTIVES in the same commit.",
    ).toBe(EXPECTED_DIRECTIVES);
    // The positive controls are the other half: without them a change that
    // broke EVERY op literal would still leave the directives "used".
    expect(source).toContain("Positive controls");
  });

  it("compiles test/types/invalid-states.negative.ts with zero diagnostics", () => {
    expect(existsSync(tsc), "typescript devDependency missing — run `npm ci`").toBe(true);
    expect(
      existsSync(negatives),
      "the negative-type file is gone; `include` now names it explicitly so this is TS18003, " +
        "but assert it directly rather than relying on a compiler diagnostic to notice",
    ).toBe(true);

    const run = spawnSync(process.execPath, [tsc, "-p", project], {
      cwd: root,
      encoding: "utf8",
    });

    // tsc prints diagnostics on stdout. A TS2578 ("Unused '@ts-expect-error'
    // directive") means an invalid state became constructible again; anything
    // else means a positive control stopped compiling.
    expect(`${run.stdout}${run.stderr}`.trim()).toBe("");
    expect(run.status).toBe(0);
  }, 60_000);
});
