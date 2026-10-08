import { describe, expect, it } from "vitest";
import { applyOps, mint, project, type SetWidgetOp } from "../src/index.js";
import { loadCatalog, loadLwwVectors } from "./helpers.js";

/**
 * Characterizes op_id-reuse order-dependence (tracking item `OPID-REUSE-ORDER-DEPENDENT`,
 * follow-up to CMP #33 / `reports/pr-review/gauntlet-75.md`).
 *
 * The `op_id_reuse` gate (`src/applier.ts:152-186`) records a payload digest on
 * FIRST sight of an `op_id` and rejects any later op reusing that `op_id` with a
 * different digest. That means: given the same set of two ops that share an
 * `op_id` but carry different payloads, whichever one is APPLIED FIRST is the one
 * that is kept — the second is rejected outright, never merged, never LWW-compared
 * by stamp. Swap arrival order and the surviving payload swaps too.
 *
 * This is a real protocol property (not a bug — first-writer-wins-by-arrival is a
 * legitimate, if surprising, dedupe semantic), but it is currently undocumented:
 * `.agents/checks/op-identity.md:12` states "reuse with different payload must
 * fail without mutation" with no order qualifier, and every existing test
 * (`test/op-id-reuse.test.ts`, `test/opid-payload-reuse.regression.test.ts`)
 * exercises only ONE fixed arrival order (`firstOp()` always first). None assert
 * that the outcome is order-dependent. Do not change production code here —
 * this file only documents current behavior with both-orders assertions.
 */

const NODE_ID = 3308598398221244;

function widgetOp(opId: string, actor: string, baseVersion: number, value: number): SetWidgetOp {
  return {
    op: "set_widget",
    op_id: opId,
    actor,
    base_version: baseVersion,
    stamp: [baseVersion, actor],
    node_id: NODE_ID,
    widget: "steps",
    value,
  };
}

describe("op_id_reuse is order-dependent (not stamp/LWW-resolved)", () => {
  it("keeps whichever payload is applied FIRST, order A: 25 then 30", () => {
    const catalog = loadCatalog();
    const doc = mint(loadLwwVectors().base_workflow, catalog);
    const opId = "orderaaaaaaaaaaaaaaaaaaaaaaaaaaa";

    // Op "value=30" carries a LATER stamp (base_version 9 > 5) than "value=25" —
    // if this were resolved by stamp/LWW, 30 (the later stamp) would win
    // regardless of arrival order. It does not: arrival order alone decides.
    const earlyStampLateArrival = widgetOp(opId, "human:a", 5, 25);
    const lateStampEarlyArrival = widgetOp(opId, "human:b", 9, 30);

    const first = applyOps(doc, [earlyStampLateArrival], catalog);
    expect(first.outcomes[0]).toMatchObject({ outcome: "applied" });

    const second = applyOps(doc, [lateStampEarlyArrival], catalog);
    expect(second.outcomes[0]).toMatchObject({
      outcome: "rejected",
      reason: { code: "op_id_reuse" },
    });

    const projected = project(doc, catalog);
    const node = projected.nodes.find((n) => n.id === NODE_ID)!;
    // `steps` is widgets_values[2] for KSampler (fixtures/lww-vectors.json).
    expect((node.widgets_values as unknown[])[2]).toBe(25);
  });

  it("keeps whichever payload is applied FIRST, order B: 30 then 25 — the surviving value flips", () => {
    const catalog = loadCatalog();
    const doc = mint(loadLwwVectors().base_workflow, catalog);
    const opId = "orderbbbbbbbbbbbbbbbbbbbbbbbbbbb";

    const earlyStampLateArrival = widgetOp(opId, "human:a", 5, 25);
    const lateStampEarlyArrival = widgetOp(opId, "human:b", 9, 30);

    // Same two ops, same op_id, opposite arrival order.
    const first = applyOps(doc, [lateStampEarlyArrival], catalog);
    expect(first.outcomes[0]).toMatchObject({ outcome: "applied" });

    const second = applyOps(doc, [earlyStampLateArrival], catalog);
    expect(second.outcomes[0]).toMatchObject({
      outcome: "rejected",
      reason: { code: "op_id_reuse" },
    });

    const projected = project(doc, catalog);
    const node = projected.nodes.find((n) => n.id === NODE_ID)!;
    // Order B keeps the OTHER value than order A kept, from the identical op
    // pair — the outcome is a function of arrival order, not of the stamp.
    expect((node.widgets_values as unknown[])[2]).toBe(30);
  });

  it("two replicas that each apply their own op first diverge — arrival order, not the stamp, breaks the tie", () => {
    const catalog = loadCatalog();
    const base = loadLwwVectors().base_workflow;
    const opId = "orderccccccccccccccccccccccccccc";
    const opA = widgetOp(opId, "human:a", 5, 25);
    const opB = widgetOp(opId, "human:b", 9, 30);

    // Replica 1 receives [opA, opB] (opA arrives first).
    const replica1 = mint(base, catalog);
    applyOps(replica1, [opA], catalog);
    applyOps(replica1, [opB], catalog);

    // Replica 2 receives [opB, opA] (opB arrives first) — e.g. a different
    // relay/fan-out ordering of the exact same two ops.
    const replica2 = mint(base, catalog);
    applyOps(replica2, [opB], catalog);
    applyOps(replica2, [opA], catalog);

    const steps1 = (project(replica1, catalog).nodes.find((n) => n.id === NODE_ID)!.widgets_values as unknown[])[2];
    const steps2 = (project(replica2, catalog).nodes.find((n) => n.id === NODE_ID)!.widgets_values as unknown[])[2];

    // Replicas that saw the same op set in different orders converge on
    // DIFFERENT projections. This is the gap named in `OPID-REUSE-ORDER-DEPENDENT`:
    // op_id reuse is a real, order-dependent conflict-resolution mechanism that
    // is not named in `.agents/checks/op-identity.md`'s "resolve by stamp" rule.
    expect(steps1).toBe(25);
    expect(steps2).toBe(30);
    expect(steps1).not.toEqual(steps2);
  });
});
