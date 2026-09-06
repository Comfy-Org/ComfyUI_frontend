/**
 * KA-1 / KA-3: a value the document ACCEPTS but its own encoding does not
 * preserve.
 *
 * This is a different question from the KA-4 / D4 work these tests sit next to.
 * D4 asks whether a REJECTED op left the bytes alone. This asks what happens to
 * an op that is ACCEPTED — with no failure, no throw, and byte-identical
 * replicas — while the replica that applied it and every replica that decoded
 * the update hold different values. Yjs keeps a `ContentAny` value BY
 * REFERENCE and only lib0's `writeAny` walks the interior at encode time, where
 * every non-`Uint8Array` object is rewritten as a bag of its own enumerable
 * keys. `isStorableMapValue` is a faithful mirror of what yjs ACCEPTS, so it
 * cannot see this: it is asked at depth 0, and being accepted is not being
 * transmitted.
 *
 * These tests are CHARACTERIZATION, deliberately. Every op below is asserted to
 * be accepted, because that is what the applier does today, and rejecting it
 * would narrow the accepted payload domain — a vocabulary amendment owed a
 * comfy-cli counterpart and an `EXCEPTIONS.md` row, not a fix to make in
 * passing. What is pinned here is the SHAPE of the gap plus the detector that
 * measures it, so whoever takes the decision inherits evidence rather than a
 * repro.
 *
 * TWO ROWS HAVE SINCE FLIPPED, on the merits and not by that decision, and the
 * flips are deliberate: a reference CYCLE is now refused (it bricked the
 * document rather than merely diverging it, and no JSON producer can express
 * one), and a `Date` at depth 0 is now refused (the gate's predicate was
 * corrected from "will yjs accept it" to "will it survive encoding"). See
 * `encoding-survival.regression.test.ts`. Everything else here still
 * characterizes the accepted-and-lossy set that decision D4 owns.
 */

import * as Y from "yjs";
import { describe, expect, it } from "vitest";
import {
  applyOps,
  encodingLosses,
  mint,
  project,
  type Op,
  type WorkflowJSON,
} from "../src/index.js";
import { isStorableMapValue } from "../src/doc.js";
import { loadCatalog } from "./helpers.js";

const catalog = loadCatalog();
const opId = (tag: string) => (tag + "0".repeat(32)).slice(0, 32);

const node = { id: 300, type: "LoadImage", inputs: [], outputs: [], widgets_values: [] };
const workflow: WorkflowJSON = {
  nodes: [node],
  links: [],
  groups: [],
  extra: {},
  last_node_id: 300,
  last_link_id: 0,
};

/** Two replicas forked from ONE mint snapshot (KA-10), never independently re-seeded. */
function forkedPair(): [Y.Doc, Y.Doc] {
  const a = mint(workflow, catalog);
  const b = new Y.Doc();
  Y.applyUpdate(b, Y.encodeStateAsUpdate(a));
  return [a, b];
}

function setWidget(value: unknown, tag = "loss"): Op {
  return {
    op: "set_widget",
    op_id: opId(tag),
    actor: "human:z",
    base_version: 1,
    stamp: [1, "human:z"],
    node_id: 300,
    widget: "image",
    value,
  } as Op;
}

/**
 * Structural identity, NOT deep-equality-modulo-JSON: a `Map` and a `{}` are
 * `JSON.stringify`-identical and must still compare unequal here, because that
 * indistinguishability is the whole reason the existing suite cannot see this.
 */
function identical(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== typeof b) return false;
  if (a === null || b === null || typeof a !== "object") return false;
  if (Object.getPrototypeOf(a) !== Object.getPrototypeOf(b as object)) return false;
  if (Array.isArray(a)) {
    const other = b as unknown[];
    return a.length === other.length && a.every((x, i) => identical(x, other[i]));
  }
  if (a instanceof Uint8Array) {
    const other = b as Uint8Array;
    return a.length === other.length && a.every((x, i) => x === other[i]);
  }
  const ka = Object.keys(a);
  const kb = Object.keys(b as object);
  return (
    ka.length === kb.length &&
    ka.every((k) => identical((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]))
  );
}

/** What a real Y.Doc gives back after its own encode → decode. */
function roundTrip(value: unknown): unknown {
  const a = new Y.Doc();
  a.getMap("m").set("k", value);
  const b = new Y.Doc();
  Y.applyUpdate(b, Y.encodeStateAsUpdate(a));
  return b.getMap("m").get("k");
}

class Instance {
  x = 1;
}

const SAMPLES: [string, () => unknown][] = [
  ["Map", () => new Map([["k", 1]])],
  ["Set", () => new Set([1])],
  ["RegExp", () => /re/g],
  ["Error", () => new Error("boom")],
  ["ArrayBuffer", () => new ArrayBuffer(4)],
  ["DataView", () => new DataView(new ArrayBuffer(4))],
  ["Int32Array", () => new Int32Array([1])],
  ["Date", () => new Date(0)],
  ["oversized BigInt", () => 2n ** 70n],
  ["int64 BigInt", () => 10n],
  ["undefined", () => undefined],
  ["function", () => () => 1],
  ["symbol", () => Symbol("s")],
  ["Uint8Array", () => new Uint8Array([1, 2])],
  ["class instance", () => new Instance()],
  ["null-prototype object", () => Object.assign(Object.create(null), { a: 1 })],
  ["NaN", () => NaN],
  ["-0", () => -0],
  ["Infinity", () => Infinity],
  ["string", () => "s"],
  ["null", () => null],
  ["plain object", () => ({ a: 1 })],
  ["array", () => [1, "two"]],
];

const PLACEMENTS: [string, (v: unknown) => unknown][] = [
  ["depth 0 (the value itself)", (v) => v],
  ["depth 1, in an object", (v) => ({ a: v })],
  ["depth 3, in objects", (v) => ({ a: { b: { c: v } } })],
  ["depth 1, in an array", (v) => [v]],
  ["depth 3, in arrays", (v) => [[[v]]]],
  ["in an object in an array", (v) => [{ a: v }]],
  ["in an array in an object", (v) => ({ a: [v] })],
];

describe("KA-1: `encodingLosses` agrees with a real encode → decode", () => {
  it("flags a value iff the round trip is not the identity, across every depth and container", () => {
    const disagreements: string[] = [];
    let flagged = 0;
    let clean = 0;
    for (const [pname, place] of PLACEMENTS) {
      for (const [sname, make] of SAMPLES) {
        let placed: unknown;
        try {
          // The value AS IT WILL BE STORED, per the detector's contract and
          // the storability gate's: cloning is what normalizes a class instance
          // or a prototype-less object into a plain, faithfully encodable one.
          // A value the clone REFUSES never reaches either question.
          placed = structuredClone(place(make()));
        } catch {
          continue;
        }
        // A value yjs REFUSES is the storability gate's business, not this one.
        if (!isStorableMapValue(placed)) continue;
        const lossy = !identical(placed, roundTrip(placed));
        const reported = encodingLosses(placed).length > 0;
        if (reported !== lossy) {
          disagreements.push(`${sname} @ ${pname}: round trip lossy=${String(lossy)}, reported=${String(reported)}`);
        }
        if (lossy) flagged++;
        else clean++;
      }
    }
    expect(disagreements).toEqual([]);
    // Non-vacuity: the sweep must contain both verdicts, or agreement is free.
    expect(flagged).toBeGreaterThan(40);
    expect(clean).toBeGreaterThan(40);
  });

  it("does not flag what the clone already normalizes", () => {
    // A class instance and a prototype-less object are BOTH plain objects by
    // the time they are stored, which is why checking the original would
    // report a loss the document never suffers.
    expect(encodingLosses(structuredClone({ a: new Instance() }))).toEqual([]);
    expect(encodingLosses(structuredClone({ a: Object.assign(Object.create(null), { x: 1 }) }))).toEqual(
      [],
    );
    // Pre-clone, a function IS a loss — the detector is usable on either side
    // of the clone, and says something different on each.
    expect(encodingLosses({ a: () => 1 })).toEqual([
      { path: ".a", detail: "a function is written as undefined" },
    ]);
  });

  it("reports the path, so a host can name the offending key rather than the op", () => {
    expect(encodingLosses({ properties: { a: [1, new Map()] } })).toEqual([
      { path: ".properties.a[1]", detail: expect.stringContaining("a Map decodes as {}") },
    ]);
    expect(encodingLosses({ a: 1, b: "two" })).toEqual([]);
  });

  it("terminates on a reference cycle instead of following yjs into the stack overflow", () => {
    const cyclic: Record<string, unknown> = {};
    cyclic["self"] = cyclic;
    expect(encodingLosses({ a: cyclic })).toEqual([
      { path: ".a.self", detail: expect.stringContaining("reference cycle") },
    ]);
    // A DAG is not a cycle: writeAny duplicates a shared reference happily.
    const shared = { v: 1 };
    expect(encodingLosses({ a: shared, b: shared })).toEqual([]);
  });
});

describe("KA-1: the gap is depth-independent and the same in both containers", () => {
  const nested = [
    ["properties.a", (v: unknown) => ({ a: v })],
    ["properties.a.b.c", (v: unknown) => ({ a: { b: { c: v } } })],
    ["properties[0]", (v: unknown) => [v]],
    ["properties[0][0][0]", (v: unknown) => [[[v]]]],
  ] as const;

  for (const [where, place] of nested) {
    it(`a Map at ${where} is ACCEPTED and silently coerced (characterization)`, () => {
      const [a, b] = forkedPair();
      const result = applyOps(a, [setWidget(place(new Map([["k", "v"]])))], catalog);

      // Nothing anywhere reports it.
      expect(result.outcomes.find((outcome) => outcome.outcome === "rejected")).toBeUndefined();
      expect(result.outcomes.filter((outcome) => outcome.outcome === "applied")).toHaveLength(1);

      Y.applyUpdate(b, Y.encodeStateAsUpdate(a));
      const read = (doc: Y.Doc) =>
        (doc.getMap("nodes").get("300") as Y.Map<unknown>).get("widgets") as Y.Map<unknown>;
      expect(identical(read(a).get("image"), read(b).get("image"))).toBe(false);
    });
  }

  it("the same value at depth 0 is refused, which is the whole asymmetry", () => {
    const [a] = forkedPair();
    expect(
      applyOps(a, [setWidget(new Map([["k", "v"]]))], catalog).outcomes.find(
        (outcome) => outcome.outcome === "rejected",
      )?.reason,
    ).toMatchObject({ code: "malformed_op" });
  });
});

describe("KA-1: two replicas disagree about document contents, end to end", () => {
  it("host → follower (raw update): no error, byte-identical, different contents", () => {
    const [a, b] = forkedPair();
    const result = applyOps(
      a,
      [
        {
          op: "add_node",
          op_id: opId("nested-add"),
          actor: "human:z",
          base_version: 1,
          stamp: [1, "human:z"],
          node_id: 400,
          class_type: "LoadImage",
          pos: [0, 0],
          node: {
            id: 400,
            type: "LoadImage",
            inputs: [],
            outputs: [],
            widgets_values: [],
            properties: { a: new Map([["cnv", "secret"]]) },
          },
        } as Op,
      ],
      catalog,
    );
    expect(result.outcomes.find((outcome) => outcome.outcome === "rejected")).toBeUndefined();
    Y.applyUpdate(b, Y.encodeStateAsUpdate(a));

    const props = (doc: Y.Doc) =>
      (doc.getMap("nodes").get("400") as Y.Map<unknown>).get("properties") as { a: unknown };
    expect(props(a).a).toBeInstanceOf(Map);
    expect(props(b).a).not.toBeInstanceOf(Map);
    expect(props(b).a).toEqual({});

    // Both replicas believe they converged, by every oracle this repo owns.
    expect(
      Buffer.from(Y.encodeStateAsUpdate(a)).equals(Buffer.from(Y.encodeStateAsUpdate(b))),
    ).toBe(true);
    expect(JSON.stringify(project(a, catalog))).toBe(JSON.stringify(project(b, catalog)));
    // …and both consumed the op, so `__applied` cannot distinguish them either.
    expect(a.getMap("__applied").has(opId("nested-add"))).toBe(true);
    expect(b.getMap("__applied").has(opId("nested-add"))).toBe(true);
  });

  it("op over a JSON wire (KA-1 replication unit): the receiver applies a different value", () => {
    const [a, b] = forkedPair();
    const op = setWidget({ a: new Map([["k", "v"]]) }, "wire");
    expect(
      applyOps(a, [structuredClone(op)], catalog).outcomes.find(
        (outcome) => outcome.outcome === "rejected",
      ),
    ).toBeUndefined();
    // What the peer actually receives — the op crossed the wire as JSON.
    expect(
      applyOps(b, [JSON.parse(JSON.stringify(op)) as Op], catalog).outcomes.find(
        (outcome) => outcome.outcome === "rejected",
      ),
    ).toBeUndefined();

    const read = (doc: Y.Doc) =>
      ((doc.getMap("nodes").get("300") as Y.Map<unknown>).get("widgets") as Y.Map<unknown>).get(
        "image",
      ) as { a: unknown };
    expect(read(a).a).toBeInstanceOf(Map);
    expect(read(b).a).toEqual({});
  });

  it("a NESTED Date makes the disagreement visible in the PROJECTION, not only in memory", () => {
    // A `Date` at depth 0 is no longer accepted — that was the storable-vs-
    // encodable correction, and `encoding-survival.regression.test.ts` pins it.
    // Nested, it still is, and it is the member of the remaining set that a
    // JSON-based oracle can actually see: the two replicas project DIFFERENT
    // workflow JSON with nothing anywhere reporting a failure. This is the
    // sharpest evidence for decision D4 and must keep working until D4 is taken.
    const [a, b] = forkedPair();
    expect(
      applyOps(a, [setWidget({ at: new Date(0) }, "date")], catalog).outcomes.find(
        (outcome) => outcome.outcome === "rejected",
      ),
    ).toBeUndefined();
    Y.applyUpdate(b, Y.encodeStateAsUpdate(a));
    const wv = (doc: Y.Doc) => JSON.stringify(project(doc, catalog).nodes[0]!["widgets_values"]);
    expect(wv(a)).toBe(`[{"at":"1970-01-01T00:00:00.000Z"}]`);
    expect(wv(b)).toBe(`[{"at":{}}]`);
    // Both oracles this repo owns still say "converged".
    expect(
      Buffer.from(Y.encodeStateAsUpdate(a)).equals(Buffer.from(Y.encodeStateAsUpdate(b))),
    ).toBe(true);
  });

  it("a live replica also disagrees with its own snapshot", () => {
    const a = mint(workflow, catalog);
    expect(
      applyOps(a, [setWidget({ a: new Map() }, "reload")], catalog).outcomes.find(
        (outcome) => outcome.outcome === "rejected",
      ),
    ).toBeUndefined();
    const reloaded = new Y.Doc();
    Y.applyUpdate(reloaded, Y.encodeStateAsUpdate(a));
    const read = (doc: Y.Doc) =>
      ((doc.getMap("nodes").get("300") as Y.Map<unknown>).get("widgets") as Y.Map<unknown>).get(
        "image",
      ) as { a: unknown };
    expect(read(a).a).toBeInstanceOf(Map);
    expect(read(reloaded).a).not.toBeInstanceOf(Map);
  });
});

describe("KA-1: a reference cycle is detected even though A8 rejects it before the write", () => {
  it("reports the cycle while applyOps leaves the document encodable", () => {
    const doc = mint(workflow, catalog);
    const cyclic: Record<string, unknown> = {};
    cyclic["self"] = cyclic;
    expect(
      applyOps(doc, [setWidget({ a: cyclic }, "cycle")], catalog).outcomes.find(
        (outcome) => outcome.outcome === "rejected",
      )?.reason,
    ).toMatchObject({ code: "payload_too_deep" });
    expect(() => Y.encodeStateAsUpdate(doc)).not.toThrow();
    // Still detectable independently of the whole-op depth gate, for hosts
    // inspecting values before they construct an op.
    expect(encodingLosses({ a: cyclic })).not.toEqual([]);
  });
});

describe("mint and the applier gate the same values, and now say so the same way", () => {
  it("mint names the workflow key rather than surfacing yjs's bare `Unexpected content type`", () => {
    expect(() => mint({ ...workflow, extra: new Map() as unknown as Record<string, unknown> }, catalog)).toThrow(
      /workflow\.extra: a Map cannot be stored in a Y\.Doc/,
    );
    expect(() => mint({ ...workflow, extra: new Map() as unknown as Record<string, unknown> }, catalog)).toThrow(
      TypeError,
    );
    expect(() =>
      mint({ ...workflow, links: [new Set() as unknown as unknown[]] }, catalog),
    ).toThrow(/mint: link: a Set cannot be stored/);
    expect(() =>
      mint(
        {
          ...workflow,
          definitions: { subgraphs: [{ id: "d1", custom: new RegExp("x"), nodes: [], links: [] }] },
        } as unknown as WorkflowJSON,
        catalog,
      ),
    ).toThrow(/definition\.custom: a RegExp cannot be stored/);
  });

  it("exactly three shapes that minted before stop minting, and they are named", () => {
    // The passthrough gate and the node builders still share one predicate.
    // What changed is the predicate: it now asks whether the value SURVIVES
    // encoding, not merely whether yjs accepts the write. Three shapes are
    // refused that were not — a reference cycle, a `Date`, and a `BigInt`
    // outside int64 — and no JSON producer can send any of them, which is why
    // this is a correction rather than a vocabulary amendment.
    const cyclic: Record<string, unknown> = {};
    cyclic["self"] = cyclic;
    for (const value of [new Date(0), 2n ** 70n, cyclic]) {
      expect(() =>
        mint({ ...workflow, extra: value as unknown as Record<string, unknown> }, catalog),
      ).toThrow(TypeError);
    }
    // Everything else the node builders accept still mints unchanged.
    for (const value of [10n, undefined, new Uint8Array([1]), { a: 1 }, [1, 2], null]) {
      expect(() =>
        mint({ ...workflow, extra: value as unknown as Record<string, unknown> }, catalog),
      ).not.toThrow();
    }
    // …and a nested unstorable or lossy value still mints, which is exactly
    // the gap decision D4 owns and this change deliberately does not close.
    expect(() => mint({ ...workflow, extra: { a: new Map() } }, catalog)).not.toThrow();
    expect(() => mint({ ...workflow, extra: { a: new Date(0) } }, catalog)).not.toThrow();
  });
});
