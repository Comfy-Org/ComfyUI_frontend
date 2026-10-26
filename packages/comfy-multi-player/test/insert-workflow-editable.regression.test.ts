/**
 * Nodes an `insert_workflow` op lands must stay editable by the clients that
 * exist: comfy-cli and the frontend mint `set_widget` WITHOUT
 * `node_incarnation` (absent means legacy life 0), and the projection never
 * shows a node's incarnation, so no client can learn a different one.
 *
 * Seen on stg-v2 agent traces (2026-09-21): `set_widget` on a template's
 * LoadImage reported committed, the document kept the template's own
 * `medusa_poster.png`, and the job failed on that missing input.
 *
 * `proxyWidgets` names interior nodes by raw id; after the remap those ids no
 * longer exist, so a promoted-widget write routed through it finds nothing.
 */
import { describe, expect, it } from "vitest";

import { applyOps, mint, project, type Op, type WidgetCatalog, type WorkflowJSON } from "../src/index.js";

const catalog: WidgetCatalog = {
  types: {
    LoadImage: { widget_order: ["image"] },
    Inner: { widget_order: ["text"] },
  },
};

const OP_ID = "1ed4449ae23f3bcc8b599de88f69fd6a";

function template(): WorkflowJSON {
  return {
    nodes: [
      { id: 12, type: "LoadImage", widgets_values: ["medusa_poster.png"] },
      { id: 57, type: "def-1", properties: { proxyWidgets: [["27", "text"]] } },
    ],
    links: [],
    definitions: {
      subgraphs: [{ id: "def-1", name: "D", nodes: [{ id: 27, type: "Inner", widgets_values: ["t"] }], links: [] }],
    },
  } as unknown as WorkflowJSON;
}

function envelope(tag: string) {
  return { op_id: (tag + "0".repeat(32)).slice(0, 32), actor: "agent:a", base_version: 1, stamp: [1, "agent:a"] };
}

function inserted() {
  const doc = mint({ nodes: [], links: [] }, catalog);
  const op = { ...envelope(OP_ID), op_id: OP_ID, op: "insert_workflow", workflow: template() } as unknown as Op;
  expect(applyOps(doc, [op], catalog).outcomes[0]).toMatchObject({ outcome: "applied" });
  const wf = project(doc, catalog);
  const loadImage = wf.nodes!.find((n) => n.type === "LoadImage")!;
  const instance = wf.nodes!.find((n) => n.type !== "LoadImage")!;
  const sg = (wf as { definitions: { subgraphs: { id: string; nodes: { id: unknown }[] }[] } }).definitions
    .subgraphs[0]!;
  return { doc, loadImage, instance, interiorId: sg.nodes[0]!.id };
}

describe("insert_workflow: inserted nodes stay editable", () => {
  it("applies a top-level set_widget that carries no node_incarnation", () => {
    const { doc, loadImage } = inserted();
    const op = {
      ...envelope("sw1"),
      op: "set_widget",
      node_id: loadImage.id,
      widget: "image",
      value: "upload_abc.png",
    } as unknown as Op;

    expect(applyOps(doc, [op], catalog).outcomes[0]).toMatchObject({ outcome: "applied" });
    const after = project(doc, catalog).nodes!.find((n) => n.id === loadImage.id)!;
    expect(after.widgets_values).toEqual(["upload_abc.png"]);
  });

  it("applies an interior set_widget that carries no node_incarnation", () => {
    const { doc, instance, interiorId } = inserted();
    const op = {
      ...envelope("sw2"),
      op: "set_widget",
      node_id: instance.id,
      widget: "text",
      path: [instance.id, interiorId],
      inner_widget: "text",
      value: "a white wolf",
    } as unknown as Op;

    expect(applyOps(doc, [op], catalog).outcomes[0]).toMatchObject({ outcome: "applied" });
    const sg = (project(doc, catalog) as { definitions: { subgraphs: { nodes: { widgets_values: unknown }[] }[] } })
      .definitions.subgraphs[0]!;
    expect(sg.nodes[0]!.widgets_values).toEqual(["a white wolf"]);
  });

  it("remaps proxyWidgets interior ids along with the interior nodes", () => {
    const { instance, interiorId } = inserted();
    const proxy = (instance.properties as { proxyWidgets: unknown[][] }).proxyWidgets;
    expect(proxy).toEqual([[String(interiorId), "text"]]);
  });
});

describe("insert_workflow: proxyWidgets instance sentinel", () => {
  // `-1` in a proxyWidgets entry means "the instance itself", never an interior
  // node — even when the definition really holds an interior node whose id is -1.
  it("keeps a -1 proxy entry as the instance sentinel when an interior node is also -1", () => {
    const wf = {
      nodes: [{ id: 57, type: "def-1", properties: { proxyWidgets: [["-1", "seed"], ["27", "text"]] } }],
      links: [],
      definitions: {
        subgraphs: [
          {
            id: "def-1",
            name: "D",
            nodes: [
              { id: -1, type: "Inner", widgets_values: ["x"] },
              { id: 27, type: "Inner", widgets_values: ["t"] },
            ],
            links: [],
          },
        ],
      },
    } as unknown as WorkflowJSON;
    const doc = mint({ nodes: [], links: [] }, catalog);
    const op = { ...envelope(OP_ID), op_id: OP_ID, op: "insert_workflow", workflow: wf } as unknown as Op;
    expect(applyOps(doc, [op], catalog).outcomes[0]).toMatchObject({ outcome: "applied" });
    const projected = project(doc, catalog) as unknown as {
      nodes: { properties: { proxyWidgets: unknown[][] } }[];
      definitions: { subgraphs: { nodes: { id: unknown }[] }[] };
    };
    const interior27 = projected.definitions.subgraphs[0]!.nodes[1]!.id;
    expect(projected.nodes[0]!.properties.proxyWidgets).toEqual([
      ["-1", "seed"],
      [String(interior27), "text"],
    ]);
  });
});
