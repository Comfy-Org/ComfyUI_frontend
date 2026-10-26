/** KA-4/KA-10: both orders of two independent selector writes, one shared snapshot. */
import * as Y from "yjs";
import { expect, it } from "vitest";

import { applyOps, mint, project, type SetWidgetOp, type WidgetCatalog } from "../src/index.js";

it("converges when competing options share a child name with different defaults", () => {
  const catalog: WidgetCatalog = {
    types: {
      SharedChild: {
        widget_order: ["mode"],
        dynamic_combos: {
          mode: {
            default: "empty",
            options: {
              empty: { widgets: [], defaults: {} },
              a: { widgets: ["mode.detail"], defaults: { "mode.detail": 41 } },
              b: { widgets: ["mode.detail"], defaults: { "mode.detail": 82 } },
            },
          },
        },
      },
    },
  };
  const seed = mint({ nodes: [{ id: 1, type: "SharedChild", widgets_values: ["empty"] }], links: [] }, catalog);
  const snapshot = Y.encodeStateAsUpdate(seed);
  seed.destroy();
  const writes: SetWidgetOp[] = ["a", "b"].map((value, index) => ({
    op: "set_widget",
    op_id: String(index + 1).padStart(32, "0"),
    actor: `agent:${value}`,
    base_version: (index + 1) * 10,
    stamp: [(index + 1) * 10, `agent:${value}`],
    node_id: 1,
    widget: "mode",
    value,
  }));
  const projections = [writes, [...writes].reverse()].map((ops, order) => {
    const doc = new Y.Doc();
    Y.applyUpdate(doc, snapshot);
    try {
      expect(applyOps(doc, ops, catalog).outcomes.map((outcome) => outcome.outcome)).toEqual(
        order === 0 ? ["applied", "applied"] : ["applied", "lww-dropped"],
      );
      const values = project(doc, catalog).nodes[0]?.widgets_values;
      expect(Array.isArray(values) && values[0]).toBe("b");
      return values;
    } finally {
      doc.destroy();
    }
  });
  // Equality is required regardless of which default policy is chosen.
  // There are exactly two permutations of these independent operations.
  expect(projections).toHaveLength(2);
  expect(projections[0]).toEqual(projections[1]);
});
