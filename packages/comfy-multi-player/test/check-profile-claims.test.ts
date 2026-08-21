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
    expect(run.stderr).toContain("INCONCLUSIVE");
  });

  it("passes when every claimed substring is present in its target", () => {
    writeFileSync(join(root, "src", "index.ts"), 'export { mint } from "./mint.js";\n');
    writeFileSync(
      join(checks, "a.md"),
      '<!-- claim: export { mint } from "./mint.js" :: src/index.ts -->\n',
    );
    const run = runAgainst(root);
    expect(run.status).toBe(0);
    expect(run.stdout).toContain("PASSED (1 claims still hold)");
  });

  it("fails when a claimed export has been renamed away", () => {
    writeFileSync(join(root, "src", "index.ts"), 'export { renamed } from "./mint.js";\n');
    writeFileSync(
      join(checks, "a.md"),
      '<!-- claim: export { mint } from "./mint.js" :: src/index.ts -->\n',
    );
    const run = runAgainst(root);
    expect(run.status).toBe(1);
    expect(run.stderr).toContain("STALE claim");
  });

  it("fails when the claim target file does not exist", () => {
    writeFileSync(join(checks, "a.md"), "<!-- claim: anything :: src/gone.ts -->\n");
    const run = runAgainst(root);
    expect(run.status).toBe(1);
    expect(run.stderr).toContain("does not exist");
  });

  it("fails when the claim target escapes the repo root", () => {
    writeFileSync(join(checks, "a.md"), "<!-- claim: root: :: ../../../../etc/passwd -->\n");
    const run = runAgainst(root);
    expect(run.status).toBe(1);
    expect(run.stderr).toContain("escapes the repo root");
  });

  it("fails when the claim target is a directory, not a file", () => {
    writeFileSync(join(checks, "a.md"), "<!-- claim: anything :: src -->\n");
    const run = runAgainst(root);
    expect(run.status).toBe(1);
    expect(run.stderr).toContain("not a regular file");
  });

  it("fails on a malformed marker missing the separator", () => {
    writeFileSync(join(checks, "a.md"), "<!-- claim: no separator here -->\n");
    const run = runAgainst(root);
    expect(run.status).toBe(1);
    expect(run.stderr).toContain("malformed claim marker");
  });
});
