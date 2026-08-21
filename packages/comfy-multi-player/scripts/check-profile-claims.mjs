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
 * There is a second marker form, for facts whose content is an ABSENCE:
 *
 *   <!-- claim-absent: <exact substring> :: <repo-relative path> -->
 *
 * which fails when the substring IS present. Two things need it, and the
 * positive form structurally cannot express either. First, a profile that says
 * "`project()` cannot observe `__stamps`, so it is the wrong oracle for a
 * rejection" is resting on `src/project.ts` NOT naming that map; make the
 * projection render it and the profile's justification is silently false, which
 * is the same drift class in the other direction. Second, advice that has been
 * retired for being wrong (the history that prompted this: `test-quality.md` §2 told
 * reviewers to compare a projection snapshot across a rejection, an oracle that
 * returns `bytesEq=false, projEq=true` on the very defect class it names) can be
 * re-typed by the next author, and a gate that only checks what a profile still
 * says cannot notice what it started saying again.
 *
 * Claim markers are stripped out of the target text before either test runs. A
 * marker is metadata about prose, not prose; a claim that only its own marker
 * satisfies would be exactly the vacuous pass this gate exists to prevent, and
 * a ban on a phrase must not be tripped by the marker that spells the phrase
 * out. This is what lets a profile point a `claim-absent` at itself.
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

// <!-- claim: <needle> :: <path> -->            needle MUST be present in path
// <!-- claim-absent: <needle> :: <path> -->     needle MUST NOT be present
// (needle may contain any char except the literal " :: " separator and the
// closing "-->"; split on the LAST " :: ").
const CLAIM_RE = /<!--\s*claim(-absent)?:\s*([\s\S]*?)\s*-->/g;

/**
 * Strip claim markers from a target's text before testing it. A marker is
 * metadata about prose, never prose: a positive claim satisfied only by some
 * other profile's marker would be a vacuous pass, and a `claim-absent` that
 * bans a phrase must not be tripped by the marker that spells the phrase out
 * (which is what makes a self-targeted ban possible at all).
 */
// Replaced with a newline, not the empty string: deleting a marker outright
// would join the text on either side of it, and a needle spanning that seam
// would then match where it previously did not. Stripping must only ever make
// a positive claim harder to satisfy.
const withoutMarkers = (text) => text.replace(new RegExp(CLAIM_RE.source, "g"), "\n");

// README.md is the index/convention doc, not a review profile — it documents the
// claim-marker syntax (including an example marker), so it is not scanned.
const profiles = readdirSync(checksDir)
  .filter((name) => name.endsWith(".md") && name !== "README.md")
  .sort();

let positiveCount = 0;
let absentCount = 0;
const stale = [];

for (const name of profiles) {
  const profilePath = join(checksDir, name);
  const text = readFileSync(profilePath, "utf8");
  for (const match of text.matchAll(CLAIM_RE)) {
    const mustBeAbsent = match[1] === "-absent";
    const body = match[2];
    const sep = body.lastIndexOf(" :: ");
    if (sep === -1) {
      stale.push(
        `${name}: malformed claim marker (missing " :: " separator): ${JSON.stringify(body)}`,
      );
      continue;
    }
    const needle = body.slice(0, sep).trim();
    const target = body.slice(sep + 4).trim();
    if (mustBeAbsent) absentCount += 1;
    else positiveCount += 1;

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
    const targetText = withoutMarkers(readFileSync(targetPath, "utf8"));
    const present = targetText.includes(needle);
    if (mustBeAbsent && present) {
      stale.push(
        `${name}: REVIVED claim — banned text is present again in ${target}:\n      ${needle}`,
      );
    } else if (!mustBeAbsent && !present) {
      stale.push(
        `${name}: STALE claim — not found in ${target}:\n      ${needle}`,
      );
    }
  }
}

if (stale.length > 0) {
  console.error("profile-claims check FAILED — profile claims no longer hold:\n");
  for (const message of stale) console.error(`  - ${message}`);
  console.error(
    `\nFix the profile prose to match the code (or correct the marker). ` +
      `Checked ${positiveCount} presence claim(s) and ${absentCount} absence claim(s).`,
  );
  process.exit(1);
}

// The floor is on PRESENCE claims specifically. An absence claim passes against
// almost any file, so a profile set carrying only bans would satisfy a combined
// floor while anchoring no restated fact at all — nonzero work unit, zero work.
if (positiveCount === 0) {
  console.error(
    `profile-claims check INCONCLUSIVE — no presence claims in .agents/checks/*.md ` +
      `(${absentCount} absence claim(s) found, which anchor no restated fact).\n` +
      'Annotate each restated code fact with `<!-- claim: <exact substring> :: <path> -->`\n' +
      "so it fails when the code drifts, and each retired-because-wrong phrase with\n" +
      '`<!-- claim-absent: <exact substring> :: <path> -->` so it fails when the phrase\n' +
      "comes back. Start with api-contract.md's export list.",
  );
  process.exit(2);
}

console.log(
  `profile-claims check PASSED (${positiveCount} presence + ${absentCount} absence claims still hold)`,
);
