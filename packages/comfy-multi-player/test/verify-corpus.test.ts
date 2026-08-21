import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const script = join(root, "scripts", "verify-corpus.mjs");

function runAgainst(dir: string) {
  return spawnSync("node", [script], {
    encoding: "utf8",
    env: { ...process.env, CORPUS_FIXTURES_DIR: dir },
  });
}

describe("verify-corpus fail-closed guards", () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "corpus-"));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("fails closed on an empty manifest instead of a vacuous pass", () => {
    writeFileSync(join(dir, "MANIFEST.json"), JSON.stringify({ files: {} }));
    const run = runAgainst(dir);
    expect(run.status).toBe(1);
    expect(run.stderr).toContain("must not be empty");
  });

  it("fails when a fixture is present but unlisted in the manifest", () => {
    writeFileSync(join(dir, "a.json"), "{}");
    const known = "b.json";
    const body = "{}";
    const sha = createHash("sha256").update(body).digest("hex");
    writeFileSync(join(dir, known), body);
    writeFileSync(
      join(dir, "MANIFEST.json"),
      JSON.stringify({ files: { [known]: { sha256: sha } } }),
    );
    const run = runAgainst(dir);
    expect(run.status).toBe(1);
    expect(run.stderr).toContain("a.json is not listed");
  });

  it("fails closed on a malformed (non-JSON) manifest", () => {
    writeFileSync(join(dir, "MANIFEST.json"), "{ not valid json");
    const run = runAgainst(dir);
    expect(run.status).toBe(1);
    expect(run.stderr).toContain("could not read fixtures/MANIFEST.json");
  });

  it("fails closed when files is not an object", () => {
    writeFileSync(join(dir, "MANIFEST.json"), JSON.stringify({ files: [] }));
    const run = runAgainst(dir);
    expect(run.status).toBe(1);
    expect(run.stderr).toContain("MANIFEST.json must contain a files object");
  });

  it("passes on a non-empty manifest whose hashes match", () => {
    const body = '{"ok":true}';
    const sha = createHash("sha256").update(body).digest("hex");
    writeFileSync(join(dir, "c.json"), body);
    writeFileSync(
      join(dir, "MANIFEST.json"),
      JSON.stringify({ files: { "c.json": { sha256: sha } } }),
    );
    const run = runAgainst(dir);
    expect(run.status).toBe(0);
    expect(run.stdout).toContain("PASSED (1 files)");
  });
});
