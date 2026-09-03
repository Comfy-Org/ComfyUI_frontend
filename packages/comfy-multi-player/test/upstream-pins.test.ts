/**
 * FC-10 / KA-12: cross-repository citations are pinned by immutable SHA.
 *
 * `scripts/check-pins.mjs` is the gate; this suite is the in-suite consumer of
 * the same registry, so a citation that loses its SHA fails `npm test` and not
 * only CI's dedicated step — the same doubling the repository already applies to
 * the purity gate (`scripts/check-purity.mjs` + `test/purity.test.ts`).
 *
 * These assertions are deliberately offline. Whether each pinned SHA still
 * resolves upstream is a network question, and a test that silently degrades to
 * "assume fine" when the network is absent is worse than no test.
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = dirname(dirname(fileURLToPath(import.meta.url)));

interface Pin {
  repo: string;
  path: string;
  commit: string;
  blob_sha1?: string;
  content_sha256?: string;
  sections_cited: string[];
  established_by: string;
  cited_by: string[];
  former_branch_citation?: string | null;
  branch_status?: string;
}

const registry = JSON.parse(readFileSync(join(root, "docs", "upstream-pins.json"), "utf8")) as {
  schema_version: number;
  pins: Record<string, Pin>;
};

const entries = Object.entries(registry.pins);
const read = (relative: string) => readFileSync(join(root, relative), "utf8");

/**
 * Strip JSDoc/Markdown continuation furniture and join lines, so a citation that
 * wraps across lines reads as one string. Mirrors the windowing in
 * scripts/check-pins.mjs; keep the two in step.
 */
const flatten = (text: string) =>
  text
    .split("\n")
    .map((line) => line.replace(/^\s*(?:\/\/+|\*+|#+|>+)\s?/, "").trim())
    .join(" ");

/**
 * The three source/doc citations named in the FC-10 finding, plus the README.
 * Listed literally rather than derived from the registry: a registry that
 * quietly dropped a site would otherwise shrink the test with itself.
 */
const REQUIRED_SITES = ["src/index.ts", "src/types.ts", "docs/multiplayer-schema.md", "README.md"];

const VOCABULARY_PIN = "7e732242d971daf0d2d30f22f997abfacd78986e";

describe("FC-10 — upstream citations are pinned by SHA, not by branch", () => {
  it("makes the production gate fail on a planted moving upstream citation", () => {
    const fixture = mkdtempSync(join(tmpdir(), "pins-"));
    try {
      mkdirSync(join(fixture, "docs"));
      const commit = "a".repeat(40);
      const citedBy = ["citation-1.md", "citation-2.md", "citation-3.md", "citation-4.md"];
      writeFileSync(
        join(fixture, "docs", "upstream-pins.json"),
        JSON.stringify({
          pins: {
            vocabulary: {
              commit,
              repo: "https://github.com/example/op-vocabulary",
              path: "README.md",
              established_by: "resolved from an immutable upstream revision with audit evidence",
              sections_cited: ["Vocabulary"],
              cited_by: citedBy,
            },
          },
        }),
      );
      for (const site of citedBy) writeFileSync(join(fixture, site), `Pinned at ${commit}.\n`);
      writeFileSync(
        join(fixture, citedBy[0]!),
        `comfy-cli op-vocabulary citation (branch \`moving/main\`) at ${commit}.\n`,
      );
      for (let index = 0; index < 20; index += 1) {
        writeFileSync(join(fixture, `tracked-${index}.md`), `fixture ${index}\n`);
      }
      expect(spawnSync("git", ["init", "--quiet"], { cwd: fixture }).status).toBe(0);
      expect(spawnSync("git", ["add", "."], { cwd: fixture }).status).toBe(0);

      const run = spawnSync(process.execPath, [join(root, "scripts", "check-pins.mjs")], {
        encoding: "utf8",
        env: { ...process.env, PINS_ROOT: fixture },
      });
      expect(run.status).toBe(1);
      expect(run.stderr).toContain("upstream citation uses a moving reference");
      expect(run.stderr).toContain("citation-1.md:1");
    } finally {
      rmSync(fixture, { recursive: true, force: true });
    }
  });

  it("registers at least the vocabulary, its v1.2 amendment, and the minting module", () => {
    // "At least", as the title says. This asserted exact set equality, which
    // made it a change detector: registering a NEW cross-repo pin — the thing
    // FC-10 wants to happen — turned it red, with a diff that says nothing
    // about whether the new pin is any good. The structural rules below apply
    // to every entry (`it.each(entries)`), so completeness is enforced there,
    // per entry, rather than by freezing the list.
    expect(registry.schema_version).toBe(1);
    expect(Object.keys(registry.pins).sort()).toEqual(
      expect.arrayContaining([
        "comfy-cli/op-vocabulary-v1",
        "comfy-cli/op-vocabulary-v1@amendment-v1.2",
        "comfy-cli/workflow_ops",
      ]),
    );
  });

  it.each(entries)("%s pins an immutable 40-hex commit with recorded content digests", (_id, pin) => {
    expect(pin.commit).toMatch(/^[0-9a-f]{40}$/);
    expect(pin.repo).toMatch(/^https:\/\/github\.com\//);
    expect(pin.path.length).toBeGreaterThan(0);
    if (pin.blob_sha1 !== undefined) expect(pin.blob_sha1).toMatch(/^[0-9a-f]{40}$/);
    if (pin.content_sha256 !== undefined) expect(pin.content_sha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it.each(entries)("%s records how its SHA was established, not merely that one exists", (_id, pin) => {
    // A pin resolved to "whatever upstream HEAD is today" asserts the citation
    // is accurate now, which is the unverified claim FC-10 is about. The
    // derivation is the evidence, so it is required, not optional.
    expect(pin.established_by.length).toBeGreaterThan(40);
    expect(pin.sections_cited.length).toBeGreaterThan(0);
    expect(pin.cited_by.length).toBeGreaterThan(0);
  });

  it.each(entries)("%s is carried verbatim by every file it claims cites it", (_id, pin) => {
    for (const site of pin.cited_by) {
      expect(read(site), `${site} must cite ${pin.commit}`).toContain(pin.commit);
    }
  });

  it.each(REQUIRED_SITES)("%s cites the vocabulary by SHA", (site) => {
    expect(read(site)).toContain(VOCABULARY_PIN);
  });

  it.each(REQUIRED_SITES)("%s no longer names the deleted upstream branch as its citation", (site) => {
    // The branch is `fix/validate-lowers-ui-to-api`; it was deleted upstream on
    // 2026-08-21 when comfy-cli PR #511 merged. Naming it as provenance is fine
    // (docs/upstream-pins.json does); naming it as the citation is FC-10.
    //
    // Read the file with continuation furniture stripped and lines joined, the
    // same way scripts/check-pins.mjs does. A per-line regex here would pass a
    // citation that wraps `(branch` onto one line and the name onto the next —
    // which is how two of the three original citations were written, and why the
    // first cut of the gate caught only one of them.
    expect(flatten(read(site))).not.toMatch(/\(\s*branch\s+`[^`]+`/i);
  });

  it("README names a revision at all, which is the defect README actually had", () => {
    // README never named the deleted branch, so the assertion above can never
    // fail for it. Its defect was the opposite: "Which revision of that document
    // this package tracks is an open question" — a citation with no revision.
    // Guard THAT, or the README row of the suite is decorative.
    const readme = read("README.md");
    expect(readme).not.toMatch(/which revision of that document this package tracks/i);
    expect(readme).toMatch(/comfy-cli commit\s+`?[0-9a-f]{40}/i);
  });

  it("keeps every pin's branch provenance on record so the pins stay auditable", () => {
    // Deleting the provenance would make the pins unreviewable: a future reader
    // could not tell a resolved citation from a guessed one.
    //
    // Two shapes, and the second is not an exemption. A pin RETROFITTED from a
    // citation that once named a branch must say which branch and what became
    // of it. A pin registered at a SHA from the start never had one, and must
    // say THAT explicitly — `former_branch_citation: null` plus a
    // `branch_status` that states it — so "pinned from the start" stays
    // distinguishable from "provenance lost", which is the whole point.
    for (const [id, pin] of entries) {
      if (pin.former_branch_citation === null) {
        expect(pin.branch_status, id).toMatch(/NEVER BRANCH-CITED/);
        continue;
      }
      expect(pin.former_branch_citation, id).toBeTruthy();
      expect(pin.branch_status, id).toMatch(/DELETED/);
    }
  });

  it("agrees with the corpus manifest about which comfy-cli commit this package tracks", () => {
    // fixtures/MANIFEST.json pinned the generator independently, before this
    // registry existed. If the two ever disagree, the package's op corpus and
    // its op vocabulary describe different upstream revisions.
    const manifest = JSON.parse(read("fixtures/MANIFEST.json")) as {
      provenance: { generator_commit: string };
    };
    expect(manifest.provenance.generator_commit).toBe(VOCABULARY_PIN);
    expect(registry.pins["comfy-cli/workflow_ops"]?.commit).toBe(VOCABULARY_PIN);
  });
});
