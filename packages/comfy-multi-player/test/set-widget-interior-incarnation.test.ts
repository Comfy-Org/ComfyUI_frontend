/**
 * Characterizes the interior `set_widget` incarnation guard: only the
 * currently addressed node lifetime may receive the widget write and stamp.
 */
import * as Y from "yjs";
import { describe, expect, it } from "vitest";
import {
  LEGACY_NODE_INCARNATION,
  NODE_INCARNATION_KEY,
  applyOps,
  hasAppliedOp,
  mint,
  project,
  readStamps,
  stampKey,
  stampTargetKey,
  type SetWidgetOp,
  type WidgetCatalog,
  type WorkflowJSON,
} from "../src/index.js";

const DEFINITION_ID = "interior-definition";
const INSTANCE_ID = 100;
const INTERIOR_NODE_ID = 27;
const REPLACEMENT_INCARNATION = "replacement-incarnation";

const catalog: WidgetCatalog = {
  types: {
    Inner: { widget_order: ["text"] },
  },
};

function workflow(): WorkflowJSON {
  return {
    nodes: [{ id: INSTANCE_ID, type: DEFINITION_ID, inputs: [], outputs: [] }],
    links: [],
    definitions: {
      subgraphs: [
        {
          id: DEFINITION_ID,
          nodes: [{ id: INTERIOR_NODE_ID, type: "Inner", widgets_values: ["original"] }],
          links: [],
        },
      ],
    },
  } as WorkflowJSON;
}

function interiorNode(doc: Y.Doc): Y.Map<unknown> {
  const definition = doc.getMap<Y.Map<unknown>>("definitions").get(DEFINITION_ID)!;
  return (definition.get("nodes") as Y.Map<Y.Map<unknown>>).get(String(INTERIOR_NODE_ID))!;
}

function interiorValue(doc: Y.Doc): unknown {
  const definitions = (project(doc, catalog)["definitions"] as {
    subgraphs: { id: string; nodes: { id: unknown; widgets_values: unknown[] }[] }[];
  }).subgraphs;
  return definitions
    .find((definition) => definition.id === DEFINITION_ID)!
    .nodes.find((node) => node.id === INTERIOR_NODE_ID)!
    .widgets_values[0];
}

function setWidget(serial: number, incarnation?: string): SetWidgetOp {
  const op: SetWidgetOp = {
    op: "set_widget",
    op_id: serial.toString(16).padStart(32, "0"),
    actor: "agent:a",
    base_version: serial,
    stamp: [serial, "agent:a"],
    node_id: INSTANCE_ID,
    widget: "text",
    path: [String(INSTANCE_ID), String(INTERIOR_NODE_ID)],
    inner_widget: "text",
    value: `value-${serial}`,
  };
  if (incarnation !== undefined) op.node_incarnation = incarnation;
  return op;
}

describe("set_widget interior incarnation guard (current-behavior characterization)", () => {
  it("applies a write whose incarnation matches the interior target", () => {
    const doc = mint(workflow(), catalog);
    interiorNode(doc).set(NODE_INCARNATION_KEY, REPLACEMENT_INCARNATION);
    const op = setWidget(1, REPLACEMENT_INCARNATION);

    expect(applyOps(doc, [op], catalog).outcomes).toEqual([
      { op_id: op.op_id, outcome: "applied" },
    ]);
    expect(interiorValue(doc)).toBe("value-1");
    expect(readStamps(doc)).toEqual({
      [JSON.stringify(["widget", [DEFINITION_ID, String(INTERIOR_NODE_ID)], REPLACEMENT_INCARNATION, "text"])]: stampKey(op),
    });
  });

  it("makes a mismatched-incarnation write a graph no-op without recording a stamp", () => {
    const doc = mint(workflow(), catalog);
    interiorNode(doc).set(NODE_INCARNATION_KEY, REPLACEMENT_INCARNATION);
    const op = setWidget(2, "stale-incarnation");
    const graphBefore = project(doc, catalog);
    const bytesBefore = Y.encodeStateAsUpdate(doc);
    const stampsBefore = readStamps(doc);

    expect(applyOps(doc, [op], catalog).outcomes).toEqual([
      { op_id: op.op_id, outcome: "no-op" },
    ]);
    expect(project(doc, catalog)).toEqual(graphBefore);
    expect(interiorValue(doc)).toBe("original");
    // Full stamp-map equality: a mutation that wrote the stale stamp into the
    // current incarnation register while still returning "no-op" would
    // LWW-drop a later valid lower-stamped write (A16 / KA-4).
    expect(readStamps(doc)).toEqual(stampsBefore);
    expect(readStamps(doc)[stampTargetKey(op)]).toBeUndefined();

    // applyOps consumes op_ids even for delete-wins no-ops. The graph and
    // stamp register stay untouched, but the __applied ledger changes.
    expect(hasAppliedOp(doc, op.op_id)).toBe(true);
    expect(Y.encodeStateAsUpdate(doc)).not.toEqual(bytesBefore);
  });

  it("defaults an absent incarnation to the matching legacy incarnation", () => {
    const doc = mint(workflow(), catalog);
    expect(interiorNode(doc).get(NODE_INCARNATION_KEY)).toBe(LEGACY_NODE_INCARNATION);
    const op = setWidget(3);

    expect(applyOps(doc, [op], catalog).outcomes).toEqual([
      { op_id: op.op_id, outcome: "applied" },
    ]);
    expect(interiorValue(doc)).toBe("value-3");
    expect(readStamps(doc)).toEqual({
      [JSON.stringify(["widget", [DEFINITION_ID, String(INTERIOR_NODE_ID)], LEGACY_NODE_INCARNATION, "text"])]: stampKey(op),
    });
  });

  it("makes an absent-incarnation write a no-op for a non-legacy target", () => {
    const doc = mint(workflow(), catalog);
    interiorNode(doc).set(NODE_INCARNATION_KEY, REPLACEMENT_INCARNATION);
    const op = setWidget(4);
    const stampsBefore = readStamps(doc);

    expect(applyOps(doc, [op], catalog).outcomes).toEqual([
      { op_id: op.op_id, outcome: "no-op" },
    ]);
    expect(interiorValue(doc)).toBe("original");
    expect(readStamps(doc)).toEqual(stampsBefore);
    expect(readStamps(doc)[stampTargetKey(op)]).toBeUndefined();
  });
});
