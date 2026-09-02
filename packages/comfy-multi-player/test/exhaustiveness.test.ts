/**
 * Runtime companions to the compile-time exhaustiveness guards (#21).
 *
 * The guards themselves are type-level: they are demonstrated by adding a
 * member to `Op` / `WIDGET_STORAGE_STRATEGIES` and watching `npm run build`
 * fail at each unhandled site (see the PR body). A test file cannot re-run
 * `tsc`, so what it pins instead is the part a type guard cannot reach — what
 * the package does when an unknown kind arrives at RUNTIME from a peer
 * implementation that was built against a newer vocabulary — plus the
 * classifier behaviour the guarded switches now dispatch on.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import * as Y from "yjs";
import { describe, expect, it } from "vitest";
import {
  DEFERRED_OPS,
  FROZEN_OPS,
  OPAQUE_WIDGETS_KEY,
  applyOps,
  mint,
  writeTarget,
  type Op,
  type WorkflowJSON,
} from "../src/index.js";
import { createNodeMap, widgetStorageFor, widgetStorageOf } from "../src/doc.js";
import { assertNever, checkExhaustive } from "../src/exhaustive.js";
import { fixturesDir, loadCatalog } from "./helpers.js";

const catalog = loadCatalog();
const emptyWorkflow: WorkflowJSON = { nodes: [], links: [] };

function env(opId: string) {
  return { op_id: opId, actor: "peer", base_version: 1, stamp: [1, "peer"] as [number, string] };
}

function bytes(doc: Y.Doc): string {
  return Buffer.from(Y.encodeStateAsUpdate(doc)).toString("hex");
}

describe("exhaustiveness helpers", () => {
  it("assertNever throws with its call-site context", () => {
    expect(() => assertNever("surprise" as never, "unit")).toThrow(/unit: unhandled variant/);
  });

  it("checkExhaustive is a runtime no-op — its whole force is at compile time", () => {
    expect(checkExhaustive("surprise" as never)).toBeUndefined();
  });
});

describe("runtime: an op kind this build does not know", () => {
  it("is REJECTED loudly, not silently no-oped, and leaves the doc byte-identical", () => {
    const doc = mint(emptyWorkflow, catalog, "sha");
    const before = bytes(doc);
    const result = applyOps(doc, [{ op: "future_op", ...env("a") } as unknown as Op], catalog);
    expect(result.outcomes.find((o) => o.outcome === "rejected")?.reason.code).toBe("unknown_op");
    expect(result.outcomes.filter((o) => o.outcome === "applied").map((o) => o.op_id)).toEqual([]);
    expect(result.outcomes.filter((o) => o.outcome === "no-op").map((o) => o.op_id)).toEqual([]);
    expect(result.ops_seen).toBe(0);
    expect(bytes(doc)).toBe(before);
  });

  it("aborts the remainder of the batch rather than skipping past it", () => {
    const doc = mint(emptyWorkflow, catalog, "sha");
    const ops = [
      { op: "future_op", ...env("a") },
      { op: "clear", ...env("b"), removed_nodes: [] },
    ] as unknown as Op[];
    const result = applyOps(doc, ops, catalog);
    expect(result.outcomes.findIndex((o) => o.outcome === "rejected" && o.reason.code !== "batch_aborted")).toBe(0);
    // Pin the CODE, not just the index: without this, removing the
    // `unknown_op` reject from `validateEnvelope` leaves this test green
    // (the op then falls through to `dispatch`'s `assertNever`, which also
    // fails at index 0).
    expect(result.outcomes.find((o) => o.outcome === "rejected")?.reason.code).toBe("unknown_op");
    expect(result.outcomes.filter((o) => o.outcome === "applied").map((o) => o.op_id)).toEqual([]);
  });

  it("keeps the VALID PREFIX applied — the doc is byte-identical only when the unknown op is first", () => {
    // README's "an op kind this build does not know" paragraph used to say the
    // batch "applies nothing" and leaves the doc "byte-identical", full stop.
    // That is true only at index 0. Vocabulary §4 is abort-remainder, not
    // all-or-nothing: ops before the failure stay applied. Pinned so the prose
    // and the behaviour cannot drift apart again.
    const doc = mint(emptyWorkflow, catalog, "sha");
    const node = { id: 1, type: "KSampler", pos: [0, 0], size: [1, 1], widgets_values: [] };
    const ops = [
      { op: "add_node", ...env("p"), node_id: 1, node },
      { op: "future_op", ...env("q") },
      { op: "add_node", ...env("r"), node_id: 2, node: { ...node, id: 2 } },
    ] as unknown as Op[];

    const before = bytes(doc);
    const result = applyOps(doc, ops, catalog);

    expect(result.outcomes.findIndex((o) => o.outcome === "rejected" && o.reason.code !== "batch_aborted")).toBe(1);
    expect(result.outcomes.find((o) => o.outcome === "rejected")?.reason.code).toBe("unknown_op");
    expect(result.outcomes.filter((o) => o.outcome === "applied").map((o) => o.op_id)).toEqual(["p"]); // the prefix DID apply
    expect(bytes(doc)).not.toBe(before); // so the doc is NOT byte-identical
    expect([...doc.getMap("nodes").keys()]).toEqual(["1"]); // op 2 never ran
    expect(result.ops_seen).toBe(1);
  });

  it("still degrades to [op.op] in writeTarget — the documented tolerant fallback", () => {
    // Pinned deliberately: `writeTarget` is public and hosts feed it ops off
    // the wire, so the `default` arm must keep DEGRADING rather than throwing.
    // The cost, stated: every op of an unknown kind collapses onto ONE
    // conflict register regardless of what it targets — see the PR body.
    expect(writeTarget({ op: "future_op", ...env("a") } as unknown as Op)).toEqual(["future_op"]);
    expect(writeTarget({ op: "future_op", ...env("b"), node_id: 5 } as unknown as Op)).toEqual([
      "future_op",
    ]);
  });
});

describe("runtime: the op-kind partition matches the applier's behaviour", () => {
  // Runtime mirror of the type-level partition assertion in src/types.ts: the
  // kinds the compiler says are implemented are exactly the kinds `applyOps`
  // does not call unknown, and the deferred ones are exactly the deferred ones.
  it.each(FROZEN_OPS)("%s is not rejected as an unknown kind", (kind) => {
    const doc = mint(emptyWorkflow, catalog, "sha");
    const result = applyOps(doc, [{ op: kind, ...env(`f_${kind}`) } as unknown as Op], catalog);
    expect(result.outcomes.find((o) => o.outcome === "rejected")?.reason.code).not.toBe("unknown_op");
    expect(result.outcomes.find((o) => o.outcome === "rejected")?.reason.code).not.toBe("op_deferred");
  });

  it.each(DEFERRED_OPS)("%s is rejected as deferred, not as unknown", (kind) => {
    const doc = mint(emptyWorkflow, catalog, "sha");
    const result = applyOps(doc, [{ op: kind, ...env(`d_${kind}`) } as unknown as Op], catalog);
    expect(result.outcomes.find((o) => o.outcome === "rejected")?.reason.code).toBe("op_deferred");
  });
});

describe("widget-storage strategy classifiers", () => {
  const noteWorkflow = JSON.parse(
    readFileSync(join(fixturesDir, "session-frontend-only-notes.session.jsonl"), "utf8").split(
      "\n",
    )[0]!,
  ) as { base_workflow: WorkflowJSON };

  it("classifies the write side from the pinned catalog's widget_order", () => {
    expect(widgetStorageFor(["a", "b"], undefined)).toBe("opaque");
    expect(widgetStorageFor(["a", "b"], ["seed", "steps"])).toBe("named");
    expect(widgetStorageFor([], undefined)).toBe("named");
    expect(widgetStorageFor(undefined, undefined)).toBe("named");
  });

  it("classifies the read side from what the node actually stored", () => {
    // Integrated into a doc on purpose: `Y.Map#has` reads the integrated map,
    // so a preliminary (not-yet-inserted) node Y.Map answers `false` for every
    // key. `widgetStorageOf` is a read-side classifier for nodes already in
    // the doc, which is the only way the applier and `project` call it.
    const doc = mint(emptyWorkflow, catalog, "sha");
    const nodes = doc.getMap<Y.Map<unknown>>("nodes");
    doc.transact(() => {
      nodes.set("1", createNodeMap({ id: 1, type: "Note", widgets_values: ["hi"] }, undefined));
      nodes.set("2", createNodeMap({ id: 2, type: "KSampler", widgets_values: [1] }, ["seed"]));
    });

    const opaque = nodes.get("1")!;
    expect(opaque.has(OPAQUE_WIDGETS_KEY)).toBe(true);
    expect(widgetStorageOf(opaque)).toBe("opaque");
    expect(widgetStorageOf(nodes.get("2")!)).toBe("named");
  });

  it("agrees with the write side for every node of a real frontend-only session", () => {
    const doc = mint(noteWorkflow.base_workflow, catalog, "sha");
    const nodes = doc.getMap<Y.Map<unknown>>("nodes");
    expect(nodes.size).toBeGreaterThan(0);
    nodes.forEach((node) => {
      const type = String(node.get("type") ?? "");
      const order = catalog.types[type]?.widget_order;
      const expected = node.has(OPAQUE_WIDGETS_KEY) ? "opaque" : "named";
      expect(widgetStorageOf(node)).toBe(expected);
      if (order === undefined && node.has(OPAQUE_WIDGETS_KEY)) {
        expect(widgetStorageFor(node.get(OPAQUE_WIDGETS_KEY), order)).toBe("opaque");
      }
    });
  });
});
