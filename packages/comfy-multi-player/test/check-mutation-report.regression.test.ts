/**
 * Regression: malformed mutation JSON escaped the gate as a SyntaxError/exit 1.
 * Source: https://github.com/Comfy-Org/ComfyUI_frontend/pull/16644#discussion_r3914401883
 */
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const fixtures: string[] = [];

function runReport(contents: string | null) {
  const fixture = mkdtempSync(join(tmpdir(), "mutation-report-"));
  fixtures.push(fixture);
  mkdirSync(join(fixture, "scripts"));
  mkdirSync(join(fixture, "reports", "mutation"), { recursive: true });
  const scriptPath = join(fixture, "scripts", "check-mutation-report.mjs");
  copyFileSync(join(root, "scripts", "check-mutation-report.mjs"), scriptPath);
  const reportPath = join(fixture, "reports", "mutation", "mutation.json");
  if (contents === null) mkdirSync(reportPath);
  else writeFileSync(reportPath, contents);
  return spawnSync(process.execPath, [scriptPath], {
    encoding: "utf8",
  });
}

function report(killed: number, survived: number, breakAt: number) {
  const mutants = [
    ...Array.from({ length: killed }, () => ({ status: "Killed" })),
    ...Array.from({ length: survived }, () => ({ status: "Survived" })),
  ];
  return JSON.stringify({ files: { "src/example.ts": { mutants } }, thresholds: { break: breakAt } });
}

afterEach(() => {
  for (const fixture of fixtures.splice(0)) rmSync(fixture, { recursive: true, force: true });
});

describe("mutation report CLI", () => {
  it("regression: classifies an unreadable report as INCONCLUSIVE", () => {
    const run = runReport("{not-json");
    expect(run.status).toBe(2);
    expect(run.stderr).toContain("mutation report INCONCLUSIVE: could not read or parse report");
    expect(run.stderr).not.toContain("SyntaxError");
  });

  it("classifies a report file-read failure as INCONCLUSIVE", () => {
    const run = runReport(null);
    expect(run.status).toBe(2);
    expect(run.stderr).toContain("mutation report INCONCLUSIVE: could not read or parse report");
    expect(run.stderr).toContain("EISDIR");
  });

  // Preserved request: https://github.com/Comfy-Org/ComfyUI_frontend/pull/16644#discussion_r3926236086
  it.each(["CompileError", "RuntimeError", "Ignored"])("refuses 500 %s mutants with no valid result", (status) => {
    const run = runReport(JSON.stringify({
      files: { "src/example.ts": { mutants: Array.from({ length: 500 }, () => ({ status })) } },
      thresholds: { break: 90 },
    }));
    expect(run.status).toBe(2);
    expect(run.stderr).toContain("mutation report INCONCLUSIVE: the report contains 0 valid mutants");
    expect(run.stdout).not.toContain("PASSED");
  });

  it("scores a valid survivor as failure even when all other mutants were ignored", () => {
    const run = runReport(JSON.stringify({
      files: { "src/example.ts": { mutants: [
        ...Array.from({ length: 499 }, () => ({ status: "Ignored" })),
        { status: "Survived" },
      ] } },
      thresholds: { break: 90 },
    }));
    expect(run.status).toBe(1);
    expect(run.stderr).toContain("mutation report FAILED: 0.00%");
  });

  it("passes a valid report at or above its score threshold", () => {
    const run = runReport(report(450, 50, 90));
    expect(run.status).toBe(0);
    expect(run.stdout).toContain("mutation report PASSED");
  });

  it("fails a valid report below its score threshold", () => {
    const run = runReport(report(449, 51, 90));
    expect(run.status).toBe(1);
    expect(run.stderr).toContain("mutation report FAILED");
  });
});
