/**
 * Boundary pins for the #14 payload budget (src/limits.ts).
 *
 * Each limit is pinned EXACTLY — the largest accepted shape and the smallest
 * rejected one — so a constant change is a deliberate diff here, not a silent
 * drift. Integration rows assert the applyOps contract on refusal: failed set,
 * empty applied, byte-identical doc, projectable doc.
 */
import * as Y from "yjs";
import { describe, expect, it } from "vitest";
import { appliedOpIds, noOpIds, nonRejectedOutcomeCount, rejectedOutcome } from "./apply-result-helpers.js";
import {
  applyOps,
  MAX_COLLECTION_ENTRIES,
  MAX_OP_COST,
  MAX_OPS_PER_BATCH,
  MAX_PAYLOAD_DEPTH,
  mint,
  opBoundsRefusal,
  project,
} from "../src/index.js";
import type { Op, WorkflowJSON } from "../src/index.js";
import { loadCatalog } from "./helpers.js";

const catalog = loadCatalog();

function bytes(doc: Y.Doc): Buffer {
  return Buffer.from(Y.encodeStateAsUpdate(doc));
}

/** `n` nested objects; traversal starts at outermost depth 0, so the string leaf is depth `n`. */
function wrap(n: number): unknown {
  let value: unknown = "leaf";
  for (let i = 0; i < n; i++) value = { child: value };
  return value;
}

describe("opBoundsRefusal boundaries", () => {
  it(`accepts an array of exactly ${MAX_COLLECTION_ENTRIES} entries`, () => {
    expect(opBoundsRefusal(new Array(MAX_COLLECTION_ENTRIES).fill(0))).toBeNull();
  });

  it(`rejects an array of ${MAX_COLLECTION_ENTRIES + 1} entries`, () => {
    expect(opBoundsRefusal(new Array(MAX_COLLECTION_ENTRIES + 1).fill(0))).toMatch(/entry limit/);
  });

  it(`rejects an object of ${MAX_COLLECTION_ENTRIES + 1} keys`, () => {
    const obj: Record<string, number> = {};
    for (let i = 0; i <= MAX_COLLECTION_ENTRIES; i++) obj[`k${i}`] = 0;
    expect(opBoundsRefusal(obj)).toMatch(/entry limit/);
  });

  it("pins the cost budget exactly on a bare string (1 visit + length)", () => {
    expect(opBoundsRefusal("x".repeat(MAX_OP_COST - 1))).toBeNull();
    expect(opBoundsRefusal("x".repeat(MAX_OP_COST))).toMatch(/cost budget/);
  });

  it("counts binary payloads by byteLength", () => {
    expect(opBoundsRefusal(new Uint8Array(1024))).toBeNull();
    expect(opBoundsRefusal(new Uint8Array(MAX_OP_COST + 1))).toMatch(/cost budget/);
  });

  it(`accepts a payload whose leaf is exactly at depth ${MAX_PAYLOAD_DEPTH}`, () => {
    expect(opBoundsRefusal(wrap(MAX_PAYLOAD_DEPTH))).toBeNull();
  });

  it(`rejects a payload whose leaf is at depth ${MAX_PAYLOAD_DEPTH + 1}`, () => {
    expect(opBoundsRefusal(wrap(MAX_PAYLOAD_DEPTH + 1))).toMatch(/nests deeper/);
  });

  it("skips reference cycles (the value gates own that refusal), terminating", () => {
    const cycle: Record<string, unknown> = {};
    cycle["self"] = cycle;
    expect(opBoundsRefusal(cycle)).toBeNull();
  });

  it("trips the budget on a shared-reference (billion-laughs) DAG instead of hanging", () => {
    let node: unknown = "y".repeat(64);
    for (let i = 0; i < 10; i++) node = new Array(16).fill(node);
    expect(opBoundsRefusal(node)).toMatch(/cost budget/);
  });
});

describe("applyOps enforces the budget before any mutation", () => {
  const base: WorkflowJSON = {
    nodes: [{ id: 1, type: "KSampler", widgets_values: [] }],
    links: [],
  };

  function setWidget(opId: string, value: unknown): Op {
    return {
      op: "set_widget",
      op_id: opId,
      actor: "attacker",
      base_version: 1,
      stamp: [1, "attacker"],
      node_id: 1,
      widget: "steps",
      value,
    } as Op;
  }

  it("rejects an oversized value with malformed_op, leaving the doc byte-identical", () => {
    const doc = mint(base, catalog);
    const before = bytes(doc);
    const result = applyOps(doc, [setWidget("b".repeat(32), "x".repeat(MAX_OP_COST))], catalog);
    expect(rejectedOutcome(result)?.reason.code).toBe("malformed_op");
    expect(rejectedOutcome(result)?.reason.message).toMatch(/cost budget/);
    expect(appliedOpIds(result)).toEqual([]);
    expect(bytes(doc).equals(before)).toBe(true);
    expect(() => project(doc, catalog)).not.toThrow();
  });

  it("accepts a deep-but-legal value (the bound is above real payloads)", () => {
    const doc = mint(base, catalog);
    const result = applyOps(doc, [setWidget("c".repeat(32), wrap(30))], catalog);
    expect(rejectedOutcome(result)).toBeUndefined();
    expect(nonRejectedOutcomeCount(result)).toBe(1);
  });

  it(`rejects a batch of ${MAX_OPS_PER_BATCH + 1} ops before processing any`, () => {
    const doc = mint(base, catalog);
    const before = bytes(doc);
    const ops = Array.from({ length: MAX_OPS_PER_BATCH + 1 }, (_, i) =>
      setWidget(String(i).padStart(32, "0"), i),
    );
    const result = applyOps(doc, ops, catalog);
    expect(rejectedOutcome(result)?.reason.code).toBe("malformed_op");
    expect(rejectedOutcome(result)?.reason.message).toMatch(/op limit/);
    expect(appliedOpIds(result)).toEqual([]);
    expect(noOpIds(result)).toEqual([]);
    expect(bytes(doc).equals(before)).toBe(true);
  });

  it.each([
    { name: "cost", value: "x".repeat(MAX_OP_COST), code: "malformed_op", message: /cost budget/ },
    { name: "breadth", value: new Array(MAX_COLLECTION_ENTRIES + 1).fill(0), code: "malformed_op", message: /entry limit/ },
    { name: "depth", value: wrap(MAX_PAYLOAD_DEPTH + 1), code: "payload_too_deep", message: /nests deeper/ },
  ])("rejects decoded JSON over the $name limit and accepts a corrected retry", ({ value, code, message }) => {
    const doc = mint(base, catalog);
    const before = bytes(doc);
    const opId = "e".repeat(32);
    const trailingId = "f".repeat(32);
    // Only inert test fixtures are encoded here. A host receives JSON text;
    // stringify is not a sanitizer for caller-created getters or Proxies.
    const wireText = JSON.stringify([setWidget(opId, value), setWidget(trailingId, 99)]);
    const decoded: Op[] = JSON.parse(wireText);
    for (let attempt = 0; attempt < 2; attempt++) {
      const result = applyOps(doc, decoded, catalog);
      expect(result.outcomes).toEqual([{
        op_id: opId,
        outcome: "rejected",
        reason: { code, message: expect.stringMatching(message) },
      }, {
        op_id: trailingId,
        outcome: "rejected",
        reason: { code: "batch_aborted", message: expect.any(String) },
      }]);
      expect(result.ops_seen).toBe(0);
      expect(doc.getMap("__applied").has(trailingId)).toBe(false);
      expect(bytes(doc)).toEqual(before);
    }

    const corrected: Op[] = JSON.parse(JSON.stringify([setWidget(opId, 42)]));
    const accepted = applyOps(doc, corrected, catalog);
    expect(accepted.outcomes).toEqual([{ op_id: opId, outcome: "applied" }]);
    expect(accepted.ops_seen).toBe(1);
    expect(project(doc, catalog).nodes[0]!.widgets_values).toEqual([null, null, 42]);
    const applied = bytes(doc);
    expect(applyOps(doc, corrected, catalog).outcomes).toEqual([{ op_id: opId, outcome: "no-op" }]);
    expect(bytes(doc)).toEqual(applied);
  });

  it(`accepts a batch of exactly ${MAX_OPS_PER_BATCH} ops`, () => {
    const doc = mint(base, catalog);
    const ops = Array.from({ length: MAX_OPS_PER_BATCH }, (_, i) =>
      setWidget(String(i).padStart(32, "0"), i),
    );
    const result = applyOps(doc, ops, catalog);
    expect(rejectedOutcome(result)).toBeUndefined();
    expect(nonRejectedOutcomeCount(result)).toBe(MAX_OPS_PER_BATCH);
  });
});
