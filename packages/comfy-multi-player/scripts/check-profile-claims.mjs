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
 * There is a third marker form, for a defect that has been DIAGNOSED and
 * deliberately NOT fixed — a tombstone:
 *
 *   <!-- known-defect: <#issue> :: <exact substring> :: <repo-relative path> -->
 *
 * It asserts the defective text is still there, and fails when it is gone, with
 * a diagnostic that tells the finder to delete the tombstone and close the
 * issue. That inversion is the whole point of a separate form: a positive
 * `claim` on the same substring would tell whoever fixed the defect to put it
 * back. The history: the rejection-oracle line in `test-quality.md` was
 * diagnosed independently by two merge reviews (#34, #58) and relayed into a
 * third (#60), each of which correctly scoped it out of its own change, and
 * every one of those findings was written to a report outside this repository.
 * Zero GitHub reviews and zero inline comments exist on those PRs, so no reader
 * of this repo — human or bot — ever met a warning attached to the line, and it
 * outlived all three. A tombstone makes the finding cost one line, name an
 * issue, and fail CI at the moment someone edits the text it is about.
 *
 * Markers are stripped out of the target text before any test runs. A
 * marker is metadata about prose, not prose; a claim that only its own marker
 * satisfies would be exactly the vacuous pass this gate exists to prevent, and
 * a ban on a phrase must not be tripped by the marker that spells the phrase
 * out. This is what lets a profile point a `claim-absent` at itself.
 *
 * Exit codes:
 *   0  every claim still holds
 *   1  one or more claims are stale (or target file missing)
 *   2  INCONCLUSIVE — no presence claims at all (a vacuous pass; add markers to
 *      the profiles that restate code facts, starting with api-contract.md).
 *      Bans and tombstones do not count: neither anchors a restated fact.
 */

import { readdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { dirname, join, resolve, sep as pathSep } from "node:path";
import { fileURLToPath } from "node:url";

// PROFILE_CLAIMS_ROOT overrides the repo root used to resolve claim targets, and
// PROFILE_CHECKS_DIR overrides the profiles directory; both exist so the test can
// run this gate against an isolated fixture tree instead of the real repo.
const root = process.env.PROFILE_CLAIMS_ROOT || dirname(dirname(fileURLToPath(import.meta.url)));
const checksDir = process.env.PROFILE_CHECKS_DIR || join(root, ".agents", "checks");

// <!-- claim: <needle> :: <path> -->                     needle MUST be present
// <!-- claim-absent: <needle> :: <path> -->              needle MUST NOT be present
// <!-- known-defect: <#issue> :: <needle> :: <path> -->  needle MUST be present,
//                                                        and is WRONG on purpose
// (a needle may contain any char except the closing "-->"; the path is taken
// after the LAST " :: ", and a tombstone's issue reference before the FIRST.)
const CLAIM_RE = /<!--\s*(claim-absent|claim|known-defect):\s*([\s\S]*?)\s*-->/g;

// A tombstone must name an owner. The gate checks the SHAPE only: `#99999` and
// a URL to a repository that does not exist both pass, so this makes filing the
// obvious thing to do, not an enforced one — the social half is still social,
// exactly as the proposal that prompted this said. Whether the issue is OPEN
// needs the network. That is implementable as an opt-in flag, the way
// `check:pins --verify-remote` is, and it is deliberately not built here: this
// gate is merge-blocking on every PR, and a merge-blocking verdict that depends
// on GitHub being reachable is worse than no verdict.
const ISSUE_RE = /^(#\d+|https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/issues\/\d+)$/;

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

// The exclusion above is silent, and silence is the failure this gate exists to
// stop: a marker written in README.md would simply never run, and the README
// itself tells authors to point a ban at "the profile itself". So a marker at
// column 0 in README.md is an error, not a no-op. Its documentation examples are
// indented, which is what distinguishes them.
const readmePath = join(checksDir, "README.md");
if (existsSync(readmePath)) {
  // "Indented" means a LEADING SPACE, specifically. A tab is indentation to a
  // reader and to Markdown, so a tab-indented marker would look like an example
  // and be skipped — restoring the silent inertness this rule exists to stop.
  // Scanned over the whole text rather than line by line, because `\s*` spans a
  // newline: `<!--\nclaim: x :: p -->` IS a live marker in a real profile, and a
  // line-by-line filter saw neither line as one and passed it silently — the
  // exact inertness this rule exists to stop. A marker counts as an example only
  // if its OPENING `<!--` has a space before it on its own line.
  const readmeText = readFileSync(readmePath, "utf8");
  // A marker is an EXAMPLE only if the text between the start of its line and
  // its opening `<!--` is one or more characters and all of them are spaces.
  // Everything else — column 0, a tab, a bullet — is a live-looking marker that
  // this gate would silently skip.
  const isExample = (index) => {
    const lineStart = readmeText.lastIndexOf("\n", index - 1) + 1;
    const prefix = readmeText.slice(lineStart, index);
    return prefix.length > 0 && /^ +$/.test(prefix);
  };
  const stray = [...readmeText.matchAll(/<!--\s*(?:claim|claim-absent|known-defect):[\s\S]*?-->/g)]
    .filter((m) => !isExample(m.index))
    .map((m) => m[0].replace(/\s+/g, " "));
  if (stray.length > 0) {
    console.error(
      `profile-claims check FAILED — ${stray.length} unindented claim marker(s) in ` +
        "README.md, which this gate does not scan (it is the convention doc, and its\n" +
        "examples would otherwise run as claims). A marker there is silently inert.\n" +
        "Move it to the profile that owns the fact, or indent it with SPACES to mark it\n" +
        "as an example (a tab does not count — it reads as indentation and would be skipped):\n" +
        stray.map((marker) => `  ${marker}`).join("\n"),
    );
    process.exit(1);
  }
}

let positiveCount = 0;
let absentCount = 0;
let defectCount = 0;
const stale = [];
const tombstones = [];

for (const name of profiles) {
  const profilePath = join(checksDir, name);
  const text = readFileSync(profilePath, "utf8");
  for (const match of text.matchAll(CLAIM_RE)) {
    const kind = match[1];
    const mustBeAbsent = kind === "claim-absent";
    const isTombstone = kind === "known-defect";
    const body = match[2];
    const sep = body.lastIndexOf(" :: ");
    if (sep === -1) {
      stale.push(
        `${name}: malformed ${isTombstone ? "known-defect" : "claim"} marker ` +
          `(missing " :: " separator): ${JSON.stringify(body)}`,
      );
      continue;
    }
    let head = body.slice(0, sep);
    const target = body.slice(sep + 4).trim();
    let issue = null;
    if (isTombstone) {
      const refSep = head.indexOf(" :: ");
      if (refSep === -1) {
        stale.push(
          `${name}: malformed known-defect marker ` +
            `(expected "<#issue> :: <exact substring> :: <path>"): ${JSON.stringify(body)}`,
        );
        continue;
      }
      issue = head.slice(0, refSep).trim();
      head = head.slice(refSep + 4);
      if (!ISSUE_RE.test(issue)) {
        stale.push(
          `${name}: known-defect marker needs an issue reference (#N or a GitHub ` +
            `issue URL), got: ${JSON.stringify(issue)}`,
        );
        continue;
      }
    }
    const needle = head.trim();
    if (mustBeAbsent) absentCount += 1;
    else if (isTombstone) defectCount += 1;
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
    if (isTombstone) {
      if (present) tombstones.push(`  - ${issue} at ${target} (tombstone in ${name})`);
      else {
        stale.push(
          `${name}: RESOLVED known-defect ${issue} — the defect text is gone from ${target}:\n` +
            `      ${needle}\n` +
            `      If it is fixed, delete this tombstone and close ${issue}. ` +
            `If it only moved, repoint the marker.`,
        );
      }
    } else if (mustBeAbsent && present) {
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
      `Checked ${positiveCount} presence claim(s), ${absentCount} absence claim(s) ` +
      `and ${defectCount} known-defect tombstone(s).`,
  );
  process.exit(1);
}

// The floor stays exactly where #74 put it: on PRESENCE claims. Neither of the
// other two forms anchors a restated fact — a ban passes against almost any
// file, and a tombstone anchors text the profile says is WRONG. A marker set
// made of nothing but those would satisfy a widened floor while leaving every
// restated fact unverified, which is the vacuous pass that floor exists to
// prevent. Widening it to include tombstones was considered and rejected.
if (positiveCount === 0) {
  console.error(
    `profile-claims check INCONCLUSIVE — no presence claims in .agents/checks/*.md ` +
      `(${absentCount} absence claim(s) and ${defectCount} known-defect tombstone(s) found, ` +
      `which anchor no restated fact).\n` +
      'Annotate each restated code fact with `<!-- claim: <exact substring> :: <path> -->`\n' +
      "so it fails when the code drifts, and each retired-because-wrong phrase with\n" +
      '`<!-- claim-absent: <exact substring> :: <path> -->` so it fails when the phrase\n' +
      "comes back. Start with api-contract.md's export list.",
  );
  process.exit(2);
}

console.log(
  `profile-claims check PASSED (${positiveCount} presence + ${absentCount} absence claims ` +
    `still hold, ${defectCount} known-defect tombstone(s) standing)`,
);
// Print the roster on every green run. A tombstone is only worth writing if
// something surfaces it, and CI output is the one place every contributor
// already looks. The gate cannot tell whether the issue is still open — that
// needs the network — so the roster is a prompt to check, not an assertion.
if (tombstones.length > 0) {
  console.log(
    "known-defect tombstones still standing (this gate cannot tell whether an issue is open):",
  );
  for (const line of tombstones) console.log(line);
}
