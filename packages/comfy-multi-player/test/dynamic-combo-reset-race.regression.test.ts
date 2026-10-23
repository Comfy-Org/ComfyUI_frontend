/**
 * Regression for https://github.com/Comfy-Org/comfy-multi-player/pull/240:
 * a lower-stamped selector reset must not erase a higher-stamped child write.
 * KA-2/KA-4: both arrivals preserve the causal order of the two selector writes.
 * Two executions, forked from one snapshot; no helper-only reset simulation.
 */
import * as Y from "yjs";
import { describe, expect, it } from "vitest";

import { applyOps, mint, project, type SetWidgetOp, type WidgetCatalog } from "../src/index.js";

const catalog: WidgetCatalog = {
  types: {
    MagnificImageSkinEnhancerNode: {
      widget_order: ["sharpen", "smart_grain", "mode"],
      dynamic_combos: {
        mode: {
          default: "creative",
          options: {
            creative: { widgets: [], defaults: {} },
            faithful: { widgets: ["mode.skin_detail"], defaults: { "mode.skin_detail": 80 } },
            flexible: { widgets: ["mode.optimized_for"], defaults: { "mode.optimized_for": "enhance_skin" } },
          },
        },
      },
    },
  },
};

function write(counter: number, actor: string, widget: string, value: unknown): SetWidgetOp {
  return {
    op: "set_widget",
    op_id: counter.toString(16).padStart(32, "0"),
    actor,
    base_version: counter,
    stamp: [counter, actor],
    node_id: 1,
    widget,
    value,
  };
}

describe("dynamic combo reset preserves a newer concurrent child write", () => {
  const seed = mint({
    nodes: [{ id: 1, type: "MagnificImageSkinEnhancerNode", widgets_values: [0, 2, "faithful", 55] }],
    links: [],
  }, catalog);
  const snapshot = Y.encodeStateAsUpdate(seed);
  seed.destroy();

  it.each(["child-first", "child-last"] as const)("regression: %s arrival", (arrival) => {
    const doc = new Y.Doc();
    Y.applyUpdate(doc, snapshot);
    const away = write(10, "agent:selector", "mode", "flexible");
    const back = write(20, "agent:selector", "mode", "faithful");
    const child = write(30, "agent:child", "mode.skin_detail", 63);
    const ops = arrival === "child-first" ? [child, away, back] : [away, back, child];
    try {
      const result = applyOps(doc, ops, catalog);
      expect(result.outcomes.map((outcome) => outcome.outcome)).toEqual(["applied", "applied", "applied"]);
      // The child stamp (30) wins over both reset stamps (10 and 20).
      // A receiver-side delete/default write must not replace it with 80.
      expect(project(doc, catalog).nodes[0]?.widgets_values).toEqual([0, 2, "faithful", 63]);

      // Double-apply: replaying the completed batch is a true no-op.
      const before = Buffer.from(Y.encodeStateAsUpdate(doc));
      const replay = applyOps(doc, ops, catalog);
      expect(replay.outcomes.map((outcome) => outcome.outcome)).toEqual(["no-op", "no-op", "no-op"]);
      expect(Buffer.from(Y.encodeStateAsUpdate(doc)).equals(before)).toBe(true);
      expect(project(doc, catalog).nodes[0]?.widgets_values).toEqual([0, 2, "faithful", 63]);
    } finally {
      doc.destroy();
    }
  });
});
