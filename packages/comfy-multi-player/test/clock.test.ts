import * as Y from "yjs";
import { describe, expect, it, vi } from "vitest";
import { applyOps, DocDerivedLamportClockStore, freezeLamportEnvelope, MAX_LAMPORT_COUNTER,
  mint, migrate, observedDocCounter, observeLamport, persistLamportTick, project, readStamps,
  SCHEMA_VERSION, tickLamport, validateLamportCounter, type LamportClockStore } from "../src/index.js";
import { loadCatalog } from "./helpers.js";

const catalog = loadCatalog();
const identity = { workflow_id: "w", lineage_id: "l", producer_id: "agent:clock" };
const reservationKey = '["__lamport_clock","w","l","agent:clock"]';

function replicaOf(doc: Y.Doc): Y.Doc {
  const replica = new Y.Doc();
  Y.applyUpdate(replica, Y.encodeStateAsUpdate(doc));
  return replica;
}

describe("creator-owned Lamport counter", () => {
  it("validates numeric boundaries without coercing unknown inputs", () => {
    for (const allowZero of [false, true]) {
      const message = `Lamport counter must be a ${allowZero ? "non-negative" : "positive"} safe integer`;
      // eslint-disable-next-line sonarjs/no-primitive-wrappers -- A boxed counter must be rejected without coercion; a primitive would destroy this regression input.
      for (const value of ["1", 1n, true, null, undefined, Symbol("counter"), {}, new Number(1), -1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
        expect(() => validateLamportCounter(value, allowZero)).toThrow(RangeError);
        expect(() => validateLamportCounter(value, allowZero)).toThrow(new RangeError(message));
      }
      expect(validateLamportCounter(1, allowZero)).toBe(1);
      expect(validateLamportCounter(Number.MAX_SAFE_INTEGER, allowZero)).toBe(Number.MAX_SAFE_INTEGER);
    }
    expect(() => validateLamportCounter(0)).toThrow(new RangeError("Lamport counter must be a positive safe integer"));
    expect(validateLamportCounter(0, true)).toBe(0);
    expect(validateLamportCounter(-0, true)).toBe(-0);
  });

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
    expect(doc.getMap("__clock_reservations").size).toBe(2);
    expect(readStamps(doc)).toEqual({});
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
    expect(doc.getMap("__clock_reservations").size).toBe(2);
    expect(readStamps(doc)).toEqual({});
  });

  it("fails closed when the document stamp ledger is malformed", async () => {
    const doc = mint({ nodes: [], links: [] }, catalog);
    doc.getMap<unknown>("__stamps").set("bad", [Number.NaN, "agent:bad", "c".repeat(32)]);
    await expect(new DocDerivedLamportClockStore(doc).transaction(
      { workflow_id: "w", lineage_id: "l", producer_id: "p" },
      async (stored) => ({ counter: tickLamport(stored ?? 0), value: stored }),
    )).rejects.toThrow(/Lamport counter/);
  });

  it("keeps reservations out of public readStamps and preserves their identity tuple", async () => {
    const doc = mint({ nodes: [], links: [] }, catalog);
    const store = new DocDerivedLamportClockStore(doc);
    await expect(persistLamportTick(store, identity, [7])).resolves.toBe(8);
    expect(readStamps(doc)).toEqual({});
    expect(doc.getMap("__clock_reservations").get(reservationKey)).toEqual([8, "agent:clock", reservationKey]);
    await expect(persistLamportTick(store, identity, [])).resolves.toBe(9);
    expect(doc.getMap("__clock_reservations").toJSON()).toEqual({ [reservationKey]: [9, "agent:clock", reservationKey] });
    expect(readStamps(replicaOf(doc))).toEqual({});
  });

  it.each(["workflow_id", "lineage_id", "producer_id"] as const)(
    "rejects an invalid reservation %s before invoking the callback",
    async (field) => {
      const doc = mint({ nodes: [], links: [] }, catalog);
      const store = new DocDerivedLamportClockStore(doc);
      const before = Y.encodeStateAsUpdate(doc);
      const roots = [...doc.share.keys()];
      const update = vi.fn(async () => ({ counter: 1, value: 1 }));
      for (const value of [undefined, 17]) {
        const invalid = { ...identity, [field]: value } as unknown as typeof identity;
        await expect(store.transaction(invalid, update)).rejects.toThrow(TypeError);
        expect(update).not.toHaveBeenCalled();
        expect(Y.encodeStateAsUpdate(doc)).toEqual(before);
        expect([...doc.share.keys()]).toEqual(roots);
      }
      await expect(persistLamportTick(store, identity, [])).resolves.toBe(1);
      expect(doc.getMap("__clock_reservations").toJSON()).toEqual({
        [reservationKey]: [1, "agent:clock", reservationKey],
      });
    },
  );

  it("captures the reservation identity before the callback can change it", async () => {
    const doc = mint({ nodes: [], links: [] }, catalog);
    const callerIdentity = { ...identity };
    await new DocDerivedLamportClockStore(doc).transaction(callerIdentity, async () => {
      callerIdentity.workflow_id = "other-workflow";
      callerIdentity.lineage_id = "other-lineage";
      callerIdentity.producer_id = "other-producer";
      return { counter: 7, value: 7 };
    });
    expect(doc.getMap("__clock_reservations").toJSON()).toEqual({
      [reservationKey]: [7, "agent:clock", reservationKey],
    });
    expect(observedDocCounter(replicaOf(doc))).toBe(7);
  });

  it("continues unapplied reservations after a fresh module and snapshot restart", async () => {
    const doc = mint({ nodes: [], links: [] }, catalog);
    await persistLamportTick(new DocDerivedLamportClockStore(doc), identity, [31]);
    const replica = replicaOf(doc);
    const before = Y.encodeStateAsUpdate(replica);
    const roots = [...replica.share.keys()];
    vi.resetModules();
    const fresh = await import("../src/index.js");
    expect(fresh.observedDocCounter(replica)).toBe(32);
    expect(Y.encodeStateAsUpdate(replica)).toEqual(before);
    expect([...replica.share.keys()]).toEqual(roots);
    await expect(fresh.persistLamportTick(new fresh.DocDerivedLamportClockStore(replica), identity, [], { requireSeed: true })).resolves.toBe(33);
    expect(readStamps(replica)).toEqual({});
    expect(fresh.observedDocCounter(replicaOf(replica))).toBe(33);
  });

  it("takes the maximum across winning stamps and reservations, including decoded roots", async () => {
    const doc = mint({ nodes: [{ id: 1, type: "KSampler", widgets_values: { steps: 20 } }], links: [] }, catalog);
    const store = new DocDerivedLamportClockStore(doc);
    await persistLamportTick(store, identity, [7]);
    const op = { op: "set_widget" as const, op_id: "d".repeat(32), actor: "agent:remote",
      base_version: 2, stamp: [40, "agent:remote"] as [number, string],
      node_id: 1, node_incarnation: "0", widget: "steps", value: 42 };
    expect(applyOps(doc, [op], catalog).outcomes[0]?.outcome).toBe("applied");
    const stamps = { '["widget","1","0","steps"]': [40, "agent:remote", "d".repeat(32)] };
    expect(readStamps(doc)).toEqual(stamps);
    const replica = replicaOf(doc);
    expect(observedDocCounter(replica)).toBe(40);
    await expect(persistLamportTick(new DocDerivedLamportClockStore(replica), identity, [])).resolves.toBe(41);
    expect(observedDocCounter(replicaOf(replica))).toBe(41);
    expect(readStamps(replica)).toEqual(stamps);
  });

  // Two roots × eleven malformed values. Bytes and share keys catch rejected
  // admissions that consume a reservation, even though projection is unchanged.
  describe.each(["__stamps", "__clock_reservations"])("fail-closed %s", (root) => {
    it.each([
      null, {}, [1, "agent:clock"], [1, "agent:clock", reservationKey, "extra"],
      [1, 2, reservationKey], [1, "agent:clock", 2], [1, "agent:clock", ""],
      [NaN, "agent:clock", reservationKey], [-1, "agent:clock", reservationKey],
      [0.5, "agent:clock", reservationKey], [Number.MAX_SAFE_INTEGER + 1, "agent:clock", reservationKey],
    ].map((value) => ({ value })))("rejects malformed row $value before invoking the callback", async ({ value }) => {
      const doc = mint({ nodes: [], links: [] }, catalog);
      doc.getMap(root).set(reservationKey, value);
      const before = Y.encodeStateAsUpdate(doc);
      const roots = [...doc.share.keys()];
      const update = vi.fn(async () => ({ counter: 10, value: 10 }));
      const store = new DocDerivedLamportClockStore(doc);
      await expect(store.transaction(identity, update)).rejects.toThrow();
      await expect(store.transaction(identity, update)).rejects.toThrow();
      expect(update).not.toHaveBeenCalled();
      expect(Y.encodeStateAsUpdate(doc)).toEqual(before);
      expect([...doc.share.keys()]).toEqual(roots);
      doc.getMap(root).delete(reservationKey);
      await expect(persistLamportTick(store, identity, [])).resolves.toBe(1);
    });

    it.each([
      { decoded: false, populated: false },
      { decoded: false, populated: true },
      { decoded: true, populated: true },
    ])("rejects a sequence root ($decoded snapshot, $populated populated) without reserving", async ({ decoded, populated }) => {
      const source = new Y.Doc();
      source.getMap("meta").set("schema_version", SCHEMA_VERSION);
      const sequence = source.getArray(root);
      if (populated) sequence.push([[900, "actor", "id"]]);
      const doc = decoded ? replicaOf(source) : source;
      const before = Y.encodeStateAsUpdate(doc);
      const roots = [...doc.share.keys()];
      const update = vi.fn(async () => ({ counter: 1, value: 1 }));
      await expect(new DocDerivedLamportClockStore(doc).transaction(identity, update)).rejects.toThrow();
      expect(update).not.toHaveBeenCalled();
      expect(Y.encodeStateAsUpdate(doc)).toEqual(before);
      expect([...doc.share.keys()]).toEqual(roots);
    });
  });

  it.each([
    [reservationKey, [0, "agent:clock", reservationKey]],
    [reservationKey, [2, "other", reservationKey]],
    [reservationKey, [2, "agent:clock", "other"]],
    ["not json", [2, "agent:clock", "not json"]],
    ['["wrong","w","l","agent:clock"]', [2, "agent:clock", '["wrong","w","l","agent:clock"]']],
    ['["__lamport_clock",null,"l","agent:clock"]', [2, "agent:clock", '["__lamport_clock",null,"l","agent:clock"]']],
  ])("rejects inconsistent reservation %s", async (key, value) => {
    const doc = mint({ nodes: [], links: [] }, catalog);
    doc.getMap("__clock_reservations").set(key, value);
    const before = Y.encodeStateAsUpdate(doc);
    await expect(persistLamportTick(new DocDerivedLamportClockStore(doc), identity, [])).rejects.toThrow();
    expect(Y.encodeStateAsUpdate(doc)).toEqual(before);
  });

  it("does not consume failed callbacks, invalid counters, unseeded admissions, or overflow", async () => {
    const doc = replicaOf(mint({ nodes: [], links: [] }, catalog));
    const store = new DocDerivedLamportClockStore(doc);
    const before = Y.encodeStateAsUpdate(doc);
    const roots = [...doc.share.keys()];
    await expect(persistLamportTick(store, identity, [], { requireSeed: true })).rejects.toThrow(/unseeded/);
    await expect(store.transaction(identity, async () => { throw new Error("cancelled"); })).rejects.toThrow(/cancelled/);
    await expect(store.transaction(identity, async () => ({ counter: NaN, value: 0 }))).rejects.toThrow(/Lamport counter/);
    expect(Y.encodeStateAsUpdate(doc)).toEqual(before);
    expect([...doc.share.keys()]).toEqual(roots);
    await expect(persistLamportTick(store, identity, [])).resolves.toBe(1);
    const reserved = Y.encodeStateAsUpdate(doc);
    await expect(store.transaction(identity, async () => ({ counter: 1, value: 1 }))).rejects.toThrow(/did not advance/);
    await expect(persistLamportTick(store, identity, [MAX_LAMPORT_COUNTER])).rejects.toThrow(/exhausted/);
    expect(Y.encodeStateAsUpdate(doc)).toEqual(reserved);
    await expect(persistLamportTick(store, identity, [])).resolves.toBe(2);
  });

  it("reads absent ledgers without creating roots and accepts zero winning stamps", async () => {
    const doc = replicaOf(mint({ nodes: [], links: [] }, catalog));
    const before = Y.encodeStateAsUpdate(doc);
    expect(observedDocCounter(doc)).toBeUndefined();
    expect([...doc.share.keys()]).toEqual(["meta"]);
    expect(Y.encodeStateAsUpdate(doc)).toEqual(before);
    doc.getMap("__stamps").set('["node","1"]', [0, "", "zero-op"]);
    expect(observedDocCounter(replicaOf(doc))).toBe(0);
    await expect(persistLamportTick(new DocDerivedLamportClockStore(doc), identity, [], { requireSeed: true })).resolves.toBe(1);
  });

  it.each([undefined, 1, 2, 3, 4, 6])("refuses unsupported schema %s without migration or reservation", async (version) => {
    const doc = new Y.Doc();
    if (version !== undefined) doc.getMap("meta").set("schema_version", version);
    const before = Y.encodeStateAsUpdate(doc);
    const roots = [...doc.share.keys()];
    expect(() => observedDocCounter(doc)).toThrow(/schema/);
    await expect(persistLamportTick(new DocDerivedLamportClockStore(doc), identity, [])).rejects.toThrow(/schema/);
    expect(() => project(doc, catalog)).toThrow(/schema/);
    expect(() => migrate(doc, version ?? 5)).toThrow(/schema/);
    if (version !== undefined) expect(() => readStamps(doc)).toThrow(/schema/);
    expect(Y.encodeStateAsUpdate(doc)).toEqual(before);
    expect([...doc.share.keys()]).toEqual(roots);
  });
});
