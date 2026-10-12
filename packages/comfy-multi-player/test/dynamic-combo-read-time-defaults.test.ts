/**
 * Defaults of a dynamic combo's selected option are applied when the node is
 * READ (projection), never written into the document by a selector change.
 *
 * Any receiver-side write at selection time is arrival-dependent: with two
 * options sharing a child name (`mode.detail`, defaults 41 and 82) the first
 * seed to land wins (review on #240, reproducer e0bbd29). The document only
 * ever holds values an op actually wrote, so its state is order-independent,
 * and the projection is a pure function of that state:
 *
 * - a selected option's slot shows its stored value if one was ever written,
 *   otherwise that option's default;
 * - a child name shared by several options is ONE slot, so a written value
 *   shows under every option that owns the name.
 */
import { describe, expect, it } from "vitest";

import { applyOps, mint, project, type Op, type WidgetCatalog, type WorkflowJSON } from "../src/index.js";

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

let n = 0;
function write(widget: string, value: unknown, extra: Record<string, unknown> = {}): Op {
  n += 1;
  return {
    op: "set_widget",
    op_id: ("rt" + String(n).padStart(4, "0")).padEnd(32, "0"),
    actor: "agent:a",
    base_version: n,
    stamp: [n, "agent:a"],
    node_id: 1,
    widget,
    value,
    ...extra,
  } as unknown as Op;
}

const top = (): WorkflowJSON => ({ nodes: [{ id: 1, type: "SharedChild", widgets_values: ["empty"] }], links: [] }) as WorkflowJSON;

describe("dynamic combos: read-time defaults", () => {
  it("shows the selected option's own default for a slot nothing wrote", () => {
    const doc = mint(top(), catalog);
    applyOps(doc, [write("mode", "a"), write("mode", "b")], catalog);
    expect(project(doc, catalog).nodes![0]!.widgets_values).toEqual(["b", 82]);
  });

  it("keeps a written shared-name value across the options that own it", () => {
    const doc = mint(top(), catalog);
    applyOps(doc, [write("mode", "a"), write("mode.detail", 7), write("mode", "b")], catalog);
    expect(project(doc, catalog).nodes![0]!.widgets_values).toEqual(["b", 7]);
  });

  it("accepts an interior write to a selected option's slot that holds no stored value", () => {
    const wf = {
      nodes: [{ id: 57, type: "def-1" }],
      links: [],
      definitions: {
        subgraphs: [{ id: "def-1", name: "D", nodes: [{ id: 5, type: "SharedChild", widgets_values: ["empty"] }], links: [] }],
      },
    } as unknown as WorkflowJSON;
    const doc = mint(wf, catalog);
    const interior = { path: [57, 5] };
    const select = write("mode", "a", { ...interior, inner_widget: "mode" });
    const child = write("mode.detail", 9, { ...interior, inner_widget: "mode.detail" });
    expect(applyOps(doc, [select, child], catalog).outcomes.map((o) => o.outcome)).toEqual(["applied", "applied"]);
    const def = (project(doc, catalog) as unknown as { definitions: { subgraphs: { nodes: { widgets_values: unknown }[] }[] } })
      .definitions.subgraphs[0]!;
    expect(def.nodes[0]!.widgets_values).toEqual(["a", 9]);
  });
});
