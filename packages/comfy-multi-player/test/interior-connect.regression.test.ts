import { describe, expect, it } from "vitest";
import {
  applyOps,
  mint,
  project,
  type ConnectOp,
  type WidgetCatalog,
  type WorkflowJSON,
} from "../src/index.js";

const catalog: WidgetCatalog = {
  types: {
    Source: { widget_order: [] },
    Sink: { widget_order: [] },
  },
};

const workflow = {
  nodes: [{ id: 100, type: "definition-1", inputs: [], outputs: [] }],
  links: [],
  definitions: {
    subgraphs: [
      {
        id: "definition-1",
        nodes: [
          {
            id: 1,
            type: "Source",
            inputs: [],
            outputs: [{ name: "text", type: "STRING", links: null }],
          },
          {
            id: 2,
            type: "Sink",
            inputs: [{ name: "text", type: "STRING", link: null }],
            outputs: [],
          },
        ],
        links: [],
      },
    ],
  },
} as unknown as WorkflowJSON;

describe("interior connect regression", () => {
  it("applies and projects a concrete link inside one subgraph definition", () => {
    const doc = mint(workflow, catalog);
    const connect = {
      op: "connect",
      op_id: "interiorconnect0000000000000001",
      actor: "human:a",
      base_version: 1,
      stamp: [1, "human:a"],
      path: ["100"],
      link_id: 41,
      from_node: 1,
      from_slot: 0,
      to_node: 2,
      to_slot: 0,
      link_type: "STRING",
    } as unknown as ConnectOp;

    expect(applyOps(doc, [connect], catalog).outcomes).toEqual([
      { op_id: connect.op_id, outcome: "applied" },
    ]);

    const definitions = project(doc, catalog).definitions as {
      subgraphs: Array<{
        nodes: Array<{
          id: number;
          inputs?: Array<{ link: number | null }>;
          outputs?: Array<{ links: number[] | null }>;
        }>;
        links: unknown[];
      }>;
    };
    const definition = definitions.subgraphs[0]!;

    expect(definition.links).toEqual([
      {
        id: 41,
        origin_id: 1,
        origin_slot: 0,
        target_id: 2,
        target_slot: 0,
        type: "STRING",
      },
    ]);
    expect(definition.nodes.find(({ id }) => id === 1)?.outputs?.[0]?.links).toEqual([41]);
    expect(definition.nodes.find(({ id }) => id === 2)?.inputs?.[0]?.link).toBe(41);
  });
});
