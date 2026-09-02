import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const BEGIN = "  # BEGIN GENERATED path_instructions";
const END = "  # END GENERATED path_instructions";
const CONTRACT_PREFIX = "Required named CI steps (exact):";

function namedCiSteps(workflow: string): string[] {
  const lines = workflow.split("\n");
  const stepsLine = lines.findIndex((line) => /^    steps:\s*$/.test(line));
  expect(stepsLine, "ci.yml must contain a jobs.<job>.steps list").toBeGreaterThanOrEqual(0);

  const names: string[] = [];
  for (const line of lines.slice(stepsLine + 1)) {
    if (/^ {0,4}\S/.test(line) && line.trim() !== "") break;
    const match = /^ {6}- name:\s*(.+?)\s*$/.exec(line);
    if (match?.[1]) names.push(match[1]);
  }
  return names;
}

function generatedCiContract(config: string): string {
  const begin = config.indexOf(BEGIN);
  const end = config.indexOf(END);
  expect(begin, "missing generated CodeRabbit BEGIN sentinel").toBeGreaterThanOrEqual(0);
  expect(end, "missing generated CodeRabbit END sentinel").toBeGreaterThan(begin);

  const region = config.slice(begin, end);
  const entry = region.match(
    /- path: "\{package\.json,package-lock\.json,tsconfig\.json,\.github\/\*\*,stryker\.conf\.\*\}"[\s\S]*?instructions: >-\n((?: {8}.*\n?)*)/,
  );
  expect(entry, "missing generated build/CI path instruction").not.toBeNull();
  return (entry?.[1] ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join(" ");
}

describe("CodeRabbit CI contract", () => {
  it("names exactly every required CI step", () => {
    const workflow = readFileSync(join(repoRoot, ".github", "workflows", "ci.yml"), "utf8");
    const config = readFileSync(join(repoRoot, ".coderabbit.yaml"), "utf8");
    const requiredSteps = namedCiSteps(workflow);
    const contract = generatedCiContract(config);
    const contractStart = contract.indexOf(CONTRACT_PREFIX);

    expect(requiredSteps.length, "ci.yml must contain named CI steps").toBeGreaterThan(0);
    expect(contractStart, `generated CI instruction must contain ${CONTRACT_PREFIX}`).toBeGreaterThanOrEqual(0);
    const namedByContract = [...contract.slice(contractStart + CONTRACT_PREFIX.length).matchAll(/`([^`]+)`/g)].map(
      ([, name]) => name,
    );

    expect(namedByContract).toEqual(requiredSteps);
  });
});
