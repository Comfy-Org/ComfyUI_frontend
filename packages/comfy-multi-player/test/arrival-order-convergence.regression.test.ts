import * as Y from "yjs";
import { describe, expect, it } from "vitest";
import { applyOps, mint, project, type Op, type WorkflowJSON, type WorkflowNode } from "../src/index.js";
import { canonicalize, loadCatalog } from "./helpers.js";

const catalog = loadCatalog();
const id = (tag: string) => (tag + "0".repeat(32)).slice(0, 32);

function source(id: number): WorkflowNode {
  return {
    id,
    type: "LoadImage",
    inputs: [],
    outputs: [{ name: "IMAGE", type: "IMAGE", links: [] }],
    widgets_values: [],
  };
}

function base(nodes: WorkflowNode[]): WorkflowJSON {
  return { nodes, links: [], groups: [], extra: {}, last_node_id: 700, last_link_id: 0 };
}

function run(workflow: WorkflowJSON, ops: Op[]): WorkflowJSON {
  const seeded = mint(workflow, catalog);
  const doc = new Y.Doc();
  Y.applyUpdate(doc, Y.encodeStateAsUpdate(seeded));
  expect(applyOps(doc, ops, catalog).outcomes.find((outcome) => outcome.outcome === "rejected")).toBeUndefined();
  return canonicalize(project(doc, catalog));
}

describe("regression: structural operations resolve by stamp, not arrival order (#11)", () => {
  it("node delete and re-add converge to the higher-stamped presence", () => {
    const original = source(500);
    const replacement = { ...source(500), title: "replacement" };
    const del = {
      op: "delete_node", op_id: id("delete"), actor: "human:z", base_version: 5,
      stamp: [5, "human:z"], node_id: 500, removed_links: [],
    } as Op;
    const add = {
      op: "add_node", op_id: id("readd"), actor: "agent:a", base_version: 9,
      stamp: [9, "agent:a"], node_id: 500, class_type: "LoadImage", pos: [], node: replacement,
    } as Op;

    expect(run(base([original]), [del, add])).toEqual(run(base([original]), [add, del]));
    expect(run(base([original]), [add, del]).nodes[0]?.title).toBe("replacement");
  });

  it("concurrent autogrows assign names and input indexes by stamp", () => {
    const destination: WorkflowNode = {
      id: 700,
      type: "BatchImagesNode",
      inputs: [{ name: "images.image0", type: "IMAGE", link: null }],
      outputs: [{ name: "IMAGE", type: "IMAGE", links: [] }],
      widgets_values: [],
    };
    const grow = (tag: string, actor: string, version: number, link: number, from: number): Op => ({
      op: "connect", op_id: id(tag), actor, base_version: version, stamp: [version, actor],
      link_id: link, from_node: from, from_slot: 0, to_node: 700, to_slot: null,
      link_type: "IMAGE", grow: { name: "images.image0", type: "IMAGE" },
    } as Op);
    const low = grow("grow-low", "agent:a", 5, 9701, 500);
    const high = grow("grow-high", "human:z", 9, 9702, 510);
    const workflow = base([source(500), source(510), destination]);

    expect(run(workflow, [low, high])).toEqual(run(workflow, [high, low]));
  });

  it("clear and a concurrent add converge to the higher-stamped node presence", () => {
    const added = source(600);
    const clear = {
      op: "clear", op_id: id("clear"), actor: "agent:a", base_version: 5,
      stamp: [5, "agent:a"], removed_nodes: [500, 600],
    } as Op;
    const add = {
      op: "add_node", op_id: id("after-clear"), actor: "human:z", base_version: 9,
      stamp: [9, "human:z"], node_id: 600, class_type: "LoadImage", pos: [], node: added,
    } as Op;
    const workflow = base([source(500)]);

    expect(run(workflow, [clear, add])).toEqual(run(workflow, [add, clear]));
    expect(run(workflow, [add, clear]).nodes.map((node) => node.id)).toEqual([600]);
  });

  it("delete with a non-empty removed_links converges against a re-add", () => {
    // The first pass at this fix gated link severance on the node-presence
    // register, so a delete that LOST the gate also dropped the links it
    // explicitly named: [delete, add] ended with `links: []` while
    // [add, delete] kept `[[9000, ...]]` installed. Severing a named link is
    // monotonic and belongs to its own register.
    const wired: WorkflowJSON = {
      nodes: [
        { ...source(500), outputs: [{ name: "IMAGE", type: "IMAGE", links: [9000] }] },
        {
          id: 600, type: "PreviewImage",
          inputs: [{ name: "images", type: "IMAGE", link: 9000 }],
          outputs: [], widgets_values: [],
        },
      ],
      links: [[9000, 500, 0, 600, 0, "IMAGE"]],
      groups: [], extra: {}, last_node_id: 600, last_link_id: 9000,
    } as unknown as WorkflowJSON;
    const del = {
      op: "delete_node", op_id: id("del-links"), actor: "human:z", base_version: 5,
      stamp: [5, "human:z"], node_id: 500, removed_links: [9000],
    } as Op;
    const add = {
      op: "add_node", op_id: id("readd-links"), actor: "agent:a", base_version: 9,
      stamp: [9, "agent:a"], node_id: 500, class_type: "LoadImage", pos: [],
      node: { ...source(500), outputs: [{ name: "IMAGE", type: "IMAGE", links: [9000] }], title: "re" },
    } as Op;

    expect(run(wired, [del, add])).toEqual(run(wired, [add, del]));
    const settled = run(wired, [add, del]);
    expect(settled.links).toEqual([]);
    // No dangling reference survives on either side of the severed link.
    expect(((settled.nodes.find((n) => n.id === 500) as WorkflowNode).outputs?.[0] as { links?: number[] } | undefined)?.links).toEqual([]);
    expect(((settled.nodes.find((n) => n.id === 600) as WorkflowNode).inputs?.[0] as { link?: number | null } | undefined)?.link).toBeNull();
  });

  it("a winning add_node re-derives its link references instead of orphaning them", () => {
    // Replacing a live node with the op payload verbatim installed mint-time
    // link references over a links map that had moved on: node 500's output
    // port disowned link 9000 while the link and node 600's consumption of it
    // both survived.
    const wired: WorkflowJSON = {
      nodes: [
        { ...source(500), outputs: [{ name: "IMAGE", type: "IMAGE", links: [9000] }] },
        {
          id: 600, type: "PreviewImage",
          inputs: [{ name: "images", type: "IMAGE", link: 9000 }],
          outputs: [], widgets_values: [],
        },
      ],
      links: [[9000, 500, 0, 600, 0, "IMAGE"]],
      groups: [], extra: {}, last_node_id: 600, last_link_id: 9000,
    } as unknown as WorkflowJSON;
    const add = {
      op: "add_node", op_id: id("clobber"), actor: "agent:a", base_version: 1,
      stamp: [1, "agent:a"], node_id: 500, class_type: "LoadImage", pos: [],
      node: { ...source(500), outputs: [{ name: "IMAGE", type: "IMAGE", links: [] }] },
    } as Op;

    const after = run(wired, [add]);
    expect(after.links).toEqual([[9000, 500, 0, 600, 0, "IMAGE"]]);
    expect(((after.nodes.find((n) => n.id === 500) as WorkflowNode).outputs?.[0] as { links?: number[] } | undefined)?.links).toEqual([9000]);
    expect(((after.nodes.find((n) => n.id === 600) as WorkflowNode).inputs?.[0] as { link?: number | null } | undefined)?.link).toBe(9000);
  });

  it("concurrent autogrows that request DIFFERENT names still converge", () => {
    // Canonical renaming replayed the currently-executing op's `grow.name` for
    // every racing slot, so a family holding one `images.image0` request and
    // one `images.image7` request settled differently per arrival order.
    const destination: WorkflowNode = {
      id: 700,
      type: "BatchImagesNode",
      inputs: [{ name: "images.image0", type: "IMAGE", link: null }],
      outputs: [{ name: "IMAGE", type: "IMAGE", links: [] }],
      widgets_values: [],
    };
    const grow = (tag: string, actor: string, version: number, link: number, from: number, name: string): Op => ({
      op: "connect", op_id: id(tag), actor, base_version: version, stamp: [version, actor],
      link_id: link, from_node: from, from_slot: 0, to_node: 700, to_slot: null,
      link_type: "IMAGE", grow: { name, type: "IMAGE" },
    } as Op);
    const low = grow("diff-low", "agent:a", 5, 9701, 500, "images.image0");
    const high = grow("diff-high", "human:z", 9, 9702, 510, "images.image7");
    const workflow = base([source(500), source(510), destination]);

    expect(run(workflow, [low, high])).toEqual(run(workflow, [high, low]));
    expect(
      (run(workflow, [high, low]).nodes.find((n) => n.id === 700) as WorkflowNode).inputs?.map(
        (slot) => (slot as { name?: string }).name,
      ),
    ).toEqual(["images.image0", "images.image1", "images.image7"]);
  });

  it("clear with an empty removed_nodes list converges against a lower-stamped add", () => {
    // The hole that survived the first pass at #11: `clear` fell back to
    // `nodes.keys()` when `removed_nodes` was empty, so the target set was
    // read out of arrival-dependent document state. With a clear that
    // OUTRANKS the concurrent add, [add, clear] deleted the add while
    // [clear, add] kept it. `removed_nodes` is now authoritative (FC-8).
    const added = source(600);
    const clear = {
      op: "clear", op_id: id("empty-clear"), actor: "agent:a", base_version: 9,
      stamp: [9, "agent:a"], removed_nodes: [],
    } as Op;
    const add = {
      op: "add_node", op_id: id("low-add"), actor: "human:z", base_version: 3,
      stamp: [3, "human:z"], node_id: 600, class_type: "LoadImage", pos: [], node: added,
    } as Op;
    const workflow = base([source(500)]);

    expect(run(workflow, [clear, add])).toEqual(run(workflow, [add, clear]));
    // A node the clear never saw is outside its scope; node 500 was not in
    // `removed_nodes` either, so an empty list removes nothing.
    expect(run(workflow, [add, clear]).nodes.map((node) => node.id)).toEqual([500, 600]);
  });

  it("clear drops only links whose endpoints it removed, in either arrival order", () => {
    // Links used to be wiped wholesale, which reintroduced the same
    // arrival-order dependence one level down: a concurrent `connect` between
    // two survivors vanished when it arrived before the clear and survived
    // when it arrived after. Link survival now follows node presence.
    const destination: WorkflowNode = {
      id: 700,
      type: "PreviewImage",
      inputs: [{ name: "images", type: "IMAGE", link: null }],
      outputs: [],
      widgets_values: [],
    };
    const clear = {
      op: "clear", op_id: id("scoped-clear"), actor: "agent:a", base_version: 9,
      stamp: [9, "agent:a"], removed_nodes: [510],
    } as Op;
    const connect = {
      op: "connect", op_id: id("survivor-link"), actor: "human:z", base_version: 3,
      stamp: [3, "human:z"], link_id: 9800, from_node: 500, from_slot: 0,
      to_node: 700, to_slot: 0, link_type: "IMAGE",
    } as Op;
    const workflow = base([source(500), source(510), destination]);

    expect(run(workflow, [clear, connect])).toEqual(run(workflow, [connect, clear]));
    expect(run(workflow, [connect, clear]).links.map((link) => (link as unknown[])[0])).toEqual([9800]);
  });
});
