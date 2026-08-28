import * as Y from "yjs";
import { describe, expect, it } from "vitest";
import { applyOps, mint, project, type SetWidgetOp } from "../src/index.js";
import { canonicalOp } from "../src/applier.js";
import { sha256Hex } from "../src/digest.js";
import { appliedMap } from "../src/doc.js";
import { loadCatalog, loadLwwVectors } from "./helpers.js";

const NODE_ID = 3308598398221244;

function firstOp(): SetWidgetOp {
  return {
    op: "set_widget",
    op_id: "same0000000000000000000000000000",
    actor: "human:a",
    base_version: 5,
    stamp: [5, "human:a"],
    node_id: NODE_ID,
    widget: "steps",
    value: 25,
  };
}

describe("regression: op_id reuse with a changed payload (#12)", () => {
  it("is rejected without mutation", () => {
    const catalog = loadCatalog();
    const doc = mint(loadLwwVectors().base_workflow, catalog);
    const first = firstOp();
    expect(applyOps(doc, [first], catalog).outcomes.some((o) => o.outcome === "rejected")).toBe(false);
    const before = Buffer.from(Y.encodeStateAsUpdate(doc));

    const reused = { ...first, value: 30 };
    const result = applyOps(doc, [reused], catalog);

    expect(result.outcomes[0]).toMatchObject({ outcome: "rejected", reason: { code: "op_id_reuse" } });
    expect(result.outcomes.filter((o) => o.outcome === "no-op").map((o) => o.op_id)).toEqual([]);
    expect(Buffer.from(Y.encodeStateAsUpdate(doc)).equals(before)).toBe(true);
  });

  it("aborts the remainder of the batch, leaving the doc untouched (KA-4)", () => {
    const catalog = loadCatalog();
    const doc = mint(loadLwwVectors().base_workflow, catalog);
    const first = firstOp();
    expect(applyOps(doc, [first], catalog).outcomes.some((o) => o.outcome === "rejected")).toBe(false);
    const before = Buffer.from(Y.encodeStateAsUpdate(doc));

    const reused = { ...first, value: 30 };
    const trailing: SetWidgetOp = { ...first, op_id: "next0000000000000000000000000000", value: 40 };
    const result = applyOps(doc, [reused, trailing], catalog);

    expect(result.outcomes[0]).toMatchObject({ outcome: "rejected", reason: { code: "op_id_reuse" } });
    expect(result.outcomes.filter((o) => o.outcome === "applied").map((o) => o.op_id)).toEqual([]);
    expect(Buffer.from(Y.encodeStateAsUpdate(doc)).equals(before)).toBe(true);
  });

  it("records a bounded digest of a canonical payload, pinned as a cross-language vector (KA-3)", () => {
    // `__applied` is part of the replicated document, so a Python or Go
    // applier that canonicalizes or digests differently would reject a
    // legitimate retry across the language boundary. This pins both halves:
    // the canonical string (JSON, object keys sorted by code point at every
    // depth, array order preserved, whole envelope including `op_id`) and the
    // SHA-256 of its UTF-8 bytes, which is what the document stores.
    const catalog = loadCatalog();
    const doc = mint(loadLwwVectors().base_workflow, catalog);
    expect(applyOps(doc, [firstOp()], catalog).outcomes.some((o) => o.outcome === "rejected")).toBe(false);

    const canonical =
      '{"actor":"human:a","base_version":5,"node_id":3308598398221244,' +
      '"op":"set_widget","op_id":"same0000000000000000000000000000",' +
      '"stamp":[5,"human:a"],"value":25,"widget":"steps"}';
    expect(canonicalOp(firstOp())).toBe(canonical);
    expect(appliedMap(doc).get(firstOp().op_id)).toBe(sha256Hex(canonical));
    // Bounded: 64 hex chars regardless of payload size (schema §4 amendment A8).
    expect(String(appliedMap(doc).get(firstOp().op_id))).toHaveLength(64);
  });

  it("rejects a payload nested past the depth bound before touching the document", () => {
    // The canonicalizer walks attacker-controlled payload, and it now runs on
    // the DUPLICATE path too, which used to short-circuit before reading the
    // payload at all. Unbounded recursion there is a stack-exhaustion
    // `RangeError` reachable by anyone who knows one applied op_id (issue #14).
    const catalog = loadCatalog();
    const doc = mint(loadLwwVectors().base_workflow, catalog);
    const first = firstOp();
    expect(applyOps(doc, [first], catalog).outcomes.some((o) => o.outcome === "rejected")).toBe(false);
    const before = Buffer.from(Y.encodeStateAsUpdate(doc));

    let deep: Record<string, unknown> = {};
    for (let i = 0; i < 60_000; i++) deep = { n: deep };
    const hostile = { ...first, value: deep };

    const result = applyOps(doc, [hostile], catalog);
    expect(result.outcomes[0]).toMatchObject({ outcome: "rejected", reason: { code: "payload_too_deep" } });
    expect(result.outcomes.filter((o) => o.outcome === "no-op").map((o) => o.op_id)).toEqual([]);
    expect(Buffer.from(Y.encodeStateAsUpdate(doc)).equals(before)).toBe(true);

    // Same bound on a FRESH op_id, and still before any mutation.
    const fresh = applyOps(
      doc,
      [{ ...hostile, op_id: "deep00000000000000000000000000000".slice(0, 32) }],
      catalog,
    );
    expect(fresh.outcomes[0]).toMatchObject({ outcome: "rejected", reason: { code: "payload_too_deep" } });
    expect(Buffer.from(Y.encodeStateAsUpdate(doc)).equals(before)).toBe(true);
  });

  it("treats a pre-A8 `1` record as a duplicate rather than a reuse", () => {
    // Documents written before amendment A8 store `1`. They must keep
    // deduping silently instead of failing every retry with op_id_reuse.
    const catalog = loadCatalog();
    const doc = mint(loadLwwVectors().base_workflow, catalog);
    const first = firstOp();
    expect(applyOps(doc, [first], catalog).outcomes.some((o) => o.outcome === "rejected")).toBe(false);
    doc.transact(() => appliedMap(doc).set(first.op_id, 1));
    const before = project(doc, catalog);

    const result = applyOps(doc, [{ ...first, value: 30 }], catalog);

    expect(result.outcomes.some((o) => o.outcome === "rejected")).toBe(false);
    expect(result.outcomes.filter((o) => o.outcome === "no-op").map((o) => o.op_id)).toEqual([first.op_id]);
    expect(project(doc, catalog)).toEqual(before);
  });
});
