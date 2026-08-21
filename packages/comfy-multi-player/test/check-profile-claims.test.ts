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
const claimsFail = (message: string, checked: number) =>
  "profile-claims check FAILED — profiles restate code facts that no longer hold:\n\n" +
  `  - ${message}\n` +
  `\nFix the profile prose to match the code (or correct the marker). Checked ${checked} claim(s).\n`;

const claimsInconclusive =
  "profile-claims check INCONCLUSIVE — no claim markers found in .agents/checks/*.md.\n" +
  "Annotate each restated code fact with `<!-- claim: <exact substring> :: <path> -->`\n" +
  "so it fails when the code drifts. Start with api-contract.md's export list.\n";

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
    expect(run.stderr).toBe(claimsInconclusive);
  });

  it("passes when every claimed substring is present in its target", () => {
    writeFileSync(join(root, "src", "index.ts"), 'export { mint } from "./mint.js";\n');
    writeFileSync(
      join(checks, "a.md"),
      '<!-- claim: export { mint } from "./mint.js" :: src/index.ts -->\n',
    );
    const run = runAgainst(root);
    expect(run.status).toBe(0);
    expect(run.stdout).toBe("profile-claims check PASSED (1 claims still hold)\n");
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
