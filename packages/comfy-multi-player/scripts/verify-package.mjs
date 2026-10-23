#!/usr/bin/env node
// Verifies the artifact pnpm would publish, not the workspace manifest: pnpm
// rewrites catalog: specifiers and applies publishConfig.exports only at pack time.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, sep } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const PACKAGE_NAME = "@comfyorg/comfy-multi-player";
const requiredPaths = ["dist/index.js", "dist/index.d.ts", "package.json"];
const publishedExports = { ".": { types: "./dist/index.d.ts", import: "./dist/index.js" } };
const dependencyFields = ["dependencies", "peerDependencies", "optionalDependencies", "devDependencies"];

function fail(message) {
  throw new Error(`package verification failed: ${message}`);
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], ...options });
  if (result.error) fail(`could not run ${command} (${result.error.message})`);
  if (result.status !== 0) {
    fail(`${command} ${args.join(" ")} exited with status ${result.status ?? "unknown"}\n${result.stdout}${result.stderr}`);
  }
  return result.stdout;
}

function parsePackResult(raw) {
  let result;
  try {
    result = JSON.parse(raw);
  } catch (error) {
    fail(`pnpm pack returned malformed JSON (${error instanceof Error ? error.message : String(error)})`);
  }
  if (result === null || typeof result !== "object" || Array.isArray(result) || !Array.isArray(result.files)) {
    fail("expected one pnpm pack result object with a files array");
  }
  if (typeof result.filename !== "string" || !isAbsolute(result.filename)) {
    fail("pnpm pack result filename must be an absolute tarball path");
  }
  const paths = result.files.map((file, index) => {
    if (typeof file?.path !== "string") fail(`files[${index}].path must be a string`);
    return file.path;
  });
  return { filename: result.filename, paths };
}

function verifyPackedPaths(paths) {
  const included = new Set(paths);
  for (const required of requiredPaths) {
    if (!included.has(required)) fail(`packed artifact is missing ${required}`);
  }
  const source = paths.find((path) => path === "src" || path.startsWith("src/"));
  if (source) fail(`packed artifact unexpectedly includes ${source}`);
}

function verifyPackedManifest(manifest) {
  assert.equal(manifest.name, PACKAGE_NAME, "packed package.json has the wrong name");
  assert.equal(manifest.main, "./dist/index.js", "packed package.json main must be ./dist/index.js");
  assert.equal(manifest.types, "./dist/index.d.ts", "packed package.json types must be ./dist/index.d.ts");
  assert.deepEqual(manifest.exports, publishedExports, `packed exports must be exactly ${JSON.stringify(publishedExports)}`);
  assert.equal(manifest.publishConfig?.exports, undefined, "packed package.json still carries publishConfig.exports");
  for (const field of dependencyFields) {
    for (const [name, specifier] of Object.entries(manifest[field] ?? {})) {
      assert.doesNotMatch(String(specifier), /^(catalog|workspace|link|file):/,
        `packed ${field}.${name} keeps unpublishable specifier ${specifier}`);
    }
  }
}

function tarballEntries(tarball) {
  return run("tar", ["-tzf", tarball])
    .split("\n")
    .filter((line) => line && !line.endsWith("/"))
    .map((line) => {
      if (!line.startsWith("package/")) fail(`tarball entry ${line} is outside package/`);
      return line.slice("package/".length);
    });
}

function verifyArtifact(rawPackResult) {
  const { filename, paths } = parsePackResult(rawPackResult);
  if (!existsSync(filename)) fail(`packed tarball ${filename} does not exist`);
  verifyPackedPaths(paths);
  const entries = tarballEntries(filename);
  verifyPackedPaths(entries);
  const reported = [...new Set(paths)].sort();
  const actual = [...new Set(entries)].sort();
  if (JSON.stringify(reported) !== JSON.stringify(actual)) {
    fail(`pnpm pack files list differs from tarball contents: reported=${reported.join(",")} tarball=${actual.join(",")}`);
  }
  const manifestRaw = run("tar", ["-xzOf", filename, "package/package.json"]);
  let manifest;
  try {
    manifest = JSON.parse(manifestRaw);
  } catch {
    fail("packed package.json is malformed JSON");
  }
  verifyPackedManifest(manifest);
  return { filename, manifest };
}

function cleanEnv() {
  return Object.fromEntries(
    Object.entries(process.env).filter(([key]) => !/^(npm_|pnpm_|PNPM_|NODE_OPTIONS$|NODE_PATH$)/i.test(key)),
  );
}

const runtimeProbe = `
import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
const name = ${JSON.stringify(PACKAGE_NAME)};
const entry = realpathSync(fileURLToPath(import.meta.resolve(name)));
const root = realpathSync("node_modules/" + name);
if (entry !== root + "/dist/index.js") throw new Error("root export resolved to " + entry);
const api = await import(name);
if (Object.keys(api).length === 0) throw new Error("root export has no runtime exports");
let subpathBlocked = false;
try { import.meta.resolve(name + "/dist/index.js"); } catch (error) { subpathBlocked = error?.code === "ERR_PACKAGE_PATH_NOT_EXPORTED"; }
if (!subpathBlocked) throw new Error("subpath dist/index.js is importable; only the root export may be published");
process.stdout.write(String(Object.keys(api).length));
`;

const consumerTsconfig = {
  compilerOptions: {
    strict: true,
    noEmit: true,
    skipLibCheck: false,
    module: "nodenext",
    moduleResolution: "nodenext",
    target: "es2022",
    types: [],
  },
  files: ["consumer.ts"],
};

function smokeConsumer(tarball) {
  const consumer = realpathSync(mkdtempSync(join(tmpdir(), "cmp-consumer-")));
  const env = cleanEnv();
  try {
    writeFileSync(join(consumer, "package.json"), '{"name":"cmp-consumer","private":true,"type":"module"}\n');
    run("npm", ["install", "--ignore-scripts", "--no-audit", "--no-fund", "--no-package-lock", tarball], { cwd: consumer, env });
    const installed = realpathSync(join(consumer, "node_modules", PACKAGE_NAME));
    if (!installed.startsWith(`${consumer}${sep}`)) fail("consumer install resolved outside the disposable consumer");
    const exportCount = run(process.execPath, ["--input-type=module", "-e", runtimeProbe], { cwd: consumer, env }).trim();
    writeFileSync(
      join(consumer, "consumer.ts"),
      `import * as cmp from "${PACKAGE_NAME}";\nexport const names: string[] = Object.keys(cmp);\n`,
    );
    writeFileSync(join(consumer, "tsconfig.json"), JSON.stringify(consumerTsconfig));
    const tsc = createRequire(join(packageRoot, "package.json")).resolve("typescript/bin/tsc");
    run(process.execPath, [tsc, "-p", "tsconfig.json"], { cwd: consumer, env });
    return Number(exportCount);
  } finally {
    rmSync(consumer, { recursive: true, force: true });
  }
}

function packWorkspace(destination) {
  run("pnpm", ["run", "build"], { cwd: packageRoot });
  return run("pnpm", ["pack", "--config.ignore-scripts=true", "--json", "--pack-destination", destination], { cwd: packageRoot });
}

function main(argv) {
  const packResultIndex = argv.indexOf("--pack-result");
  const skipConsumer = argv.includes("--skip-consumer");
  const destination = mkdtempSync(join(tmpdir(), "cmp-pack-"));
  try {
    const raw = packResultIndex === -1 ? packWorkspace(destination) : readFileSync(argv[packResultIndex + 1], "utf8");
    const { filename } = verifyArtifact(raw);
    const summary = skipConsumer ? "consumer smoke skipped" : `npm consumer imported ${smokeConsumer(filename)} exports`;
    console.log(`package verification passed (${summary})`);
  } finally {
    rmSync(destination, { recursive: true, force: true });
  }
}

try {
  main(process.argv.slice(2));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
