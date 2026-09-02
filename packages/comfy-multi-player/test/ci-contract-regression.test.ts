import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const workspaceRoot = join(packageRoot, "..", "..");

describe("workspace CI contract", () => {
  it("keeps package gates and review guidance at the workspace root", () => {
    const workflow = readFileSync(
      join(workspaceRoot, ".github", "workflows", "ci-comfy-multi-player.yaml"),
      "utf8",
    );
    const codeRabbit = readFileSync(join(workspaceRoot, ".coderabbit.yaml"), "utf8");

    const requiredCommands = [
      "pnpm check:comfy-multi-player-workspace",
      "run typecheck",
      "run verify:corpus",
      "run check:purity",
      "run check:stateless",
      "run check:imports",
      "run check:pins",
      "run check:profile-claims",
      "run check:coderabbit",
      "@comfyorg/comfy-multi-player test",
      "run test:clock-matrix",
      "vitest run src/workbench/extensions/agent/crdt",
      "pnpm pack",
    ];
    for (const command of requiredCommands) {
      expect(workflow, `workspace CI must run ${command}`).toContain(command);
    }

    expect(codeRabbit).toContain("path: 'packages/comfy-multi-player/**'");
    expect(codeRabbit).toContain("packages/comfy-multi-player/AGENTS.md");
    expect(codeRabbit).toContain("packages/comfy-multi-player/docs/INVARIANTS.md");
    expect(codeRabbit).toContain("packages/comfy-multi-player/.agents/checks/");
  });
});
