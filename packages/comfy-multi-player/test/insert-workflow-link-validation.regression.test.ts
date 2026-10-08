import * as Y from "yjs";
import { expect, it } from "vitest";
import { applyOps, hasAppliedOp, mint, type Op, type WidgetCatalog } from "../src/index.js";

// Joint insertion/durable-state recovery must validate every descriptor before
// committing any prefix, including definitions and an earlier valid link.
it("regression: invalid later inserted link leaves the document and operation ledger untouched", () => {
  const catalog: WidgetCatalog = { types: { Source: { widget_order: [] }, Sink: { widget_order: [] } } };
  const doc = mint({ nodes: [], links: [] }, catalog);
  const op = {
    op: "insert_workflow",
    op_id: "a7".repeat(16),
    actor: "agent:validation",
    base_version: 5,
    stamp: [5, "agent:validation"],
    workflow: {
      nodes: [
        { id: 1, type: "Source", outputs: [{ name: "out", type: "IMAGE", links: [10, 11] }] },
        { id: 2, type: "Sink", inputs: [{ name: "in", type: "IMAGE", link: 10 }] },
        { id: 3, type: "Sink", inputs: [{ name: "in", type: "IMAGE", link: 11 }] },
      ],
      links: [[10, 1, 0, 2, 0, "IMAGE"], [11, 1, -1, 3, 0, "IMAGE"]],
      definitions: { subgraphs: [{ id: "retained-template", nodes: [], links: [] }] },
    },
  } as Op;
  const before = Y.encodeStateAsUpdate(doc);
  for (let attempt = 0; attempt < 2; attempt++) {
    const result = applyOps(doc, [op], catalog);
    expect(Y.encodeStateAsUpdate(doc)).toEqual(before);
    expect(result.outcomes).toEqual([
      expect.objectContaining({
        op_id: op.op_id, outcome: "rejected", reason: expect.objectContaining({ code: "malformed_op" }),
      }),
    ]);
    expect(hasAppliedOp(doc, op.op_id)).toBe(false);
  }
});
