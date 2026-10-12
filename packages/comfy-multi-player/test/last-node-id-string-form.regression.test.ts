/**
 * DQ-15 Q2 (Christian, blocked-on-christian#10, ruled 2026-08-28): "node ids
 * get normalized before the id-counter write so numeric vs string forms of
 * the same id can't skew it." `NodeId = string | number` (src/types.ts), so
 * a wire `node_id` of `"42"` is a legal add_node payload — but the
 * `last_node_id` max-register write in `applyAddNode` (src/applier.ts) only
 * fires when `typeof op.node_id === "number"`, silently skipping the update
 * for any string-form id. A later numeric add can then reuse an id already
 * taken by the string-form add, corrupting the id-counter invariant
 * (vocabulary §8.3: last_node_id is a max-register over all node ids ever
 * minted, not just numeric-typed ones).
 */
import { describe, expect, it } from "vitest";
import { applyOps, mint, project, type Op, type WorkflowJSON } from "../src/index.js";
import { loadCatalog } from "./helpers.js";

const catalog = loadCatalog();
const id = (tag: string) => (tag + "0".repeat(32)).slice(0, 32);

const base = (): WorkflowJSON => ({
  nodes: [],
  links: [],
  groups: [],
  extra: {},
  last_node_id: 0,
  last_link_id: 0,
});

function addNode(nodeId: string | number, tag: string): Op {
  return {
    op: "add_node",
    op_id: id(tag),
    actor: "human:a",
    base_version: 1,
    stamp: [1, "human:a"],
    node_id: nodeId,
    class_type: "LoadImage",
    pos: [],
    node: {
      id: nodeId,
      type: "LoadImage",
      inputs: [],
      outputs: [{ name: "IMAGE", type: "IMAGE", links: [] }],
      widgets_values: [],
    },
  } satisfies Op;
}

describe("DQ-15 Q2: last_node_id max-register normalizes string-form node_id", () => {
  it("advances last_node_id when the wire node_id is a numeric string", () => {
    const doc = mint(base(), catalog);

    const result = applyOps(doc, [addNode("42", "string-form")], catalog);

    expect(result.outcomes[0]).toMatchObject({ outcome: "applied" });
    const projected = project(doc, catalog);
    expect(projected["last_node_id"]).toBe(42);
  });

  it("does not let a later numeric add reuse an id already taken by a string-form add", () => {
    const doc = mint(base(), catalog);

    applyOps(doc, [addNode("42", "string-form")], catalog);
    // comfy-cli would mint the next node id as last_node_id + 1; if the
    // max-register never advanced past 0, it would mint 1 here and diverge
    // from a replica that saw the numeric-form id land first.
    const projectedAfterFirst = project(doc, catalog);
    expect(projectedAfterFirst["last_node_id"]).toBeGreaterThanOrEqual(42);

    const second = applyOps(doc, [addNode(43, "numeric-form")], catalog);
    expect(second.outcomes[0]).toMatchObject({ outcome: "applied" });
    const projected = project(doc, catalog);
    expect(projected["last_node_id"]).toBe(43);
    expect(projected.nodes.map((n) => n.id).sort()).toEqual(["42", 43].sort());
  });

  it("mixed order: numeric add after a higher string-form add keeps the max, does not regress it", () => {
    const doc = mint(base(), catalog);

    applyOps(doc, [addNode("100", "string-hi")], catalog);
    applyOps(doc, [addNode(5, "numeric-lo")], catalog);

    const projected = project(doc, catalog);
    expect(projected["last_node_id"]).toBe(100);
  });
});
