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
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { systemExecutable } from "./process-helpers.js";

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
  it.each(["repo", "path", "valid"])("regression: remote verification checks valid pins alongside %s input", (field) => {
    // Source: https://github.com/Comfy-Org/ComfyUI_frontend/pull/16644#discussion_r3914401911
    const fixture = mkdtempSync(join(tmpdir(), "pins-remote-"));
    try {
      mkdirSync(join(fixture, "docs"));
      mkdirSync(join(fixture, "bin"));
      const commit = "a".repeat(40);
      const citedBy = ["citation-1.md", "citation-2.md", "citation-3.md", "citation-4.md"];
      const basePin = {
        commit,
        repo: "https://github.com/example/upstream",
        path: "README.md",
        established_by: "resolved from an immutable upstream revision with audit evidence",
        sections_cited: ["1"],
        cited_by: citedBy,
      };
      writeFileSync(
        join(fixture, "docs", "upstream-pins.json"),
        JSON.stringify({
          pins: {
            ...(field === "valid" ? {} : { malformed: { ...basePin, [field]: null } }),
            valid: basePin,
          },
        }),
      );
      for (const site of citedBy) writeFileSync(join(fixture, site), `Pinned at ${commit}.\n`);
      for (let index = 0; index < 20; index += 1) writeFileSync(join(fixture, `tracked-${index}.md`), `fixture ${index}\n`);

      const ghLog = join(fixture, "gh.log");
      const fakeGh = join(fixture, "bin", "gh");
      writeFileSync(
        fakeGh,
        `#!/bin/sh\nprintf '%s\\n' "$*" >> "$GH_TEST_LOG"\n` +
          `if [ "$1" = "--version" ]; then echo 'gh version test'; exit 0; fi\n` +
          `case "$2" in\n` +
          `  rate_limit) echo '{}';;\n` +
          `  repos/example/upstream/commits/*) echo '{}';;\n` +
          `  repos/example/upstream/contents/README.md?ref=*) printf '%s\\n' '{"content":"IyAxIFRpdGxlCg==","encoding":"base64"}';;\n` +
          `  *) echo "unexpected endpoint: $2" >&2; exit 9;;\n` +
          `esac\n`,
      );
      chmodSync(fakeGh, 0o755);
      expect(spawnSync(systemExecutable("git"), ["init", "--quiet"], { cwd: fixture }).status).toBe(0);
      expect(spawnSync(systemExecutable("git"), ["add", "."], { cwd: fixture }).status).toBe(0);

      const run = spawnSync(process.execPath, [join(root, "scripts", "check-pins.mjs"), "--verify-remote"], {
        encoding: "utf8",
        env: { ...process.env, PINS_ROOT: fixture, PATH: `${join(fixture, "bin")}:${process.env.PATH}`, GH_TEST_LOG: ghLog },
      });
      expect(run.status, run.stderr).toBe(field === "valid" ? 0 : 1);
      if (field === "valid") {
        expect(run.stdout).toContain("pin check PASSED");
        expect(run.stderr).toBe("");
      } else {
        expect(run.stderr).toContain("pin check FAILED: 1 violation(s)");
        expect(run.stderr).toContain(`malformed: ${field} must`);
        expect(run.stderr).not.toContain("TypeError");
      }
      expect(readFileSync(ghLog, "utf8").trim().split("\n")).toEqual([
        "--version",
        "api rate_limit",
        `api repos/example/upstream/commits/${commit}`,
        `api repos/example/upstream/contents/README.md?ref=${commit}`,
      ]);
    } finally {
      rmSync(fixture, { recursive: true, force: true });
    }
  });

  it.each([
    {
      name: "hidden private repository commit 404",
      commitStatus: 404,
      metadataStatus: 404,
      expectedStatus: 2,
      expectedMessage: "could not establish public repository visibility for example/upstream — HTTP 404",
      endpoints: ["api rate_limit", "api repos/example/upstream/commits/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", "api repos/example/upstream"],
    },
    {
      name: "public repository commit 404",
      commitStatus: 404,
      metadataStatus: 200,
      metadataPrivate: false,
      expectedStatus: 1,
      expectedMessage: "commit aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa no longer resolves in example/upstream",
      endpoints: ["api rate_limit", "api repos/example/upstream/commits/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", "api repos/example/upstream"],
    },
    {
      name: "public repository path 404",
      commitStatus: 200,
      contentsStatus: 404,
      metadataStatus: 200,
      metadataPrivate: false,
      expectedStatus: 1,
      expectedMessage: "README.md is absent at aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa in example/upstream",
      endpoints: ["api rate_limit", "api repos/example/upstream/commits/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", "api repos/example/upstream/contents/README.md?ref=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", "api repos/example/upstream"],
    },
    {
      name: "private repository commit 404 despite readable metadata",
      commitStatus: 404,
      metadataStatus: 200,
      metadataPrivate: true,
      expectedStatus: 2,
      expectedMessage: "repository metadata for example/upstream identifies a private repository, but metadata visibility does not prove Contents access",
      endpoints: ["api rate_limit", "api repos/example/upstream/commits/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", "api repos/example/upstream"],
    },
    {
      name: "private repository path 404 despite readable metadata",
      commitStatus: 200,
      contentsStatus: 404,
      metadataStatus: 200,
      metadataPrivate: true,
      expectedStatus: 2,
      expectedMessage: "repository metadata for example/upstream identifies a private repository, but metadata visibility does not prove Contents access",
      endpoints: ["api rate_limit", "api repos/example/upstream/commits/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", "api repos/example/upstream/contents/README.md?ref=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", "api repos/example/upstream"],
    },
    {
      name: "commit 422 remains object-scoped",
      commitStatus: 422,
      metadataStatus: 200,
      expectedStatus: 1,
      expectedMessage: "commit aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa no longer resolves in example/upstream",
      endpoints: ["api rate_limit", "api repos/example/upstream/commits/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"],
    },
    {
      name: "commit 451 remains object-scoped",
      commitStatus: 451,
      metadataStatus: 200,
      expectedStatus: 1,
      expectedMessage: "commit aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa no longer resolves in example/upstream",
      endpoints: ["api rate_limit", "api repos/example/upstream/commits/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"],
    },
    {
      name: "repository metadata rejects authentication",
      commitStatus: 404,
      metadataStatus: 403,
      expectedStatus: 2,
      expectedMessage: "could not establish public repository visibility for example/upstream — HTTP 403",
      endpoints: ["api rate_limit", "api repos/example/upstream/commits/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", "api repos/example/upstream"],
    },
    {
      name: "repository metadata is unavailable",
      commitStatus: 404,
      metadataStatus: 500,
      expectedStatus: 2,
      expectedMessage: "could not establish public repository visibility for example/upstream — HTTP 500",
      endpoints: ["api rate_limit", "api repos/example/upstream/commits/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", "api repos/example/upstream"],
    },
    {
      name: "repository metadata response is malformed",
      commitStatus: 404,
      metadataStatus: 200,
      malformedMetadata: true,
      expectedStatus: 2,
      expectedMessage: "repository metadata for example/upstream was malformed, so repository visibility was not established",
      endpoints: ["api rate_limit", "api repos/example/upstream/commits/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", "api repos/example/upstream"],
    },
    {
      name: "repository metadata omits visibility",
      commitStatus: 404,
      metadataStatus: 200,
      omitMetadataPrivate: true,
      expectedStatus: 2,
      expectedMessage: "repository metadata for example/upstream was malformed, so repository visibility was not established",
      endpoints: ["api rate_limit", "api repos/example/upstream/commits/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", "api repos/example/upstream"],
    },
    {
      name: "repository metadata has nonboolean visibility",
      commitStatus: 404,
      metadataStatus: 200,
      metadataPrivate: "false",
      expectedStatus: 2,
      expectedMessage: "repository metadata for example/upstream was malformed, so repository visibility was not established",
      endpoints: ["api rate_limit", "api repos/example/upstream/commits/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", "api repos/example/upstream"],
    },
  ])("classifies $name without mistaking repository access for object absence", (scenario) => {
    // Source: https://github.com/Comfy-Org/ComfyUI_frontend/pull/16644#discussion_r3940075206
    const fixture = mkdtempSync(join(tmpdir(), "pins-private-remote-"));
    try {
      mkdirSync(join(fixture, "docs"));
      mkdirSync(join(fixture, "bin"));
      const commit = "a".repeat(40);
      const citedBy = ["citation-1.md", "citation-2.md", "citation-3.md", "citation-4.md"];
      writeFileSync(
        join(fixture, "docs", "upstream-pins.json"),
        JSON.stringify({
          pins: {
            upstream: {
              commit,
              repo: "https://github.com/example/upstream",
              path: "README.md",
              established_by: "resolved from an immutable upstream revision with audit evidence",
              sections_cited: ["1"],
              cited_by: citedBy,
            },
          },
        }),
      );
      for (const site of citedBy) writeFileSync(join(fixture, site), `Pinned at ${commit}.\n`);
      for (let index = 0; index < 20; index += 1) writeFileSync(join(fixture, `tracked-${index}.md`), `fixture ${index}\n`);

      const ghLog = join(fixture, "gh.log");
      const fakeGh = join(fixture, "bin", "gh");
      writeFileSync(
        fakeGh,
        `#!/bin/sh\nprintf '%s\\n' "$*" >> "$GH_TEST_LOG"\n` +
          `if [ "$1" = "--version" ]; then echo 'gh version test'; exit 0; fi\n` +
          `status=200\n` +
          `case "$2" in\n` +
          `  rate_limit) status=200;;\n` +
          `  repos/example/upstream/commits/*) status="$COMMIT_STATUS";;\n` +
          `  repos/example/upstream/contents/*) status="$CONTENTS_STATUS";;\n` +
          `  repos/example/upstream) status="$METADATA_STATUS";;\n` +
          `  *) echo "unexpected endpoint: $2" >&2; exit 9;;\n` +
          `esac\n` +
          `if [ "$status" != 200 ]; then echo "gh: fixture failure (HTTP $status)" >&2; exit 1; fi\n` +
          `case "$2" in\n` +
          `  repos/example/upstream/contents/*) printf '%s\\n' '{"content":"IyAxIFRpdGxlCg==","encoding":"base64"}';;\n` +
          `  repos/example/upstream) if [ "$MALFORMED_METADATA" = true ]; then echo '{}'; elif [ "$OMIT_METADATA_PRIVATE" = true ]; then echo '{"full_name":"example/upstream"}'; else printf '{"full_name":"example/upstream","private":%s}\\n' "$METADATA_PRIVATE"; fi;;\n` +
          `  *) echo '{}';;\n` +
          `esac\n`,
      );
      chmodSync(fakeGh, 0o755);
      expect(spawnSync(systemExecutable("git"), ["init", "--quiet"], { cwd: fixture }).status).toBe(0);
      expect(spawnSync(systemExecutable("git"), ["add", "."], { cwd: fixture }).status).toBe(0);

      const run = spawnSync(process.execPath, [join(root, "scripts", "check-pins.mjs"), "--verify-remote"], {
        encoding: "utf8",
        env: {
          ...process.env,
          PINS_ROOT: fixture,
          PATH: `${join(fixture, "bin")}:${process.env.PATH}`,
          GH_TEST_LOG: ghLog,
          COMMIT_STATUS: String(scenario.commitStatus),
          CONTENTS_STATUS: String(scenario.contentsStatus ?? 200),
          METADATA_STATUS: String(scenario.metadataStatus),
          MALFORMED_METADATA: String(scenario.malformedMetadata ?? false),
          OMIT_METADATA_PRIVATE: String(scenario.omitMetadataPrivate ?? false),
          METADATA_PRIVATE: JSON.stringify(scenario.metadataPrivate ?? false),
        },
      });
      expect(run.status, run.stderr).toBe(scenario.expectedStatus);
      expect(run.stderr).toContain(scenario.expectedMessage);
      expect(readFileSync(ghLog, "utf8").trim().split("\n")).toEqual(["--version", ...scenario.endpoints]);
    } finally {
      rmSync(fixture, { recursive: true, force: true });
    }
  });

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
      expect(spawnSync(systemExecutable("git"), ["init", "--quiet"], { cwd: fixture }).status).toBe(0);
      expect(spawnSync(systemExecutable("git"), ["add", "."], { cwd: fixture }).status).toBe(0);

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
