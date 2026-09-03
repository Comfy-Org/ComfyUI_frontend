/**
 * Schema §11 — the bounded-writes ceiling is a LIVE gate, and the accounting
 * under it is pinned.
 *
 * `test/applier.test.ts` "bounded writes (schema §11)" compares
 * `_getMutationCount()` against a ceiling for every op in the fixture corpus.
 * PR #58 found that `mutations++` in `apush`/`mdel`/`adel` could be
 * flipped to `mutations--` with the suite green, and pinned the
 * DIRECTION of each helper in `test/doc-mint-mutation-survivors.test.ts`.
 *
 * Direction is necessary and not sufficient. A stated bound is only a bound if
 * some reachable input can violate it and if the number being compared tracks
 * the work actually done. Two things were still unheld:
 *
 *  1. **That the gate can fire at all.** Re-measured through the gate's own
 *     harness at this commit, the corpus's worst non-`clear` op is 8 (a
 *     `connect` in `session-edit-heavy`) against a ceiling of 12 — so every
 *     green run is green with headroom, and nothing demonstrated that any
 *     input pushes the count past a fixed ceiling. (7 is schema §11's spike
 *     figure and the number `test/applier.test.ts` quotes; this counter is one
 *     higher per op because it also charges the §4 `__applied` set.) The tests
 *     below show the count grows without limit in the size of the op's blast
 *     radius — `delete_node` costs `2·degree + 2` Y-writes — so a fixed ceiling K
 *     is exceeded at degree > K/2, for every K this gate could plausibly take.
 *     (Not literally EVERY K: issue #14's payload bounds, in flight, cap
 *     `removed_links` at a maximum collection size, which caps the cost at
 *     `2·MAX + 2`. The argument survives — that cap is orders of magnitude above
 *     any ceiling `test/applier.test.ts` would set — but read "any fixed
 *     ceiling" as "any ceiling in the range this gate uses".) That is a proof
 *     rather than a second copy of
 *     the constant, which is why no ceiling value appears here: the ceiling
 *     lives in `test/applier.test.ts` and is deliberately NOT touched by this
 *     file, which several open PRs also edit.
 *
 *     Scope, because §11's own table calls `delete_node` bounded ("writes
 *     bounded by the node's degree") and names only `clear` as unbounded: a
 *     high-degree delete tripping `LIMIT` would be the ceiling firing on a
 *     legal op, not on a §11 violation. What is proven here is that the
 *     quantity is caller-controlled and unbounded, which is what makes
 *     `toBeLessThanOrEqual(LIMIT)` an assertion rather than a formality. Whether
 *     `LIMIT` should be degree-relative belongs to whoever owns that file.
 *
 *  2. **That the count is the applier's real write count.** If a future
 *     refactor wrote through raw `m.set(…)` instead of `mset(…)`, the count
 *     would fall, the ceiling would still pass, and the gate would be measuring
 *     nothing. `set_widget` has an exact, schema-stated cost (§1.2: one widget
 *     `set` plus one `__stamps` set; §4: one `__applied` set) and is pinned to
 *     it here, so a bypassed or an extra write both show up as a number. A
 *     `connect` and a stranding `delete_node` are pinned alongside it because
 *     they are the only paths that reach `apush` and `adel`, which the
 *     degree-scaling fixture never touches.
 *
 * These are deliberately expressed as EXACT counts and as growth, not as
 * `toBeGreaterThan(0)`: an op-count assertion that only checks non-zero passes
 * for any implementation that writes at least once — a surface too coarse to
 * express the property.
 *
 * The perturb/red/restore transcript behind the claims above is kept OUTSIDE
 * this repository, in the in-app-agent workspace, so it is not citable from
 * here; each `it` names the invariant and the behaviour it pins so the claim
 * can be re-derived from this tree alone.
 */
import { describe, expect, it } from "vitest";
import {
  applyOps,
  mint,
  type ConnectOp,
  type DeleteNodeOp,
  type SetWidgetOp,
  type WidgetCatalog,
  type WorkflowJSON,
} from "../src/index.js";
import { _getMutationCount, _resetMutationCount, stampsMap } from "../src/doc.js";

const catalog: WidgetCatalog = { types: { Hub: { widget_order: ["text"] }, Peer: { widget_order: [] } } };

let seq = 0;
const env = () => {
  const op_id = ("b" + String(seq++).padStart(4, "0")).padEnd(32, "0");
  return { op_id, actor: "a", base_version: 1, stamp: [1, "a"] as [number, string] };
};

/**
 * Node 1 ("the hub") fans out to `degree` peers over `degree` links. Deleting
 * the hub costs one `mdel` for the node, one per severed link, and one `mset`
 * per peer input slot whose `link` is scrubbed to null — so the write count is
 * a function of the hub's DEGREE, which is caller-controlled and unbounded.
 */
function hubWorkflow(degree: number): WorkflowJSON {
  const nodes: unknown[] = [
    {
      id: 1,
      type: "Hub",
      inputs: [],
      outputs: [{ name: "out", type: "X", links: Array.from({ length: degree }, (_, i) => i + 1) }],
      widgets_values: ["t"],
    },
  ];
  const links: unknown[] = [];
  for (let i = 1; i <= degree; i++) {
    nodes.push({ id: i + 1, type: "Peer", inputs: [{ name: "in", type: "X", link: i }], outputs: [] });
    links.push([i, 1, 0, i + 1, 0, "X"]);
  }
  return { nodes, links } as unknown as WorkflowJSON;
}

/** 1 → 2 → 3, every port wired, so a delete of node 2 strands references on BOTH sides. */
function chainWorkflow(): WorkflowJSON {
  return {
    nodes: [
      { id: 1, type: "Peer", inputs: [], outputs: [{ name: "o", type: "X", links: [1] }] },
      {
        id: 2,
        type: "Peer",
        inputs: [{ name: "i", type: "X", link: 1 }],
        outputs: [{ name: "o", type: "X", links: [2] }],
      },
      { id: 3, type: "Peer", inputs: [{ name: "i", type: "X", link: 2 }], outputs: [{ name: "o", type: "X", links: [] }] },
    ],
    links: [
      [1, 1, 0, 2, 0, "X"],
      [2, 2, 0, 3, 0, "X"],
    ],
  } as unknown as WorkflowJSON;
}

/** Y-writes performed by deleting the hub of a `degree`-wide fan-out. */
function deleteHubCost(degree: number): number {
  const doc = mint(hubWorkflow(degree), catalog);
  const op: DeleteNodeOp = {
    op: "delete_node",
    ...env(),
    node_id: 1,
    removed_links: Array.from({ length: degree }, (_, i) => i + 1),
  };
  _resetMutationCount(doc);
  const res = applyOps(doc, [op], catalog);
  expect(res.outcomes.some((o) => o.outcome === "rejected"), `delete_node at degree ${degree} must succeed`).toBe(false);
  return _getMutationCount(doc);
}

describe("schema §11: the bounded-writes count grows with the op's blast radius", () => {
  it("is strictly increasing in the deleted node's degree", () => {
    // Varying cardinality is the point. A single-degree fixture would report
    // one number that any monotone-or-not implementation reproduces; the
    // sequence is what makes the assertion sensitive to the ACCOUNTING and not
    // just to the fact that something was counted.
    const degrees = [1, 2, 4, 16, 32];
    const costs = degrees.map(deleteHubCost);
    for (let i = 1; i < costs.length; i++) {
      expect(costs[i]!, `degree ${degrees[i]} must cost more than degree ${degrees[i - 1]}`).toBeGreaterThan(
        costs[i - 1]!,
      );
    }
    // The exact law, so a change to the write pattern is a visible diff rather
    // than a still-passing inequality: one node delete, one delete per severed
    // link, one retirement row and one scrub per peer input slot, and one
    // node-presence stamp.
    expect(costs).toEqual(degrees.map((d) => 3 * d + 3));
  });

  it("exceeds any ceiling in this gate's range at a large enough degree, so the §11 gate can fire", () => {
    // The gate in `test/applier.test.ts` asserts `count <= LIMIT` for a fixed
    // LIMIT. This does not restate LIMIT — it shows the quantity is unbounded,
    // which is what makes that assertion a bound rather than a formality.
    const small = deleteHubCost(2);
    const large = deleteHubCost(64);
    expect(large).toBeGreaterThan(small * 10);
    expect(large).toBeGreaterThan(64);
  });
});

describe("schema §11: the counter measures the applier's real writes", () => {
  it("charges a top-level set_widget exactly three Y-writes (§1.2 widget + §4 stamp + §4 applied)", () => {
    // Schema §1.2: "A set_widget apply is one map `set` (plus one `__stamps`
    // set)". §4 adds the `__applied` idempotency set. Anything that writes
    // through raw Y instead of `mset` would drop below three; anything that
    // writes more would rise above it. Both are the gate losing its meaning.
    const doc = mint(hubWorkflow(1), catalog);
    const op = { op: "set_widget", ...env(), node_id: 1, widget: "text", value: "z" } as SetWidgetOp;
    _resetMutationCount(doc);
    expect(applyOps(doc, [op], catalog).outcomes.some((o) => o.outcome === "rejected")).toBe(false);
    expect(_getMutationCount(doc)).toBe(3);
  });

  it("accumulates across ops without a reset, and never runs backwards", () => {
    // The aggregate view of the direction pin: with `mutations--` anywhere on
    // this path the running total falls instead of stepping up by three.
    const doc = mint(hubWorkflow(1), catalog);
    _resetMutationCount(doc);
    const running: number[] = [];
    for (let i = 0; i < 4; i++) {
      const op = { op: "set_widget", ...env(), node_id: 1, widget: "text", value: "v" + String(i) } as SetWidgetOp;
      expect(applyOps(doc, [op], catalog).outcomes.some((o) => o.outcome === "rejected")).toBe(false);
      running.push(_getMutationCount(doc));
    }
    expect(running).toEqual([3, 6, 9, 12]);
  });

  it("charges an autogrow connect exactly nine, including durable link intent and canonicalization ledger rows", () => {
    // Reaches both `apush` sites, which `deleteHubCost` never does: wiring the
    // link id into the source output port's list, and appending the grown input
    // slot itself. Itemized precisely because this is an exact-accounting test:
    // `to_slot: null` + `grow` takes the AUTOGROW branch, which schema §3 marks
    // "identity only" and Amendment A1 leaves UNGATED. Amendment A7 adds two
    // ledger rows used to canonicalize concurrent grows; neither is an LWW
    // gate that can discard a grow.
    const doc = mint(chainWorkflow(), catalog);
    const op = {
      op: "connect",
      ...env(),
      link_id: 9,
      from_node: 3,
      from_slot: 0,
      to_node: 1,
      to_slot: null,
      link_type: "X",
      grow: { name: "gin", type: "X" },
    } as unknown as ConnectOp;
    _resetMutationCount(doc);
    expect(applyOps(doc, [op], catalog).outcomes.some((o) => o.outcome === "rejected")).toBe(false);
    expect(_getMutationCount(doc)).toBe(9);
    expect(stampsMap(doc).size, "two minted intents plus autogrow link ownership, stamp, and request (A7/A18/A19)").toBe(5);
  });

  it("charges the array delete when a delete strands an output link", () => {
    // Reaches `adel`, the applier's only array REMOVE: deleting the middle of
    // 1 → 2 → 3 leaves node 1's output `links` array holding a dead link id,
    // which the dangling scrub removes in place. One node delete, two link
    // deletes, one array delete, one input-slot scrub, two retirement rows,
    // one presence stamp, one applied set.
    const doc = mint(chainWorkflow(), catalog);
    const op: DeleteNodeOp = { op: "delete_node", ...env(), node_id: 2, removed_links: [1, 2] };
    _resetMutationCount(doc);
    expect(applyOps(doc, [op], catalog).outcomes.some((o) => o.outcome === "rejected")).toBe(false);
    expect(_getMutationCount(doc)).toBe(9);
  });

  it("charges a de-duplicated replay nothing, so the ceiling is not padded by idempotent retries (KA-4)", () => {
    // §4: a second delivery of the same op_id is skipped. It must therefore
    // cost zero Y-writes — if a skipped op still wrote, the ceiling would be
    // absorbing work that the idempotency gate is supposed to have removed.
    const doc = mint(hubWorkflow(1), catalog);
    const op = { op: "set_widget", ...env(), node_id: 1, widget: "text", value: "z" } as SetWidgetOp;
    const first = applyOps(doc, [op], catalog);
    expect(first.outcomes.some((o) => o.outcome === "rejected")).toBe(false);
    expect(first.outcomes.filter((o) => o.outcome === "applied").map((o) => o.op_id)).toEqual([op.op_id]);
    _resetMutationCount(doc);
    const replay = applyOps(doc, [op], catalog);
    expect(replay.outcomes.some((o) => o.outcome === "rejected")).toBe(false);
    // `failed === null` plus a zero count is ALSO satisfied by an applier that
    // does nothing for every op, so the reason must be asserted too: this op
    // was recognized as a duplicate and skipped, not quietly ignored.
    expect(replay.outcomes.filter((o) => o.outcome === "no-op").map((o) => o.op_id)).toEqual([op.op_id]);
    expect(replay.outcomes.filter((o) => o.outcome === "applied").map((o) => o.op_id)).toEqual([]);
    expect(_getMutationCount(doc)).toBe(0);
  });
});
