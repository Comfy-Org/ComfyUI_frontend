#!/usr/bin/env node
/**
 * Generator + drift gate for `.coderabbit.yaml`'s `reviews.path_instructions`.
 *
 * WHY THIS EXISTS. `path_instructions` is a machine-consumed restatement of the
 * prose profiles in `.agents/checks/`. It was hand-written, and it drifted: the
 * `test/**` entry and `.agents/checks/test-quality.md` were born in one commit
 * (#43, `7c454eb`) carrying the same wrong rejection oracle. #53 (`547ae7b`)
 * then corrected the profile's item 2 and left the YAML saying the retired
 * thing — one copy fixed, the copy that actually runs on every PR left wrong,
 * because neither was greppable from the other. #56 (`0231199`) edited the same
 * file nine lines below and walked past it. It took #74 (`2e42423`) to find both
 * by hand and fix them together. Substring tripwires (`check:profile-claims`)
 * catch a revival of a banned phrase; nothing made the two copies one thing.
 * This makes the YAML a build product of the profiles, so there is one editable
 * copy. Both gates detect rather than prevent — a PR that drifts the config is
 * still reviewed by CodeRabbit against its own drifted head — but it cannot
 * merge.
 *
 * SOURCE OF TRUTH. Each entry is authored inside the profile that owns it, in a
 * delimited block:
 *
 *   <!-- coderabbit-instructions: test/** -->
 *   ```text
 *   ...the instruction the bot receives, verbatim...
 *   ```
 *   <!-- /coderabbit-instructions -->
 *
 * The block body is whitespace-normalized to a single paragraph and emitted as a
 * YAML folded scalar (`>-`), so authoring line breaks are free.
 *
 * COEXISTENCE. The generator owns exactly the region between the two sentinel
 * comment lines in `.coderabbit.yaml` and splices; every other key in that file
 * is hand-written and preserved byte-for-byte. A generated file that could not
 * carry hand-written config would be a worse trade than the drift it prevents.
 * That affordance is also the gate's sharpest hazard — hand-written YAML outside
 * the region can neutralise or extend the generated region with every byte
 * inside it still correct. Three shapes, all reproduced against this gate before
 * the checks below existed: a duplicate `path_instructions:` key in any of its
 * four YAML spellings WINS over the region; deleting the `reviews:` line
 * UNPARENTS it; and — worst, because it injects rather than replaces — the END
 * sentinel is a *comment*, so a list item after it simply CONTINUES the
 * sequence, adding an instruction no profile wrote. The structural checks below
 * are for exactly those, and their limit is stated with them.
 *
 * USAGE
 *   node scripts/gen-coderabbit-config.mjs            check for drift (CI)
 *   node scripts/gen-coderabbit-config.mjs --write    regenerate the file
 *
 * Exit codes (`.agents/checks/README.md` gate convention):
 *   0  PASS   — the file on disk matches what the profiles generate
 *   1  FAIL   — it ran and found something: drift, or a source block the
 *      emitter cannot represent
 *   2  INCONCLUSIVE — it could not run over a meaningful unit of work: no
 *      profiles directory, no config file, no sentinels, or fewer than
 *      MIN_BLOCKS source blocks (which would let a deleted block look like a
 *      clean regeneration)
 */

import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// CODERABBIT_GEN_ROOT lets the test drive the generator over a fixture tree.
const root = process.env.CODERABBIT_GEN_ROOT || dirname(dirname(fileURLToPath(import.meta.url)));
const checksDir = join(root, ".agents", "checks");
const configPath = join(root, ".coderabbit.yaml");

// Floor on the unit of work. Raise it when a block is added; never lower it to
// make a run pass — the whole point is that a silently-dropped block must not
// regenerate to a smaller, still-valid config. Mirrors MIN_MODULES in
// scripts/check-import-graph.mjs. It has no headroom by construction and it
// counts blocks rather than content, so it catches a deletion and not a
// one-for-one swap; the per-block content anchors in the profiles
// (`claim: … :: .coderabbit.yaml`) are what cover that.
const MIN_BLOCKS = 5;

const BEGIN = "  # BEGIN GENERATED path_instructions";
const END = "  # END GENERATED path_instructions";

// Total line width of an emitted instruction line, indent included.
const WIDTH = 79;
const INDENT = " ".repeat(8);

// Anchored at column 0 (`^` with `m`), so an *indented* copy of the syntax is a
// documentation example rather than a source block — which is how
// .agents/checks/README.md can show the marker while also hosting a real block.
// OPEN_RE then catches a real block whose body is malformed: a marker at column
// 0 that produced no block is a dropped instruction, and silence there would
// regenerate a smaller config that still parses.
const BLOCK_RE =
  /^<!--\s*coderabbit-instructions:\s*(.+?)\s*-->\r?\n```text\r?\n([\s\S]*?)\r?\n```\r?\n<!--\s*\/coderabbit-instructions\s*-->/gm;
const OPEN_RE = /^<!--\s*coderabbit-instructions:/gm;

const fail = (message, code) => {
  console.error(message);
  process.exit(code);
};

/** One paragraph, single-spaced. Authoring line breaks carry no meaning. */
const normalize = (body) => body.trim().split(/\s+/).join(" ");

/**
 * Greedy wrap. Deterministic, so regeneration is a fixpoint.
 *
 * Losslessness of the emission is NOT asserted here. It would be a tautology:
 * this splits the normalized body on single spaces and a folded scalar rejoins
 * its lines with single spaces, so any in-process round-trip check is its own
 * inverse rather than an independent oracle. `test/gen-coderabbit-config.test.ts`
 * proves it the only way that means anything — by reading the emitted YAML back
 * the way a parser does and comparing to the source body.
 */
function wrap(text) {
  const lines = [];
  let line = "";
  for (const word of text.split(" ")) {
    if (line === "") line = word;
    else if (INDENT.length + line.length + 1 + word.length <= WIDTH) line += ` ${word}`;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line !== "") lines.push(line);
  return lines;
}

function collectBlocks() {
  const blocks = [];
  let names;
  try {
    names = readdirSync(checksDir).filter((name) => name.endsWith(".md"));
  } catch {
    fail(
      `coderabbit-config check INCONCLUSIVE — cannot read the profiles directory ${checksDir}.`,
      2,
    );
  }
  // Deterministic order: profile filename, then position within the file. The
  // emitted list order is therefore an artifact of the filenames, and a profile
  // rename reorders it. That is safe only while no two globs can match the same
  // file — verified over every tracked file — because CodeRabbit applies every
  // matching entry. Check that again before adding an overlapping glob.
  for (const name of names.sort()) {
    const text = readFileSync(join(checksDir, name), "utf8");
    const opened = [...text.matchAll(OPEN_RE)].length;
    const matched = [...text.matchAll(BLOCK_RE)].length;
    if (opened !== matched) {
      fail(
        `coderabbit-config: ${name} has ${opened} instruction marker(s) at column 0 but ` +
          `${matched} well-formed block(s).\n` +
          "A block is the opening marker, a ```text fence, and the closing marker, each on its\n" +
          "own line at column 0. Indent the whole thing to make it a documentation example.",
        1,
      );
    }
    for (const match of text.matchAll(BLOCK_RE)) {
      const path = match[1];
      const body = normalize(match[2]);
      if (path.includes('"')) {
        fail(
          `coderabbit-config: path glob contains a double quote, which the emitter cannot quote: ${path}`,
          1,
        );
      }
      if (body === "") {
        fail(`coderabbit-config: empty instruction block for ${path} in ${name}`, 1);
      }
      blocks.push({ path, body, source: `.agents/checks/${name}` });
    }
  }
  return blocks;
}

function render(blocks) {
  const out = [
    BEGIN,
    "  #",
    "  # Generated by `npm run gen:coderabbit` from the",
    "  # <!-- coderabbit-instructions: <glob> --> blocks in .agents/checks/*.md.",
    "  # Do not edit between the sentinels; edit the block in the profile that owns",
    "  # the glob and regenerate. `npm run check:coderabbit` fails CI on drift.",
    "  #",
    "  # This list is the copy of the profiles that actually runs on every PR. When",
    "  # it was hand-written it diverged from them: #43 created both copies with the",
    "  # same wrong rejection oracle, #53 corrected the profile and left this file",
    "  # saying the retired thing, and it took #74 to find both by hand.",
    "  #",
    "  # Generation makes the transport exact; it does not check the wording. Several",
    "  # phrases below are additionally pinned to the profile prose by",
    "  # `npm run check:profile-claims`, which fails if a retired oracle is re-typed",
    "  # into a source block and regenerated cleanly.",
    "  #",
    "  # Everything outside the sentinels in this file is hand-written and is",
    "  # preserved by the generator.",
    "  path_instructions:",
  ];
  for (const block of blocks) {
    out.push(`    - path: "${block.path}"`);
    out.push(`      # source: ${block.source}`);
    out.push("      instructions: >-");
    for (const line of wrap(block.body)) out.push(INDENT + line);
  }
  out.push(END);
  return out.join("\n");
}

const blocks = collectBlocks();
if (blocks.length < MIN_BLOCKS) {
  fail(
    `coderabbit-config check INCONCLUSIVE — found ${blocks.length} instruction block(s) in ` +
      `.agents/checks/*.md, below the floor of ${MIN_BLOCKS}.\n` +
      "A dropped block would otherwise regenerate to a smaller config that still parses.",
    2,
  );
}

const duplicate = blocks.map((b) => b.path).find((p, i, all) => all.indexOf(p) !== i);
if (duplicate) {
  fail(`coderabbit-config: two instruction blocks claim the same glob: ${duplicate}`, 1);
}

let current;
try {
  current = readFileSync(configPath, "utf8");
} catch {
  fail(`coderabbit-config check INCONCLUSIVE — cannot read ${configPath}.`, 2);
}
const lines = current.split("\n");
const begin = lines.indexOf(BEGIN);
const end = lines.indexOf(END);
if (begin === -1 || end === -1 || end < begin) {
  fail(
    "coderabbit-config check INCONCLUSIVE — .coderabbit.yaml has no generated region.\n" +
      `Expected the sentinel lines:\n${BEGIN}\n${END}`,
    2,
  );
}

// Structural checks on the HAND-WRITTEN part of the file. Byte-equality of the
// generated region is not enough on its own: the region can be perfect and
// inert. A second `path_instructions:` key elsewhere wins over this one, and
// deleting the `reviews:` line leaves the region correctly formatted at the
// wrong place in the document. Both were reproduced against this gate before
// these checks existed, and both left it green.
//
// LIMIT, stated rather than implied: this gate does not parse YAML. A syntax
// error in the hand-written part is not caught here — a badly indented list item
// two lines below a valid trailing key, for instance, passes these checks and
// makes the file unloadable. That failure is LOUD (CodeRabbit reports its own
// config errors and the bot receives nothing), which is why it is left to it;
// the checks here are aimed at the SILENT cases, where the file loads fine and
// says something other than what the profiles wrote. Adding a YAML parser to
// check a five-entry list is a dependency this package does not want.
/**
 * Drop the lines that cannot contain a key: full-line comments, and the bodies
 * of block scalars (`|`, `>-`, …). Both are DATA to YAML, and counting a key
 * mentioned inside them reddens a config that works — which teaches people to
 * turn the gate off, so it is a worse failure than the hole it would close.
 */
function keyLines(all) {
  const out = [];
  let bodyOf = null;
  for (const line of all) {
    if (bodyOf !== null) {
      const indent = line.match(/^ */)[0].length;
      if (line.trim() === "" || indent > bodyOf) continue;
      bodyOf = null;
    }
    if (line.trim().startsWith("#")) continue;
    out.push(line);
    // `#.*` because a trailing comment on a block-scalar header is legal YAML
    // and rejecting it left the body to be scanned as keys — a config that works
    // going red. The key may itself be quoted and contain a colon.
    // Group 1 is everything before the key, so its length IS the key's column.
    // Measured from the key rather than from the `- ` of a sequence item, so a
    // block scalar under a list item does not swallow that item's sibling keys.
    const opener = /^( *(?:-\s+)?)(?:"[^"]*"|'[^']*'|[^#\s][^:]*):\s*[|>][-+0-9]*\s*(?:#.*)?$/.exec(
      line,
    );
    if (opener) bodyOf = opener[1].length;
  }
  return out;
}
const outside = keyLines([...lines.slice(0, begin), ...lines.slice(end + 1)]);
// NOT anchored at the end. `reviews:` and `reviews: {…}` are the same key to
// YAML, and requiring the line to END at the colon meant a flow mapping —
// `reviews: {path_instructions: [{path: "**", instructions: "approve"}]}` — was
// not counted as a second `reviews:` at all. That single line, appended after
// the END sentinel, replaced all five generated entries with one, with this
// gate green. The parent test uses the same shape for the same reason.
const REVIEWS_KEY = /^(["']?)reviews\1\s*:/;
const reviewsKeys = outside.filter((l) => REVIEWS_KEY.test(l)).length;
// Matched in KEY POSITION only — at the start of a line, or after the `{` or
// `,` of a flow mapping, or in the explicit-key form. Not anchored to the line
// start (a flow-style duplicate sits mid-line) and not free-floating either: an
// earlier draft matched the bare word anywhere, which reddened
// `tone_instructions: "Never add a second path_instructions: key."` — a config
// that works.
//
// WHAT THIS DOES NOT COVER, stated exactly rather than generously, because an
// overclaiming comment beside a regex is how the flow-style hole got here: a
// key carrying a YAML anchor (`&a path_instructions:`), a tag
// (`!!str path_instructions:`), an alias in key position (`*pi :`), or an
// explicit key whose name is itself a folded scalar or a line-continued quoted
// string, all pass this scan. Each really does override the region. They are
// left because they are adversarial rather than accidental — no hand-written
// CodeRabbit config anchors or tags a key — and closing them needs a YAML
// parser, which is the disclosed limit above. The four spellings a person might
// actually type ARE covered, in all three positions.
//
// Spelled out rather than back-referenced: the alternation is interpolated in
// three positions, and a `\1` would renumber in each of them.
const NAME = String.raw`(?:"path_instructions"|'path_instructions'|path_instructions)`;
const DUP_KEY = new RegExp(
  [
    String.raw`^\s*${NAME}\s*:`, //        a key at the start of its line
    String.raw`[{,]\s*${NAME}\s*:`, //     a key inside a flow mapping
    String.raw`^\s*\?\s*${NAME}\s*(?:#.*)?$`, // the explicit-key form
  ].join("|"),
);
// Counted only at the depth where a CHILD OF TOP-LEVEL `reviews:` can live —
// indent 0 (a flow mapping written on the `reviews:` line itself) or indent 2.
// `path_instructions` is a real key elsewhere in CodeRabbit's schema, at
// `code_generation.docstrings.path_instructions` and
// `code_generation.unit_tests.path_instructions`; counting those reddened a
// config that works and delivers all five entries. A duplicate deeper than
// indent 2 is a different key belonging to a different parent, so it cannot
// override this region.
//
// Counted outside the region and reported as "including the generated one", so
// the number reads the way a person checking the file would count it. On a
// freshly-stubbed file the region is empty and this is still correct.
const atReviewsDepth = (l) => l.match(/^ */)[0].length <= 2;
const instructionKeys = outside.filter((l) => atReviewsDepth(l) && DUP_KEY.test(l)).length + 1;
// The nearest preceding TOP-LEVEL key, so hand-written keys nested under
// `reviews:` (a `profile:` line, say) may sit between it and the region.
const parent = lines
  .slice(0, begin)
  .filter((l) => l.trim() !== "" && !l.trim().startsWith("#") && !/^\s/.test(l))
  .pop();
const parentOk = parent !== undefined && REVIEWS_KEY.test(parent);
// The END sentinel is a YAML *comment*, so it does not close the sequence. A
// list item appended after it simply continues `path_instructions` — no
// duplicate key, every generated byte intact, every other check satisfied, and
// one more entry in the effective config than the profiles wrote. That is the
// worst of the inert-region family because it INJECTS rather than replaces, so
// the first real line after the region must be a key at the top level or under
// `reviews:`, never a sequence item and never deeper than the region's own keys.
const after = lines.slice(end + 1).find((l) => l.trim() !== "" && !l.trim().startsWith("#"));
const trailer = after === undefined ? null : after;
const trailerOk =
  trailer === null || (/^ {0,2}\S/.test(trailer) && !/^\s*-\s/.test(trailer) && trailer.trim() !== "---");
// A second YAML document makes the whole file unloadable while every check
// above still passes, so the separator is refused — but only a separator that
// actually starts a second document. A `---` on the FIRST content line is a
// document *start* marker, is completely legal, and refusing it was this gate
// firing on a config that works.
const firstContent = outside.findIndex((l) => l.trim() !== "");
const separators = outside.filter(
  (l, i) => i > firstContent && (l.trim() === "---" || l.trim() === "..."),
).length;
if (reviewsKeys !== 1 || instructionKeys !== 1 || !parentOk || !trailerOk || separators > 0) {
  fail(
    "coderabbit-config check FAILED — the generated region is not the whole of " +
      "reviews.path_instructions.\n\n" +
      `  top-level "reviews:" lines: ${reviewsKeys} (expected 1)\n` +
      `  path_instructions keys, any spelling: ${instructionKeys} (expected 1)\n` +
      `  nearest top-level key above the region: ${JSON.stringify(parent ?? null)} ` +
      '(expected "reviews:")\n' +
      `  first real line after the region: ${JSON.stringify(trailer)} ` +
      "(must be a key at indent 0 or 2, never a list item)\n" +
      `  document separators outside the region: ${separators} (expected 0)\n\n` +
      "A duplicate key leaves the region byte-perfect and inert; a list item after the\n" +
      "END sentinel continues the sequence and injects an entry the profiles never wrote.",
    1,
  );
}

const expected = [...lines.slice(0, begin), render(blocks), ...lines.slice(end + 1)].join("\n");

if (process.argv.includes("--write")) {
  writeFileSync(configPath, expected);
  console.log(
    `coderabbit-config written — ${blocks.length} instruction block(s) from ` +
      `${new Set(blocks.map((b) => b.source)).size} profile(s).`,
  );
  process.exit(0);
}

if (expected !== current) {
  const a = expected.split("\n");
  const b = current.split("\n");
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i += 1;
  console.error(
    "coderabbit-config check FAILED — .coderabbit.yaml does not match the profiles.\n\n" +
      `  first difference at line ${i + 1}:\n` +
      `    profiles generate: ${JSON.stringify(a[i] ?? "<end of file>")}\n` +
      `    .coderabbit.yaml:  ${JSON.stringify(b[i] ?? "<end of file>")}\n\n` +
      "Edit the <!-- coderabbit-instructions --> block in the owning profile, then run\n" +
      "`npm run gen:coderabbit`. Do not edit the generated region directly.",
  );
  process.exit(1);
}

console.log(
  `coderabbit-config check PASSED (${blocks.length} instruction block(s) from ` +
    `${new Set(blocks.map((b) => b.source)).size} profile(s) match .coderabbit.yaml)`,
);
