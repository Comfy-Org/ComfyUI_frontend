import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import type { Op } from "../src/index.js";
import { loadCatalog } from "./helpers.js";

const catalog = loadCatalog();
const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const add: Op = {
  op: "add_node",
  op_id: "1".repeat(32),
  actor: "agent:stateless-test",
  base_version: 1,
  stamp: [1, "agent:stateless-test"],
  node_id: 1001,
  class_type: "PreviewImage",
  pos: [0, 0],
  node: { id: 1001, type: "PreviewImage", pos: [0, 0], inputs: [], outputs: [], widgets_values: [] },
};

async function freshApi() {
  vi.resetModules();
  return import("../src/index.js");
}

const withStatelessFixture = (source: string, check: (root: string) => void) => {
  const root = mkdtempSync(join(tmpdir(), "stateless-"));
  try {
    mkdirSync(join(root, ".agents", "checks"), { recursive: true });
    mkdirSync(join(root, "src"));
    mkdirSync(join(root, "node_modules"));
    symlinkSync(
      join(repoRoot, ".agents", "checks", "eslint.strict.config.js"),
      join(root, ".agents", "checks", "eslint.strict.config.js"),
    );
    for (const dependency of [".bin", "@typescript-eslint", "eslint", "eslint-plugin-sonarjs"]) {
      symlinkSync(join(repoRoot, "node_modules", dependency), join(root, "node_modules", dependency), "dir");
    }
    writeFileSync(join(root, "package.json"), JSON.stringify({ name: "stateless-fixture" }));
    writeFileSync(join(root, "src", "leak.ts"), source);
    check(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
};

describe("KA-13: cmp is stateless modulo caller-owned documents", () => {
  const mutableCollection = "no module-level mutable collection";
  const mutableBinding = "no module-level let/var";
  it.each([
    ["module-level mutable state", "const cache = new Map<string, unknown>();\nvoid cache;\n", mutableCollection],
    ["a module-level let", "let current = 0;\ncurrent += 1;\n", mutableBinding],
    ["an exported let", "export let current = 0;\n", mutableBinding],
    ["an exported var", "export var current = 0;\n", mutableBinding],
    ["an exported Map", "export const cache = new Map();\n", mutableCollection],
    ["an exported Set", "export const cache = new Set();\n", mutableCollection],
    ["an exported WeakMap", "export const cache = new WeakMap();\n", mutableCollection],
    ["an exported WeakSet", "export const cache = new WeakSet();\n", mutableCollection],
    ["a collection beside the exemption", "export const documentTransactionTails = new WeakMap(), cache = new Map();\n", mutableCollection],
    ["a mutable binding named like the exemption", "export let documentTransactionTails = 0;\n", mutableBinding],
    ["a UI import", 'import { ref } from "vue";\nvoid ref;\n', "cmp is DOM/framework-free and stateless"],
  ])("makes the production gate fail on planted %s", (_name, source, expected) => {
    withStatelessFixture(source, root => {
      const run = spawnSync(process.execPath, [join(repoRoot, "scripts", "check-stateless.mjs")], {
        encoding: "utf8",
        env: { ...process.env, STATELESS_ROOT: root },
      });
      expect(run.status).toBe(1);
      expect(run.stderr).toContain(expected);
      expect(run.stderr).toContain("src/leak.ts");
    });
  });

  it.each([
    ["immutable exports", 'export const answer = 42;\nconst label = "cmp";\nexport { label };\n'],
    ["function-local state", `export function createState() {
      let current = 0;
      var previous = 1;
      const map = new Map();
      const set = new Set();
      const weakMap = new WeakMap();
      const weakSet = new WeakSet();
      return { current, previous, map, set, weakMap, weakSet };
    }\n`],
    ["the admission queue exemption", "const documentTransactionTails = new WeakMap();\n"],
    ["the exported admission queue exemption", "export const documentTransactionTails = new WeakMap();\n"],
  ])("allows %s through the production static-analysis seam", (_name, source) => {
    withStatelessFixture(source, root => {
      // Run the gate's real ESLint phase without requiring a fake runtime probe.
      const run = spawnSync(process.execPath, [
        join(root, "node_modules", "eslint", "bin", "eslint.js"),
        "--no-config-lookup", "--config", ".agents/checks/eslint.strict.config.js",
        "--no-warn-ignored", "--format", "json", "src/leak.ts",
      ], {
        cwd: root,
        encoding: "utf8",
        env: { ...process.env, CMP_STATELESS_ONLY: "1" },
      });
      expect(run.status).toBe(0);
      expect(run.stderr).toBe("");
      expect(JSON.parse(run.stdout)).toEqual([
        expect.objectContaining({ filePath: join(root, "src", "leak.ts"), messages: [], errorCount: 0, warningCount: 0 }),
      ]);
    });
  });

  it("does not share document state between calls in one module instance", async () => {
    const api = await freshApi();
    const untouched = api.mint({ nodes: [], links: [] }, catalog);
    const changed = api.mint({ nodes: [], links: [] }, catalog);
    expect(api.applyOps(changed, [add], catalog).outcomes.some((outcome) => outcome.outcome === "rejected")).toBe(false);
    expect(api.project(untouched, catalog)).toEqual({ nodes: [], links: [] });
    expect(api.project(changed, catalog).nodes).toHaveLength(1);
  });

  it("has the same public behavior from fresh module registries", async () => {
    const first = await freshApi();
    const second = await freshApi();
    const exercise = (api: typeof first) => {
      const doc = api.mint({ nodes: [], links: [] }, catalog);
      api.applyOps(doc, [add], catalog);
      return api.project(doc, catalog);
    };
    expect(exercise(first)).toEqual(exercise(second));
    expect(Object.keys(first).sort()).toEqual(Object.keys(second).sort());
  });

  it("keeps fresh Node processes behaviorally equivalent", () => {
    const entry = fileURLToPath(new URL("../dist/index.js", import.meta.url));
    expect(existsSync(entry), "dist/index.js missing — run `npm run build` before the stateless process probe").toBe(true);
    const script = `import { mint, project } from ${JSON.stringify(entry)}; import catalog from ${JSON.stringify(fileURLToPath(new URL("../fixtures/catalog.json", import.meta.url)))} with { type: "json" }; console.log(JSON.stringify(project(mint({nodes: [], links: []}, catalog), catalog)));`;
    const run = () => spawnSync(process.execPath, ["--input-type=module", "-e", script], { encoding: "utf8" });
    const first = run();
    const second = run();
    expect(first.status).toBe(0);
    expect(second.status).toBe(0);
    expect(first.stdout).toBe(second.stdout);
  });
});
