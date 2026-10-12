import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = dirname(dirname(fileURLToPath(import.meta.url)));

describe("lint enforcement contract", () => {
  it.each([
    ["export const digit = /[0-9]/;", "sonarjs/concise-regex"],
    ["export const boxed = new Number(1);", "sonarjs/no-primitive-wrappers"],
    ['export const boxed = new String("x");', "sonarjs/no-primitive-wrappers"],
    ["export const boxed = new Boolean(false);", "sonarjs/no-primitive-wrappers"],
    ['import { runInNewContext } from "node:vm"; export function run(source: string) { return runInNewContext(source); }', "sonarjs/code-eval"],
  ])("rejects production finding %s", (input, ruleId) => {
    const manifest = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
    expect(manifest.scripts.lint).toBe("eslint .");
    const run = spawnSync(process.execPath, [
      join(root, "node_modules/eslint/bin/eslint.js"),
      ".",
      "--stdin", "--stdin-filename", "src/lint-contract-probe.ts", "--format", "json",
    ], {
      cwd: root,
      encoding: "utf8",
      input,
    });
    expect(run.error).toBeUndefined();
    expect(run.stderr).toBe("");
    const results = JSON.parse(run.stdout) as {
      messages: { ruleId: string; severity: number }[];
    }[];
    expect(results).toHaveLength(1);
    expect(results[0]!.messages).toContainEqual(expect.objectContaining({
      ruleId,
      severity: 2,
    }));
    expect(run.status).toBe(1);
  });

  it("exits successfully for corrected code", () => {
    const run = spawnSync(process.execPath, [
      join(root, "node_modules/eslint/bin/eslint.js"),
      ".", "--stdin", "--stdin-filename", "src/lint-contract-probe.ts", "--format", "json",
    ], { cwd: root, encoding: "utf8", input: "export const digit = /\\d/;\n" });
    expect(run.status, run.stderr).toBe(0);
    expect(JSON.parse(run.stdout)).toEqual([
      expect.objectContaining({ errorCount: 0, warningCount: 0, messages: [] }),
    ]);
  });

  it.each([
    ["src/lint-contract-probe.ts", ["Buffer", "process", "window"]],
    ["test/lint-contract-probe.test.ts", ["window"]],
  ])("recognizes only the runtime globals available to %s", (filename, missing) => {
    const run = spawnSync(process.execPath, [
      join(root, "node_modules/eslint/bin/eslint.js"),
      "--stdin", "--stdin-filename", filename as string, "--format", "json",
      // Probe the declared environment independently of recommended rule selection.
      "--rule", "sonarjs/no-reference-error:error",
    ], {
      cwd: root,
      encoding: "utf8",
      input: "export const probe = [TextEncoder, structuredClone, Buffer, process, window];\n",
    });
    expect(run.error).toBeUndefined();
    expect(run.stderr).toBe("");
    const results = JSON.parse(run.stdout) as {
      messages: { ruleId: string; message: string }[];
    }[];
    expect(results).toHaveLength(1);
    const references = results[0]!.messages.filter(
      message => message.ruleId === "sonarjs/no-reference-error",
    );
    expect(references.map(message => message.message.split('"')[1])).toEqual(missing);
    expect(run.status).toBe(1);
  });

  it("retains the actual upstream disabled rules and every enabled rule option", () => {
    const run = spawnSync(process.execPath, ["--input-type=module", "-e", `
      import sonarjs from "eslint-plugin-sonarjs";
      const { default: configs } = await import("./eslint.config.mjs");
      process.stdout.write(JSON.stringify({
        upstream: sonarjs.configs.recommended.rules,
        configured: configs.find(config => config.rules).rules,
      }));
    `], { cwd: root, encoding: "utf8" });
    expect(run.status, run.stderr).toBe(0);
    const { upstream, configured } = JSON.parse(run.stdout) as {
      upstream: Record<string, string | number | unknown[]>;
      configured: Record<string, string | number | unknown[]>;
    };
    expect(Object.keys(configured).sort()).toEqual(Object.keys(upstream).sort());
    let disabled = 0;
    let enabled = 0;
    for (const [name, setting] of Object.entries(upstream)) {
      const severity = Array.isArray(setting) ? setting[0] : setting;
      if (severity === "off" || severity === 0) {
        expect(configured[name], name).toEqual(setting);
        disabled++;
      } else {
        const mapped = configured[name];
        expect(Array.isArray(mapped) ? mapped[0] : mapped, name).toBe("error");
        expect(Array.isArray(mapped) ? mapped.slice(1) : [], name).toEqual(
          Array.isArray(setting) ? setting.slice(1) : [],
        );
        enabled++;
      }
    }
    expect(disabled).toBeGreaterThan(0);
    expect(enabled).toBeGreaterThan(0);
  });

  it.each([
    [["warn", 3], ["error", 3]],
    [[1, 4], ["error", 4]],
    [["off", 5], ["off", 5]],
    [[0, 6], [0, 6]],
  ])("preserves options and interprets severity in %j", (setting, expected) => {
    // The installed recommendation currently has scalar settings only. Inject
    // an option-bearing setting before importing the real config so dropping
    // array tails cannot pass unnoticed when the recommendation gains options.
    const run = spawnSync(process.execPath, ["--input-type=module", "-e", `
      import sonarjs from "eslint-plugin-sonarjs";
      sonarjs.configs.recommended.rules["sonarjs/cognitive-complexity"] = ${JSON.stringify(setting)};
      const { default: configs } = await import("./eslint.config.mjs");
      const config = configs.find(config => config.rules);
      process.stdout.write(JSON.stringify(config.rules["sonarjs/cognitive-complexity"]));
    `], { cwd: root, encoding: "utf8" });
    expect(run.error).toBeUndefined();
    expect(run.status).toBe(0);
    expect(run.stderr).toBe("");
    expect(JSON.parse(run.stdout)).toEqual(expected);
  });
});
