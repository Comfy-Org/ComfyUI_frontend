import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import { applyOps, mint, project, type Op } from "../src/index.js";
import { loadCatalog } from "./helpers.js";

const catalog = loadCatalog();
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

describe("KA-13: cmp is stateless modulo caller-owned documents", () => {
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
    const script = `import { mint, project } from ${JSON.stringify(entry)}; import catalog from ${JSON.stringify(fileURLToPath(new URL("../fixtures/catalog.json", import.meta.url)))} with { type: "json" }; console.log(JSON.stringify(project(mint({nodes: [], links: []}, catalog), catalog)));`;
    const run = () => spawnSync(process.execPath, ["--input-type=module", "-e", script], { encoding: "utf8" });
    const first = run();
    const second = run();
    expect(first.status).toBe(0);
    expect(second.status).toBe(0);
    expect(first.stdout).toBe(second.stdout);
  });
});
