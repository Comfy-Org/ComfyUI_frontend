/**
 * A catalog that describes EVERY dynamic-combo option (`dynamic_combos`,
 * comfy-cli `nodes widget-catalog`) lets the applier handle a selection other
 * than the first — the gap BE-9176's `_extra_N` placeholders worked around.
 *
 * Measured on stg-v2 agent traces (2026-09-21): after `set_widget mode
 * faithful` on MagnificImageSkinEnhancerNode, `set_widget mode.skin_detail`
 * was refused "widget 'mode.skin_detail' not found … available: sharpen,
 * smart_grain, mode".
 *
 * Semantics follow the frontend (`src/core/graph/widgets/dynamicWidgets.ts`):
 * the selected option's widget slots sit right after the selector; changing
 * the selection removes the old option's slots and seeds the new option's from
 * spec defaults.
 */
import * as Y from "yjs";
import { describe, expect, it } from "vitest";

import { applyOps, mint, project, type Op, type WidgetCatalog, type WorkflowJSON } from "../src/index.js";
import { cleanRejection, rejectionEvidence } from "./rejection-oracle.js";

// The shape comfy-cli publishes (comfy-cli#920), verbatim for this class.
const catalog = {
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
} as unknown as WidgetCatalog;

function canvas(widgets_values: unknown[]): WorkflowJSON {
  return { nodes: [{ id: 1, type: "MagnificImageSkinEnhancerNode", widgets_values }], links: [] } as WorkflowJSON;
}

let seq = 0;
function setWidget(widget: string, value: unknown): Op {
  const n = ++seq;
  return {
    op: "set_widget",
    op_id: ("dc" + String(n).padStart(4, "0")).padEnd(32, "0"),
    actor: "agent:a",
    base_version: n,
    stamp: [n, "agent:a"],
    node_id: 1,
    widget,
    value,
  } as unknown as Op;
}

function values(doc: ReturnType<typeof mint>): unknown {
  return project(doc, catalog).nodes![0]!.widgets_values;
}

describe("dynamic combos: every option is addressable", () => {
  it("names a non-default selection's sub-widget by its real name on mint", () => {
    const doc = mint(canvas([0, 2, "faithful", 55]), catalog);
    expect(applyOps(doc, [setWidget("mode.skin_detail", 60)], catalog).outcomes[0]).toMatchObject({
      outcome: "applied",
    });
    expect(values(doc)).toEqual([0, 2, "faithful", 60]);
  });

  it("seeds the new option's defaults when the selector changes, then accepts its sub-widget", () => {
    const doc = mint(canvas([0, 2, "creative"]), catalog);
    expect(applyOps(doc, [setWidget("mode", "faithful")], catalog).outcomes[0]).toMatchObject({ outcome: "applied" });
    expect(values(doc)).toEqual([0, 2, "faithful", 80]);

    expect(applyOps(doc, [setWidget("mode.skin_detail", 55)], catalog).outcomes[0]).toMatchObject({
      outcome: "applied",
    });
    expect(values(doc)).toEqual([0, 2, "faithful", 55]);
  });

  it("drops the old option's sub-widgets when the selection moves on", () => {
    const doc = mint(canvas([0, 2, "faithful", 55]), catalog);
    applyOps(doc, [setWidget("mode", "flexible")], catalog);
    expect(values(doc)).toEqual([0, 2, "flexible", "enhance_skin"]);
  });

  // Validation must not depend on the current selection: a child write that
  // arrives before the selector write it follows would otherwise be refused on
  // one replica and applied on another. An unselected option's value is stored
  // and simply not projected — the frontend likewise keeps it for when that
  // option is selected again (dynamicWidgets.ts `restoreRemovedValues`).
  it("stores a sub-widget of an unselected option without projecting it", () => {
    const doc = mint(canvas([0, 2, "faithful", 55]), catalog);
    expect(applyOps(doc, [setWidget("mode.optimized_for", "improve_lighting")], catalog).outcomes[0]).toMatchObject({
      outcome: "applied",
    });
    expect(values(doc)).toEqual([0, 2, "faithful", 55]);
    applyOps(doc, [setWidget("mode", "flexible")], catalog);
    expect(values(doc)).toEqual([0, 2, "flexible", "improve_lighting"]);
  });

  it("still refuses a name no option of the class has, leaving the document untouched", () => {
    // KA-4 rejection oracle: byte identity, unconsumed op_id, and a trailing
    // valid op reported batch_aborted.
    const evidence = rejectionEvidence(
      canvas([0, 2, "faithful", 55]),
      setWidget("mode.no_such_widget", 1),
      catalog,
      setWidget("mode.skin_detail", 60),
    );
    expect(evidence).toEqual(cleanRejection("unknown_widget", true));
  });

  it.each(["child-first", "child-last"] as const)(
    "converges when a new option's child write races the selector write (%s)",
    (arrival) => {
      const doc = mint(canvas([0, 2, "creative"]), catalog);
      const selector = setWidget("mode", "faithful"); // lower stamp
      const child = setWidget("mode.skin_detail", 63); // higher stamp
      const ops = arrival === "child-first" ? [child, selector] : [selector, child];
      const outcomes = ops.map((op) => applyOps(doc, [op], catalog).outcomes[0]!.outcome);
      expect(outcomes).toEqual(["applied", "applied"]);
      expect(values(doc)).toEqual([0, 2, "faithful", 63]);

      // Double-apply: a duplicate op_id is a true no-op, bytes and projection.
      const before = Buffer.from(Y.encodeStateAsUpdate(doc));
      expect(applyOps(doc, ops, catalog).outcomes.map((outcome) => outcome.outcome)).toEqual(["no-op", "no-op"]);
      expect(Buffer.from(Y.encodeStateAsUpdate(doc)).equals(before)).toBe(true);
      expect(values(doc)).toEqual([0, 2, "faithful", 63]);
    },
  );
});
