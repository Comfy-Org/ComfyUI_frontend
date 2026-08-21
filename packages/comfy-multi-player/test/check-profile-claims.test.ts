import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const script = join(repoRoot, "scripts", "check-profile-claims.mjs");

/** Run the gate against an isolated fixture root (its own checks dir + targets). */
function runAgainst(root: string) {
  return spawnSync("node", [script], {
    encoding: "utf8",
    env: {
      ...process.env,
      PROFILE_CLAIMS_ROOT: root,
      PROFILE_CHECKS_DIR: join(root, ".agents", "checks"),
    },
  });
}

// The gate's diagnostics are its contract, so assert the exact stderr/stdout.
// A FAILED run prints a header line, a blank line (the header string itself
// ends in "\n" and `console.error` appends another), one "  - <message>" block
// per stale claim, then a blank line and a footer naming the claim count; every
// line is newline-terminated. `claimsFail` rebuilds that byte-for-byte.
const claimsFail = (message: string, checked: number, absent = 0) =>
  "profile-claims check FAILED — profile claims no longer hold:\n\n" +
  `  - ${message}\n` +
  `\nFix the profile prose to match the code (or correct the marker). ` +
  `Checked ${checked} presence claim(s) and ${absent} absence claim(s).\n`;

const claimsInconclusive = (absent = 0) =>
  `profile-claims check INCONCLUSIVE — no presence claims in .agents/checks/*.md ` +
  `(${absent} absence claim(s) found, which anchor no restated fact).\n` +
  "Annotate each restated code fact with `<!-- claim: <exact substring> :: <path> -->`\n" +
  "so it fails when the code drifts, and each retired-because-wrong phrase with\n" +
  "`<!-- claim-absent: <exact substring> :: <path> -->` so it fails when the phrase\n" +
  "comes back. Start with api-contract.md's export list.\n";

describe("check-profile-claims staleness gate", () => {
  let root: string;
  let checks: string;
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "claims-"));
    checks = join(root, ".agents", "checks");
    mkdirSync(checks, { recursive: true });
    mkdirSync(join(root, "src"));
  });
  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it("is INCONCLUSIVE (exit 2) when no claim markers exist", () => {
    writeFileSync(join(checks, "a.md"), "# profile\nprose with no claims\n");
    const run = runAgainst(root);
    expect(run.status).toBe(2);
    expect(run.stderr).toBe(claimsInconclusive());
  });

  it("passes when every claimed substring is present in its target", () => {
    writeFileSync(join(root, "src", "index.ts"), 'export { mint } from "./mint.js";\n');
    writeFileSync(
      join(checks, "a.md"),
      '<!-- claim: export { mint } from "./mint.js" :: src/index.ts -->\n',
    );
    const run = runAgainst(root);
    expect(run.status).toBe(0);
    expect(run.stdout).toBe("profile-claims check PASSED (1 presence + 0 absence claims still hold)\n");
  });

  it("fails when a claimed export has been renamed away", () => {
    writeFileSync(join(root, "src", "index.ts"), 'export { renamed } from "./mint.js";\n');
    writeFileSync(
      join(checks, "a.md"),
      '<!-- claim: export { mint } from "./mint.js" :: src/index.ts -->\n',
    );
    const run = runAgainst(root);
    expect(run.status).toBe(1);
    expect(run.stderr).toBe(
      claimsFail('a.md: STALE claim — not found in src/index.ts:\n      export { mint } from "./mint.js"', 1),
    );
  });

  it("fails when the claim target file does not exist", () => {
    writeFileSync(join(checks, "a.md"), "<!-- claim: anything :: src/gone.ts -->\n");
    const run = runAgainst(root);
    expect(run.status).toBe(1);
    expect(run.stderr).toBe(
      claimsFail("a.md: claim target does not exist: src/gone.ts\n      claim: anything", 1),
    );
  });

  it("fails when the claim target escapes the repo root", () => {
    writeFileSync(join(checks, "a.md"), "<!-- claim: root: :: ../../../../etc/passwd -->\n");
    const run = runAgainst(root);
    expect(run.status).toBe(1);
    expect(run.stderr).toBe(
      claimsFail("a.md: claim target escapes the repo root: ../../../../etc/passwd\n      claim: root:", 1),
    );
  });

  it("fails when the claim target is a directory, not a file", () => {
    writeFileSync(join(checks, "a.md"), "<!-- claim: anything :: src -->\n");
    const run = runAgainst(root);
    expect(run.status).toBe(1);
    expect(run.stderr).toBe(
      claimsFail("a.md: claim target is not a regular file: src\n      claim: anything", 1),
    );
  });

  // ---- claim-absent ------------------------------------------------------
  //
  // The negative form exists for two facts the positive form cannot express: a
  // fact whose content is an absence (`project()` does not read `__stamps`, the
  // reason a projection is the wrong rejection oracle), and a retired-because-
  // wrong sentence that must not be re-typed. Both are proven red below, since
  // a ban nobody has ever seen fail is indistinguishable from no ban at all.

  // Every fixture below carries one presence claim as well, because a profile
  // set of bans alone is now INCONCLUSIVE — see the floor test at the end.
  const anchor = '<!-- claim: getMap :: src/project.ts -->\n';

  it("passes a claim-absent whose banned text is genuinely gone", () => {
    writeFileSync(join(root, "src", "project.ts"), "const meta = doc.getMap('meta');\n");
    writeFileSync(join(checks, "a.md"), anchor + "<!-- claim-absent: __stamps :: src/project.ts -->\n");
    const run = runAgainst(root);
    expect(run.status).toBe(0);
    expect(run.stdout).toBe("profile-claims check PASSED (1 presence + 1 absence claims still hold)\n");
  });

  it("fails when banned text reappears in the target (the absence claim is revived)", () => {
    writeFileSync(join(root, "src", "project.ts"), 'const s = doc.getMap("__stamps");\n');
    writeFileSync(join(checks, "a.md"), anchor + "<!-- claim-absent: __stamps :: src/project.ts -->\n");
    const run = runAgainst(root);
    expect(run.status).toBe(1);
    expect(run.stderr).toBe(
      claimsFail("a.md: REVIVED claim — banned text is present again in src/project.ts:\n      __stamps", 1, 1),
    );
  });

  it("is INCONCLUSIVE (exit 2) when a profile set carries bans but anchors no fact", () => {
    // An absence claim passes against almost any file, so a combined floor
    // would be satisfiable with zero anchored facts — nonzero work, no work.
    writeFileSync(join(root, "src", "project.ts"), "const meta = doc.getMap('meta');\n");
    writeFileSync(
      join(checks, "a.md"),
      "<!-- claim-absent: __stamps :: src/project.ts -->\n" +
        "<!-- claim-absent: __applied :: src/project.ts -->\n",
    );
    const run = runAgainst(root);
    expect(run.status).toBe(2);
    expect(run.stderr).toBe(claimsInconclusive(2));
  });

  it("lets a profile ban a retired sentence in itself without the marker tripping the ban", () => {
    // Self-targeted: the marker names the phrase it forbids, and lives in the
    // file it forbids it in. Markers are stripped before the test, so this is
    // green while the prose is clean...
    writeFileSync(
      join(checks, "a.md"),
      anchor +
        "Use byte identity.\n<!-- claim-absent: the projection must be unchanged :: .agents/checks/a.md -->\n",
    );
    writeFileSync(join(root, "src", "project.ts"), "const meta = doc.getMap('meta');\n");
    expect(runAgainst(root).status).toBe(0);

    // ...and red the moment someone re-types the retired advice.
    writeFileSync(
      join(checks, "a.md"),
      anchor +
        "For rejections the projection must be unchanged.\n" +
        "<!-- claim-absent: the projection must be unchanged :: .agents/checks/a.md -->\n",
    );
    const run = runAgainst(root);
    expect(run.status).toBe(1);
    expect(run.stderr).toBe(
      claimsFail(
        "a.md: REVIVED claim — banned text is present again in .agents/checks/a.md:\n      the projection must be unchanged",
        1,
        1,
      ),
    );
  });

  it("does not let a positive claim be satisfied by nothing but a claim marker", () => {
    // Markers are metadata, not prose. A claim that only another marker
    // satisfies is the vacuous pass this gate exists to prevent.
    writeFileSync(join(checks, "a.md"), "<!-- claim: mintDoc :: .agents/checks/b.md -->\n");
    writeFileSync(join(checks, "b.md"), "<!-- claim: mintDoc :: src/index.ts -->\n");
    writeFileSync(join(root, "src", "index.ts"), "export function mintDoc() {}\n");
    const run = runAgainst(root);
    expect(run.status).toBe(1);
    expect(run.stderr).toBe(
      claimsFail("a.md: STALE claim — not found in .agents/checks/b.md:\n      mintDoc", 2),
    );
  });

  it("does not let stripping a marker splice a needle together across the seam", () => {
    // Stripping must only ever make a positive claim HARDER to satisfy, so a
    // removed marker leaves a newline behind rather than closing the gap.
    writeFileSync(join(checks, "a.md"), "<!-- claim: foobar :: .agents/checks/b.md -->\n");
    writeFileSync(join(checks, "b.md"), "foo<!-- claim: x :: src/index.ts -->bar\n");
    writeFileSync(join(root, "src", "index.ts"), "x\n");
    const run = runAgainst(root);
    expect(run.status).toBe(1);
    expect(run.stderr).toBe(
      claimsFail("a.md: STALE claim — not found in .agents/checks/b.md:\n      foobar", 2),
    );
  });

  it("fails on a malformed marker missing the separator", () => {
    writeFileSync(join(checks, "a.md"), "<!-- claim: no separator here -->\n");
    const run = runAgainst(root);
    expect(run.status).toBe(1);
    // A malformed marker is rejected before the claim counter increments, so the
    // footer reports zero checked claims.
    expect(run.stderr).toBe(
      claimsFail('a.md: malformed claim marker (missing " :: " separator): "no separator here"', 0),
    );
  });
});
