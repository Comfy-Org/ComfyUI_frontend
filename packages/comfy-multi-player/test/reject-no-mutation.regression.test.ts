import * as Y from "yjs";
import { describe, expect, it } from "vitest";
import {
  applyOps,
  mint,
  project,
  type ConnectOp,
  type Op,
  type WidgetCatalog,
  type WorkflowJSON,
} from "../src/index.js";
import { appliedMap } from "../src/doc.js";
import { loadCatalog } from "./helpers.js";
import { checkGraphInvariants } from "./graph-invariant-oracle.js";

const catalog = loadCatalog();
/** Same catalog, but with a real `inputcount` widget on the grow destination. */
const countingCatalog: WidgetCatalog = {
  ...catalog,
  types: {
    ...catalog.types,
    BatchImagesNode: { ...catalog.types["BatchImagesNode"]!, widget_order: ["inputcount"] },
  },
};
const opId = (tag: string) => (tag + "0".repeat(32)).slice(0, 32);

function rejected(result: ReturnType<typeof applyOps>) {
  const index = result.outcomes.findIndex((outcome) => outcome.outcome === "rejected");
  const outcome = result.outcomes[index];
  return outcome?.outcome === "rejected"
    ? { index, code: outcome.reason.code, message: outcome.reason.message, op_id: outcome.op_id }
    : null;
}

/**
 * D4: a rejected op leaves the document BYTE-identical, not merely
 * projection-identical. The rejected op also never records its `op_id`, so
 * re-submitting it is re-attempted (and re-rejected) rather than deduped —
 * which is what makes the retry non-mutating too, the second half of #10.
 */
function assertRejectedWithoutMutation(
  workflow: WorkflowJSON,
  op: ConnectOp,
  code: string,
  withCatalog: WidgetCatalog = catalog,
): void {
  const doc = mint(workflow, withCatalog);
  const before = Buffer.from(Y.encodeStateAsUpdate(doc));
  expect(rejected(applyOps(doc, [op], withCatalog))).toMatchObject({ code });
  expect(Buffer.from(Y.encodeStateAsUpdate(doc)).equals(before)).toBe(true);

  const retry = applyOps(doc, [op], withCatalog);
  expect(rejected(retry)).toMatchObject({ code });
  expect(Buffer.from(Y.encodeStateAsUpdate(doc)).equals(before)).toBe(true);
}

describe("regression: rejected connect ops leave document bytes unchanged (#10)", () => {
  const source = {
    id: 300, type: "LoadImage", inputs: [],
    outputs: [{ name: "IMAGE", type: "IMAGE", links: [9000] }], widgets_values: [],
  };
  const destination = {
    id: 700, type: "BatchImagesNode",
    inputs: [{ name: "images.image0", type: "IMAGE", link: 9000 }],
    outputs: [{ name: "IMAGE", type: "IMAGE", links: [] }], widgets_values: [],
  };
  const workflow: WorkflowJSON = {
    nodes: [source, destination],
    links: [[9000, 300, 0, 700, 0, "IMAGE"]],
    groups: [], extra: {}, last_node_id: 700, last_link_id: 9000,
  };

  it.each([
    ["number", 7],
    ["null", null],
    ["object", { type: "IMAGE" }],
  ])(
    "A14 rejects a %s link_type before writes in both destination-delete arrival orders",
    (_label, linkType) => {
      const bad = {
        op: "connect", op_id: opId(`a14-${_label}`), actor: "human:z", base_version: 9,
        stamp: [9, "human:z"], link_id: 9499, from_node: 300, from_slot: 0,
        to_node: 700, to_slot: 0, link_type: linkType,
      } as unknown as Op;
      const deletion = {
        op: "delete_node", op_id: opId(`a14-del-${_label}`), actor: "human:d",
        base_version: 8, stamp: [8, "human:d"], node_id: 700,
      } as Op;

      for (const order of [[bad, deletion], [deletion, bad]]) {
        const doc = mint(workflow, catalog);
        for (const op of order) {
          const before = Buffer.from(Y.encodeStateAsUpdate(doc));
          const result = applyOps(doc, [op], catalog);
          if (op === bad) {
            expect(rejected(result)).toMatchObject({ code: "malformed_op", op_id: bad.op_id });
            expect(rejected(result)?.message).toContain("link_type must be a string");
            expect(Buffer.from(Y.encodeStateAsUpdate(doc)).equals(before)).toBe(true);
            expect(appliedMap(doc).has(bad.op_id)).toBe(false);
          }
        }
      }
    },
  );

  it("A14 accepts arbitrary string link_type values without catalogue membership validation", () => {
    const op = {
      op: "connect", op_id: opId("a14-arbitrary"), actor: "human:z", base_version: 9,
      stamp: [9, "human:z"], link_id: 9498, from_node: 300, from_slot: 0,
      to_node: 700, to_slot: 0, link_type: "UNKNOWN_ARBITRARY_LINK_TYPE",
    } as ConnectOp;
    const doc = mint(workflow, catalog);
    const result = applyOps(doc, [op], catalog);

    expect(rejected(result)).toBeNull();
    expect(result.outcomes).toEqual([{ op_id: op.op_id, outcome: "applied" }]);
    expect(project(doc, catalog).links).toContainEqual([
      op.link_id, op.from_node, op.from_slot, op.to_node, op.to_slot, op.link_type,
    ]);
  });

  it("invalid source output does not claim the input or remove its incumbent link", () => {
    assertRejectedWithoutMutation(workflow, {
      op: "connect", op_id: opId("bad-output"), actor: "human:z", base_version: 9,
      stamp: [9, "human:z"], link_id: 9500, from_node: 300, from_slot: 5,
      to_node: 700, to_slot: 0, link_type: "IMAGE",
    }, "output_slot_missing");
  });

  it("invalid inputcount widget does not append a grown slot", () => {
    assertRejectedWithoutMutation(workflow, {
      op: "connect", op_id: opId("bad-count"), actor: "human:z", base_version: 9,
      stamp: [9, "human:z"], link_id: 9501, from_node: 300, from_slot: 0,
      to_node: 700, to_slot: null, link_type: "IMAGE",
      grow: {
        name: "images.image0", type: "IMAGE",
        inputcount: { widget: "not_a_widget", value: 2 },
      },
    }, "unknown_widget");
  });

  it("non-string inputcount widget does not append a grown slot (the verified #10 repro)", () => {
    // The exact path recorded against issue #10: `growInput` appended the slot
    // and `applyInputcountBump` then threw `malformed_op` on a non-string
    // `grow.inputcount.widget`. Yjs does not roll a transact body back on
    // throw and `mset(op_id)` never ran, so the doc gained an input slot
    // (inputs 1 -> 2) while `ApplyResult.failed` reported nothing had
    // happened, and a retry appended a second slot.
    assertRejectedWithoutMutation(workflow, {
      op: "connect", op_id: opId("nonstr-count"), actor: "human:z", base_version: 9,
      stamp: [9, "human:z"], link_id: 9502, from_node: 300, from_slot: 0,
      to_node: 700, to_slot: null, link_type: "IMAGE",
      grow: {
        name: "images.image0", type: "IMAGE",
        inputcount: { widget: 7 as unknown as string, value: 2 },
      },
    }, "malformed_op");
  });

  it("malformed grow payload does not append a grown slot", () => {
    assertRejectedWithoutMutation(workflow, {
      op: "connect", op_id: opId("bad-grow"), actor: "human:z", base_version: 9,
      stamp: [9, "human:z"], link_id: 9503, from_node: 300, from_slot: 0,
      to_node: 700, to_slot: null, link_type: "IMAGE",
      grow: { name: 5 as unknown as string, type: "IMAGE" },
    }, "malformed_op");
  });

  it("an opaque destination refuses an inputcount grow before growing the slot", () => {
    const opaque = {
      id: 800, type: "MarkdownNode",
      inputs: [{ name: "images.image0", type: "IMAGE", link: null }],
      outputs: [], widgets_values: ["opaque"],
    };
    assertRejectedWithoutMutation(
      {
        nodes: [source, opaque],
        links: [],
        groups: [], extra: {}, last_node_id: 800, last_link_id: 9000,
      },
      {
        op: "connect", op_id: opId("opaque-count"), actor: "human:z", base_version: 9,
        stamp: [9, "human:z"], link_id: 9504, from_node: 300, from_slot: 0,
        to_node: 800, to_slot: null, link_type: "IMAGE",
        grow: {
          name: "images.image0", type: "IMAGE",
          inputcount: { widget: "inputcount", value: 2 },
        },
      },
      "opaque_widgets",
    );
  });

  it("a non-cloneable inputcount value is refused before the slot is grown", () => {
    // `structuredClone` throws DataCloneError on a value JSON cannot carry.
    // It used to be evaluated as an argument to `mset`, i.e. after `widgetsOf`
    // had created the widgets map and after the autogrow had appended a slot.
    assertRejectedWithoutMutation(workflow, {
      op: "connect", op_id: opId("uncloneable"), actor: "human:z", base_version: 9,
      stamp: [9, "human:z"], link_id: 9505, from_node: 300, from_slot: 0,
      to_node: 700, to_slot: null, link_type: "IMAGE",
      grow: {
        name: "images.image0", type: "IMAGE",
        inputcount: { widget: "inputcount", value: (() => undefined) as unknown as number },
      },
    }, "malformed_op", countingCatalog);
  });

  it.each([
    ["negative", -1],
    ["fractional", 0.5],
    ["NaN", Number.NaN],
    ["out of range", 99],
  ])("a %s from_slot is refused before the link tuple is written", (_label, fromSlot) => {
    // `from_slot >= outs.length` alone admitted every one of these: each
    // reached `outs.get(from_slot)` returning `undefined` and threw a raw
    // TypeError, reported as the generic `apply_failed`, only AFTER the link
    // tuple and the input slot had been written — with `__applied` unwritten,
    // so the retry re-mutated. Identical on `main` and on the first pass of
    // this fix; the fix closed two instances of #10, not the class.
    assertRejectedWithoutMutation(workflow, {
      op: "connect", op_id: opId(`slot${String(fromSlot)}`), actor: "human:z", base_version: 9,
      stamp: [9, "human:z"], link_id: 9506, from_node: 300, from_slot: fromSlot,
      to_node: 700, to_slot: 0, link_type: "IMAGE",
    }, "output_slot_missing");
  });

  it.each([
    ["negative", -1],
    ["fractional", 1.5],
    ["NaN", Number.NaN],
  ])("a %s to_slot is refused before the register is claimed", (_label, toSlot) => {
    assertRejectedWithoutMutation(workflow, {
      op: "connect", op_id: opId(`to${String(toSlot)}`), actor: "human:z", base_version: 9,
      stamp: [9, "human:z"], link_id: 9507, from_node: 300, from_slot: 0,
      to_node: 700, to_slot: toSlot, link_type: "IMAGE",
    }, "input_slot_missing");
  });

  /**
   * BOTH ARRIVAL ORDERS, from ONE seeded snapshot (KA-10).
   *
   * The convergence oracle here is the PROJECTION, not the bytes. Two replicas
   * that applied the same ops in different orders legitimately hold different
   * Yjs clocks, so `encodeStateAsUpdate` differs even when they agree — byte
   * identity is the oracle for a SINGLE rejected op (D4), and projection
   * equality is the oracle for convergence (KA-4 clause 1). Conflating them is
   * how a convergence bug hides behind a green byte assertion.
   */
  /**
   * The incumbent link MUST come from a node that survives `d`. In the shared
   * `workflow` above, node 300 both sources the incumbent link and is the
   * connect's source, so deleting it retires the link in every order and there
   * is nothing left to diverge about — the first draft of these tests used it
   * and passed against the very defect they were written for. Node 301 holds
   * the incumbent here and is never deleted.
   */
  const convergenceWorkflow: WorkflowJSON = {
    nodes: [
      { id: 300, type: "LoadImage", inputs: [], outputs: [{ name: "IMAGE", type: "IMAGE", links: [] }], widgets_values: [] },
      { id: 301, type: "LoadImage", inputs: [], outputs: [{ name: "IMAGE", type: "IMAGE", links: [7000] }], widgets_values: [] },
      { id: 700, type: "BatchImagesNode", inputs: [{ name: "images.image0", type: "IMAGE", link: 7000 }], outputs: [{ name: "IMAGE", type: "IMAGE", links: [] }], widgets_values: [] },
    ],
    links: [[7000, 301, 0, 700, 0, "IMAGE"]],
    groups: [], extra: {}, last_node_id: 700, last_link_id: 7000,
  };

  function assertConvergesBothOrders(x: Op, d: Op, workflowIn: WorkflowJSON = convergenceWorkflow): void {
    const seed = mint(workflowIn, catalog);
    const snapshot = Y.encodeStateAsUpdate(seed);
    const projections = [[x, d], [d, x]].map((order) => {
      const doc = new Y.Doc();
      Y.applyUpdate(doc, snapshot);
      for (const op of order) applyOps(doc, [op], catalog);
      const violations = checkGraphInvariants(doc);
      expect(violations, `graph invariant violation: ${JSON.stringify(violations)}`).toEqual([]);
      return JSON.stringify(project(doc, catalog));
    });
    expect(projections[0]).toEqual(projections[1]);
  }

  const deleteSource: Op = {
    op: "delete_node", op_id: opId("del-src"), actor: "human:d",
    base_version: 4, stamp: [4, "human:d"], node_id: 300,
  } as Op;

  it.each([
    ["negative", -1],
    ["fractional", 0.5],
    ["NaN", Number.NaN],
  ])(
    "a %s from_slot is refused in BOTH arrival orders against its source's deletion",
    (label, fromSlot) => {
      // REGRESSION (the defect this PR's first revision introduced). Validating
      // `from_slot` only where the source still exists made the verdict depend
      // on document state: a replica that had already applied `delete_node(300)`
      // could not see the malformation, so it ACCEPTED the op, claimed the
      // concrete-input register and retired the incumbent link, while a replica
      // that had not applied the delete REJECTED it and kept the link. Same
      // op-set, two legal orders, two different documents.
      //
      // The op-only half of the domain (`Number.isInteger && >= 0`) now runs
      // unconditionally, so every replica reaches the same verdict in every
      // state. The in-range half cannot: "is 5 in range" is unanswerable once
      // the source is gone. Schema Amendment A6 records that residual, and
      // `from_slot: 5` is deliberately NOT in this table.
      assertConvergesBothOrders(
        {
          op: "connect", op_id: opId(`conv${label}`), actor: "human:x", base_version: 5,
          stamp: [5, "human:x"], link_id: 9600, from_node: 300, from_slot: fromSlot,
          to_node: 700, to_slot: 0, link_type: "IMAGE",
        } as unknown as Op,
        deleteSource,
      );
    },
  );

  it("a valid from_slot converges in both orders too (the control that makes the above meaningful)", () => {
    // Without this, a bug that rejected EVERYTHING would pass the table above.
    assertConvergesBothOrders(
      {
        op: "connect", op_id: opId("conv-ok"), actor: "human:x", base_version: 5,
        stamp: [5, "human:x"], link_id: 9601, from_node: 300, from_slot: 0,
        to_node: 700, to_slot: 0, link_type: "IMAGE",
      } as unknown as Op,
      deleteSource,
    );
  });

  it("an op-only-invalid from_slot is refused even when the DESTINATION is gone", () => {
    // The same reasoning one node over, but it needs a DIFFERENT oracle. With
    // the destination deleted the two orders project identically either way —
    // the op touches nothing — so `project()` cannot see this and an earlier
    // draft of this test passed with the guard on the wrong side of the `!dst`
    // return. What differs is the `__applied` LEDGER: a delete-wins no-op
    // CONSUMES its op_id, a rejection does not, so one replica would dedupe a
    // later retry and the other would re-attempt it. Assert the DISPOSITION.
    const badOp = {
      op: "connect", op_id: opId("conv-dst"), actor: "human:x", base_version: 5,
      stamp: [5, "human:x"], link_id: 9602, from_node: 300, from_slot: -1,
      to_node: 700, to_slot: 0, link_type: "IMAGE",
    } as unknown as Op;
    const deleteDestination = {
      op: "delete_node", op_id: opId("del-dst"), actor: "human:d",
      base_version: 4, stamp: [4, "human:d"], node_id: 700,
    } as Op;

    const seed = mint(convergenceWorkflow, catalog);
    const snapshot = Y.encodeStateAsUpdate(seed);
    const dispositions = [[badOp, deleteDestination], [deleteDestination, badOp]].map((order) => {
      const doc = new Y.Doc();
      Y.applyUpdate(doc, snapshot);
      let connectFailure: string | null = null;
      for (const op of order) {
        const result = applyOps(doc, [op], catalog);
        if (op === badOp) connectFailure = rejected(result)?.code ?? null;
      }
      return connectFailure;
    });
    // Both orders must REJECT — never `null` (accepted as a delete-wins no-op).
    expect(dispositions).toEqual(["output_slot_missing", "output_slot_missing"]);
  });

  it.each([
    ["negative", -1],
    ["large negative", -5],
    ["fractional below the slot count", 0.5],
    ["fractional above the slot count", 1.5],
    ["NaN", Number.NaN],
    ["out of range", 99],
  ])(
    "a %s from_slot is refused as a STRUCTURED rejection, not a raw TypeError",
    (_label, fromSlot) => {
      // The error TYPE matters independently of whether the op is rejected.
      // On `main` a `from_slot` of -1, -5, 0.5 or NaN passed
      // `typeof !== "number" || from_slot >= outs.length`, so `outs.get(i)`
      // returned `undefined` and the next property access threw a raw
      // `TypeError`. `applyOps` catches it — abort-remainder is still honoured,
      // it does NOT escape the protocol — but it is reported under the generic
      // `apply_failed` code with a message about "properties of undefined",
      // which tells a consumer nothing and is indistinguishable from an
      // internal fault. Every value in this table must now come back as
      // `output_slot_missing`.
      //
      // Note `1.5` is in the table as a CONTROL of sorts: it was already
      // structured on `main`, because 1.5 >= outs.length. The gap was floats
      // BELOW the slot count, not floats in general.
      const doc = mint(workflow, catalog);
      const result = applyOps(doc, [{
        op: "connect", op_id: opId(`typ${String(fromSlot)}`), actor: "human:z", base_version: 9,
        stamp: [9, "human:z"], link_id: 9702, from_node: 300, from_slot: fromSlot,
        to_node: 700, to_slot: 0, link_type: "IMAGE",
      } as unknown as Op], catalog);
      expect(rejected(result)?.code).toBe("output_slot_missing");
      expect(rejected(result)?.code).not.toBe("apply_failed");
      expect(rejected(result)?.message).not.toMatch(/properties of undefined/);
    },
  );

  it("a rejected connect never escapes applyOps as a thrown exception", () => {
    // The rejection protocol is in-band by contract (D4: "The failure is
    // returned, not thrown"). Pinned explicitly because the raw-TypeError path
    // above was once described as bypassing it — it does not, and a future
    // refactor that let anything escape would break every consumer's error
    // handling rather than merely degrade a code.
    const doc = mint(workflow, catalog);
    expect(() =>
      applyOps(doc, [
        {
          op: "connect", op_id: opId("esc1"), actor: "human:z", base_version: 9,
          stamp: [9, "human:z"], link_id: 9703, from_node: 300, from_slot: -1,
          to_node: 700, to_slot: 0, link_type: "IMAGE",
        },
        {
          op: "add_node", op_id: opId("esc2"), actor: "human:z", base_version: 9,
          stamp: [9, "human:z"], node_id: 901, class_type: "LoadImage", pos: [0, 0],
          node: { id: 901, type: "LoadImage", inputs: [], outputs: [], widgets_values: [], pos: [0, 0] },
        },
      ] as unknown as Op[], catalog),
    ).not.toThrow();

    const doc2 = mint(workflow, catalog);
    const result = applyOps(doc2, [
      {
        op: "connect", op_id: opId("esc3"), actor: "human:z", base_version: 9,
        stamp: [9, "human:z"], link_id: 9704, from_node: 300, from_slot: -1,
        to_node: 700, to_slot: 0, link_type: "IMAGE",
      },
      {
        op: "add_node", op_id: opId("esc4"), actor: "human:z", base_version: 9,
        stamp: [9, "human:z"], node_id: 902, class_type: "LoadImage", pos: [0, 0],
        node: { id: 902, type: "LoadImage", inputs: [], outputs: [], widgets_values: [], pos: [0, 0] },
      },
    ] as unknown as Op[], catalog);
    // Abort-remainder (§4): the trailing valid op is NOT applied.
    //
    // Deliberately asserts the PROTOCOL only — that a failure is returned at
    // index 0 and the remainder is discarded — and not the specific code, which
    // the table above owns. This test is a GUARD, not a regression catcher: it
    // passes against `main` too, because the raw `TypeError` was always caught
    // and reported in band. Written down so nobody later reads it as evidence
    // that the TypeError escaped, which it never did.
    expect(rejected(result)?.index).toBe(0);
    expect(result.outcomes.filter((outcome) => outcome.outcome !== "rejected")).toHaveLength(0);
  });

  it("reports from_slot's code when BOTH slot axes are invalid (precedence pinned)", () => {
    // A DISCLOSED code change, and it is LAYERED rather than "from_slot always
    // wins" — an earlier version of this comment said the latter and was wrong
    // for `from_slot: 9, to_slot: -1`. The actual precedence is:
    //   1. op-only `from_slot` domain   -> output_slot_missing
    //   2. op-only `to_slot` domain     -> input_slot_missing
    //   3. state-dependent `from_slot`  -> output_slot_missing
    //   4. state-dependent `to_slot`    -> input_slot_missing
    // On `main` the `to_slot` range check ran before `requireOutputSlot`, so
    // most of these returned `input_slot_missing` there — but NOT all of them,
    // and an earlier version of this comment claimed otherwise. `[9, 0]`
    // returned `output_slot_missing` on `main` too (only `from_slot` is
    // invalid, nothing for the `to_slot` check to catch), and `[-1, 0]`
    // returned the raw-TypeError `apply_failed` — the headline case this PR
    // exists to fix. TWO combinations changed class, `[-1, 0]` and `[0.5, 0]`,
    // both marked below; an earlier version of this comment said "the only",
    // fifteen lines above a row annotated `(CLASS CHANGED)` that contradicted
    // it. All ten rows are in the table so the claim is checkable rather than
    // asserted.
    // README tells integrators to "Match on `code`, never on `message`", so the
    // code is contractual and this precedence should not drift again unnoticed.
    for (const [fromSlot, toSlot, expected] of [
      [9, 9, "output_slot_missing"],   // both state-dependent: from_slot wins (CHANGED)
      [9, -1, "input_slot_missing"],   // to_slot fails op-only first (unchanged)
      [9, 0.5, "input_slot_missing"],  // same (unchanged)
      [-1, 9, "output_slot_missing"],  // from_slot fails op-only first (CHANGED)
      [-1, -1, "output_slot_missing"], // from_slot op-only outranks to_slot op-only (CHANGED)
      [0.5, 0.5, "output_slot_missing"], // same (CHANGED)
      [9, 0, "output_slot_missing"],   // only from_slot invalid (unchanged on main)
      [0, 9, "input_slot_missing"],    // only to_slot invalid (unchanged on main)
      [-1, 0, "output_slot_missing"],  // main: apply_failed (raw TypeError) — CLASS CHANGED
      [0.5, 0, "output_slot_missing"], // same (CLASS CHANGED)
    ] as [number, number, string][]) {
      const doc = mint(workflow, catalog);
      const result = applyOps(doc, [{
        op: "connect", op_id: opId(`prec${String(fromSlot)}${String(toSlot)}`), actor: "human:z",
        base_version: 9, stamp: [9, "human:z"], link_id: 9705, from_node: 300,
        from_slot: fromSlot, to_node: 700, to_slot: toSlot, link_type: "IMAGE",
      } as unknown as Op], catalog);
      expect(rejected(result)?.code).toBe(expected);
    }
  });

  it("a throwing base_version is refused identically whether or not the destination is gone", () => {
    // `stampKey` is op-only (`Number(stamp[0])`, no document read) but the
    // concrete branch used to evaluate it BELOW the delete-wins return, so a
    // `Symbol` or throwing-`valueOf` `base_version` was rejected on a replica
    // holding the destination and delete-wins-APPLIED on one that was not.
    // `applySetWidget` already got this right, which is what made the
    // asymmetry findable.
    for (const stamp of [
      [Symbol("x"), "human:z"],
      [{ valueOf() { throw new Error("boom"); } }, "human:z"],
    ] as unknown[]) {
      const deleteDestination = {
        op: "delete_node", op_id: opId("dd-stamp"), actor: "human:d",
        base_version: 4, stamp: [4, "human:d"], node_id: 700,
      } as Op;
      const badOp = {
        op: "connect", op_id: opId("stampbad"), actor: "human:z", base_version: 9,
        stamp, link_id: 9706, from_node: 300, from_slot: 0, to_node: 700,
        to_slot: 0, link_type: "IMAGE",
      } as unknown as Op;
      const seed = mint(convergenceWorkflow, catalog);
      const snapshot = Y.encodeStateAsUpdate(seed);
      const dispositions = [[badOp, deleteDestination], [deleteDestination, badOp]].map((order) => {
        const doc = new Y.Doc();
        Y.applyUpdate(doc, snapshot);
        let code: string | null = null;
        for (const op of order) {
          const result = applyOps(doc, [op], catalog);
          if (op === badOp) code = rejected(result)?.code ?? null;
        }
        return code;
      });
      expect(dispositions[0]).toBe(dispositions[1]);
      expect(dispositions[0]).not.toBeNull();
    }
  });

  it.each([
    ["Symbol", [Symbol("x"), "human:z"]],
    ["throwing valueOf", [{ valueOf() { throw new Error("boom"); } }, "human:z"]],
  ])(
    "a %s base_version leaves the doc byte-identical on the AUTOGROW path too",
    (_label, stamp) => {
      // This hole was open until `stampKey` was hoisted into
      // `requireOpOnlyValid` for a convergence reason; closing it here was a
      // side effect. Pinned so the enumerations in `src/applier.ts`,
      // `docs/INVARIANTS.md` KA-4 and `test/invalid-op-states.test.ts` cannot
      // quietly become wrong again. (They enumerate FOUR open holes; this
      // sentence has already been wrong once by naming a stale count, so it
      // deliberately names none.)
      const doc = mint(workflow, countingCatalog);
      const before = Buffer.from(Y.encodeStateAsUpdate(doc));
      const result = applyOps(doc, [{
        op: "connect", op_id: opId("stampgrow"), actor: "human:z", base_version: 9,
        stamp, link_id: 9709, from_node: 300, from_slot: 0, to_node: 700,
        to_slot: null, link_type: "IMAGE",
        grow: { name: "images.image1", type: "IMAGE", inputcount: { widget: "inputcount", value: 2 } },
      } as unknown as Op], countingCatalog);
      expect(rejected(result)).not.toBeNull();
      expect(Buffer.from(Y.encodeStateAsUpdate(doc)).equals(before)).toBe(true);
    },
  );

  /**
   * §2.5 items 4-8 promise "each is pinned by a test that will start
   * failing the day it is closed". These are those tests. They assert the
   * carve-out STILL DIVERGES — so closing either one reddens here and forces
   * the schema list to be updated, which is what the header sentence claims.
   */
  it("§2.5 item 4 (source axis) still diverges — pinning the carve-out", () => {
    const projections = [[
      { op: "connect", op_id: opId("cv4a"), actor: "human:x", base_version: 5, stamp: [5, "human:x"],
        link_id: 9707, from_node: 300, from_slot: 5, to_node: 700, to_slot: 0, link_type: "IMAGE" },
      { op: "delete_node", op_id: opId("cv4d"), actor: "human:d", base_version: 4, stamp: [4, "human:d"], node_id: 300 },
    ], [
      { op: "delete_node", op_id: opId("cv4d"), actor: "human:d", base_version: 4, stamp: [4, "human:d"], node_id: 300 },
      { op: "connect", op_id: opId("cv4a"), actor: "human:x", base_version: 5, stamp: [5, "human:x"],
        link_id: 9707, from_node: 300, from_slot: 5, to_node: 700, to_slot: 0, link_type: "IMAGE" },
    ]].map((order) => {
      const doc = mint(convergenceWorkflow, catalog);
      for (const op of order) applyOps(doc, [op as unknown as Op], catalog);
      return JSON.stringify(project(doc, catalog));
    });
    // NOT equal — this is the documented residual, not a passing property.
    expect(projections[0]).not.toEqual(projections[1]);
  });

  it("§2.5 item 5 (destination axis) still diverges — pinning the carve-out", () => {
    const bad = {
      op: "connect", op_id: opId("cv5a"), actor: "human:x", base_version: 5, stamp: [5, "human:x"],
      link_id: 9708, from_node: 300, from_slot: 0, to_node: 700, to_slot: 9, link_type: "IMAGE",
    };
    const del = { op: "delete_node", op_id: opId("cv5d"), actor: "human:d", base_version: 4, stamp: [4, "human:d"], node_id: 700 };
    const add = {
      op: "add_node", op_id: opId("cv5n"), actor: "human:x", base_version: 5, stamp: [5, "human:x"],
      node_id: 903, class_type: "LoadImage", pos: [0, 0],
      node: { id: 903, type: "LoadImage", inputs: [], outputs: [], widgets_values: [], pos: [0, 0] },
    };
    const seed = mint(convergenceWorkflow, catalog);
    const snapshot = Y.encodeStateAsUpdate(seed);
    const projections = [[[bad, add], [del]], [[del], [bad, add]]].map((batches) => {
      const doc = new Y.Doc();
      Y.applyUpdate(doc, snapshot);
      for (const b of batches) applyOps(doc, b as unknown as Op[], catalog);
      return JSON.stringify(project(doc, catalog));
    });
    expect(projections[0]).not.toEqual(projections[1]);
  });

  it("§2.5 item 6 (set_widget) still diverges — pinning the carve-out", () => {
    // §2.5's header promises every carve-out has a test that reddens the day it
    // closes. Items 6 and 7 were enumerated in this PR, so they need theirs.
    // `rejectIfOpaqueWidgets` reads the node, so it sits below `!node return`.
    const opaqueWorkflow: WorkflowJSON = {
      nodes: [
        { id: 300, type: "LoadImage", inputs: [], outputs: [], widgets_values: [] },
        { id: 700, type: "MarkdownNode", inputs: [], outputs: [], widgets_values: ["opaque"] },
      ],
      links: [], groups: [], extra: {}, last_node_id: 700, last_link_id: 0,
    };
    const bad = {
      op: "set_widget", op_id: opId("cv6a"), actor: "human:x", base_version: 5,
      stamp: [5, "human:x"], node_id: 700, widget: "anything", value: 1,
    };
    const del = { op: "delete_node", op_id: opId("cv6d"), actor: "human:d", base_version: 4, stamp: [4, "human:d"], node_id: 700 };
    const add = {
      op: "add_node", op_id: opId("cv6n"), actor: "human:x", base_version: 5, stamp: [5, "human:x"],
      node_id: 950, class_type: "LoadImage", pos: [0, 0],
      node: { id: 950, type: "LoadImage", inputs: [], outputs: [], widgets_values: [], pos: [0, 0] },
    };
    const seed = mint(opaqueWorkflow, catalog);
    const snapshot = Y.encodeStateAsUpdate(seed);
    const projections = [[[bad, add], [del]], [[del], [bad, add]]].map((batches) => {
      const doc = new Y.Doc();
      Y.applyUpdate(doc, snapshot);
      for (const b of batches) applyOps(doc, b as unknown as Op[], catalog);
      return JSON.stringify(project(doc, catalog));
    });
    expect(projections[0]).not.toEqual(projections[1]);
  });

  it("§2.5 item 7 (add_node) now converges under the node-presence stamp gate", () => {
    const bad = {
      op: "add_node", op_id: opId("cv7a"), actor: "human:x", base_version: 5, stamp: [5, "human:x"],
      node_id: 960, class_type: "LoadImage", pos: [0, 0],
      node: { id: 960, type: "LoadImage", inputs: [], outputs: [], widgets_values: ["a", "b", "c", "d", "e", "f"], pos: [0, 0] },
    };
    const rival = {
      op: "add_node", op_id: opId("cv7r"), actor: "human:y", base_version: 4, stamp: [4, "human:y"],
      node_id: 960, class_type: "LoadImage", pos: [1, 1],
      node: { id: 960, type: "LoadImage", inputs: [], outputs: [], widgets_values: [], pos: [1, 1] },
    };
    const tail = {
      op: "add_node", op_id: opId("cv7t"), actor: "human:x", base_version: 5, stamp: [5, "human:x"],
      node_id: 961, class_type: "LoadImage", pos: [0, 0],
      node: { id: 961, type: "LoadImage", inputs: [], outputs: [], widgets_values: [], pos: [0, 0] },
    };
    const seed = mint(convergenceWorkflow, catalog);
    const snapshot = Y.encodeStateAsUpdate(seed);
    const projections = [[[bad, tail], [rival]], [[rival], [bad, tail]]].map((batches) => {
      const doc = new Y.Doc();
      Y.applyUpdate(doc, snapshot);
      for (const b of batches) applyOps(doc, b as unknown as Op[], catalog);
      return JSON.stringify(project(doc, catalog));
    });
    expect(projections[0]).toEqual(projections[1]);
  });

  it("§2.5 item 8 (interior path resolution) still diverges WITHOUT any deletion — pinning the carve-out", () => {
    // The shape no other carve-out covers. Items 4-7 are all framed as a race
    // against a deletion (or, for 7, a rival same-`node_id` add_node).
    // `shared_definition_unforked` needs neither: it flips verdict purely
    // because a concurrent `add_node` raises the definition's instance count,
    // and under §4 abort-remainder the trailing op survives on one replica only.
    // This case is why §2.5 stopped claiming its list was exhaustive and now
    // states the rule instead.
    const subgraphWorkflow = {
      nodes: [
        { id: 9, type: "LoadImage", inputs: [], outputs: [], widgets_values: [] },
        { id: 57, type: "sg1", inputs: [], outputs: [], widgets_values: [] },
      ],
      links: [], groups: [], extra: {}, last_node_id: 57, last_link_id: 0,
      definitions: {
        subgraphs: [{
          id: "sg1",
          nodes: [{ id: 27, type: "LoadImage", inputs: [], outputs: [], widgets_values: ["prev.png"] }],
          links: [],
        }],
      },
    } as unknown as WorkflowJSON;
    const env = (t: string) => ({ op_id: opId(t), actor: "human:x", base_version: 5, stamp: [5, "human:x"] });
    const interiorWrite = { op: "set_widget", ...env("i8w"), node_id: 57, path: ["57", "27"], inner_widget: "image", value: 1 };
    const tail = {
      op: "add_node", ...env("i8t"), node_id: 777, class_type: "LoadImage", pos: [0, 0],
      node: { id: 777, type: "LoadImage", inputs: [], outputs: [], widgets_values: [], pos: [0, 0] },
    };
    // No deletion anywhere — this add_node merely makes sg1 instantiated twice.
    const rival = {
      op: "add_node", ...env("i8r"), node_id: 61, class_type: "sg1", pos: [0, 0],
      node: { id: 61, type: "sg1", inputs: [], outputs: [], widgets_values: [], pos: [0, 0] },
    };
    const seed = mint(subgraphWorkflow, catalog);
    const snapshot = Y.encodeStateAsUpdate(seed);
    const projections = [[[interiorWrite, tail], [rival]], [[rival], [interiorWrite, tail]]].map((batches) => {
      const doc = new Y.Doc();
      Y.applyUpdate(doc, snapshot);
      for (const b of batches) applyOps(doc, b as unknown as Op[], catalog);
      return JSON.stringify(project(doc, catalog));
    });
    expect(projections[0]).not.toEqual(projections[1]);
  });

  it("a from_slot addressing a non-slot-record element is refused, not dereferenced", () => {
    // The STATE-DEPENDENT half's second clause. `from_slot` is in the op-only
    // domain and in range, so only `outs.get(i) instanceof Y.Map` rejects it.
    // Without that clause `outs.get(1)` yields a Y.Array and the handler
    // dereferences it as a slot record — on `main` that surfaced as a generic
    // `apply_failed` AFTER the link tuple had been written.
    const doc = mint(workflow, catalog);
    const outs = (doc.getMap("nodes").get("300") as Y.Map<unknown>).get("outputs") as Y.Array<unknown>;
    doc.transact(() => { outs.push([new Y.Array<unknown>()]); });
    const before = Buffer.from(Y.encodeStateAsUpdate(doc));
    const result = applyOps(doc, [{
      op: "connect", op_id: opId("nonrecord"), actor: "human:z", base_version: 9,
      stamp: [9, "human:z"], link_id: 9700, from_node: 300, from_slot: 1,
      to_node: 700, to_slot: 0, link_type: "IMAGE",
    } as unknown as Op], catalog);
    expect(rejected(result)).toMatchObject({ code: "output_slot_missing" });
    expect(Buffer.from(Y.encodeStateAsUpdate(doc)).equals(before)).toBe(true);
  });

  it("a malformed grow payload is refused even when the source is already deleted", () => {
    // A DISCLOSED semantics change. On `main` this returned `applied` — the
    // `!src` delete-wins return fired before `growInputSlot` ever looked at the
    // payload, so a malformed op was recorded as an applied no-op and consumed
    // its op_id. It is now rejected, because whether an op is well formed must
    // not depend on which replica saw the delete first. No conforming producer
    // emits a non-string `grow.name`; see the PR body's G8 note.
    const doc = mint(workflow, catalog);
    const before = Buffer.from(Y.encodeStateAsUpdate(doc));
    const result = applyOps(doc, [{
      op: "connect", op_id: opId("grow-nosrc"), actor: "human:z", base_version: 9,
      stamp: [9, "human:z"], link_id: 9701, from_node: 424242, from_slot: 0,
      to_node: 700, to_slot: null, link_type: "IMAGE",
      grow: { name: 5 as unknown as string, type: "IMAGE" },
    } as unknown as Op], catalog);
    expect(rejected(result)).toMatchObject({ code: "malformed_op" });
    expect(result.outcomes.filter((outcome) => outcome.outcome !== "rejected")).toHaveLength(0);
    expect(Buffer.from(Y.encodeStateAsUpdate(doc)).equals(before)).toBe(true);
  });

  /**
   * Every OP-ONLY `connect` precondition must reach the same verdict whether or
   * not the DESTINATION has already been deleted. `if (!dst) return` is a
   * delete-wins no-op that CONSUMES the `op_id`, so a check evaluated below it
   * makes a malformed op "applied" on one replica and "rejected" on the other.
   * Under §4 abort-remainder that is a projection divergence, because the
   * rejection also discards the rest of the batch on one side only.
   *
   * The oracle is the DISPOSITION, deliberately: with the destination gone the
   * two orders project identically for a single op, so `project()` cannot see
   * this at all.
   */
  it.each([
    ["non-string grow.inputcount.widget", { to_slot: null, grow: { name: "images.image1", type: "IMAGE", inputcount: { widget: 7, value: 2 } } }],
    ["non-cloneable grow.inputcount.value", { to_slot: null, grow: { name: "images.image1", type: "IMAGE", inputcount: { widget: "inputcount", value: () => 1 } } }],
    ["non-string grow.name", { to_slot: null, grow: { name: 5, type: "IMAGE" } }],
    ["non-number to_slot", { to_slot: "x" }],
    ["negative to_slot", { to_slot: -1 }],
    ["fractional to_slot", { to_slot: 0.5 }],
    ["NaN to_slot", { to_slot: Number.NaN }],
  ])(
    "a %s is refused whether or not the destination is already deleted",
    (_label, over) => {
      const deleteDestination = {
        op: "delete_node", op_id: opId("dd-opon"), actor: "human:d",
        base_version: 4, stamp: [4, "human:d"], node_id: 700,
      } as Op;
      const badOp = {
        op: "connect", op_id: opId("opon"), actor: "human:x", base_version: 5,
        stamp: [5, "human:x"], link_id: 9800, from_node: 300, from_slot: 0,
        to_node: 700, link_type: "IMAGE", ...over,
      } as unknown as Op;

      const seed = mint(convergenceWorkflow, catalog);
      const snapshot = Y.encodeStateAsUpdate(seed);
      const dispositions = [[badOp, deleteDestination], [deleteDestination, badOp]].map((order) => {
        const doc = new Y.Doc();
        Y.applyUpdate(doc, snapshot);
        let code: string | null = null;
        for (const op of order) {
          const result = applyOps(doc, [op], catalog);
          if (op === badOp) code = rejected(result)?.code ?? null;
        }
        return code;
      });
      // Both orders must reach the SAME verdict. The code differs by field —
      // `malformed_op` for shape errors, `input_slot_missing` for the `to_slot`
      // numeric domain — so assert agreement plus "not accepted", rather than
      // hard-coding one code and silently excluding the other family.
      expect(dispositions[0]).toBe(dispositions[1]);
      expect(dispositions[0]).not.toBeNull();
    },
  );

  it("an aborted batch converges whether or not the destination was deleted first", () => {
    // The §4 abort-remainder consequence, end to end: a malformed `connect`
    // followed by a valid `add_node`. If the malformed op were accepted as a
    // delete-wins no-op on one replica, that replica would go on to apply the
    // `add_node` while the other discarded it — a real projection divergence
    // from an op-only defect. This is the case that made the hoist necessary
    // rather than merely tidy.
    const deleteDestination = {
      op: "delete_node", op_id: opId("dd-batch"), actor: "human:d",
      base_version: 4, stamp: [4, "human:d"], node_id: 700,
    } as Op;
    const batch = [
      {
        op: "connect", op_id: opId("b-bad"), actor: "human:x", base_version: 5,
        stamp: [5, "human:x"], link_id: 9801, from_node: 300, from_slot: 0,
        to_node: 700, to_slot: null, link_type: "IMAGE",
        grow: { name: 5 as unknown as string, type: "IMAGE" },
      },
      {
        op: "add_node", op_id: opId("b-add"), actor: "human:x", base_version: 5,
        stamp: [5, "human:x"], node_id: 900, class_type: "LoadImage", pos: [0, 0],
        node: { id: 900, type: "LoadImage", inputs: [], outputs: [], widgets_values: [], pos: [0, 0] },
      },
    ] as unknown as Op[];

    const seed = mint(convergenceWorkflow, catalog);
    const snapshot = Y.encodeStateAsUpdate(seed);
    const projections = [[batch, [deleteDestination]], [[deleteDestination], batch]].map((orderedBatches) => {
      const doc = new Y.Doc();
      Y.applyUpdate(doc, snapshot);
      for (const b of orderedBatches) applyOps(doc, b, catalog);
      return JSON.stringify(project(doc, catalog));
    });
    expect(projections[0]).toEqual(projections[1]);
  });

  it("a non-cloneable set_widget value is refused before the widgets map is created", () => {
    const doc = mint(workflow, catalog);
    const before = Buffer.from(Y.encodeStateAsUpdate(doc));
    const op = {
      op: "set_widget", op_id: opId("uncloneable-sw"), actor: "human:z", base_version: 9,
      stamp: [9, "human:z"], node_id: 700, widget: "inputcount",
      value: (() => undefined) as unknown,
    } as unknown as ConnectOp;
    expect(rejected(applyOps(doc, [op], catalog))).toMatchObject({ code: "malformed_op" });
    expect(Buffer.from(Y.encodeStateAsUpdate(doc)).equals(before)).toBe(true);
  });
});
