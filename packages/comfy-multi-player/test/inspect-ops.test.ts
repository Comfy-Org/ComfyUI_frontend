import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  inspectOps,
  OpRejectedError,
  type SetWidgetOp,
} from "../src/index.js";

const opId = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

function setWidget(value: number, id = opId, counter = 7, stampActor = "human:creator"): SetWidgetOp {
  return {
    value,
    widget: "steps",
    node_id: 42,
    stamp: [counter, stampActor],
    base_version: 2,
    actor: "host:arrival-metadata",
    op_id: id,
    op: "set_widget",
  };
}

describe("inspectOps", () => {
  it("returns exact canonical bytes, raw SHA-256, creator stamp, and input indexes in order", () => {
    const first = setWidget(25);
    const second = setWidget(30, "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb", 9, "agent:creator");

    const inspected = inspectOps([first, second]);

    expect(inspected.map(({ index, op_id }) => ({ index, op_id }))).toEqual([
      { index: 0, op_id: first.op_id },
      { index: 1, op_id: second.op_id },
    ]);
    expect(inspected[0]).toMatchObject({
      creator_actor: "human:creator",
      creator_lamport: 7,
    });
    expect(inspected[1]).toMatchObject({
      creator_actor: "agent:creator",
      creator_lamport: 9,
    });

    for (const item of inspected) {
      expect(item.canonical_op).toBeInstanceOf(Uint8Array);
      expect(item.canonical_digest).toBeInstanceOf(Uint8Array);
      expect(item.canonical_digest).toHaveLength(32);
      expect(Buffer.from(item.canonical_digest)).toEqual(
        createHash("sha256").update(item.canonical_op).digest(),
      );
    }

    expect(new TextDecoder().decode(inspected[0]!.canonical_op)).toBe(
      JSON.stringify({
        actor: first.actor,
        base_version: first.base_version,
        node_id: first.node_id,
        op: first.op,
        op_id: first.op_id,
        stamp: first.stamp,
        value: first.value,
        widget: first.widget,
      }),
    );
  });

  it("preserves identical duplicates but rejects changed bytes with typed op_id_reuse", () => {
    const op = setWidget(25);
    expect(inspectOps([op, { ...op }])).toHaveLength(2);

    try {
      inspectOps([op, setWidget(30)]);
      expect.fail("changed op_id reuse must be rejected");
    } catch (error) {
      expect(error).toBeInstanceOf(OpRejectedError);
      expect(error).toMatchObject({ code: "op_id_reuse" });
    }
  });

  it("requires the creator stamp and preserves the applier's malformed-op type", () => {
    const unstamped = { ...setWidget(25), stamp: undefined } as unknown as SetWidgetOp;
    try {
      inspectOps([unstamped]);
      expect.fail("unstamped ops must be rejected");
    } catch (error) {
      expect(error).toBeInstanceOf(OpRejectedError);
      expect(error).toMatchObject({ code: "malformed_op" });
    }
  });
});
