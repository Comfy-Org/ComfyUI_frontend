import { describe, expect, it } from "vitest";
import { MAX_LAMPORT_COUNTER, freezeLamportEnvelope, observeLamport,
  persistLamportTick, tickLamport, type LamportClockStore } from "../src/index.js";

describe("creator-owned Lamport counter", () => {
  it("observes, ticks, and refuses overflow", () => {
    expect(observeLamport(2, 9, 4)).toBe(9);
    expect(tickLamport(2, 9, 4)).toBe(10);
    expect(() => tickLamport(MAX_LAMPORT_COUNTER)).toThrow(/exhausted/);
  });

  it("persists before returning and freezes the single op envelope", async () => {
    let durable: number | undefined;
    const store: LamportClockStore = { async transaction(_identity, update) {
      const result = await update(durable); durable = result.counter; return result.value;
    } };
    const identity = { workflow_id: "w", lineage_id: "l", producer_id: "p" };
    await expect(persistLamportTick(store, identity, [12])).resolves.toBe(13);
    expect(durable).toBe(13);
    expect(freezeLamportEnvelope({ op: "clear" }, "agent:t:1", "a".repeat(32), 13)).toEqual({
      op: "clear", actor: "agent:t:1", op_id: "a".repeat(32), base_version: 13,
      stamp: [13, "agent:t:1"],
    });
  });
});
