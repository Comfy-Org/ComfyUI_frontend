import { describe, expect, it } from "vitest";
import { mint, project } from "../src/index.js";
import type { WorkflowJSON } from "../src/index.js";
import { loadCatalog } from "./helpers.js";

const catalog = loadCatalog();

// Preserved review: https://github.com/Comfy-Org/ComfyUI_frontend/pull/16644#discussion_r3926236102
describe("top-level definition identity", () => {
  it.each([
    ["absent", {}],
    ["undefined", { id: undefined }],
    ["null", { id: null }],
  ])("regression: rejects %s definition IDs instead of silently overwriting subgraphs", (_label, identity) => {
    const workflow: WorkflowJSON = {
      nodes: [],
      links: [],
      definitions: {
        subgraphs: [
          { ...identity, name: "first", nodes: [], links: [] },
          { ...identity, name: "second", nodes: [], links: [] },
        ],
      },
    };

    expect(() => mint(workflow, catalog)).toThrow("mint: definition is missing id");
  });

  it("preserves zero and literal null/undefined string IDs with their distinct payloads", () => {
    const definitions = {
      subgraphs: [
        { id: 0, name: "zero", nodes: [], links: [] },
        { id: "null", name: "literal-null", nodes: [], links: [] },
        { id: "undefined", name: "literal-undefined", nodes: [], links: [] },
      ],
    };
    const workflow: WorkflowJSON = { nodes: [], links: [], definitions };

    expect(project(mint(workflow, catalog), catalog).definitions).toEqual(definitions);
  });
});
