/**
 * KA-2 / FC-2 conformance: the ordering key rides INSIDE the op.
 *
 * `[base_version, actor, op_id]` is the total order, and the first two elements
 * are read from `op.stamp` — not from the envelope's `base_version`/`actor`
 * fields — precisely so that any replica can evaluate order offline without
 * asking a server what version it assigned (KA-2). If the applier silently fell
 * back to the envelope, ordering would collapse onto the server-assigned scalar
 * that FC-2 forecloses.
 *
 * Almost every other suite in this repo mints ops with `stamp === [base_version,
 * actor]` (the shape comfy-cli's `_new_op` produces), which makes the two
 * readings indistinguishable. That was once true of the WHOLE suite: at
 * 5129209, the commit this work started from, neutering `stampKey` to ignore
 * `op.stamp` left all 183 tests in 20 files green — the invariant had nothing
 * holding it (AUD-MUT-1 R14). `test/mutation-survivors.test.ts` has since
 * closed the top-level `set_widget` case. This file covers the property at
 * every register that reads the key, in both arrival orders; the §8.4
 * inputcount pseudo-op below is held by no other test in the repo.
 *
 * Every op here deliberately gives `stamp` a value the envelope does NOT imply,
 * and picks the divergence so that the two readings name DIFFERENT winners. A
 * fallback to the envelope therefore flips the expected value rather than
 * merely failing to distinguish.
 *
 * Non-vacuity is asserted structurally as well: `envelopeWinnerDiffers` fails the
 * test if a vector is ever weakened to one where the two readings agree.
 */
import * as Y from "yjs";
import { describe, expect, it } from "vitest";
import {
  applyOps,
  compareStampKeys,
  mint,
  project,
  stampKey,
  type ConnectOp,
  type Op,
  type SetWidgetOp,
  type StampKey,
  type WidgetCatalog,
  type WorkflowJSON,
  type WorkflowNode,
} from "../src/index.js";

const catalog: WidgetCatalog = {
  types: {
    CLIPTextEncode: { widget_order: ["text"] },
    Src: { widget_order: [] },
    Sink: { widget_order: ["count"] },
  },
};

const id = (c: string) => c.repeat(32);

/** The key a replica that ignored `op.stamp` would compute (the FC-2 collapse). */
function envelopeKey(op: Op): StampKey {
  return [op.base_version ?? 0, op.actor ?? "", op.op_id];
}

/**
 * Guard against this file quietly becoming vacuous: every vector must be one
 * where honouring `op.stamp` and falling back to the envelope pick DIFFERENT
 * winners. If someone "simplifies" a stamp back to `[base_version, actor]`,
 * this fails instead of silently passing under either implementation.
 */
function envelopeWinnerDiffers(a: Op, b: Op): void {
  const byStamp = compareStampKeys(stampKey(a), stampKey(b));
  const byEnvelope = compareStampKeys(envelopeKey(a), envelopeKey(b));
  expect(byStamp, "vector must not be a tie").not.toBe(0);
  expect(
    byEnvelope,
    "vector is vacuous: the envelope and the in-op stamp agree on the winner",
  ).toBe(-byStamp as -1 | 1);
}

/** One snapshot, two forks (KA-10) — apply in both arrival orders. */
function bothOrders(base: WorkflowJSON, ops: Op[]): [WorkflowJSON, WorkflowJSON] {
  const snapshot = Y.encodeStateAsUpdate(mint(base, catalog));
  const fork = () => {
    const d = new Y.Doc();
    Y.applyUpdate(d, snapshot);
    return d;
  };
  const forward = fork();
  const reverse = fork();
  expect(applyOps(forward, ops, catalog).outcomes.find((outcome) => outcome.outcome === "rejected")).toBeUndefined();
  expect(applyOps(reverse, [...ops].reverse(), catalog).outcomes.find((outcome) => outcome.outcome === "rejected")).toBeUndefined();
  return [project(forward, catalog), project(reverse, catalog)];
}

const textWorkflow: WorkflowJSON = {
  nodes: [{ id: 1, type: "CLIPTextEncode", inputs: [], outputs: [], widgets_values: ["base"] }],
  links: [],
} as unknown as WorkflowJSON;

const widgetOf = (wf: WorkflowJSON, nodeId: number, index = 0): unknown =>
  ((wf.nodes.find((n) => String(n.id) === String(nodeId)) as WorkflowNode)
    .widgets_values as unknown[])[index];

const setText = (
  opId: string,
  envelope: { actor: string; base_version: number },
  stamp: [number, string],
  value: string,
): SetWidgetOp => ({
  op: "set_widget",
  op_id: id(opId),
  actor: envelope.actor,
  base_version: envelope.base_version,
  stamp,
  node_id: 1,
  widget: "text",
  value,
});

describe("KA-2 / FC-2: the ordering key is read from op.stamp, not the envelope", () => {
  it("stampKey reads base_version AND actor out of op.stamp when they differ from the envelope", () => {
    const op = setText("a", { actor: "envelope-actor", base_version: 1 }, [9, "stamp-actor"], "v");
    expect(stampKey(op)).toEqual([9, "stamp-actor", id("a")]);
    // Stated as the negative too: the envelope reading is a DIFFERENT key.
    expect(stampKey(op)).not.toEqual(envelopeKey(op));
  });

  it("an in-op stamp with a lower base_version than the envelope still wins if the stamp says so", () => {
    // Envelope says the loser is newer (99 > 1); the in-op stamp says the
    // opposite (50 > 1). Honouring op.stamp -> "stamp-wins".
    const winner = setText("w", { actor: "a", base_version: 1 }, [50, "a"], "stamp-wins");
    const loser = setText("l", { actor: "a", base_version: 99 }, [1, "a"], "envelope-wins");
    envelopeWinnerDiffers(winner, loser);

    const [forward, reverse] = bothOrders(textWorkflow, [winner, loser]);
    expect(widgetOf(forward, 1)).toBe("stamp-wins");
    expect(widgetOf(reverse, 1)).toBe("stamp-wins");
  });

  it("the actor tiebreak is read from op.stamp, not from the envelope actor", () => {
    // Both stamps carry base_version 5, so the actor element decides. The
    // envelope actors are swapped relative to the stamp actors, so reading
    // `op.actor` instead of `stamp[1]` names the other winner.
    const winner = setText("p", { actor: "alice", base_version: 5 }, [5, "zed"], "stamp-actor-wins");
    const loser = setText("q", { actor: "zed", base_version: 5 }, [5, "alice"], "envelope-actor-wins");
    envelopeWinnerDiffers(winner, loser);

    const [forward, reverse] = bothOrders(textWorkflow, [winner, loser]);
    expect(widgetOf(forward, 1)).toBe("stamp-actor-wins");
    expect(widgetOf(reverse, 1)).toBe("stamp-actor-wins");
  });

  it("a replica can decide the winner offline from the ops alone (no doc, no server version)", () => {
    // The point of KA-2: order is a pure function of the two ops. No Y.Doc, no
    // `base_version` handed down by a host, is consulted here.
    const winner = setText("w", { actor: "a", base_version: 1 }, [50, "a"], "stamp-wins");
    const loser = setText("l", { actor: "a", base_version: 99 }, [1, "a"], "envelope-wins");
    const offlineWinner =
      compareStampKeys(stampKey(winner), stampKey(loser)) > 0 ? winner : loser;
    expect(offlineWinner.op_id).toBe(winner.op_id);

    const [forward] = bothOrders(textWorkflow, [winner, loser]);
    expect(widgetOf(forward, 1)).toBe(offlineWinner.value);
  });
});

describe("KA-2 / FC-2: the in-op stamp governs every LWW register, not just top-level widgets", () => {
  const DEF_ID = "def-ka2";
  const interiorWorkflow: WorkflowJSON = {
    nodes: [{ id: 100, type: DEF_ID, inputs: [], outputs: [] }],
    links: [],
    definitions: {
      subgraphs: [
        {
          id: DEF_ID,
          name: "Interior",
          nodes: [{ id: 27, type: "CLIPTextEncode", widgets_values: ["base"] }],
          links: [],
        },
      ],
    },
  } as unknown as WorkflowJSON;

  const interiorWrite = (
    opId: string,
    envelope: { actor: string; base_version: number },
    stamp: [number, string],
    value: string,
  ): SetWidgetOp => ({
    ...setText(opId, envelope, stamp, value),
    path: ["100", "27"],
    inner_widget: "text",
  }) as unknown as SetWidgetOp;

  it("interior subgraph writes resolve by the in-op stamp", () => {
    const winner = interiorWrite("w", { actor: "a", base_version: 1 }, [50, "a"], "stamp-wins");
    const loser = interiorWrite("l", { actor: "a", base_version: 99 }, [1, "a"], "envelope-wins");
    envelopeWinnerDiffers(winner, loser);

    const interiorText = (wf: WorkflowJSON): unknown =>
      (
        (wf["definitions"] as { subgraphs: { nodes: WorkflowNode[] }[] }).subgraphs[0]!.nodes.find(
          (n) => String(n.id) === "27",
        )!.widgets_values as unknown[]
      )[0];

    const [forward, reverse] = bothOrders(interiorWorkflow, [winner, loser]);
    expect(interiorText(forward)).toBe("stamp-wins");
    expect(interiorText(reverse)).toBe("stamp-wins");
  });

  const wireWorkflow: WorkflowJSON = {
    nodes: [
      { id: 1, type: "Src", inputs: [], outputs: [{ name: "out", type: "X", links: [] }] },
      { id: 2, type: "Src", inputs: [], outputs: [{ name: "out", type: "X", links: [] }] },
      {
        id: 3,
        type: "Sink",
        inputs: [{ name: "in", type: "X", link: null }],
        outputs: [],
        widgets_values: [0],
      },
    ],
    links: [],
  } as unknown as WorkflowJSON;

  const wire = (
    opId: string,
    fromNode: number,
    linkId: number,
    envelope: { actor: string; base_version: number },
    stamp: [number, string],
  ): ConnectOp => ({
    op: "connect",
    op_id: id(opId),
    actor: envelope.actor,
    base_version: envelope.base_version,
    stamp,
    link_id: linkId,
    from_node: fromNode,
    from_slot: 0,
    to_node: 3,
    to_slot: 0,
    link_type: "X",
  });

  it("the concrete-input register (vocabulary v1.2) resolves by the in-op stamp", () => {
    const winner = wire("w", 2, 902, { actor: "a", base_version: 1 }, [50, "a"]);
    const loser = wire("l", 1, 901, { actor: "a", base_version: 99 }, [1, "a"]);
    envelopeWinnerDiffers(winner, loser);

    const occupant = (wf: WorkflowJSON): unknown => {
      const link = (
        wf.nodes.find((n) => String(n.id) === "3")! as WorkflowNode & {
          inputs: { link: unknown }[];
        }
      ).inputs[0]!.link;
      return (wf.links.find((l) => String((l as unknown[])[0]) === String(link)) as unknown[])[1];
    };

    const [forward, reverse] = bothOrders(wireWorkflow, [winner, loser]);
    // The stamp winner's source (node 2) occupies the slot in both orders.
    expect(String(occupant(forward))).toBe("2");
    expect(String(occupant(reverse))).toBe("2");
  });

  it("the §8.4 inputcount bump inherits the connect's in-op stamp", () => {
    const growWire = (
      opId: string,
      envelope: { actor: string; base_version: number },
      stamp: [number, string],
      count: number,
      linkId: number,
      slotName: string,
    ): ConnectOp => ({
      ...wire(opId, 1, linkId, envelope, stamp),
      to_slot: null,
      grow: { name: slotName, type: "X", inputcount: { widget: "count", value: count } },
    });

    // Both bumps write the SAME `("widget", 3, "count")` register, so the LWW
    // gate inside applyInputcountBump decides the surviving count. The pseudo-op
    // it builds copies `op.stamp`; an envelope fallback picks the other count.
    const winner = growWire("w", { actor: "a", base_version: 1 }, [50, "a"], 7, 902, "in.a");
    const loser = growWire("l", { actor: "a", base_version: 99 }, [1, "a"], 3, 901, "in.b");
    envelopeWinnerDiffers(winner, loser);

    const count = (wf: WorkflowJSON): unknown => widgetOf(wf, 3, 0);
    const [forward, reverse] = bothOrders(wireWorkflow, [winner, loser]);
    expect(count(forward)).toBe(7);
    expect(count(reverse)).toBe(7);
  });
});
