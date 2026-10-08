import * as Y from "yjs";
import { describe, expect, it } from "vitest";
import {
  LEGACY_NODE_INCARNATION,
  applyOps,
  hasAppliedOp,
  mint,
  project,
  readStamps,
  type SetWidgetOp,
  type WorkflowJSON,
} from "../src/index.js";
import { loadCatalog } from "./helpers.js";

const catalog = loadCatalog();
const targetKey = JSON.stringify(["widget", "1", LEGACY_NODE_INCARNATION, "text"]);

function base(): WorkflowJSON {
  return {
    nodes: [
      {
        id: 1,
        type: "CLIPTextEncode",
        pos: [0, 0],
        inputs: [],
        outputs: [],
        widgets_values: ["initial"],
      },
    ],
    links: [],
    last_node_id: 1,
    last_link_id: 0,
  };
}

function setWidget(opId: string, counter: number, actor: string, value: string): SetWidgetOp {
  return {
    op: "set_widget",
    op_id: opId,
    actor,
    base_version: counter,
    stamp: [counter, actor],
    node_id: 1,
    widget: "text",
    value,
  };
}

function widgetValue(doc: Y.Doc): unknown {
  const values = project(doc, catalog).nodes[0]?.widgets_values;
  return Array.isArray(values) ? values[0] : undefined;
}

describe("set_widget LWW gate current-behavior characterization (cmp-sw-lww-1)", () => {
  it("drops a lower stamp without changing the widget register", () => {
    const doc = mint(base(), catalog);
    const winner = setWidget("f".repeat(32), 5, "agent:a", "winner");
    const loser = setWidget("e".repeat(32), 3, "human:z", "loser");

    expect(applyOps(doc, [winner], catalog).outcomes).toEqual([
      { op_id: winner.op_id, outcome: "applied" },
    ]);
    const stampBefore = readStamps(doc)[targetKey];
    const bytesBefore = Y.encodeStateAsUpdate(doc);

    expect(applyOps(doc, [loser], catalog).outcomes).toEqual([
      { op_id: loser.op_id, outcome: "lww-dropped" },
    ]);
    expect(widgetValue(doc)).toBe("winner");
    expect(readStamps(doc)[targetKey]).toEqual(stampBefore);
    expect(hasAppliedOp(doc, loser.op_id)).toBe(true);
    // LWW drops consume their op_id, so the bookkeeping write changes the
    // encoded document even though the contested widget register is unchanged.
    expect(Y.encodeStateAsUpdate(doc)).not.toEqual(bytesBefore);
  });

  it("uses op_id as the tiebreak when counter and actor are equal", () => {
    const doc = mint(base(), catalog);
    const winner = setWidget("f".repeat(32), 5, "agent:a", "winner");
    const loser = setWidget("a".repeat(32), 5, "agent:a", "loser");

    applyOps(doc, [winner], catalog);
    const stampBefore = readStamps(doc)[targetKey];

    expect(applyOps(doc, [loser], catalog).outcomes).toEqual([
      { op_id: loser.op_id, outcome: "lww-dropped" },
    ]);
    expect(widgetValue(doc)).toBe("winner");
    expect(readStamps(doc)[targetKey]).toEqual(stampBefore);
    expect(hasAppliedOp(doc, loser.op_id)).toBe(true);
  });

  it("applies a later-arriving higher op_id at an equal counter and actor (reverse arrival order)", () => {
    // The forward order (higher op_id first) also passes if the top-level gate
    // compares only the counter, so pin the reverse order too: the second op
    // wins purely on the op_id tiebreak.
    const doc = mint(base(), catalog);
    const first = setWidget("a".repeat(32), 5, "agent:a", "first");
    const winner = setWidget("f".repeat(32), 5, "agent:a", "winner");

    applyOps(doc, [first], catalog);
    const bytesBefore = Y.encodeStateAsUpdate(doc);

    expect(applyOps(doc, [winner], catalog).outcomes).toEqual([
      { op_id: winner.op_id, outcome: "applied" },
    ]);
    expect(widgetValue(doc)).toBe("winner");
    expect(readStamps(doc)[targetKey]).toEqual([5, "agent:a", winner.op_id]);
    expect(hasAppliedOp(doc, first.op_id)).toBe(true);
    expect(Y.encodeStateAsUpdate(doc)).not.toEqual(bytesBefore);
  });

  it("resolves equal-counter different-actor stamps by actor in both arrival orders", () => {
    const docForward = mint(base(), catalog);
    const docReverse = mint(base(), catalog);
    const fromA = setWidget("a".repeat(32), 5, "agent:a", "from-a");
    const fromB = setWidget("b".repeat(32), 5, "agent:b", "from-b");

    applyOps(docForward, [fromA], catalog);
    expect(applyOps(docForward, [fromB], catalog).outcomes).toEqual([
      { op_id: fromB.op_id, outcome: "applied" },
    ]);

    applyOps(docReverse, [fromB], catalog);
    expect(applyOps(docReverse, [fromA], catalog).outcomes).toEqual([
      { op_id: fromA.op_id, outcome: "lww-dropped" },
    ]);

    expect(widgetValue(docForward)).toBe("from-b");
    expect(widgetValue(docReverse)).toBe("from-b");
    expect(readStamps(docForward)[targetKey]).toEqual([5, "agent:b", fromB.op_id]);
    expect(readStamps(docReverse)[targetKey]).toEqual([5, "agent:b", fromB.op_id]);
    expect(hasAppliedOp(docReverse, fromA.op_id)).toBe(true);
    expect(project(docForward, catalog)).toEqual(project(docReverse, catalog));
  });

  it("applies a higher stamp and replaces the widget register", () => {
    const doc = mint(base(), catalog);
    const first = setWidget("a".repeat(32), 5, "agent:a", "first");
    const winner = setWidget("b".repeat(32), 10, "agent:b", "winner");

    applyOps(doc, [first], catalog);
    const bytesBefore = Y.encodeStateAsUpdate(doc);

    expect(applyOps(doc, [winner], catalog).outcomes).toEqual([
      { op_id: winner.op_id, outcome: "applied" },
    ]);
    expect(widgetValue(doc)).toBe("winner");
    expect(readStamps(doc)[targetKey]).toEqual([10, "agent:b", winner.op_id]);
    expect(Y.encodeStateAsUpdate(doc)).not.toEqual(bytesBefore);
  });

  it("applies the first write when no prior stamp exists", () => {
    const doc = mint(base(), catalog);
    const first = setWidget("a".repeat(32), 1, "agent:a", "first");

    expect(readStamps(doc)[targetKey]).toBeUndefined();
    expect(applyOps(doc, [first], catalog).outcomes).toEqual([
      { op_id: first.op_id, outcome: "applied" },
    ]);
    expect(widgetValue(doc)).toBe("first");
    expect(readStamps(doc)[targetKey]).toEqual([1, "agent:a", first.op_id]);
  });
});
