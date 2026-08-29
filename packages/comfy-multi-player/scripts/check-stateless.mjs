#!/usr/bin/env node
/**
 * Merge-blocking statelessness gate (KA-3 / KA-13).
 *
 * Static analysis catches UI/reactivity imports and module-level mutable
 * collections. The colocated Vitest probe catches state leaking between docs,
 * fresh module registries, or fresh Node processes. Exit 2 is inconclusive,
 * never a pass, when a required precondition or unit floor is missing.
 */

import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const config = join(root, ".agents/checks/eslint.strict.config.js");
const sourceFiles = readdirSync(join(root, "src"), { recursive: true })
  .filter((file) => typeof file === "string" && file.endsWith(".ts"))
  .map((file) => join("src", file))
  .sort();

function inconclusive(message) {
  console.error(`INCONCLUSIVE — ${message}`);
  process.exit(2);
}

if (!existsSync(config)) inconclusive(".agents/checks/eslint.strict.config.js is missing");
if (sourceFiles.length === 0) inconclusive("no source files were found to lint");
if (!existsSync(join(root, "node_modules/eslint"))) inconclusive("eslint is not installed; run npm ci");
if (!existsSync(join(root, "node_modules/@typescript-eslint/parser"))) {
  inconclusive("@typescript-eslint/parser is not installed; run npm ci");
}
if (!existsSync(join(root, "node_modules/eslint-plugin-sonarjs"))) {
  inconclusive("eslint-plugin-sonarjs is not installed; run npm ci");
}

const lint = spawnSync(
  join(root, "node_modules/.bin/eslint"),
  ["--no-config-lookup", "--config", config, "--no-warn-ignored", "--format", "json", ...sourceFiles],
  { cwd: root, encoding: "utf8", maxBuffer: 16 * 1024 * 1024, env: { ...process.env, CMP_STATELESS_ONLY: "1" } },
);
if (lint.error || lint.status === 2) {
  console.error(lint.stderr || lint.error?.message || "eslint failed to execute");
  process.exit(2);
}

let report;
try {
  report = JSON.parse(lint.stdout);
} catch {
  console.error(lint.stderr || lint.stdout || "eslint produced no JSON report");
  process.exit(2);
}
const linted = report.filter((entry) => !(entry.messages ?? []).some((message) => message.ruleId === null)).length;
if (linted !== sourceFiles.length) {
  inconclusive(`eslint analyzed ${linted} of ${sourceFiles.length} source files`);
}
const findings = report.flatMap((entry) =>
  (entry.messages ?? []).map((message) => ({ file: entry.filePath, ...message })),
);
if (findings.length > 0) {
  console.error(JSON.stringify(findings, null, 2));
  process.exit(1);
}

const probe = spawnSync(
  join(root, "node_modules/.bin/vitest"),
  ["run", "test/stateless.test.ts", "--reporter=dot"],
  { cwd: root, encoding: "utf8", stdio: "inherit" },
);
if (probe.status !== 0) process.exit(probe.status ?? 1);

const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
console.log(`No issues found (${linted} source files linted; ${packageJson.name} stateless probe passed)`);
