/**
 * Every `KA-*` / `FC-*` id cited in this repository resolves to a heading in
 * `docs/INVARIANTS.md`.
 *
 * `docs/INVARIANTS.md` calls itself "the machine-addressable review log", and
 * `AGENTS.md` requires every semantics-touching change to cite the affected ids
 * in its PR description — but nothing checked that a cited id exists. `KA-13`
 * was cited by the stateless gate, the strict ESLint config, `ADR-021` and
 * `test/stateless.test.ts` while the register stopped at `KA-12`, so the label
 * was unresolvable for every reader who followed it (#152).
 *
 * This is a register-integrity check, not a coverage check: it says nothing
 * about whether an id is *guarded*, only that it is *defined*. `UNGUARDED`
 * markers stay the register's own business.
 *
 * Deliberately offline and repository-local — it reads the working tree through
 * `git ls-files` so a new citation in a new file is covered without anyone
 * remembering to extend a list.
 */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const REGISTER = "docs/INVARIANTS.md";

/** `KA-0` / `FC-0` is the placeholder row in the `EXCEPTIONS.md` table template. */
const PLACEHOLDER = /^(KA|FC)-0$/;

// `\b` is the wrong right-hand delimiter here: a digit followed by `-` IS a word
// boundary, so `/KA-\d+\b/` reads `KA-13-SOMETHING` as a citation of `KA-13`.
// That is exactly the mis-registration this suite exists to catch, so both ends
// require a non-id character.
const CITATION = /\b(KA|FC)-\d+(?![\w-])/g;
const HEADING = /^### ((?:KA|FC)-\d+)(?![\w-])/gm;

/** Text formats where a citation is meant to be read and followed. */
const TEXT_EXTENSIONS = new Set([".ts", ".js", ".mjs", ".cjs", ".md", ".json", ".yaml", ".yml"]);

function trackedTextFiles(): string[] {
  const listed = spawnSync("git", ["ls-files", "-z"], { cwd: root, encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
  if (listed.status !== 0) throw new Error(`git ls-files failed: ${listed.stderr || listed.error?.message}`);
  return listed.stdout
    .split("\0")
    .filter(Boolean)
    .filter((file) => TEXT_EXTENSIONS.has(extname(file)));
}

/** Group 1 is mandatory in `HEADING`, but `noUncheckedIndexedAccess` cannot see that. */
function captured(match: RegExpExecArray, group: number): string {
  const value = match[group];
  if (value === undefined) throw new Error(`regex group ${group} did not capture in: ${match[0]}`);
  return value;
}

function definedIds(): Set<string> {
  const register = readFileSync(join(root, REGISTER), "utf8");
  return new Set(Array.from(register.matchAll(HEADING), (match) => captured(match, 1)));
}

/** file → sorted ids cited in it, for every tracked text file outside the register. */
function citationsByFile(): Map<string, string[]> {
  const found = new Map<string, string[]>();
  for (const file of trackedTextFiles()) {
    if (file === REGISTER) continue;
    const cited = new Set(
      Array.from(readFileSync(join(root, file), "utf8").matchAll(CITATION), (match) => captured(match, 0)).filter(
        (id) => !PLACEHOLDER.test(id),
      ),
    );
    if (cited.size > 0) found.set(file, [...cited].sort());
  }
  return found;
}

describe("invariant register integrity (KA-*/FC-* ids resolve)", () => {
  const defined = definedIds();
  const cited = citationsByFile();

  it("finds the register and a non-trivial number of ids in it", () => {
    // A heading regex that silently stopped matching would read the register as
    // EMPTY, which turns the resolution case below into a wall of false
    // failures rather than a silent pass — but pin the floor anyway, because a
    // register read as empty is never a legitimate state.
    expect(defined.size).toBeGreaterThanOrEqual(22);
    expect(defined.has("KA-1")).toBe(true);
    expect(defined.has("FC-10")).toBe(true);
  });

  it("scans a non-trivial number of citing files", () => {
    expect(cited.size).toBeGreaterThanOrEqual(20);
  });

  it("resolves every cited id to a heading in docs/INVARIANTS.md", () => {
    const unresolved = [...cited]
      .flatMap(([file, ids]) => ids.filter((id) => !defined.has(id)).map((id) => `${file}: ${id}`))
      .sort();
    expect(unresolved).toEqual([]);
  });

  it("keeps KA-13 registered, the citation this guard was written for", () => {
    expect(defined.has("KA-13")).toBe(true);
    expect(cited.get("test/stateless.test.ts")).toContain("KA-13");
    expect(cited.get("scripts/check-stateless.mjs")).toContain("KA-13");
    expect(cited.get(".agents/checks/eslint.strict.config.js")).toContain("KA-13");
    expect(cited.get("docs/decisions/ADR-021-doc-derived-lamport-clock-store.md")).toContain("KA-13");
  });

  it("would catch an unregistered id (the #152 shape), rather than only the fixed instance", () => {
    // Assembled from parts on purpose: a literal sentinel in this file's own
    // source would be scanned as a real citation and fail the case above.
    const unregistered = ["KA", "999"].join("-");
    expect(defined.has(unregistered)).toBe(false);
    expect(Array.from(`cites ${unregistered} here`.matchAll(CITATION), (match) => match[0])).toEqual([unregistered]);
  });
});
