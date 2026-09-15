#!/usr/bin/env node
/** Verify that every checked-in conformance fixture matches its manifest hash. */

import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
// CORPUS_FIXTURES_DIR overrides the fixtures directory (used by the test that
// exercises the fail-closed guards against synthetic manifests); defaults to
// the real corpus.
const fixturesDir = process.env.CORPUS_FIXTURES_DIR || join(root, "fixtures");
const manifestPath = join(fixturesDir, "MANIFEST.json");

function fail(messages) {
  console.error("corpus verification FAILED:");
  for (const message of messages) console.error(`  - ${message}`);
  process.exit(1);
}

let manifest;
try {
  manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
} catch (error) {
  fail([`could not read fixtures/MANIFEST.json: ${error.message}`]);
}

const entries = manifest?.files;
if (!entries || typeof entries !== "object" || Array.isArray(entries)) {
  fail(["MANIFEST.json must contain a files object"]);
}

// Only hash regular top-level fixture files. Subdirectories (e.g.
// golden-vectors/, owned by the parity conformance suite) are verified by their
// own tests, not this corpus manifest — a flat readdir would otherwise try to
// hash a directory and crash (EISDIR) or spuriously flag it as unlisted.
const fixtureFiles = readdirSync(fixturesDir)
  .filter((name) => name !== "README.md" && name !== "MANIFEST.json")
  .filter((name) => statSync(join(fixturesDir, name)).isFile())
  .sort();
const manifestFiles = Object.keys(entries).sort();
const errors = [];

// Fail closed on an empty corpus: a manifest that lists zero fixtures makes
// every downstream check vacuous (it would otherwise print "PASSED (0 files)"),
// which is indistinguishable from a real pass. A conformance corpus must be
// non-empty for its verification to mean anything.
if (manifestFiles.length === 0) {
  fail(["MANIFEST.json lists zero fixtures — the conformance corpus must not be empty"]);
}

for (const file of fixtureFiles) {
  if (!(file in entries)) errors.push(`${file} is not listed in MANIFEST.json`);
}
for (const file of manifestFiles) {
  if (!fixtureFiles.includes(file)) errors.push(`${file} is listed but missing from fixtures/`);
}

for (const file of manifestFiles.filter((name) => fixtureFiles.includes(name))) {
  const expected = entries[file]?.sha256;
  if (typeof expected !== "string" || !/^[a-f0-9]{64}$/.test(expected)) {
    errors.push(`${file} has an invalid sha256 in MANIFEST.json`);
    continue;
  }
  const actual = createHash("sha256").update(readFileSync(join(fixturesDir, file))).digest("hex");
  if (actual !== expected) errors.push(`${file}: expected ${expected}, got ${actual}`);
}

if (errors.length > 0) fail(errors);
console.log(`corpus verification PASSED (${manifestFiles.length} files)`);
