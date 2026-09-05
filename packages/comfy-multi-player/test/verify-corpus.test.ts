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

// The script's diagnostics are its contract, so assert the exact stderr/stdout
// rather than a substring. `fail(messages)` prints one "corpus verification
// FAILED:" header line followed by one "  - <message>" line per message, each
// terminated by a newline (`console.error` appends "\n"); `corpusFail` rebuilds
// that byte-for-byte so a wording drift is caught, not silently tolerated.
const corpusFail = (...lines: string[]) =>
  ["corpus verification FAILED:", ...lines.map((line) => `  - ${line}`), ""].join("\n");

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
    expect(run.stderr).toBe(
      corpusFail("MANIFEST.json lists zero fixtures — the conformance corpus must not be empty"),
    );
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
    expect(run.stderr).toBe(corpusFail("a.json is not listed in MANIFEST.json"));
  });

  it("fails closed on a malformed (non-JSON) manifest", () => {
    writeFileSync(join(dir, "MANIFEST.json"), "{ not valid json");
    const run = runAgainst(dir);
    expect(run.status).toBe(1);
    // Only the framing is ours; the JSON parser's message text is Node-version
    // controlled, so pin our prefix exactly and require the trailing newline
    // rather than asserting the whole line.
    expect(
      run.stderr.startsWith(
        "corpus verification FAILED:\n  - could not read fixtures/MANIFEST.json: ",
      ),
    ).toBe(true);
    expect(run.stderr.endsWith("\n")).toBe(true);
  });

  it("fails closed when files is not an object", () => {
    writeFileSync(join(dir, "MANIFEST.json"), JSON.stringify({ files: [] }));
    const run = runAgainst(dir);
    expect(run.status).toBe(1);
    expect(run.stderr).toBe(corpusFail("MANIFEST.json must contain a files object"));
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
    expect(run.stdout).toBe("corpus verification PASSED (1 files)\n");
  });
});
