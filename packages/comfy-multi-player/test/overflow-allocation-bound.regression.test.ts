/**
 * BE-17528 — the overflow slot's index is attacker-chosen, so the allocation it
 * drives must be bounded.
 *
 * `widgetsToPositional` emits a `widgets_values` array running from 0 through
 * the highest index any stored widget name resolves to, and for a BE-9176
 * overflow placeholder (`_extra_<n>`) that index is read straight out of the
 * NAME. The name arrives in caller-supplied document bytes, not in an op, so
 * `opBoundsRefusal` never sees it and `validateWidgetName` is not on the path:
 * the doc-host's `/project` and `/apply` both accept a `snapshot_b64` and
 * project it. Measured before the bound: a 216-byte snapshot carrying one
 * widget named `_extra_1000000` projected a 1,000,001-element array. The
 * doc-host review that reported it reproduced the same shape end to end at
 * roughly 400-550 bytes, HTTP 200.
 *
 * `cloud`'s `catalogpins.ts` has a 1,024-slot bound, but only two of its three
 * compatibility branches consult it — a class that IS in the request's catalog
 * and whose stored `widget_order` is a prefix of the current one returns before
 * the check. That is why the bound belongs here, under every caller, rather
 * than only under the ones that happen to route through `resolvesIn`.
 *
 * The pair of properties these cases hold together, since a bound that only
 * refuses is half a fix:
 *
 *  - REFUSES, LOUDLY, any index at or past `MAX_OVERFLOW_WIDGETS` — including
 *    on the dynamic-combo path, whose shadowing branch would otherwise answer
 *    an unresolvable overflow name with a silent skip.
 *  - REFUSES NOTHING this package can mint. `MAX_OVERFLOW_WIDGETS` equals
 *    `MAX_COLLECTION_ENTRIES`, so the widest `widgets_values` an op may carry
 *    still round-trips, and mint and projection refuse exactly the same set.
 *  - DOES NOT MOVE. The bound is absolute, not `order.length + N`, so no
 *    document write can turn a stored, projectable slot into a refused one.
 *    This is a review finding against the first version of the guard and it
 *    was reachable: see the selection-invariance case below.
 *
 * Invariants: KA-4 (the refusal is a pure function of the stored name alone, so
 * replicas converge on it in any arrival order, and no op can change a verdict
 * already reached) and KA-12 (the overflow region exists only because the
 * pinned catalog is an upper rather than exact bound on a class's layout).
 */
import * as Y from "yjs";
import { describe, expect, it } from "vitest";

import {
  MAX_COLLECTION_ENTRIES,
  MAX_OVERFLOW_WIDGETS,
  applyOps,
  mint,
  nodesMap,
  project,
  type AddNodeOp,
  type SetWidgetOp,
  type WidgetCatalog,
  type WorkflowJSON,
} from "../src/index.js";
// Not re-exported from the public surface on purpose (A24: no consumer builds a
// second interpretation of a stored identity), so the test reaches the module.
import { widgetStorageKey } from "../src/widget-identity.js";

const ORDER = ["seed", "steps"];

const catalog: WidgetCatalog = { types: { KSampler: { widget_order: ORDER } } };

/** A dynamic-combo class: `widgetsToPositional`'s shadowing branch is live here. */
const dynCatalog: WidgetCatalog = {
  types: {
    Dyn: {
      widget_order: ["mode"],
      dynamic_combos: {
        mode: { default: null, options: { a: { widgets: ["mode.detail"], defaults: { "mode.detail": 41 } } } },
      },
    },
  },
};

const workflow = (type: string, wv: unknown): WorkflowJSON =>
  ({ nodes: [{ id: 1, type, widgets_values: wv }], links: [] }) as unknown as WorkflowJSON;

/** The BE-17528 entry path: doc bytes a caller hands to `/project`, not an op. */
function docCarryingWidget(name: string, value: unknown, type = "KSampler", cat = catalog): Y.Doc {
  const doc = mint(workflow(type, type === "Dyn" ? ["a"] : [123, 20]), cat);
  const widgets = nodesMap(doc).get("1")!.get("widgets") as Y.Map<unknown>;
  widgets.set(name, value);
  return doc;
}

const projected = (doc: Y.Doc, cat = catalog): unknown[] =>
  project(doc, cat).nodes[0]!.widgets_values as unknown[];

const REJECTED_OP_ID = "e".repeat(32);
const TRAILING_OP_ID = "f".repeat(32);

function setWidget(opId: string, widget: string, value: unknown): SetWidgetOp {
  return {
    op: "set_widget",
    op_id: opId,
    actor: "agent:a",
    base_version: 1,
    stamp: [1, "agent:a"],
    node_id: 1,
    widget,
    value,
  };
}

/**
 * A rejected op left NO trace, asserted the way `.agents/checks/test-quality.md`
 * requires rather than by `project()`: byte identity of the encoded state plus
 * the `op_id`'s absence from `__applied`, because `project()` renders neither
 * `__stamps` nor `__applied` and so cannot see a rejection that already claimed
 * a register (KA-4). A trailing valid op checks §4 abort-remainder.
 */
function expectRejectedWithoutTrace(doc: Y.Doc, op: AddNodeOp | SetWidgetOp): void {
  const before = Y.encodeStateAsUpdate(doc);
  const trailing = setWidget(TRAILING_OP_ID, "steps", 99);
  const outcomes = applyOps(doc, [op, trailing], catalog).outcomes.map((o) => o.outcome);
  expect(outcomes[0]).toBe("rejected");
  // Abort-remainder: the valid op behind a rejected one must not apply.
  expect(outcomes[1]).not.toBe("applied");
  expect(Y.encodeStateAsUpdate(doc)).toEqual(before);
  const applied = doc.getMap("__applied");
  expect(applied.has(op.op_id)).toBe(false);
  expect(applied.has(TRAILING_OP_ID)).toBe(false);
}

describe("BE-17528: the overflow allocation is bounded", () => {
  it("refuses the reported 1,000,000-slot projection instead of allocating it", () => {
    const doc = docCarryingWidget("_extra_1000000", "boom");
    // Small enough that no transport or body-size limit is in play: the whole
    // document is the attack payload.
    expect(Y.encodeStateAsUpdate(doc).byteLength).toBeLessThan(1024);
    expect(() => projected(doc)).toThrow(/_extra_1000000.*index 1000000.*BE-17528/s);
  });

  it("names the bound it was measured against", () => {
    expect(() => projected(docCarryingWidget("_extra_1000000", "boom"))).toThrow(
      new RegExp(`${String(MAX_OVERFLOW_WIDGETS)}-slot overflow bound`),
    );
  });

  it("accepts the LAST in-bound index and refuses the FIRST out-of-bound one", () => {
    const last = MAX_OVERFLOW_WIDGETS - 1;
    const values = projected(docCarryingWidget(`_extra_${String(last)}`, "edge"));
    expect(values).toHaveLength(last + 1);
    expect(values[last]).toBe("edge");

    expect(() => projected(docCarryingWidget(`_extra_${String(MAX_OVERFLOW_WIDGETS)}`, "edge")))
      .toThrow(/at or past the/);
  });

  it("does not move when a dynamic-combo selection changes the order length", () => {
    // Review finding against the first version of this guard, and it was
    // reachable, not theoretical. The bound was `order.length +
    // MAX_OVERFLOW_WIDGETS`, measured against the node's EXPANDED order. Under
    // selector `"a"` that order is two names, so `_extra_<MAX + 1>` minted
    // in-bound and projected. One ordinary, APPLIED `set_widget` deselecting
    // the option shrank the order to one name, dropped the bound by one, and
    // left the document permanently unprojectable — the exact mint-then-refuse
    // failure the two-leg design exists to prevent, caused by the guard itself.
    //
    // An absolute bound cannot be moved by any write, which is why
    // `overflowBoundRefusal` takes no order. The two halves below are the
    // discriminating pair, and they have to be a pair: the relative and
    // absolute bounds admit DIFFERENT sets of documents, so no single index
    // shows both "relative breaks" and "absolute works".
    const selectedOrderLength = 2; // `["mode", "mode.detail"]` under selector "a"
    const widen = (n: number): unknown[] => {
      const wv: unknown[] = ["a"];
      for (let i = 1; i <= n; i++) wv.push(i);
      return wv;
    };

    // (a) The bound does not WIDEN with the expanded order. This document is
    // exactly what a `order.length + MAX_OVERFLOW_WIDGETS` bound would admit
    // here and is the one the shrink then strands, so it must not mint at all.
    const relativeTop = selectedOrderLength + MAX_OVERFLOW_WIDGETS - 1;
    expect(() => mint(workflow("Dyn", widen(relativeTop)), dynCatalog)).toThrow(/BE-17528/);

    // (b) Everything the bound DOES admit survives a selection change. The
    // widest such document, then one applied selector write that shrinks the
    // order by a name: still projectable, same length, value intact.
    const top = MAX_OVERFLOW_WIDGETS - 1;
    const doc = mint(workflow("Dyn", widen(top)), dynCatalog);
    expect(projected(doc, dynCatalog)).toHaveLength(top + 1);

    const deselect = applyOps(doc, [setWidget(TRAILING_OP_ID, "mode", "no-such-option")], dynCatalog);
    expect(deselect.outcomes.map((o) => o.outcome)).toEqual(["applied"]);
    const after = projected(doc, dynCatalog);
    expect(after).toHaveLength(top + 1);
    expect(after[top]).toBe(top);
  });

  it("THROWS on the dynamic-combo path rather than silently shadowing the value", () => {
    // The adversarial case against the obvious implementation. Bounding
    // `positionalIndexOf` instead would return -1 here, and the shadowing
    // branch — which exists for a slot whose position the current selection
    // reassigned — would swallow it: the projection succeeds, the corrupt name
    // stays in the document, and nothing ever reports it.
    const doc = docCarryingWidget("_extra_1000000", "boom", "Dyn", dynCatalog);
    let threw = false;
    try {
      projected(doc, dynCatalog);
    } catch (err) {
      threw = true;
      expect(String(err)).toMatch(/BE-17528/);
    }
    expect(threw, "a beyond-bound overflow name must not be silently skipped").toBe(true);
    // And the legitimate shadowing behaviour is untouched: `_extra_1` is inside
    // the bound, and the expanded order gives position 1 to `mode.detail`.
    expect(projected(docCarryingWidget("_extra_1", 9, "Dyn", dynCatalog), dynCatalog)).toEqual(["a", 41]);
  });

  it("refuses nothing an op may carry: the widest legal widgets_values round-trips", () => {
    // The reason MAX_OVERFLOW_WIDGETS equals MAX_COLLECTION_ENTRIES. An array
    // of exactly the op-payload cap names `_extra_<cap - 1>`, which must remain
    // projectable — otherwise the fix trades a DoS for a document that mints
    // and is then permanently unprojectable.
    const wide = Array.from({ length: MAX_COLLECTION_ENTRIES }, (_v, i) => i);
    const doc = mint(workflow("KSampler", wide), catalog);
    const widgets = doc.getMap("nodes").get("1") as Y.Map<unknown>;
    expect((widgets.get("widgets") as Y.Map<unknown>).has(`_extra_${String(MAX_COLLECTION_ENTRIES - 1)}`)).toBe(true);
    expect(projected(doc)).toEqual(wide);
  });

  it("is exactly tight at an EMPTY widget_order, where the equality is load-bearing", () => {
    // What makes `MAX_OVERFLOW_WIDGETS === MAX_COLLECTION_ENTRIES` an equality
    // rather than a round number: with no real names in front of them, the
    // op-payload cap's worth of values occupies `_extra_0` through
    // `_extra_<cap - 1>`, so the last one sits on the boundary exactly.
    // `widget_order: []` is PRESENT but empty, which `isOpaqueWidgets`
    // deliberately routes down the named path, not the opaque one.
    const empty: WidgetCatalog = { types: { Bare: { widget_order: [] } } };
    const wide = Array.from({ length: MAX_COLLECTION_ENTRIES }, (_v, i) => i);
    const doc = mint(workflow("Bare", wide), empty);
    expect(projected(doc, empty)).toEqual(wide);
    // And one entry more — which no op payload can carry — is refused.
    expect(() => mint(workflow("Bare", [...wide, 1]), empty)).toThrow(/BE-17528/);
  });

  it("refuses the same overrun at MINT, so the two legs cannot disagree", () => {
    const tooWide = Array.from({ length: MAX_OVERFLOW_WIDGETS + 1 }, (_v, i) => i);
    expect(() => mint(workflow("KSampler", tooWide), catalog)).toThrow(/BE-17528/);
    // One shorter is accepted on both legs.
    const widest = tooWide.slice(0, -1);
    expect(projected(mint(workflow("KSampler", widest), catalog))).toEqual(widest);
  });

  it("refuses a beyond-bound placeholder KEY on a name-keyed MINT, which runs no op validation", () => {
    // The second mint shape, and the one with no other guard in front of it: a
    // name-keyed `widgets_values` record is stored key-for-key without being
    // decomposed against `widget_order`, and `mint()` does not run the
    // `rejectUnprojectableWidgets` check the two op paths do.
    expect(() => mint(workflow("KSampler", { _extra_1000000: "boom" }), catalog)).toThrow(/BE-17528/);
    // The in-bound placeholder on the same shape still mints and projects.
    const ok = mint(workflow("KSampler", { seed: 1, steps: 2, _extra_2: 3 }), catalog);
    expect(projected(ok)).toEqual([1, 2, 3]);
  });

  it("refuses it under the A24 OCCURRENCE-ENCODED spelling of the same key", () => {
    // The name-keyed record is stored key-for-key, and `k` is caller JSON, so a
    // caller can hand over either spelling of the same identity. Checking the
    // raw key — which the first version of this guard did — refused only the
    // plain one: the encoded key failed the placeholder regex, MINTED, and the
    // document was then permanently unprojectable at the projection leg, which
    // decodes. That is the mint-then-refuse failure the two-leg design exists to
    // prevent, so the two legs must agree on the SPELLING as well as the bound.
    // Both spellings a caller can get here: the canonical encoding of a second
    // occurrence, and the NON-canonical occurrence-0 encoding that
    // `widgetStorageKey` never emits (it returns the bare name there) but that
    // `widgetIdentityFromStorageKey` decodes and a caller's JSON can carry
    // verbatim. The prefix is derived from the encoder rather than re-spelled,
    // so this case cannot drift from the real key format.
    const prefix = widgetStorageKey("x", 1).slice(0, -JSON.stringify(["x", 1]).length);
    const encodedKeys = [
      widgetStorageKey("_extra_1000000", 1),
      `${prefix}${JSON.stringify(["_extra_1000000", 0])}`,
    ];
    for (const encoded of encodedKeys) {
      // Precondition: the encoded key really is a different string from the
      // name, or this case would silently re-test the one above.
      expect(encoded).not.toBe("_extra_1000000");
      expect(() => mint(workflow("KSampler", { [encoded]: "boom" }), catalog)).toThrow(
        /_extra_1000000.*index 1000000.*BE-17528/s,
      );
    }
    // An in-bound occurrence-encoded placeholder is NOT refused: the bound is
    // the only thing this spelling changes.
    const inBound = widgetStorageKey("_extra_2", 1);
    expect(() => mint(workflow("KSampler", { seed: 1, steps: 2, [inBound]: 3 }), catalog)).not.toThrow();
    // And a real duplicate-named widget, whose encoded key carries no overflow
    // index at all, is untouched.
    expect(() => mint(workflow("KSampler", { [widgetStorageKey("seed", 1)]: 7 }), catalog)).not.toThrow();
  });

  it("refuses a beyond-bound placeholder KEY in a name-keyed add_node payload", () => {
    // `rejectUnprojectableWidgets` already refuses this as `unknown_widget`;
    // the case is here so the two refusals cannot drift apart silently.
    const doc = mint(workflow("KSampler", [1, 2]), catalog);
    const op: AddNodeOp = {
      op: "add_node",
      op_id: REJECTED_OP_ID,
      actor: "agent:a",
      base_version: 1,
      stamp: [1, "agent:a"],
      node_id: 2,
      node: { id: 2, type: "KSampler", widgets_values: { _extra_1000000: "boom" } },
    } as unknown as AddNodeOp;
    expectRejectedWithoutTrace(doc, op);
    expect(projected(doc)).toEqual([1, 2]);
  });

  it("refuses a beyond-bound set_widget, with and without a catalog", () => {
    const doc = mint(workflow("KSampler", [1, 2]), catalog);
    expectRejectedWithoutTrace(doc, setWidget(REJECTED_OP_ID, "_extra_1000000", "boom"));
    expect(projected(doc)).toEqual([1, 2]);

    // No catalog skips `validateWidgetName` by design, which is how this name
    // reaches storage in the first place. The write still lands, so the bound
    // at projection is the backstop, not this.
    const blind = mint(workflow("KSampler", [1, 2]), catalog);
    applyOps(blind, [setWidget(REJECTED_OP_ID, "_extra_1000000", "boom")], undefined);
    expect(() => projected(blind)).toThrow(/BE-17528/);
  });

  it("leaves non-overflow and malformed-overflow names exactly as they were", () => {
    // `_extra_01` is not the placeholder shape (leading zero), so it is an
    // ordinary unknown name and keeps its pre-existing refusal.
    expect(() => projected(docCarryingWidget("_extra_01", "x"))).toThrow(/is not in widget_order/);
    expect(() => projected(docCarryingWidget("_extra_", "x"))).toThrow(/is not in widget_order/);
    expect(() => projected(docCarryingWidget("totally_unknown", "x"))).toThrow(/is not in widget_order/);
    // And an ordinary node is unaffected.
    expect(projected(mint(workflow("KSampler", [123, 20]), catalog))).toEqual([123, 20]);
  });

  it("holds inside a subgraph definition, not only at the top level", () => {
    const doc = mint(
      {
        nodes: [{ id: 1, type: "KSampler", widgets_values: [1, 2] }],
        links: [],
        definitions: {
          subgraphs: [
            { id: "sg", name: "sg", nodes: [{ id: 5, type: "KSampler", widgets_values: [3, 4] }], links: [] },
          ],
        },
      } as unknown as WorkflowJSON,
      catalog,
    );
    const defs = doc.getMap("definitions").get("sg") as Y.Map<unknown>;
    const inner = (defs.get("nodes") as Y.Map<unknown>).get("5") as Y.Map<unknown>;
    (inner.get("widgets") as Y.Map<unknown>).set("_extra_1000000", "boom");
    expect(() => project(doc, catalog)).toThrow(/BE-17528/);
  });
});
