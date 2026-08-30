import { describe, expect, it } from "vitest";
import { applyOps, DocDerivedLamportClockStore, freezeLamportEnvelope, MAX_LAMPORT_COUNTER,
  mint, observedDocCounter, observeLamport, persistLamportTick, tickLamport, type LamportClockStore } from "../src/index.js";
import { loadCatalog } from "./helpers.js";

const catalog = loadCatalog();

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

  it("reseeds from the document's winning stamps without package-owned state", async () => {
    const doc = mint({
      nodes: [{ id: 1, type: "KSampler", pos: [0, 0], inputs: [], outputs: [], widgets_values: [0, "fixed", 20, 7, "euler", "normal", 1] }],
      links: [],
    }, catalog);
    const op = {
      op: "set_widget" as const,
      op_id: "b".repeat(32),
      actor: "agent:clock",
      base_version: 12,
      stamp: [12, "agent:clock"] as [number, string],
      node_id: 1,
      widget: "steps",
      value: 42,
      node_incarnation: "0",
    };
    expect(applyOps(doc, [op], catalog).outcomes.some((outcome) => outcome.outcome === "rejected")).toBe(false);
    const store = new DocDerivedLamportClockStore(doc);
    const identity = { workflow_id: "w", lineage_id: "l", producer_id: "agent:clock" };
    await expect(persistLamportTick(store, identity, [], { requireSeed: true })).resolves.toBe(13);
    expect(await persistLamportTick(new DocDerivedLamportClockStore(mint({ nodes: [], links: [] }, catalog)), identity, [4])).toBe(5);
  });

  it("serializes concurrent producers and commits the counter to the document", async () => {
    const doc = mint({ nodes: [], links: [] }, catalog);
    const store = new DocDerivedLamportClockStore(doc);
    const producers = [
      { workflow_id: "w", lineage_id: "l", producer_id: "agent:one" },
      { workflow_id: "w", lineage_id: "l", producer_id: "agent:two" },
    ];

    const counters = await Promise.all(producers.map((identity) => persistLamportTick(store, identity, [])));

    expect(counters).toEqual([1, 2]);
    expect(observedDocCounter(doc)).toBe(2);
    expect(doc.getMap("__stamps").size).toBe(2);
    expect(await persistLamportTick(store, { workflow_id: "w", lineage_id: "l", producer_id: "agent:next" }, [])).toBe(3);
  });

  it("shares serialization across independently constructed stores for one document", async () => {
    const doc = mint({ nodes: [], links: [] }, catalog);
    const stores = [new DocDerivedLamportClockStore(doc), new DocDerivedLamportClockStore(doc)];
    const producers = [
      { workflow_id: "w", lineage_id: "l", producer_id: "agent:one" },
      { workflow_id: "w", lineage_id: "l", producer_id: "agent:two" },
    ];

    const counters = await Promise.all(stores.map((store, index) => persistLamportTick(store, producers[index]!, [])));

    expect(counters).toEqual([1, 2]);
    expect(observedDocCounter(doc)).toBe(2);
    expect(doc.getMap("__stamps").size).toBe(2);
  });

  it("fails closed when the document stamp ledger is malformed", async () => {
    const doc = mint({ nodes: [], links: [] }, catalog);
    doc.getMap<unknown>("__stamps").set("bad", [Number.NaN, "agent:bad", "c".repeat(32)]);
    await expect(new DocDerivedLamportClockStore(doc).transaction(
      { workflow_id: "w", lineage_id: "l", producer_id: "p" },
      async (stored) => ({ counter: tickLamport(stored ?? 0), value: stored }),
    )).rejects.toThrow(/Lamport counter/);
  });
});
