#!/usr/bin/env node
/**
 * Purity gate for @comfyorg/comfy-multi-player.
 *
 * This package is one implementation of op→doc semantics shared by the
 * browser and the server doc host — it must run identically in both, so it
 * may not depend (directly or transitively, in ANY dependency group) on UI
 * frameworks, DOM implementations, or litegraph. It must also import cleanly
 * in bare Node with no DOM globals.
 *
 * Checks:
 *   1. `npm ls --json --all` — walk the full resolved dependency tree and
 *      fail on any banned package name.
 *   2. `node --input-type=module -e "await import(dist/index.js)"` in a
 *      clean subprocess — the built entrypoint must load without DOM globals
 *      existing before or after import.
 *
 * Exit codes: 0 pure, 1 violation, 2 preconditions missing (e.g. no dist/).
 */

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));

/** Banned dependency names. Exact-match strings or RegExp tested on the name. */
const BANNED = [
  /^vue$/,
  /^@vue\//,
  /^react$/,
  /^react-dom$/,
  /^preact$/,
  /^svelte$/,
  /^jsdom$/,
  /^happy-dom$/,
  /^linkedom$/,
  /^domino$/,
  /^electron$/,
  /^canvas$/,
  /^node-canvas$/,
  /litegraph/i, // any litegraph flavor, any scope
];

function fail(msg) {
  console.error(`\npurity check FAILED: ${msg}`);
  process.exit(1);
}

// --------------------------------------------------------------------------
// 1. Positive runtime-dependency assertion + dependency-tree scan
// --------------------------------------------------------------------------

const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const declaredRuntimeDependencies = Object.keys(packageJson.dependencies ?? {}).sort();
if (
  declaredRuntimeDependencies.length !== 1 ||
  declaredRuntimeDependencies[0] !== "yjs"
) {
  fail(
    `runtime dependencies must be exactly {yjs}; found {${declaredRuntimeDependencies.join(", ")}}`,
  );
}

// npm ls exits non-zero on tree problems but still prints JSON — parse stdout
// regardless and only fail if there is no usable output.
const ls = spawnSync("npm", ["ls", "--omit=dev", "--json", "--all"], {
  cwd: root,
  encoding: "utf8",
  maxBuffer: 64 * 1024 * 1024,
});
let tree;
try {
  tree = JSON.parse(ls.stdout);
} catch {
  console.error(ls.stderr);
  console.error("could not parse `npm ls --json --all` output — did you run `npm install`?");
  process.exit(2);
}

// npm's logical tree nests transitive dependencies under their direct root.
// Ignore `extraneous` packages because development worktrees may share a
// node_modules directory; they are not part of this package's production
// graph. yjs itself has implementation dependencies (currently lib0), but it
// must be the graph's sole production root.
// A production root must be actually installed and valid: present in the tree
// with a version/resolved, and not missing/invalid/extraneous. A MISSING yjs
// node must fail the gate, not silently pass it.
const isInstalledProdRoot = (child) =>
  child &&
  typeof child === "object" &&
  ("version" in child || "resolved" in child) &&
  !child.missing &&
  !child.invalid &&
  !child.extraneous;
const resolvedRuntimeRoots = Object.entries(tree.dependencies ?? {})
  .filter(([, child]) => isInstalledProdRoot(child))
  .map(([name]) => name)
  .sort();
if (resolvedRuntimeRoots.length !== 1 || resolvedRuntimeRoots[0] !== "yjs") {
  fail(
    `resolved production dependency roots must be exactly {yjs}; found {${resolvedRuntimeRoots.join(", ")}}`,
  );
}
console.log("runtime dependency roots exactly {yjs} (declared and resolved production graph)");

const violations = new Map(); // name -> path through the tree
(function walk(node, path) {
  for (const [name, child] of Object.entries(node?.dependencies ?? {})) {
    // Unresolved optional peers show up as empty {} (e.g. vitest's optional
    // jsdom/happy-dom peers) — only packages actually present in the tree count.
    const installed =
      child && typeof child === "object" && ("version" in child || "resolved" in child);
    if (!installed || child.extraneous) continue;
    const here = [...path, name];
    if (BANNED.some((re) => re.test(name)) && !violations.has(name)) {
      violations.set(name, here.join(" > "));
    }
    walk(child, here);
  }
})(tree, []);

if (violations.size > 0) {
  console.error("banned dependencies found in the resolved tree:");
  for (const [name, via] of violations) console.error(`  - ${name}  (via: ${via})`);
  fail(
    "this package must stay DOM/framework/litegraph-free — it runs identically in the browser and the server doc host",
  );
}
console.log(`dependency tree clean (${BANNED.length} ban patterns, no matches)`);

// --------------------------------------------------------------------------
// 2. Bare-Node import of the built output
// --------------------------------------------------------------------------

const distEntry = join(root, "dist", "index.js");
if (!existsSync(distEntry)) {
  console.error("dist/index.js not found — run `npm run build` before check:purity");
  process.exit(2);
}

const probe = `
  const domGlobals = ["window", "document", "HTMLElement", "customElements"];
  const pre = domGlobals.filter((g) => typeof globalThis[g] !== "undefined");
  if (pre.length) {
    console.error("DOM globals present BEFORE import (polluted environment): " + pre.join(", "));
    process.exit(1);
  }
  const mod = await import(${JSON.stringify(pathToFileURL(distEntry).href)});
  if (typeof mod.SCHEMA_VERSION !== "number") {
    console.error("dist entrypoint did not export SCHEMA_VERSION");
    process.exit(1);
  }
  const post = domGlobals.filter((g) => typeof globalThis[g] !== "undefined");
  if (post.length) {
    console.error("importing dist/index.js introduced DOM globals: " + post.join(", "));
    process.exit(1);
  }
`;
const run = spawnSync(process.execPath, ["--input-type=module", "-e", probe], {
  cwd: root,
  encoding: "utf8",
});
if (run.status !== 0) {
  process.stderr.write(run.stderr ?? "");
  fail("built output does not import cleanly in bare Node");
}
console.log("bare-Node import clean (no DOM globals before or after import)");
console.log("\npurity check PASSED");
