#!/usr/bin/env node
/**
 * Staleness gate for the prose `.agents/checks/` review profiles.
 *
 * The prose profiles restate facts about the code (exported symbol names, the
 * wire envelope shape, invariant IDs). Those restated facts drift silently:
 * `api-contract.md` once asserted that `src/index.ts` re-exported a symbol that
 * had been removed, so a reviewer agent citing the profile "verified" a contract
 * that no longer existed. Nothing caught it because prose is not executed.
 *
 * This gate makes the load-bearing facts checkable. A profile annotates each such
 * fact with an inline claim marker:
 *
 *   <!-- claim: <exact substring> :: <repo-relative path> -->
 *
 * The gate reads every `.agents/checks/`*.md`, and for each marker asserts that
 * <exact substring> is still present verbatim in <path>. If the substring is
 * gone (symbol renamed/removed) or the file is missing, the profile's claim has
 * gone stale and the gate fails, naming the profile, the claim, and the target.
 *
 * The match is a literal substring test (no regex), so quotes and punctuation in
 * the claim are compared as written.
 *
 * Exit codes:
 *   0  every claim still holds
 *   1  one or more claims are stale (or target file missing)
 *   2  INCONCLUSIVE — no claim markers found at all (a vacuous pass; add markers
 *      to the profiles that restate code facts, starting with api-contract.md)
 */

import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { dirname, join, resolve, sep as pathSep } from "node:path";
import { fileURLToPath } from "node:url";

// PROFILE_CLAIMS_ROOT overrides the repo root used to resolve claim targets, and
// PROFILE_CHECKS_DIR overrides the profiles directory; both exist so the test can
// run this gate against an isolated fixture tree instead of the real repo.
const root = process.env.PROFILE_CLAIMS_ROOT || dirname(dirname(fileURLToPath(import.meta.url)));
const checksDir = process.env.PROFILE_CHECKS_DIR || join(root, ".agents", "checks");

// <!-- claim: <needle> :: <path> -->  (needle may contain any char except the
// literal " :: " separator and the closing "-->"; split on the LAST " :: ").
const CLAIM_RE = /<!--\s*claim:\s*([\s\S]*?)\s*-->/g;

// README.md is the index/convention doc, not a review profile — it documents the
// claim-marker syntax (including an example marker), so it is not scanned.
const profiles = readdirSync(checksDir)
  .filter((name) => name.endsWith(".md") && name !== "README.md")
  .sort();

let claimCount = 0;
const stale = [];

for (const name of profiles) {
  const profilePath = join(checksDir, name);
  const text = readFileSync(profilePath, "utf8");
  for (const match of text.matchAll(CLAIM_RE)) {
    const body = match[1];
    const sep = body.lastIndexOf(" :: ");
    if (sep === -1) {
      stale.push(
        `${name}: malformed claim marker (missing " :: " separator): ${JSON.stringify(body)}`,
      );
      continue;
    }
    const needle = body.slice(0, sep).trim();
    const target = body.slice(sep + 4).trim();
    claimCount += 1;

    if (!needle) {
      stale.push(`${name}: empty claim needle for target ${target}`);
      continue;
    }
    // A claim target is a repo-relative path to a committed source file. Reject
    // anything that escapes the root (traversal) or is not a regular file before
    // reading it, so a marker cannot point the gate at /etc/passwd or a directory.
    const rootResolved = resolve(root);
    const targetPath = resolve(rootResolved, target);
    if (targetPath !== rootResolved && !targetPath.startsWith(rootResolved + pathSep)) {
      stale.push(
        `${name}: claim target escapes the repo root: ${target}\n      claim: ${needle}`,
      );
      continue;
    }
    if (!existsSync(targetPath)) {
      stale.push(
        `${name}: claim target does not exist: ${target}\n      claim: ${needle}`,
      );
      continue;
    }
    if (!statSync(targetPath).isFile()) {
      stale.push(
        `${name}: claim target is not a regular file: ${target}\n      claim: ${needle}`,
      );
      continue;
    }
    const targetText = readFileSync(targetPath, "utf8");
    if (!targetText.includes(needle)) {
      stale.push(
        `${name}: STALE claim — not found in ${target}:\n      ${needle}`,
      );
    }
  }
}

if (stale.length > 0) {
  console.error("profile-claims check FAILED — profiles restate code facts that no longer hold:\n");
  for (const message of stale) console.error(`  - ${message}`);
  console.error(
    `\nFix the profile prose to match the code (or correct the marker). Checked ${claimCount} claim(s).`,
  );
  process.exit(1);
}

if (claimCount === 0) {
  console.error(
    "profile-claims check INCONCLUSIVE — no claim markers found in .agents/checks/*.md.\n" +
      'Annotate each restated code fact with `<!-- claim: <exact substring> :: <path> -->`\n' +
      "so it fails when the code drifts. Start with api-contract.md's export list.",
  );
  process.exit(2);
}

console.log(`profile-claims check PASSED (${claimCount} claims still hold)`);
