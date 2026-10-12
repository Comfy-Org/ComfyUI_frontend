import * as Y from "yjs";
import { describe, expect, it } from "vitest";
import { nodesMap } from "../src/doc.js";
import {
  applyOps,
  mint,
  project,
  type DeleteNodeOp,
  type SetWidgetOp,
  type WorkflowJSON,
  type WorkflowNode,
} from "../src/index.js";
import { loadCatalog } from "./helpers.js";

const catalog = loadCatalog();
const opId = (name: string): string => (name + "0".repeat(32)).slice(0, 32);

function source(id: number, links: number[]): WorkflowNode {
  return {
    id,
    type: "LoadImage",
    inputs: [],
    outputs: [{ name: "IMAGE", type: "IMAGE", links }],
    widgets_values: ["before.png"],
  };
}

function destination(id: number, link: number | null): WorkflowNode {
  return {
    id,
    type: "PreviewImage",
    inputs: [{ name: "images", type: "IMAGE", link }],
    outputs: [],
    widgets_values: [],
  };
}

function threeNodeWorkflow(): WorkflowJSON {
  return {
    nodes: [source(10, [1]), destination(20, 1), destination(30, 2)],
    links: [
      [1, 10, 0, 20, 0, "IMAGE"],
      [2, 20, 0, 30, 0, "IMAGE"],
    ],
    groups: [],
    extra: {},
    last_node_id: 30,
    last_link_id: 2,
  };
}

function deleteNode(removedLinks: number[]): DeleteNodeOp {
  return {
    op: "delete_node",
    op_id: opId(`delete-${removedLinks.join("-") || "incidental"}`),
    actor: "agent:test",
    base_version: 1,
    stamp: [1, "agent:test"],
    node_id: 20,
    removed_links: removedLinks,
  };
}

function expectApplied(doc: Y.Doc, op: DeleteNodeOp | SetWidgetOp): void {
  expect(applyOps(doc, [op], catalog).outcomes).toEqual([
    { op_id: op.op_id, outcome: "applied" },
  ]);
}

function node(workflow: WorkflowJSON, id: number): WorkflowNode {
  return workflow.nodes.find((candidate) => candidate.id === id)!;
}

function outputLinkIds(workflow: WorkflowJSON, id: number): unknown {
  return (node(workflow, id).outputs?.[0] as { links?: unknown } | undefined)?.links;
}

function inputLinkId(workflow: WorkflowJSON, id: number): unknown {
  return (node(workflow, id).inputs?.[0] as { link?: unknown } | undefined)?.link;
}

describe("scrubDanglingLinkRefs current behavior", () => {
  it("scrubs both endpoint references after delete_node removes named links", () => {
    const doc = mint(threeNodeWorkflow(), catalog);

    expectApplied(doc, deleteNode([1, 2]));

    const after = project(doc, catalog);
    expect(after.links).toEqual([]);
    expect(outputLinkIds(after, 10)).toEqual([]);
    expect(inputLinkId(after, 30)).toBeNull();
    expect(after.nodes.some((candidate) => candidate.id === 20)).toBe(false);
  });

  it("scrubs references when delete_node removes incident links without naming them", () => {
    const doc = mint(threeNodeWorkflow(), catalog);

    expectApplied(doc, deleteNode([]));

    const after = project(doc, catalog);
    expect(after.links).toEqual([]);
    expect(outputLinkIds(after, 10)).toEqual([]);
    expect(inputLinkId(after, 30)).toBeNull();
  });

  it("does not remove references to links that remain live", () => {
    const doc = mint(
      {
        nodes: [source(10, [1]), destination(20, 1)],
        links: [[1, 10, 0, 20, 0, "IMAGE"]],
      },
      catalog,
    );

    expectApplied(doc, {
      op: "set_widget",
      op_id: opId("set-widget"),
      actor: "agent:test",
      base_version: 1,
      stamp: [1, "agent:test"],
      node_id: 10,
      widget: "image",
      value: "after.png",
    });

    const after = project(doc, catalog);
    expect(outputLinkIds(after, 10)).toEqual([1]);
    expect(inputLinkId(after, 20)).toBe(1);
  });

  it("keeps live-link references when delete_node removes only the deleted node's own links", () => {
    const doc = mint(
      {
        nodes: [source(10, [1]), destination(20, 1), source(40, [3]), destination(50, 3)],
        links: [
          [1, 10, 0, 20, 0, "IMAGE"],
          [3, 40, 0, 50, 0, "IMAGE"],
        ],
      },
      catalog,
    );

    expectApplied(doc, deleteNode([1]));

    const after = project(doc, catalog);
    expect(after.links).toEqual([[3, 40, 0, 50, 0, "IMAGE"]]);
    expect(outputLinkIds(after, 10)).toEqual([]);
    expect(after.nodes.some((candidate) => candidate.id === 20)).toBe(false);
    // The unrelated live link's endpoint references survive: these are the
    // keptIds branches of the scrub.
    expect(outputLinkIds(after, 40)).toEqual([3]);
    expect(inputLinkId(after, 50)).toBe(3);
  });

  it("adds no encoded link-reference writes during a non-scrubbing set_widget", () => {
    const doc = mint(
      {
        nodes: [source(10, [1]), destination(20, 1)],
        links: [[1, 10, 0, 20, 0, "IMAGE"]],
      },
      catalog,
    );
    const sourceNode = nodesMap(doc).get("10")!;
    const destinationNode = nodesMap(doc).get("20")!;
    // Observe the parent slot containers, not just the child `links` array:
    // a whole-value replacement of `port.links` (or `slot.link`) detaches the
    // old child without firing on it, so only the parent observer sees it.
    const sourceOutputs = sourceNode.get("outputs") as Y.Array<Y.Map<unknown>>;
    const destinationInputs = destinationNode.get("inputs") as Y.Array<Y.Map<unknown>>;
    let linkReferenceEvents = 0;
    sourceOutputs.observeDeep(() => linkReferenceEvents++);
    destinationInputs.observeDeep(() => linkReferenceEvents++);
    const beforeProjection = project(doc, catalog);
    const beforeBytes = Buffer.from(Y.encodeStateAsUpdate(doc));
    const op: SetWidgetOp = {
      op: "set_widget",
      op_id: opId("set-widget-byte-check"),
      actor: "agent:test",
      base_version: 1,
      stamp: [1, "agent:test"],
      node_id: 10,
      widget: "image",
      value: "after.png",
    };

    expectApplied(doc, op);

    const afterProjection = project(doc, catalog);
    const afterBytes = Buffer.from(Y.encodeStateAsUpdate(doc));
    expect(afterBytes.equals(beforeBytes)).toBe(false);
    expect(linkReferenceEvents).toBe(0);
    expect({
      ...afterProjection,
      nodes: afterProjection.nodes.map((item) =>
        item.id === 10 ? { ...item, widgets_values: ["before.png"] } : item,
      ),
    }).toEqual(beforeProjection);

    expect(applyOps(doc, [op], catalog).outcomes).toEqual([
      { op_id: op.op_id, outcome: "no-op" },
    ]);
    expect(Buffer.from(Y.encodeStateAsUpdate(doc)).equals(afterBytes)).toBe(true);

    // Harness sensitivity: a direct whole-value replacement of `port.links`
    // must be observable through the parent containers above — the exact miss
    // the child-array observer had. Flip the assertion to prove it is live.
    const port = sourceOutputs.get(0)!;
    port.set("links", new Y.Array());
    expect(linkReferenceEvents).toBeGreaterThan(0);
  });
});
