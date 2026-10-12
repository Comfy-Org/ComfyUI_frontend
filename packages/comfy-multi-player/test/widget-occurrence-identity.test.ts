import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import {
  applyOps,
  hasAppliedOp,
  mint,
  project,
  readStamps,
  type SetWidgetOp,
  type WidgetCatalog,
  type WorkflowJSON,
} from "../src/index.js";

const catalog: WidgetCatalog = {
  types: { DuplicateWidgets: { widget_order: ["same", "same"] } },
};

const first = {
  trim: { start_time: 1, duration: 2 },
  extension_only: { untouched: true },
};
const second = {
  crop: { x: 1, y: 2, width: 3, height: 4 },
  unknown_key: ["kept", 2],
};

const workflow: WorkflowJSON = {
  nodes: [{
    id: 1,
    type: "DuplicateWidgets",
    widgets_values: [first, second],
    widgets_values_named: { same: second },
    widgets_values_ordered: [
      { name: "same", occurrence: 0, value: first, extension_entry: "keep-0" },
      { name: "same", occurrence: 1, value: second, extension_entry: { keep: true } },
    ],
  }],
  links: [],
};

function setOccurrence(
  op_id: string,
  counter: number,
  value: unknown,
  occurrence = 1,
): SetWidgetOp {
  return {
    op: "set_widget",
    op_id,
    actor: "human:user:tab",
    base_version: counter,
    stamp: [counter, "human:user:tab"],
    node_id: 1,
    widget: "same",
    widget_occurrence: occurrence,
    value,
  };
}

function fork(source: Y.Doc): Y.Doc {
  const doc = new Y.Doc();
  Y.applyUpdate(doc, Y.encodeStateAsUpdate(source));
  return doc;
}

describe("schema v5 occurrence-addressed widget identity", () => {
  it("mints and projects duplicate names losslessly, including dict values and unknown passthrough keys", () => {
    const projected = project(mint(workflow, catalog), catalog);
    expect(projected.nodes[0]?.widgets_values).toEqual([first, second]);
    expect(projected.nodes[0]?.widgets_values_named).toEqual({ same: second });
    expect(projected.nodes[0]?.widgets_values_ordered).toEqual(workflow.nodes[0]?.widgets_values_ordered);
  });

  it("escapes a catalog name that resembles an internal occurrence key", () => {
    const reservedLooking = '\u0000widget-occurrence:["same",1]';
    const hostileCatalog: WidgetCatalog = {
      types: { HostileNames: { widget_order: [reservedLooking, "same", "same"] } },
    };
    const hostile: WorkflowJSON = {
      nodes: [{ id: 9, type: "HostileNames", widgets_values: ["literal", "first", "second"] }],
      links: [],
    };
    expect(project(mint(hostile, hostileCatalog), hostileCatalog).nodes[0]?.widgets_values).toEqual([
      "literal",
      "first",
      "second",
    ]);
  });

  it("applies the second occurrence without changing the first and preserves ordered-entry unknown keys", () => {
    const doc = mint(workflow, catalog);
    const replacement = { crop: { x: 9 }, unknown_key: ["still", "kept"] };
    const op = setOccurrence("11111111111111111111111111111111", 1, replacement);

    expect(applyOps(doc, [op], catalog).outcomes).toEqual([{ op_id: op.op_id, outcome: "applied" }]);
    const node = project(doc, catalog).nodes[0]!;
    expect(node.widgets_values).toEqual([first, replacement]);
    expect(node.widgets_values_ordered).toEqual([
      { name: "same", occurrence: 0, value: first, extension_entry: "keep-0" },
      { name: "same", occurrence: 1, value: replacement, extension_entry: { keep: true } },
    ]);
  });

  it("uses independent LWW targets and converges in both arrival orders", () => {
    const seed = mint(workflow, catalog);
    const low = setOccurrence("22222222222222222222222222222222", 2, { winner: false });
    const high = setOccurrence("33333333333333333333333333333333", 3, { winner: true });
    const forward = fork(seed);
    const reverse = fork(seed);

    applyOps(forward, [low, high], catalog);
    applyOps(reverse, [high, low], catalog);

    expect(project(forward, catalog)).toEqual(project(reverse, catalog));
    expect((project(forward, catalog).nodes[0]?.widgets_values as unknown[])[1]).toEqual({ winner: true });
    expect(Object.keys(readStamps(forward))).toContain(
      JSON.stringify(["widget", "1", "0", "same", 1]),
    );
  });

  it("replays the creator-owned op_id as a byte-identical no-op", () => {
    const doc = mint(workflow, catalog);
    const op = setOccurrence("44444444444444444444444444444444", 4, { retry: "same identity" });
    applyOps(doc, [op], catalog);
    const before = Y.encodeStateAsUpdate(doc);

    expect(applyOps(doc, [op], catalog).outcomes).toEqual([{ op_id: op.op_id, outcome: "no-op" }]);
    expect(Y.encodeStateAsUpdate(doc)).toEqual(before);
    expect(hasAppliedOp(doc, op.op_id)).toBe(true);
  });

  it("rejects an absent occurrence and a malformed occurrence without mutation or op-id consumption", () => {
    for (const op of [
      setOccurrence("55555555555555555555555555555555", 5, "missing", 2),
      setOccurrence("66666666666666666666666666666666", 6, "bad", -1),
    ]) {
      const doc = mint(workflow, catalog);
      const before = Y.encodeStateAsUpdate(doc);
      const outcome = applyOps(doc, [op], catalog).outcomes[0];
      expect(outcome?.outcome).toBe("rejected");
      expect(outcome && "reason" in outcome ? outcome.reason.code : undefined).toMatch(/unknown_widget|malformed_op/);
      expect(Y.encodeStateAsUpdate(doc)).toEqual(before);
      expect(hasAppliedOp(doc, op.op_id)).toBe(false);
    }
  });
});
