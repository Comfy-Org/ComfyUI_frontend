/**
 * Regression for review on https://github.com/Comfy-Org/comfy-multi-player/pull/240
 * (project.ts, legacy overflow slot after a selector write).
 *
 * A node minted with a selector value no option has (`"unknown"`) stores its
 * trailing value as the BE-9176 overflow slot `_extra_1`. An accepted
 * `set_widget mode = "a"` then expands the order to `["mode", "mode.detail"]`,
 * so position 1 belongs to a real name. Projection used to throw
 * `widget '_extra_1' is not in widget_order` and the node became
 * permanently unprojectable.
 *
 * Pinned semantics (schema §7 rule 2): an overflow slot `_extra_N` projects at
 * index N only while N is past the node's current expanded order. When the
 * selection gives that position to a real name, the real name owns it (its
 * written value, else the option's read-time default) and the overflow value
 * is shadowed: kept in the document, not projected, and back again if the
 * selection returns to a layout that leaves the position free. This matches
 * the frontend, which rebuilds an option's widgets on a selection change and
 * never reinterprets a stale positional value as the new child. The result is
 * a pure function of doc state, so it converges in any arrival order.
 */
import * as Y from "yjs";
import { describe, expect, it } from "vitest";

import { applyOps, mint, project, type SetWidgetOp, type WidgetCatalog, type WorkflowJSON } from "../src/index.js";

const catalog: WidgetCatalog = {
  types: {
    Dyn: {
      widget_order: ["mode"],
      dynamic_combos: {
        mode: {
          default: null,
          options: { a: { widgets: ["mode.detail"], defaults: { "mode.detail": 41 } } },
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

const legacy = (wv: unknown[]): WorkflowJSON => ({ nodes: [{ id: 1, type: "Dyn", widgets_values: wv }], links: [] }) as WorkflowJSON;
const values = (doc: Y.Doc): unknown => project(doc, catalog).nodes[0]?.widgets_values;

describe("dynamic combos: legacy overflow slot survives a selector write", () => {
  it("projects the minted overflow slot before any write", () => {
    const doc = mint(legacy(["unknown", 9]), catalog);
    expect(values(doc)).toEqual(["unknown", 9]);
  });

  it("stays projectable after selecting an option whose child takes the overflow position", () => {
    const doc = mint(legacy(["unknown", 9]), catalog);
    expect(applyOps(doc, [write(1, "agent:a", "mode", "a")], catalog).outcomes.map((o) => o.outcome)).toEqual(["applied"]);
    expect(values(doc)).toEqual(["a", 41]);
  });

  it("keeps the shadowed overflow value and shows it again when the position frees up", () => {
    const doc = mint(legacy(["unknown", 9]), catalog);
    applyOps(doc, [write(1, "agent:a", "mode", "a"), write(2, "agent:a", "mode", "unknown")], catalog);
    expect(values(doc)).toEqual(["unknown", 9]);
  });

  it("still projects an overflow slot past the expanded order at its own index", () => {
    const doc = mint(legacy(["unknown", 9, 10]), catalog);
    applyOps(doc, [write(1, "agent:a", "mode", "a")], catalog);
    expect(values(doc)).toEqual(["a", 41, 10]);
  });

  describe("convergence", () => {
    const seed = mint(legacy(["unknown", 9]), catalog);
    const snapshot = Y.encodeStateAsUpdate(seed);
    seed.destroy();

    it.each(["select-first", "child-first"] as const)("%s arrival", (arrival) => {
      const doc = new Y.Doc();
      Y.applyUpdate(doc, snapshot);
      try {
        const select = write(10, "agent:selector", "mode", "a");
        const child = write(20, "agent:child", "mode.detail", 7);
        const ops = arrival === "select-first" ? [select, child] : [child, select];
        expect(applyOps(doc, ops, catalog).outcomes.map((o) => o.outcome)).toEqual(["applied", "applied"]);
        expect(values(doc)).toEqual(["a", 7]);
      } finally {
        doc.destroy();
      }
    });

    it("replicas that saw the ops in opposite orders converge after sync", () => {
      const left = new Y.Doc();
      const right = new Y.Doc();
      Y.applyUpdate(left, snapshot);
      Y.applyUpdate(right, snapshot);
      try {
        applyOps(left, [write(10, "agent:selector", "mode", "a")], catalog);
        applyOps(right, [write(20, "agent:child", "mode.detail", 7)], catalog);
        // Before sync each side is projectable on its own.
        expect(values(left)).toEqual(["a", 41]);
        expect(values(right)).toEqual(["unknown", 9]);
        Y.applyUpdate(left, Y.encodeStateAsUpdate(right));
        Y.applyUpdate(right, Y.encodeStateAsUpdate(left));
        expect(values(left)).toEqual(["a", 7]);
        expect(values(right)).toEqual(["a", 7]);
      } finally {
        left.destroy();
        right.destroy();
      }
    });
  });
});

describe("dynamic combos: mint/project round trip (schema §7 canonical form)", () => {
  const cat: WidgetCatalog = {
    types: {
      Dyn: {
        widget_order: ["mode"],
        dynamic_combos: {
          mode: {
            default: "a",
            options: {
              a: { widgets: ["mode.detail"], defaults: { "mode.detail": 41 } },
              b: { widgets: [], defaults: {} },
            },
          },
        },
      },
    },
  };
  const rt = (wv: unknown[]): unknown => project(mint(legacy(wv), cat), cat).nodes[0]?.widgets_values;

  it("fills a selected option's missing trailing slot with its default, as the frontend does on load", () => {
    expect(rt(["a"])).toEqual(["a", 41]);
  });

  it("preserves every value the imported array does carry, null included", () => {
    expect(rt(["a", 5])).toEqual(["a", 5]);
    expect(rt(["a", null])).toEqual(["a", null]);
    expect(rt(["b"])).toEqual(["b"]);
  });

  it("is a fixed point: the canonical form round-trips unchanged", () => {
    const once = rt(["a"]) as unknown[];
    expect(rt(once)).toEqual(once);
  });
});
