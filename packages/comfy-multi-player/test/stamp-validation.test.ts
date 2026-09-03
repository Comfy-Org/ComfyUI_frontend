/**
 * R-92 regression: malformed creator-owned stamps must be rejected before
 * they can mutate a register or poison KA-2's total order. Rejection is also
 * subject to KA-4: it leaves the document byte-identical in either arrival
 * order.
 */
import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import {
  appliedOpIds,
  applyOps,
  mint,
  project,
  type Op,
  type SetWidgetOp,
  type WidgetCatalog,
  type WorkflowJSON,
  type WorkflowNode,
} from "../src/index.js";
import { rejectedOutcome } from "./apply-result-helpers.js";

const catalog: WidgetCatalog = {
  types: { KSampler: { widget_order: ["seed"] } },
};

const workflow: WorkflowJSON = {
  nodes: [
    {
      id: 1,
      type: "KSampler",
      inputs: [],
      outputs: [],
      widgets_values: [0],
    },
  ],
  links: [],
} as unknown as WorkflowJSON;

const id = (hexCharacter: string): string => hexCharacter.repeat(32);

function setSeed(opId: string, value: number, stamp: unknown): SetWidgetOp {
  return {
    op: "set_widget",
    op_id: opId,
    actor: "human:envelope",
    base_version: 1,
    stamp: stamp as SetWidgetOp["stamp"],
    node_id: 1,
    widget: "seed",
    value,
  };
}

function fork(snapshot: Uint8Array): Y.Doc {
  const doc = new Y.Doc();
  Y.applyUpdate(doc, snapshot);
  return doc;
}

const bytes = (doc: Y.Doc): Uint8Array => Y.encodeStateAsUpdate(doc);

const seedValue = (doc: Y.Doc): unknown => {
  const widgetsValues = (project(doc, catalog).nodes[0] as WorkflowNode)
    .widgets_values;
  return Array.isArray(widgetsValues) ? widgetsValues[0] : undefined;
};

function expectMalformedWithoutMutation(doc: Y.Doc, op: Op): void {
  const before = bytes(doc);
  const rejection = rejectedOutcome(applyOps(doc, [op], catalog));
  expect(rejection?.reason.code).toBe("malformed_op");
  expect(bytes(doc)).toEqual(before);
  expect(appliedOpIds(doc)).not.toContain(op.op_id);
}

describe("R-92 malformed stamp validation", () => {
  const malformed: Array<{ name: string; stamp: unknown }> = [
    { name: "non-numeric counter", stamp: ["not-a-number", "human:a"] },
    { name: "NaN counter", stamp: [Number.NaN, "human:a"] },
    { name: "infinite counter", stamp: [Number.POSITIVE_INFINITY, "human:a"] },
    { name: "fractional counter", stamp: [1.5, "human:a"] },
    { name: "unsafe counter", stamp: [Number.MAX_SAFE_INTEGER + 1, "human:a"] },
    { name: "negative counter", stamp: [-1, "human:a"] },
    { name: "non-string actor", stamp: [5, 42] },
  ];

  it.each(malformed)("rejects $name without mutation", ({ stamp }) => {
    const doc = mint(workflow, catalog);
    expectMalformedWithoutMutation(doc, setSeed(id("c"), 99, stamp));
    expect(seedValue(doc)).toBe(0);
  });

  it("converges on the higher valid stamp in both arrival orders", () => {
    const snapshot = bytes(mint(workflow, catalog));
    const lower = setSeed(id("a"), 5, [5, "human:a"]);
    const higher = setSeed(id("b"), 10, [10, "human:b"]);
    const forward = fork(snapshot);
    const reverse = fork(snapshot);

    expect(
      rejectedOutcome(applyOps(forward, [lower, higher], catalog)),
    ).toBeUndefined();
    expect(
      rejectedOutcome(applyOps(reverse, [higher, lower], catalog)),
    ).toBeUndefined();
    expect(seedValue(forward)).toBe(10);
    expect(project(reverse, catalog)).toEqual(project(forward, catalog));

    const beforeReapply = bytes(forward);
    const reapplied = applyOps(forward, [higher], catalog);
    expect(reapplied.outcomes).toEqual([{ op_id: higher.op_id, outcome: "no-op" }]);
    expect(bytes(forward)).toEqual(beforeReapply);
  });

  it.each(["malformed-first", "malformed-last"])(
    "keeps only the valid op when the malformed op arrives %s",
    (name) => {
      const doc = mint(workflow, catalog);
      const valid = setSeed(id("d"), 10, [10, "human:b"]);
      const invalid = setSeed(id("e"), 99, ["not-a-number", "human:a"]);

      if (name === "malformed-first") {
        expectMalformedWithoutMutation(doc, invalid);
        expect(
          rejectedOutcome(applyOps(doc, [valid], catalog)),
        ).toBeUndefined();
      } else {
        expect(
          rejectedOutcome(applyOps(doc, [valid], catalog)),
        ).toBeUndefined();
        expectMalformedWithoutMutation(doc, invalid);
      }

      expect(seedValue(doc)).toBe(10);
    },
  );
});
