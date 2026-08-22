import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import { createNodeMap, definitionsMap, initDoc } from "../src/doc.js";
import {
  nodesMap,
  mint,
  project,
  type WidgetCatalog,
  type WorkflowJSON,
} from "../src/index.js";

const catalog: WidgetCatalog = {
  types: { Known: { widget_order: ["first", "second"] } },
};

describe("W8 projection goldens (KA-3, KA-4, KA-12)", () => {
  it("canonically orders mixed numeric/string node ids and definition ids", () => {
    const workflow = {
      nodes: [
        { id: "5", type: "Unknown" },
        { id: "4", type: "Unknown" },
        { id: 3, type: "Unknown" },
        { id: 2, type: "Unknown" },
      ],
      links: [],
      definitions: {
        subgraphs: [
          { id: "z", nodes: [], links: [] },
          { id: "a", nodes: [], links: [] },
        ],
      },
    } as unknown as WorkflowJSON;

    expect(project(mint(workflow, catalog), catalog)).toMatchInlineSnapshot(`
      {
        "definitions": {
          "subgraphs": [
            {
              "id": "a",
              "links": [],
              "nodes": [],
            },
            {
              "id": "z",
              "links": [],
              "nodes": [],
            },
          ],
        },
        "links": [],
        "nodes": [
          {
            "id": 2,
            "type": "Unknown",
          },
          {
            "id": 3,
            "type": "Unknown",
          },
          {
            "id": "4",
            "type": "Unknown",
          },
          {
            "id": "5",
            "type": "Unknown",
          },
        ],
      }
    `);
  });

  it("preserves a catalog-miss node's opaque values but rejects an invalid named widget", () => {
    const opaque = mint(
      { nodes: [{ id: 1, type: "Missing", widgets_values: ["verbatim", null] }], links: [] },
      catalog,
    );
    expect(project(opaque, catalog).nodes[0]).toEqual({
      id: 1,
      type: "Missing",
      widgets_values: ["verbatim", null],
    });

    const invalid = new Y.Doc();
    initDoc(invalid);
    const node = createNodeMap(
      { id: 2, type: "Known", widgets_values: { invalid: "must fail" } } as unknown as Parameters<
        typeof createNodeMap
      >[0],
      catalog.types.Known!.widget_order,
    );
    nodesMap(invalid).set("2", node);
    expect(() => project(invalid, catalog)).toThrow(
      "project: widget 'invalid' is not in widget_order for Known",
    );
  });

  it("uses deterministic sorted fallback order when definition order registers are absent", () => {
    const doc = mint(
      {
        nodes: [],
        links: [],
        definitions: {
          subgraphs: [
            {
              id: "sg",
              nodes: [
                { id: "b", type: "Unknown" },
                { id: "a", type: "Unknown" },
              ],
              links: [
                ["b", 1, 0, 2, 0, "X"],
                ["a", 2, 0, 1, 0, "X"],
              ],
            },
          ],
        },
      } as unknown as WorkflowJSON,
      catalog,
    );
    const definition = definitionsMap(doc).get("sg")!;
    definition.delete("node_order");
    definition.delete("link_order");

    const sg = (project(doc, catalog).definitions as { subgraphs: Array<Record<string, unknown>> })
      .subgraphs[0]!;
    expect(sg.nodes).toEqual([
      { id: "a", type: "Unknown" },
      { id: "b", type: "Unknown" },
    ]);
    expect(sg.links).toEqual([
      ["a", 2, 0, 1, 0, "X"],
      ["b", 1, 0, 2, 0, "X"],
    ]);
  });
});
