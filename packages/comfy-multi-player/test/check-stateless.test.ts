import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const script = join(repoRoot, "scripts", "check-stateless.mjs");

describe("check-stateless gate", () => {
  let root: string;
  let eslintEntrypoint: string;
  let vitestEntrypoint: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "stateless check with spaces-"));
    mkdirSync(join(root, "src"));
    mkdirSync(join(root, "test"));
    mkdirSync(join(root, "scripts"));
    copyFileSync(script, join(root, "scripts", "check-stateless.mjs"));
    mkdirSync(join(root, ".agents", "checks"), { recursive: true });
    for (const dependency of ["eslint", "@typescript-eslint/parser", "eslint-plugin-sonarjs"]) {
      mkdirSync(join(root, "node_modules", dependency), { recursive: true });
    }
    mkdirSync(join(root, "node_modules", "eslint", "bin"));
    mkdirSync(join(root, "node_modules", "vitest"));
    eslintEntrypoint = join(root, "node_modules", "eslint", "bin", "eslint.js");
    vitestEntrypoint = join(root, "node_modules", "vitest", "vitest.mjs");
    writeFileSync(join(root, "src", "index.ts"), "export const value = 1;\n");
    writeFileSync(join(root, "test", "stateless.test.ts"), "// fixture probe\n");
    writeFileSync(join(root, ".agents", "checks", "eslint.strict.config.js"), "export default [];\n");
    writeFileSync(join(root, "package.json"), JSON.stringify({ name: "stateless-fixture" }));
    writeFileSync(
      eslintEntrypoint,
      `console.log(${JSON.stringify(JSON.stringify([{ filePath: join(root, "src", "index.ts"), messages: [] }]))});\n`,
    );
    writeFileSync(vitestEntrypoint, "process.exit(0);\n");
  });

  afterEach(() => rmSync(root, { recursive: true, force: true }));

  function run(nodeArgs: string[] = []) {
    return spawnSync(process.execPath, [...nodeArgs, join(root, "scripts", "check-stateless.mjs")], {
      encoding: "utf8",
    });
  }

  it("runs package-owned JS entrypoints without relying on platform-specific .bin shims", () => {
    const result = run();
    expect(result.status).toBe(0);
    expect(result.stdout).toContain(
      "No issues found (1 source files linted; stateless-fixture stateless probe passed)",
    );
  });

  it("returns exit 2 when the vitest executable is missing", () => {
    rmSync(vitestEntrypoint);
    const result = run();
    expect(result.status).toBe(2);
    expect(result.stderr).toContain("INCONCLUSIVE — vitest is not installed; run npm ci");
  });

  it("returns exit 2 when the eslint executable is missing", () => {
    rmSync(eslintEntrypoint);
    const result = run();
    expect(result.status).toBe(2);
    expect(result.stderr).toContain("INCONCLUSIVE — eslint is not installed; run npm ci");
  });

  it("returns exit 2 when the stateless probe is missing", () => {
    rmSync(join(root, "test", "stateless.test.ts"));
    const result = run();
    expect(result.status).toBe(2);
    expect(result.stderr).toContain("INCONCLUSIVE — test/stateless.test.ts is missing");
  });

  it("returns exit 2 when spawning the stateless probe fails", () => {
    const preload = `
      import childProcess from "node:child_process";
      import { syncBuiltinESMExports } from "node:module";
      const spawn = childProcess.spawnSync;
      childProcess.spawnSync = (command, args, options) => spawn(
        args[0] === ${JSON.stringify(vitestEntrypoint)}
          ? ${JSON.stringify(join(root, "missing-node-executable"))} : command,
        args, options,
      );
      syncBuiltinESMExports();
    `;
    const result = run(["--import", `data:text/javascript,${encodeURIComponent(preload)}`]);
    expect(result.status).toBe(2);
    expect(result.stderr).toContain("INCONCLUSIVE — could not run the stateless probe: spawnSync");
    expect(result.stdout).not.toContain("No issues found");
  });

  it("returns exit 2 when the stateless probe cannot execute", () => {
    writeFileSync(vitestEntrypoint, "process.exit(2);\n");
    const result = run();
    expect(result.status).toBe(2);
    expect(result.stderr).toContain("INCONCLUSIVE — stateless probe failed to execute");
  });

  it("returns exit 2 when the stateless probe is terminated by a signal", () => {
    writeFileSync(vitestEntrypoint, 'process.kill(process.pid, "SIGTERM");\n');
    const result = run();
    expect(result.status).toBe(2);
    expect(result.stderr).toContain("INCONCLUSIVE — stateless probe terminated by signal SIGTERM");
  });

  it("preserves a genuine lint finding as exit 1", () => {
    writeFileSync(
      eslintEntrypoint,
      `console.log(${JSON.stringify(JSON.stringify([{ filePath: join(root, "src", "index.ts"), messages: [{ ruleId: "no-warning-comments", message: "finding" }] }]))});\n`,
    );
    const result = run();
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('"message": "finding"');
  });

  it("preserves a failing stateless probe as exit 1", () => {
    writeFileSync(vitestEntrypoint, "process.exit(1);\n");
    const result = run();
    expect(result.status).toBe(1);
    expect(result.stdout).not.toContain("No issues found");
  });
});
