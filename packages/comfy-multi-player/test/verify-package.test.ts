import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { systemExecutable } from "./process-helpers.js";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const script = join(root, "scripts", "verify-package.mjs");
const temporary: string[] = [];

afterEach(() => {
  for (const path of temporary.splice(0)) rmSync(path, { recursive: true, force: true });
});

const goodManifest = {
  name: "@comfyorg/comfy-multi-player",
  version: "0.0.0-test",
  type: "module",
  main: "./dist/index.js",
  types: "./dist/index.d.ts",
  exports: { ".": { types: "./dist/index.d.ts", import: "./dist/index.js" } },
  publishConfig: { access: "public" },
};

const goodFiles: Record<string, string> = {
  "dist/index.js": "export const marker = 'packed';\n",
  "dist/index.d.ts": "export declare const marker: string;\n",
};

interface Artifact {
  manifest?: Record<string, unknown>;
  files?: Record<string, string>;
  report?: (paths: string[], tarball: string) => unknown;
}

function verify({ manifest = goodManifest, files = goodFiles, report }: Artifact, consumer = false) {
  const work = mkdtempSync(join(tmpdir(), "cmp-verify-package-"));
  temporary.push(work);
  const contents = { ...files, "package.json": JSON.stringify(manifest) };
  for (const [path, body] of Object.entries(contents)) {
    mkdirSync(dirname(join(work, "package", path)), { recursive: true });
    writeFileSync(join(work, "package", path), body);
  }
  const tarball = join(work, "artifact.tgz");
  const tar = spawnSync(systemExecutable("tar"), ["-czf", tarball, "-C", work, "package"], { encoding: "utf8" });
  expect(tar.status, tar.stderr).toBe(0);
  const paths = Object.keys(contents);
  const packResult = report?.(paths, tarball) ?? { filename: tarball, files: paths.map((path) => ({ path })) };
  const packResultPath = join(work, "pack.json");
  writeFileSync(packResultPath, typeof packResult === "string" ? packResult : JSON.stringify(packResult));
  const args = [script, "--pack-result", packResultPath, ...(consumer ? [] : ["--skip-consumer"])];
  return spawnSync(process.execPath, args, { encoding: "utf8" });
}

const withManifest = (patch: Record<string, unknown>): Artifact => ({ manifest: { ...goodManifest, ...patch } });

describe("package verifier", () => {
  it("accepts a root-only dist artifact that a clean npm consumer can import and type-check", () => {
    const run = verify({}, true);
    expect(run.status, run.stderr).toBe(0);
    expect(run.stdout).toContain("package verification passed (npm consumer imported 1 exports)");
  });

  it.each<[string, Artifact, string]>([
    ["malformed pack JSON", { report: () => "not JSON" }, "malformed JSON"],
    ["npm-style array result", { report: (paths, filename) => [{ filename, files: paths.map((path) => ({ path })) }] }, "one pnpm pack result object"],
    ["relative tarball filename", { report: (paths) => ({ filename: "artifact.tgz", files: paths.map((path) => ({ path })) }) }, "absolute tarball path"],
    ["malformed file entry", { report: (paths, filename) => ({ filename, files: [...paths.map((path) => ({ path })), { path: 12 }] }) }, "path must be a string"],
    ["missing declarations", { files: { "dist/index.js": goodFiles["dist/index.js"]! } }, "missing dist/index.d.ts"],
    ["source included", { files: { ...goodFiles, "src/index.ts": "export {};\n" } }, "includes src/index.ts"],
    ["report that omits a packed file", { files: { ...goodFiles, "dist/extra.js": "" }, report: (paths, filename) => ({ filename, files: paths.filter((path) => path !== "dist/extra.js").map((path) => ({ path })) }) }, "differs from tarball contents"],
    ["workspace source export", withManifest({ exports: { ".": "./src/index.ts" } }), "packed exports must be exactly"],
    ["subpath export", withManifest({ exports: { ...goodManifest.exports, "./dist/*": "./dist/*" } }), "packed exports must be exactly"],
    ["unrewritten catalog dependency", withManifest({ dependencies: { yjs: "catalog:" } }), "dependencies.yjs keeps unpublishable specifier catalog:"],
    ["leftover publishConfig exports", withManifest({ publishConfig: { exports: goodManifest.exports } }), "publishConfig.exports"],
    ["source types entry", withManifest({ types: "./src/index.ts" }), "types must be ./dist/index.d.ts"],
  ])("rejects %s", (_name, artifact, message) => {
    const run = verify(artifact);
    expect(run.status).toBe(1);
    expect(run.stderr).toContain(message);
  });

  it.each([
    ["a runtime entry that throws on import", { "dist/index.js": "throw new Error('broken entry');\n" }, "broken entry"],
    ["declarations a consumer cannot compile", { "dist/index.d.ts": "export declare const marker: MissingType;\n" }, "MissingType"],
  ])("rejects %s in the npm consumer smoke", (_name, files, message) => {
    const run = verify({ files: { ...goodFiles, ...files } }, true);
    expect(run.status).toBe(1);
    expect(run.stderr).toContain(message);
  });
});
