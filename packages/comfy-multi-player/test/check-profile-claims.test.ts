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
const claimsFail = (message: string, checked: number, absent = 0, defects = 0) =>
  "profile-claims check FAILED — profile claims no longer hold:\n\n" +
  `  - ${message}\n` +
  `\nFix the profile prose to match the code (or correct the marker). ` +
  `Checked ${checked} presence claim(s), ${absent} absence claim(s) ` +
  `and ${defects} known-defect tombstone(s).\n`;

const claimsPass = (checked: number, absent = 0, defects = 0, roster: string[] = []) =>
  `profile-claims check PASSED (${checked} presence + ${absent} absence claims ` +
  `still hold, ${defects} known-defect tombstone(s) standing)\n` +
  (roster.length === 0
    ? ""
    : "known-defect tombstones still standing (this gate cannot tell whether an issue is open):\n" +
      roster.map((line) => `${line}\n`).join(""));

const claimsInconclusive = (absent = 0, defects = 0) =>
  `profile-claims check INCONCLUSIVE — no presence claims in .agents/checks/*.md ` +
  `(${absent} absence claim(s) and ${defects} known-defect tombstone(s) found, ` +
  `which anchor no restated fact).\n` +
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
    expect(run.stdout).toBe(claimsPass(1));
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
    expect(run.stdout).toBe(claimsPass(1, 1));
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

  // ---- known-defect tombstones -------------------------------------------
  //
  // A tombstone is a diagnosed defect that a reviewer deliberately did not fix,
  // deposited where the repository can see it. It asserts the defective text is
  // STILL THERE and fails when it is gone — the inversion is the point, since a
  // positive `claim` on the same substring would tell whoever fixed the defect
  // to put it back.

  it("passes while the defect is still there, and prints the roster", () => {
    writeFileSync(join(root, "src", "types.ts"), "  /** total ops ever consumed. */\n");
    writeFileSync(
      join(checks, "a.md"),
      '<!-- claim: total ops :: src/types.ts -->\n' +
        "<!-- known-defect: #16 :: total ops ever consumed :: src/types.ts -->\n",
    );
    const run = runAgainst(root);
    expect(run.status).toBe(0);
    expect(run.stdout).toBe(
      claimsPass(1, 0, 1, ["  - #16 at src/types.ts (tombstone in a.md)"]),
    );
  });

  it("is INCONCLUSIVE (exit 2) when a profile set carries only tombstones", () => {
    // A tombstone anchors text the profile says is WRONG, so like a ban it
    // anchors no restated fact. Widening #74's presence floor to admit them was
    // considered and rejected: it would let a marker set of pure deferrals
    // clear a floor built to catch unverified restated facts.
    writeFileSync(join(root, "src", "types.ts"), "  /** total ops ever consumed. */\n");
    writeFileSync(
      join(checks, "a.md"),
      "<!-- known-defect: #16 :: total ops ever consumed :: src/types.ts -->\n",
    );
    const run = runAgainst(root);
    expect(run.status).toBe(2);
    expect(run.stderr).toBe(claimsInconclusive(0, 1));
  });

  it("fails when the defect text is gone, and names the issue to close", () => {
    writeFileSync(join(root, "src", "types.ts"), "  /** doc revision after apply. */\n");
    writeFileSync(
      join(checks, "a.md"),
      "<!-- known-defect: #16 :: total ops ever consumed :: src/types.ts -->\n",
    );
    const run = runAgainst(root);
    expect(run.status).toBe(1);
    expect(run.stderr).toBe(
      claimsFail(
        "a.md: RESOLVED known-defect #16 — the defect text is gone from src/types.ts:\n" +
          "      total ops ever consumed\n" +
          "      If it is fixed, delete this tombstone and close #16. If it only moved, repoint the marker.",
        0,
        0,
        1,
      ),
    );
  });

  it("refuses a tombstone with no issue reference", () => {
    // Requiring the reference is the forcing function: you cannot deposit the
    // tombstone without filing the issue, which is the step four earlier
    // diagnoses of the same defect all skipped.
    writeFileSync(join(root, "src", "types.ts"), "x\n");
    writeFileSync(join(checks, "a.md"), "<!-- known-defect: x :: src/types.ts -->\n");
    const run = runAgainst(root);
    expect(run.status).toBe(1);
    expect(run.stderr).toBe(
      claimsFail(
        'a.md: malformed known-defect marker (expected "<#issue> :: <exact substring> :: <path>"): ' +
          '"x :: src/types.ts"',
        0,
      ),
    );
  });

  it("refuses a tombstone whose owner is prose rather than an issue", () => {
    writeFileSync(join(root, "src", "types.ts"), "x\n");
    writeFileSync(join(checks, "a.md"), "<!-- known-defect: someday :: x :: src/types.ts -->\n");
    const run = runAgainst(root);
    expect(run.status).toBe(1);
    expect(run.stderr).toBe(
      claimsFail(
        "a.md: known-defect marker needs an issue reference (#N or a GitHub issue URL), " +
          'got: "someday"',
        0,
      ),
    );
  });

  it("accepts a full GitHub issue URL as the owner", () => {
    const url = "https://github.com/Comfy-Org/comfy-multi-player/issues/73";
    writeFileSync(join(root, "src", "types.ts"), "wrong text\n");
    writeFileSync(
      join(checks, "a.md"),
      '<!-- claim: wrong :: src/types.ts -->\n' +
        `<!-- known-defect: ${url} :: wrong text :: src/types.ts -->\n`,
    );
    const run = runAgainst(root);
    expect(run.status).toBe(0);
    expect(run.stdout).toBe(claimsPass(1, 0, 1, [`  - ${url} at src/types.ts (tombstone in a.md)`]));
  });

  it("does not let a self-targeted tombstone be satisfied by its own marker", () => {
    // The real tombstones point at profile prose, including the prose in the
    // same file. Markers are stripped before the test, so a tombstone whose
    // defect text exists nowhere but in the marker is red, not a vacuous pass.
    writeFileSync(
      join(checks, "a.md"),
      anchor + "<!-- known-defect: #73 :: (`applied`, `skipped`) :: .agents/checks/a.md -->\n",
    );
    writeFileSync(join(root, "src", "project.ts"), "const meta = doc.getMap('meta');\n");
    const bare = runAgainst(root);
    expect(bare.status).toBe(1);
    expect(bare.stderr).toContain("RESOLVED known-defect #73");

    writeFileSync(
      join(checks, "a.md"),
      anchor +
        "Rule 4: the (`applied`, `skipped`) shape is consumed downstream.\n" +
        "<!-- known-defect: #73 :: (`applied`, `skipped`) :: .agents/checks/a.md -->\n",
    );
    expect(runAgainst(root).status).toBe(0);
  });

  it("rejects a marker written in README.md, which the gate does not scan", () => {
    // The exclusion is silent, and a silently inert marker is the exact failure
    // this gate exists to stop — while the README itself tells authors to point
    // a ban at "the profile itself".
    writeFileSync(join(checks, "README.md"), "<!-- claim: anything :: src/index.ts -->\n");
    writeFileSync(join(checks, "a.md"), '<!-- claim: x :: src/index.ts -->\n');
    writeFileSync(join(root, "src", "index.ts"), "x anything\n");
    const run = runAgainst(root);
    expect(run.status).toBe(1);
    expect(run.stderr).toBe(
      "profile-claims check FAILED — 1 unindented claim marker(s) in README.md, which this gate does not scan (it is the convention doc, and its\n" +
        "examples would otherwise run as claims). A marker there is silently inert.\n" +
        "Move it to the profile that owns the fact, or indent it with SPACES to mark it\n" +
        "as an example (a tab does not count — it reads as indentation and would be skipped):\n" +
        "  <!-- claim: anything :: src/index.ts -->\n",
    );

    // A TAB reads as indentation to a human and to Markdown, so it must not be
    // accepted as an example marker — that would restore the silent inertness.
    writeFileSync(join(checks, "README.md"), "\t<!-- claim: anything :: src/index.ts -->\n");
    expect(runAgainst(root).status).toBe(1);

    // A marker split across two lines is a LIVE marker in a real profile,
    // because the marker regex's `\s*` spans a newline. A line-by-line scan saw
    // neither line as a marker and passed it silently — the inertness this rule
    // exists to stop, wearing the one disguise the rule could not see.
    writeFileSync(join(checks, "README.md"), "<!--\nclaim: anything :: src/index.ts -->\n");
    const multiline = runAgainst(root);
    expect(multiline.status).toBe(1);
    expect(multiline.stderr).toContain("<!-- claim: anything :: src/index.ts -->");

    // A marker whose BODY spans a newline is the shape the repo's own #16
    // tombstone has, and it must be caught at column 0 too. Pinned separately
    // because a scan that stopped at the end of the line still passed the
    // opening-newline case above.
    writeFileSync(
      join(checks, "README.md"),
      '<!-- known-defect: #1 :: */\n  version: number; :: src/index.ts -->\n',
    );
    expect(runAgainst(root).status).toBe(1);

    // The same text indented with spaces is an example, and stays one.
    writeFileSync(join(checks, "README.md"), "  <!--\n  claim: anything :: src/index.ts -->\n");
    expect(runAgainst(root).status).toBe(0);

    // Indented with a space, it is documentation and the gate is green again.
    writeFileSync(join(checks, "README.md"), "  <!-- claim: anything :: src/index.ts -->\n");
    expect(runAgainst(root).status).toBe(0);
  });

  it("trims the needle, so a needle cannot rely on leading whitespace", () => {
    // Pinned because the degradation is SILENT and unsafe: a needle chosen to be
    // unique BECAUSE of its indentation is stored without it, and then matches
    // somewhere the author never meant. `  version: number;` was picked to
    // exclude `base_version: number;` and, trimmed, matches it — the marker
    // passes forever against the wrong line. Anchor on a non-space character
    // instead. This test documents the behaviour so the next author meets it
    // here rather than in a tombstone that never fires.
    writeFileSync(join(root, "src", "index.ts"), "  base_version: number;\n  other: number;\n");
    writeFileSync(join(checks, "a.md"), "<!-- claim:   version: number; :: src/index.ts -->\n");
    // Passes although `  version: number;` (as written) is nowhere in the file.
    expect(runAgainst(root).status).toBe(0);
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
