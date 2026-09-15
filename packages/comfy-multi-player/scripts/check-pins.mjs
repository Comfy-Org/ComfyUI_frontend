#!/usr/bin/env node
/**
 * Cross-repository citation-pin gate for @comfyorg/comfy-multi-player (FC-10, KA-12).
 *
 * FC-10 says never cite the frozen vocabulary or the catalog by a moving
 * branch. The reason is not tidiness: a branch pointer re-targets whenever the
 * other repository moves, so a citation that was accurate when written becomes
 * a claim about a document that no longer says that, and nothing goes red. This
 * repository had three such citations; the branch they named was deleted
 * upstream while they were still in the tree.
 *
 * A SHA pin fixes that once. It does not stay fixed by itself — an unre-checked
 * pin goes stale silently, which is the same failure one level up. Hence this
 * gate.
 *
 * OFFLINE mode (default; runs in CI, no network):
 *   1. `docs/upstream-pins.json` parses, and every pin declares a 40-hex commit,
 *      a repo, a path, a non-empty `cited_by`, and a non-empty `sections_cited`.
 *   2. Every file listed in a pin's `cited_by` exists and contains that pin's
 *      full commit SHA. A citation that drops or mistypes the SHA fails here.
 *   3. No tracked file cites an upstream repository by a moving reference —
 *      `(branch \`x\`)`, `#branch`, `@main`, `tree/<ref>`, `blob/<ref>` — unless
 *      the line is explicitly marked as historical context (see ALLOW_MARKERS).
 *
 * REMOTE mode (`--verify-remote`; opt-in, needs network + `gh`):
 *   4. Every pinned commit still resolves in its upstream repository, the
 *      pinned path still exists at it, and the blob still hashes to the
 *      recorded `blob_sha1` / `content_sha256`. Objects on deleted branches are
 *      the ones at risk, so this is the check that catches a pin going dark.
 *   5. Every section in `sections_cited` still has a heading in the pinned
 *      revision of the pinned Markdown file. A pin whose cited section has been
 *      renumbered is precise and useless.
 *
 * Non-vacuousness: a run that inspects fewer than MIN_CITATION_SITES citation
 * sites or fewer than MIN_SCANNED_FILES tree files is INCONCLUSIVE, not clean —
 * a green that analyzed nothing proves nothing. Same rule, same exit codes, as
 * scripts/check-import-graph.mjs and scripts/check-profile-claims.mjs.
 *
 * The moving-reference scan (rule 3) runs over CONTINUATION-JOINED blocks, not
 * raw lines: this repository writes its citations across wrapped JSDoc and
 * Markdown lines, so `(branch` and the branch name routinely land on different
 * lines. A line-scoped version of this rule caught one of the three citations
 * that motivated it and passed the other two.
 *
 * Exit codes: 0 pinned, 1 violation, 2 inconclusive (registry missing or
 * unparseable, nothing scanned, or — in remote mode — no definitive answer from
 * upstream). "No definitive answer" includes an unusable token and a rate limit:
 * only 404/422/451 are evidence about a pin.
 */

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const registryPath = join(root, "docs", "upstream-pins.json");
const verifyRemote = process.argv.includes("--verify-remote");

/**
 * Floors for a run to count as real. Three source/doc citations plus the README
 * is the minimum this repository has ever carried, and the tree-wide scan sees
 * every tracked text file, so a count near zero means the scan missed files
 * rather than that the citations were removed. Raise them if the surface grows;
 * never lower one to make a run pass.
 */
const MIN_CITATION_SITES = 4;
const MIN_SCANNED_FILES = 20;

/** Upstream repositories whose citations must be SHA-pinned. */
const UPSTREAM_REPOS = [/comfy-cli/i, /op-vocabulary/i, /workflow_ops/i, /object_info/i];

/**
 * Moving-reference shapes. A branch or tag name in a citation is the defect;
 * a bare word "branch" in prose is not, so these all require the reference to
 * be named, not merely mentioned.
 */
const MOVING_REF_PATTERNS = [
  { name: "(branch `x`)", re: /\(\s*branch\s+`[^`]+`/i },
  { name: "branch `x` citation", re: /\bbranch\s+`[a-z0-9][\w./-]*\/[\w./-]+`/i },
  { name: "git ref suffix `#branch`", re: /github:[\w.-]+\/[\w.-]+#(?!\[)(?![0-9a-f]{7,40}\b)[\w./-]+/i },
  { name: "`@main`-style pin", re: /@(main|master|HEAD)\b(?!\.)/ },
  { name: "GitHub tree/blob ref", re: /github\.com\/[\w.-]+\/[\w.-]+\/(tree|blob)\/(?![0-9a-f]{7,40}\/)[\w./-]+/i },
];

/**
 * Markers that legitimately name a dead or historical branch. FC-10 is about
 * what a citation RESOLVES to; naming the branch a pin replaced is provenance,
 * and removing that context would make the pins harder to audit, not easier.
 *
 * These are STRUCTURAL on purpose. An earlier cut also accepted ordinary English
 * — "no longer exists", "was deleted", "since renamed" — which meant any line
 * carrying a live moving citation plus one of those phrases went green, and they
 * are phrases a well-meaning author writes by accident. Prose cannot be the
 * escape hatch for a rule about prose. A registry field name or an explicit
 * `FC-10-historical` marker is a deliberate act; a turn of phrase is not.
 *
 * The marker must fall inside the same citation window, so it cannot be pasted
 * once at the top of a file to silence the rest of it.
 */
const ALLOW_MARKERS = [/former_branch_citation/, /branch_status/, /FC-10-historical/];

const SCAN_EXTENSIONS = [".ts", ".mts", ".mjs", ".js", ".cjs", ".md", ".json", ".yml", ".yaml"];
const SCAN_EXCLUDE = [/^dist\//, /^node_modules\//, /^package-lock\.json$/, /^\.git\//];

function inconclusive(message, ...detail) {
  console.error(`pin check INCONCLUSIVE: ${message}`);
  for (const line of detail) console.error(`  ${line}`);
  process.exit(2);
}

function fail(errors, scanned) {
  console.error(`pin check FAILED: ${errors.length} violation(s) over ${scanned}`);
  for (const error of errors) console.error(`  - ${error}`);
  console.error("\nFC-10 / KA-12: cite the frozen vocabulary and catalog by immutable SHA, never by");
  console.error("branch. The registry is docs/upstream-pins.json; see docs/INVARIANTS.md.");
  process.exit(1);
}

// --------------------------------------------------------------------------
// 0. Registry
// --------------------------------------------------------------------------

if (!existsSync(registryPath)) {
  inconclusive(
    "docs/upstream-pins.json is missing, so nothing could be checked",
    "This registry is the enforcement input, not documentation. Restore it rather than",
    "removing the gate: with no registry there is no record of what the citations mean.",
  );
}

let registry;
try {
  registry = JSON.parse(readFileSync(registryPath, "utf8"));
} catch (error) {
  inconclusive(`could not parse docs/upstream-pins.json: ${error.message}`);
}

const pins = registry?.pins;
if (!pins || typeof pins !== "object" || Array.isArray(pins) || Object.keys(pins).length === 0) {
  inconclusive("docs/upstream-pins.json declares no pins, so a clean run would prove nothing");
}

// --------------------------------------------------------------------------
// 1. Tracked-file inventory. git ls-files is the source of truth so an
//    untracked scratch file can neither trip nor silence the gate.
// --------------------------------------------------------------------------

const ls = spawnSync("git", ["-C", root, "ls-files", "-z"], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
if (ls.error || ls.status !== 0) {
  inconclusive(
    "could not list tracked files with git",
    ls.error?.message ?? ls.stderr?.trim() ?? `git exited ${ls.status}`,
  );
}

const tracked = ls.stdout
  .split("\0")
  .filter(Boolean)
  .filter((file) => SCAN_EXTENSIONS.some((extension) => file.endsWith(extension)))
  .filter((file) => !SCAN_EXCLUDE.some((pattern) => pattern.test(file)))
  .sort();

if (tracked.length < MIN_SCANNED_FILES) {
  inconclusive(
    `scanned ${tracked.length} tracked files, expected at least ${MIN_SCANNED_FILES}`,
    "Nothing meaningful was inspected, so 'no moving citations' proves nothing.",
  );
}

const errors = [];

// --------------------------------------------------------------------------
// 2. Registry shape, and every citation site carries its pin's SHA.
// --------------------------------------------------------------------------

let citationSites = 0;

for (const [id, pin] of Object.entries(pins)) {
  if (typeof pin?.commit !== "string" || !/^[0-9a-f]{40}$/.test(pin.commit)) {
    errors.push(`${id}: commit must be a full 40-hex SHA, got ${JSON.stringify(pin?.commit)}`);
    continue;
  }
  if (typeof pin.repo !== "string" || !pin.repo.startsWith("https://")) {
    errors.push(`${id}: repo must be an https URL`);
  }
  if (typeof pin.path !== "string" || pin.path.length === 0) {
    errors.push(`${id}: path must name the cited file in the upstream repository`);
  }
  if (typeof pin.established_by !== "string" || pin.established_by.length < 40) {
    errors.push(
      `${id}: established_by must record HOW this SHA was resolved. A pin with no derivation is` +
        " an unverified claim that the citation is accurate — the thing FC-10 exists to prevent.",
    );
  }
  if (!Array.isArray(pin.sections_cited) || pin.sections_cited.length === 0) {
    errors.push(`${id}: sections_cited must list what this package actually reads at the pin`);
  }
  if (!Array.isArray(pin.cited_by) || pin.cited_by.length === 0) {
    errors.push(`${id}: cited_by must list the files carrying this pin`);
    continue;
  }

  for (const site of pin.cited_by) {
    const sitePath = join(root, site);
    if (!existsSync(sitePath)) {
      errors.push(`${id}: cited_by names ${site}, which does not exist`);
      continue;
    }
    citationSites += 1;
    if (!readFileSync(sitePath, "utf8").includes(pin.commit)) {
      errors.push(
        `${site} is registered as citing ${id} but does not contain ${pin.commit}` +
          " — the citation and the registry have drifted apart",
      );
    }
  }
}

// A thin run is only "inconclusive" when there is nothing else to report. If the
// registry is already failing its shape checks, that is a definite violation and
// must not be downgraded to "could not check".
if (citationSites < MIN_CITATION_SITES && errors.length === 0) {
  inconclusive(
    `inspected ${citationSites} citation sites, expected at least ${MIN_CITATION_SITES}`,
    "Either the registry lost its cited_by entries or the citations were removed; either way a",
    "pass here would mean the gate checked almost nothing.",
  );
}
if (citationSites < MIN_CITATION_SITES) {
  errors.push(
    `only ${citationSites} citation sites were inspected (floor ${MIN_CITATION_SITES}); the` +
      " violations above left pins unresolvable, so coverage below is partial",
  );
}

// --------------------------------------------------------------------------
// 3. Tree-wide moving-reference lint (docs/ROADMAP.md "Catalog-SHA lint").
// --------------------------------------------------------------------------

const selfPath = "scripts/check-pins.mjs";

/**
 * How many consecutive lines a single citation may span. Citations here wrap
 * across JSDoc continuation lines and Markdown prose; `(branch` and the branch
 * name are routinely on different lines, and a per-line scan sees neither half
 * as a violation. Three covers every citation shape in this tree with room to
 * spare — the longest real one, docs/multiplayer-schema.md's Amendment A1
 * paragraph, wraps across two.
 */
const WINDOW_LINES = 3;

/** Strip leading comment/quote furniture so a wrapped citation reads as prose. */
const stripContinuation = (line) => line.replace(/^\s*(?:\/\/+|\*+|#+|>+)\s?/, "").trim();

for (const file of tracked) {
  if (file === selfPath) continue; // this file quotes the patterns it bans
  const lines = readFileSync(join(root, file), "utf8").split("\n");
  const stripped = lines.map(stripContinuation);

  let index = 0;
  while (index < lines.length) {
    let reported = false;

    // Widen from a single line up to WINDOW_LINES so the narrowest window that
    // shows the violation is the one reported, and single-line citations keep
    // their exact previous behaviour.
    for (let span = 1; span <= WINDOW_LINES && index + span <= lines.length; span += 1) {
      const window = stripped.slice(index, index + span).join(" ");
      if (!UPSTREAM_REPOS.some((repo) => repo.test(window))) continue;
      if (ALLOW_MARKERS.some((marker) => marker.test(window))) break;

      const hit = MOVING_REF_PATTERNS.find(({ re }) => re.test(window));
      if (!hit) continue;

      // Shrink from the left to the narrowest sub-window that still shows both
      // signals, so the reported range names the citation and not its preamble.
      let start = index;
      while (start + 1 < index + span) {
        const tighter = stripped.slice(start + 1, index + span).join(" ");
        if (!UPSTREAM_REPOS.some((repo) => repo.test(tighter)) || !hit.re.test(tighter)) break;
        start += 1;
      }

      const reportedWindow = stripped.slice(start, index + span).join(" ");
      const where = start + 1 === index + span ? `${start + 1}` : `${start + 1}-${index + span}`;
      errors.push(
        `${file}:${where}: upstream citation uses a moving reference [${hit.name}]: ${reportedWindow.slice(0, 140)}`,
      );
      // Consume the whole window so one wrapped citation is one finding.
      index += span;
      reported = true;
      break;
    }

    if (!reported) index += 1;
  }
}

const scannedSummary = `${tracked.length} tracked files, ${citationSites} citation sites, ${Object.keys(pins).length} pins`;

if (!verifyRemote) {
  if (errors.length > 0) fail(errors, scannedSummary);
  console.log(`pin check PASSED (${scannedSummary}, offline)`);
  console.log("Reachability of each pinned SHA is NOT checked offline: run `npm run check:pins -- --verify-remote`.");
  process.exit(0);
}

// --------------------------------------------------------------------------
// 4/5. Remote resolution. Opt-in, because CI has no network and a check that
//      cannot reach upstream must say so rather than pass.
// --------------------------------------------------------------------------

const ghProbe = spawnSync("gh", ["--version"], { encoding: "utf8" });
if (ghProbe.error || ghProbe.status !== 0) {
  inconclusive(
    "--verify-remote needs the `gh` CLI and it is not available",
    "Offline findings above are still valid; remote reachability was NOT checked.",
    `Offline result: ${errors.length === 0 ? "clean" : `${errors.length} violation(s)`}`,
  );
}

/**
 * Statuses that are evidence about the OBJECT that was asked for. Only these
 * may be read as "this pin is broken".
 *
 *   404 — no such commit/path in this repository
 *   422 — the SHA is well-formed but names no object here
 *   451 — the object exists but is legally unavailable; not a pin problem to
 *         fix by re-pinning, but it is a definite answer about this object
 *
 * Everything else that carries a status is evidence about the REQUEST, not the
 * object: 401/403 (no or bad credentials, SAML, SSO), 429 (throttled), 5xx
 * (GitHub is unwell). An earlier cut of this gate treated "carries an HTTP
 * status" as "is definitive", so an expired token reported every pin as
 * "commit no longer resolves" — a confident, specific, wrong answer, which is
 * strictly worse than an error. That is the same defect this PR fixes one level
 * down: a claim asserted without the check that would establish it.
 */
const OBJECT_SCOPED_STATUSES = new Set([404, 422, 451]);

function gh(endpoint) {
  const run = spawnSync("gh", ["api", endpoint], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  const stderr = (run.stderr ?? run.error?.message ?? "").trim();
  const status = /\(HTTP (\d{3})\)/.exec(stderr);
  const http = status ? Number(status[1]) : null;
  return {
    ok: run.status === 0 && !run.error,
    http,
    /** True only when the answer is about the object we asked for. */
    definitive: http !== null && OBJECT_SCOPED_STATUSES.has(http),
    stdout: run.stdout,
    stderr,
  };
}

function requireDefinitive(result, what) {
  if (result.ok || result.definitive) return;
  const status = result.http === null ? "no HTTP status (DNS/TLS/proxy)" : `HTTP ${result.http}`;
  inconclusive(
    `could not get a definitive answer from GitHub while checking ${what} — ${status}`,
    result.stderr.split("\n")[0] || "no error output",
    "This is NOT a passing pin and NOT a failing pin — the check did not happen.",
    "Only 404/422/451 are answers about the object; 401/403/429/5xx are answers about the",
    "request (credentials, rate limit, outage) and prove nothing about the pin.",
    `Offline result: ${errors.length === 0 ? "clean" : `${errors.length} violation(s)`}`,
  );
}

// Preflight: prove the API is reachable AND the credentials work before reading
// any per-commit failure as evidence about a commit. `rate_limit` needs no
// scopes, so anything other than a clean 200 here means the transport or the
// token is the problem, never the pin — hence `ok`, not merely `definitive`.
const preflight = gh("rate_limit");
if (!preflight.ok) {
  const status = preflight.http === null ? "no HTTP status (DNS/TLS/proxy)" : `HTTP ${preflight.http}`;
  inconclusive(
    `could not reach GitHub as an authenticated caller — ${status}`,
    preflight.stderr.split("\n")[0] || "no error output",
    "`gh api rate_limit` must return 200 before any pin result can be trusted. Run `gh auth login`,",
    "or wait out the rate limit, then re-run. Remote reachability was NOT checked.",
    `Offline result: ${errors.length === 0 ? "clean" : `${errors.length} violation(s)`}`,
  );
}

for (const [id, pin] of Object.entries(pins)) {
  if (typeof pin?.commit !== "string" || !/^[0-9a-f]{40}$/.test(pin.commit)) continue;
  const slug = pin.repo.replace(/^https:\/\/github\.com\//, "").replace(/\.git$/, "");

  const commit = gh(`repos/${slug}/commits/${pin.commit}`);
  requireDefinitive(commit, `${id} commit ${pin.commit}`);
  if (!commit.ok) {
    errors.push(
      `${id}: commit ${pin.commit} no longer resolves in ${slug} — ${commit.stderr.split("\n")[0]}`,
    );
    continue;
  }

  const contents = gh(`repos/${slug}/contents/${pin.path}?ref=${pin.commit}`);
  requireDefinitive(contents, `${id} path ${pin.path}`);
  if (!contents.ok) {
    errors.push(`${id}: ${pin.path} is absent at ${pin.commit} in ${slug}`);
    continue;
  }

  let blob;
  try {
    blob = JSON.parse(contents.stdout);
  } catch {
    inconclusive(`${id}: could not parse the GitHub contents response for ${pin.path}`);
  }

  if (typeof pin.blob_sha1 === "string" && blob.sha !== pin.blob_sha1) {
    errors.push(`${id}: blob_sha1 recorded ${pin.blob_sha1}, upstream reports ${blob.sha}`);
  }

  const text = Buffer.from(blob.content ?? "", blob.encoding === "base64" ? "base64" : "utf8").toString("utf8");
  const digest = createHash("sha256").update(text, "utf8").digest("hex");
  if (typeof pin.content_sha256 === "string" && digest !== pin.content_sha256) {
    errors.push(`${id}: content_sha256 recorded ${pin.content_sha256}, fetched blob hashes to ${digest}`);
  }

  // `sections_cited` means "the parts of this file the package actually reads".
  // For Markdown that is a heading; for Python it is a definition. Both are
  // checked, because a pin whose cited section has been renumbered or whose
  // cited symbol has been renamed is precise and useless — and because three
  // prose sites (INVARIANTS.md FC-10, catalog-pinning.md, ROADMAP.md) promise a
  // reviewer that this check happens.
  if (Array.isArray(pin.sections_cited)) {
    for (const section of pin.sections_cited) {
      const quoted = section.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const anchor = pin.path.endsWith(".md")
        ? { re: new RegExp(`^#{1,6} +${quoted}[. ]`, "m"), kind: `section §${section}`, what: "heading" }
        : pin.path.endsWith(".py")
          ? { re: new RegExp(`^\\s*(?:def|class) +${quoted}\\b`, "m"), kind: `symbol \`${section}\``, what: "definition" }
          : null;
      if (anchor && !anchor.re.test(text)) {
        errors.push(`${id}: ${anchor.kind} has no ${anchor.what} in ${pin.path} at ${pin.commit}`);
      }
    }
  }
}

if (errors.length > 0) fail(errors, `${scannedSummary}, remote-verified`);
console.log(`pin check PASSED (${scannedSummary}, remote-verified)`);
