// fallow-ignore-file unused-file -- invoked by run.sh and spawn-based portable harness tests
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, realpathSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";

const [packedRootArg, stageArg] = process.argv.slice(2);

function fail(message) {
  console.error(`package identity mismatch: ${message}`);
  process.exit(1);
}

if (!packedRootArg || !stageArg) fail("expected packed package root and stage path");

const packedRoot = realpathSync(packedRootArg);
const stage = realpathSync(stageArg);
const installedRoot = realpathSync(join(stage, "node_modules/@comfyorg/comfy-multi-player"));
const stagePrefix = `${stage}${sep}`;
if (!installedRoot.startsWith(stagePrefix)) fail("installed package resolves outside the disposable stage");

function files(root, directory = "dist") {
  const absolute = join(root, directory);
  return readdirSync(absolute, { withFileTypes: true })
    .flatMap((entry) => {
      const name = join(directory, entry.name);
      if (entry.isDirectory()) return files(root, name);
      if (!entry.isFile()) fail(`${name} is not a regular file`);
      return [name];
    })
    .sort();
}

const expectedFiles = files(packedRoot);
const installedFiles = files(installedRoot);
if (JSON.stringify(expectedFiles) !== JSON.stringify(installedFiles)) {
  fail(`dist file set differs: packed=${expectedFiles.join(",")} installed=${installedFiles.join(",")}`);
}

for (const name of expectedFiles) {
  const expected = readFileSync(join(packedRoot, name));
  const actual = readFileSync(join(installedRoot, name));
  const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
  if (digest(expected) !== digest(actual)) fail(`${name} bytes differ`);
}

const installedPackage = JSON.parse(readFileSync(join(installedRoot, "package.json"), "utf8"));
const packedPackage = JSON.parse(readFileSync(join(packedRoot, "package.json"), "utf8"));
if (installedPackage.name !== packedPackage.name || installedPackage.version !== packedPackage.version) {
  fail("package name or version differs");
}
if (!readFileSync(join(installedRoot, "package.json")).equals(readFileSync(join(packedRoot, "package.json")))) {
  fail("package manifest bytes differ (including exports and dependencies)");
}

process.stdout.write(`${relative(resolve(stage), installedRoot)}: ${expectedFiles.length} dist files verified\n`);
