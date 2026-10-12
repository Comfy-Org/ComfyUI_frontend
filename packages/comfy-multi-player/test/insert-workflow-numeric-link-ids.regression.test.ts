/**
 * `insert_workflow` numeric link ids (ADR-033, amended).
 *
 * ComfyUI_frontend's `LinkId` is `number & { __brand: 'LinkId' }`, unlike the
 * string-or-number `NodeId`, so `remap.ts`'s usual string `derivedId`
 * (`insert:<opId>:<scope>:link:<original>`) cannot satisfy it. The interim
 * frontend fix (ComfyUI_frontend#18458, `ecsFollowerAdapter.ts`'s
 * `resolveLinkId`) hashed that string into a 32-bit number and was found by
 * two reviewers to be genuinely broken, not merely approximate: two
 * independent derived ids collided at a measured ~0.01-1% rate at realistic
 * link counts, AND the resolved id is what `graph.serialize()` persists, so
 * a "reserved range" chosen above `last_link_id` does not survive a
 * save/reload — the saved file now contains a genuine numeric link id
 * inside that range.
 *
 * The FIRST revision of this PR fixed that by minting a 52-bit candidate and
 * retrying past any collision with a numeric link id already persisted in
 * the target document. Christian Byrne's review (PR #245, inline on
 * `src/remap.ts:65`) found that design itself broken in a different way:
 * checking the mint against document state made link identity depend on
 * LOCAL ARRIVAL ORDER. If two link seeds shared the same first candidate,
 * applying them A-then-B minted A the natural candidate and B the next one
 * in the retry sequence, while applying B-then-A minted B the natural
 * candidate and A the next one — two replicas that apply the same op set in
 * different orders could project genuinely different link ids for the same
 * logical links.
 *
 * `remap.ts`'s `derivedLinkId` now mints PURELY from the op's own content —
 * `opId`, `scope`, and the raw link — spending the full safe-integer range
 * (53 bits, `[1, Number.MAX_SAFE_INTEGER]`) so a genuine collision is an
 * accepted, quantified residual risk rather than something the mint tries to
 * avoid by reading state. See
 * `docs/decisions/ADR-033-insert-workflow-numeric-link-ids.md` and the KA-5
 * row in `docs/decisions/EXCEPTIONS.md`.
 *
 * `test/insert-workflow.test.ts`'s "numeric link id minting (ADR-033, pure
 * derivation)" block covers the single-op determinism and realized-collision
 * cases directly against `occupiedIdVectors`' existing node/definition
 * siblings. This file covers the harder cross-cutting properties: multiple
 * `insert_workflow` ops in one session (sequential and same-batch), scale
 * within one op, the project → mint round trip, comfy-multi-player#230's
 * definition-interior promoted-linkIds threading with the new numeric ids,
 * and — the regression this whole amendment exists for — opposite-order
 * convergence across two independently seeded replicas.
 */
import { describe, expect, it } from "vitest";
import * as Y from "yjs";

import { applyOps, mint, project, type Op, type WidgetCatalog, type WorkflowJSON } from "../src/index.js";
import { appliedMap } from "../src/doc.js";

const catalog: WidgetCatalog = {
  types: {
    Src: { widget_order: [] },
    Sink: { widget_order: [] },
    Def: { widget_order: [] },
  },
};

let seq = 0;
function opEnvelope(overrides: Partial<Op> = {}): Op {
  const op_id = ("n" + String(seq++).padStart(4, "0")).padEnd(32, "0");
  return { op: "insert_workflow", op_id, actor: "a", base_version: 1, stamp: [1, "a"], ...overrides } as unknown as Op;
}

/** All top-level projected link tuples, typed loosely for id/label access. */
function links(wf: WorkflowJSON): Array<[unknown, unknown, unknown, unknown, unknown, unknown]> {
  return (wf.links ?? []) as never;
}

function linkNamed(wf: WorkflowJSON, label: unknown): [unknown, unknown, unknown, unknown, unknown, unknown] {
  const found = links(wf).find((link) => link[5] === label);
  if (!found) throw new Error(`no projected link labeled ${String(label)}`);
  return found;
}

describe("insert_workflow numeric link ids (ADR-033, pure derivation)", () => {
  it("mints a real number for a top-level link while node ids stay derived strings", () => {
    const doc = mint({ nodes: [], links: [] }, catalog);
    const op = opEnvelope({ workflow: { nodes: [{ id: 1, type: "Src" }, { id: 2, type: "Sink" }], links: [[10, 1, 0, 2, 0, "L"]] } });

    expect(applyOps(doc, [op], catalog).outcomes[0]).toMatchObject({ outcome: "applied" });
    const wf = project(doc, catalog);
    expect(typeof linkNamed(wf, "L")[0]).toBe("number");
    for (const node of wf.nodes!) expect(typeof node.id).toBe("string");
  });

  it("two independent insert_workflow ops with distinct op_ids derive independent link ids", () => {
    // Distinct `op_id`s feed distinct hash seeds (`derivedId` folds `opId`
    // into the seed), so two independently authored ops naturally land on
    // different 53-bit candidates — not because either mint avoids the
    // other (it reads no document state at all), but because the space is
    // wide enough that an accidental collision between UNRELATED ops is the
    // same order of unlikely as a UUID4 `op_id` collision (KA-2).
    const doc = mint({ nodes: [], links: [] }, catalog);
    const opA = opEnvelope({
      workflow: {
        nodes: [{ id: 101, type: "Src" }, { id: 102, type: "Sink" }],
        links: [[201, 101, 0, 102, 0, "op-a-link"]],
      },
    });
    const opB = opEnvelope({
      workflow: {
        nodes: [{ id: 103, type: "Src" }, { id: 104, type: "Sink" }],
        links: [[201, 103, 0, 104, 0, "op-b-link"]],
      },
    });

    expect(applyOps(doc, [opA], catalog).outcomes[0]).toMatchObject({ outcome: "applied" });
    expect(applyOps(doc, [opB], catalog).outcomes[0]).toMatchObject({ outcome: "applied" });

    const wf = project(doc, catalog);
    expect(wf.nodes).toHaveLength(4);
    const linkA = linkNamed(wf, "op-a-link");
    const linkB = linkNamed(wf, "op-b-link");
    expect(linkA[0]).not.toBe(linkB[0]);
    // Op A's wire must not have been replaced by op B's: both endpoints
    // resolve to their OWN op's nodes.
    const nodeIds = new Set(wf.nodes!.map((n) => n.id));
    expect(nodeIds.has(linkA[1] as string)).toBe(true);
    expect(nodeIds.has(linkB[1] as string)).toBe(true);
  });

  it("two insert_workflow ops delivered in the SAME batch still derive independent link ids", () => {
    // Delivered as ONE `applyOps` batch rather than two sequential calls.
    // Neither op's mint threads any state from the other — each derives its
    // link id purely from its own (opId, scope, original) — so batching
    // changes nothing about the result.
    const doc = mint({ nodes: [], links: [] }, catalog);
    const opA = opEnvelope({
      workflow: { nodes: [{ id: 111, type: "Src" }, { id: 112, type: "Sink" }], links: [[301, 111, 0, 112, 0, "batch-a"]] },
    });
    const opB = opEnvelope({
      workflow: { nodes: [{ id: 113, type: "Src" }, { id: 114, type: "Sink" }], links: [[301, 113, 0, 114, 0, "batch-b"]] },
    });

    const result = applyOps(doc, [opA, opB], catalog);
    expect(result.outcomes).toEqual([
      { op_id: opA.op_id, outcome: "applied" },
      { op_id: opB.op_id, outcome: "applied" },
    ]);
    const wf = project(doc, catalog);
    expect(linkNamed(wf, "batch-a")[0]).not.toBe(linkNamed(wf, "batch-b")[0]);
  });

  it("mints distinct ids for a large batch of links inserted in one op", () => {
    const opId = "cc11df0c31f9440b9385ac8e01e099b2";
    const count = 200;
    const nodes = Array.from({ length: count * 2 }, (_, i) => ({ id: `n${String(i)}`, type: i % 2 === 0 ? "Src" : "Sink" }));
    const rawLinks = Array.from({ length: count }, (_, i) => [1000 + i, `n${String(i * 2)}`, 0, `n${String(i * 2 + 1)}`, 0, `link-${String(i)}`]);
    const doc = mint({ nodes: [], links: [] }, catalog);
    const op = opEnvelope({ workflow: { nodes, links: rawLinks }, op_id: opId });

    // Each of the 200 raw link ids seeds a distinct hash input, so distinct
    // final candidates are the overwhelmingly likely outcome at 53 bits of
    // entropy — not a guarantee any dedup mechanism enforces (there is
    // none left), just what the birthday bound predicts for 200 draws from
    // a ~9-quadrillion-value space.
    expect(applyOps(doc, [op], catalog).outcomes[0]).toMatchObject({ outcome: "applied" });
    const wf = project(doc, catalog);
    expect(wf.links).toHaveLength(count);
    const ids = wf.links!.map((link) => (link as unknown[])[0]);
    expect(new Set(ids).size).toBe(count);
    for (const id of ids) expect(typeof id).toBe("number");
  });

  it("round-trips numeric link ids byte-for-byte through project → mint with no duplication or corruption", () => {
    const opId = "ff11df0c31f9440b9385ac8e01e099b2";
    const doc = mint({ nodes: [], links: [] }, catalog);
    const op = opEnvelope({
      workflow: {
        nodes: [{ id: 1, type: "Src" }, { id: 2, type: "Sink" }, { id: 3, type: "Def" }],
        links: [[701, 1, 0, 2, 0, "L1"]],
        definitions: {
          subgraphs: [
            {
              id: "Def",
              nodes: [{ id: "a", type: "Src" }, { id: "b", type: "Sink" }],
              links: [{ id: 702, origin_id: "a", origin_slot: 0, target_id: "b", target_slot: 0, type: "X" }],
            },
          ],
        },
      },
      op_id: opId,
    });
    expect(applyOps(doc, [op], catalog).outcomes[0]).toMatchObject({ outcome: "applied" });
    const first = project(doc, catalog);

    const reminted = mint(first, catalog);
    const second = project(reminted, catalog);
    expect(second).toEqual(first);
  });

  it("subgraph-interior promoted linkIds thread numeric ids end-to-end (comfy-multi-player#230 non-regression)", () => {
    // Mirrors `test/insert-workflow-promoted-input-linkids.regression.test.ts`
    // but through the REAL applier + project path, asserting the ids
    // `remapLinkIdArray` threads into a definition's own `inputs[].linkIds`
    // are the SAME real numbers as `links[].id` — exactly what ComfyUI_
    // frontend's `agentSubgraphHostSlots.ts` (`Map<number, ...>` keyed by
    // `link.id`) needs to resolve a promoted widget.
    const opId = "0011df0c31f9440b9385ac8e01e099b2";
    const doc = mint({ nodes: [], links: [] }, catalog);
    const op = opEnvelope({
      workflow: {
        nodes: [{ id: 100, type: "PromotedDef", inputs: [{ name: "text", type: "STRING", link: null, widget: { name: "text" } }] }],
        links: [],
        definitions: {
          subgraphs: [
            {
              id: "PromotedDef",
              name: "Promoted text",
              inputs: [{ name: "text", type: "STRING", linkIds: [34] }],
              outputs: [],
              nodes: [
                { id: 10, type: "Src", inputs: [], outputs: [{ name: "STRING", type: "STRING", links: [34] }] },
                { id: 11, type: "Def", inputs: [{ name: "text", type: "STRING", link: 34, widget: { name: "text" } }], outputs: [] },
              ],
              links: [{ id: 34, origin_id: 10, origin_slot: 0, target_id: 11, target_slot: 0, type: "STRING" }],
            },
          ],
        },
      },
      op_id: opId,
    });

    expect(applyOps(doc, [op], catalog).outcomes[0]).toMatchObject({ outcome: "applied" });
    const wf = project(doc, catalog);
    const definition = (
      wf.definitions as { subgraphs: Array<{ inputs: Array<{ linkIds: unknown[] }>; links: Array<{ id: unknown }> }> }
    ).subgraphs[0]!;

    expect(definition.links).toHaveLength(1);
    const realLinkId = definition.links[0]!.id;
    expect(typeof realLinkId).toBe("number");
    // The promoted input names the SAME numeric id, not a stringified or
    // otherwise-derived stand-in — a `Map<number, Link>` keyed by
    // `definition.links[].id` resolves `inputs[0].linkIds[0]` directly.
    expect(definition.inputs[0]!.linkIds).toEqual([realLinkId]);
  });

  it("keeps a definition-interior link fed by the subgraph IO sentinels numeric (sentinel non-regression)", () => {
    const opId = "1122df0c31f9440b9385ac8e01e099b2";
    const doc = mint({ nodes: [], links: [] }, catalog);
    const op = opEnvelope({
      workflow: {
        nodes: [
          {
            id: 100,
            type: "SentinelDef",
            inputs: [{ name: "text", type: "STRING", link: null, widget: { name: "text" } }],
            outputs: [{ name: "IMAGE", type: "IMAGE", links: [] }],
          },
        ],
        links: [],
        definitions: {
          subgraphs: [
            {
              id: "SentinelDef",
              name: "Sentinel",
              inputs: [{ name: "text", type: "STRING", linkIds: [16] }],
              outputs: [{ name: "IMAGE", type: "IMAGE", linkIds: [17] }],
              nodes: [
                { id: 27, type: "Def", inputs: [{ name: "text", type: "STRING", link: 16, widget: { name: "text" } }], outputs: [] },
                { id: 8, type: "Src", inputs: [], outputs: [{ name: "IMAGE", type: "IMAGE", links: [17] }] },
              ],
              links: [
                { id: 16, origin_id: -10, origin_slot: 0, target_id: 27, target_slot: 1, type: "STRING" },
                { id: 17, origin_id: 8, origin_slot: 0, target_id: -20, target_slot: 0, type: "IMAGE" },
              ],
            },
          ],
        },
      },
      op_id: opId,
    });

    expect(applyOps(doc, [op], catalog).outcomes[0]).toMatchObject({ outcome: "applied" });
    const wf = project(doc, catalog);
    const definition = (
      wf.definitions as {
        subgraphs: Array<{
          inputs: Array<{ linkIds: unknown[] }>;
          outputs: Array<{ linkIds: unknown[] }>;
          links: Array<{ id: unknown; origin_id: unknown; target_id: unknown }>;
        }>;
      }
    ).subgraphs[0]!;

    expect(definition.links).toHaveLength(2);
    const promotedLink = definition.links.find((link) => link.origin_id === -10)!;
    const exposedLink = definition.links.find((link) => link.target_id === -20)!;
    expect(typeof promotedLink.id).toBe("number");
    expect(typeof exposedLink.id).toBe("number");
    expect(definition.inputs[0]!.linkIds).toEqual([promotedLink.id]);
    expect(definition.outputs[0]!.linkIds).toEqual([exposedLink.id]);
  });

  it("an exact replay (same op_id, same payload) is a true no-op and does not re-mint the link id", () => {
    const opId = "2233df0c31f9440b9385ac8e01e099b2";
    const doc = mint({ nodes: [], links: [] }, catalog);
    const op = opEnvelope({
      workflow: { nodes: [{ id: 1, type: "Src" }, { id: 2, type: "Sink" }], links: [[801, 1, 0, 2, 0, "L"]] },
      op_id: opId,
    });

    expect(applyOps(doc, [op], catalog).outcomes[0]).toMatchObject({ outcome: "applied" });
    const firstProjection = project(doc, catalog);
    const mintedId = linkNamed(firstProjection, "L")[0];
    const beforeReplay = Buffer.from(Y.encodeStateAsUpdate(doc));

    expect(applyOps(doc, [op], catalog).outcomes[0]).toMatchObject({ outcome: "no-op" });
    expect(Buffer.from(Y.encodeStateAsUpdate(doc)).equals(beforeReplay)).toBe(true);
    expect(appliedMap(doc).has(op.op_id)).toBe(true);
    const afterReplay = project(doc, catalog);
    expect(linkNamed(afterReplay, "L")[0]).toBe(mintedId);
  });

  describe("opposite-order convergence (the regression Christian Byrne's review found)", () => {
    /**
     * Apply `ops` in order to a FRESH `Y.Doc` forked from `seed` via
     * `Y.applyUpdate` (KA-10: independent replicas fork from one common
     * snapshot, never re-seed independently) and return the projection.
     */
    function applyToFreshReplica(seed: Uint8Array, ops: Op[]): WorkflowJSON {
      const doc = new Y.Doc();
      Y.applyUpdate(doc, seed);
      for (const op of ops) {
        expect(applyOps(doc, [op], catalog).outcomes[0]).toMatchObject({ outcome: "applied" });
      }
      return project(doc, catalog);
    }

    it("two concurrent insert_workflow ops project byte-identically in either arrival order", () => {
      // This is the exact shape of Christian's blocker: two CONCURRENT ops
      // (never exchanged with each other's replica before either is
      // applied), each carrying links, replayed on two independent replicas
      // in opposite order. Under the retry-against-`taken` design this PR's
      // first revision shipped, a shared first candidate between a link in
      // opA and a link in opB would resolve to opA=x/opB=y on one replica
      // and opB=x/opA=y on the other — a genuine, silent projection
      // divergence between two replicas that applied the identical op set.
      // Pure derivation makes that impossible by construction: neither op's
      // mint reads anything but its own content, so its result cannot
      // depend on which replica, or which order, it is evaluated in.
      const seed = Y.encodeStateAsUpdate(mint({ nodes: [], links: [] }, catalog));
      const opA = opEnvelope({
        workflow: {
          nodes: [{ id: 101, type: "Src" }, { id: 102, type: "Sink" }, { id: 103, type: "Sink" }],
          links: [
            [201, 101, 0, 102, 0, "a1"],
            [202, 101, 0, 103, 0, "a2"],
          ],
        },
      });
      const opB = opEnvelope({
        workflow: {
          nodes: [{ id: 501, type: "Src" }, { id: 502, type: "Sink" }],
          links: [[601, 501, 0, 502, 0, "b1"]],
        },
      });

      const forward = applyToFreshReplica(seed, [opA, opB]);
      const reverse = applyToFreshReplica(seed, [opB, opA]);

      // Not merely "both applied successfully" -- the WHOLE projected
      // document, including every link's numeric id, is byte-for-byte
      // identical regardless of order (`project()` sorts by id, so this
      // equality is meaningful even though the two replicas wrote their
      // Y.Map entries in opposite orders).
      expect(forward).toEqual(reverse);
      expect(linkNamed(forward, "a1")[0]).toBe(linkNamed(reverse, "a1")[0]);
      expect(linkNamed(forward, "a2")[0]).toBe(linkNamed(reverse, "a2")[0]);
      expect(linkNamed(forward, "b1")[0]).toBe(linkNamed(reverse, "b1")[0]);
    });

    it("two insert_workflow ops sharing a definition converge identically in either order", () => {
      // Extends the same property to a subgraph-definition interior scope
      // (this PR's other cross-cutting surface): opA inserts a definition
      // and an instance of it; opB is an unrelated top-level insert. Both
      // the top-level and the definition-interior link ids must agree
      // across orders.
      const seed = Y.encodeStateAsUpdate(mint({ nodes: [], links: [] }, catalog));
      const opA = opEnvelope({
        workflow: {
          nodes: [{ id: 900, type: "Def" }],
          links: [],
          definitions: {
            subgraphs: [
              {
                id: "Def",
                nodes: [{ id: "x", type: "Src" }, { id: "y", type: "Sink" }],
                links: [{ id: 41, origin_id: "x", origin_slot: 0, target_id: "y", target_slot: 0, type: "X" }],
              },
            ],
          },
        },
      });
      const opB = opEnvelope({
        workflow: { nodes: [{ id: 701, type: "Src" }, { id: 702, type: "Sink" }], links: [[801, 701, 0, 702, 0, "top-level"]] },
      });

      const forward = applyToFreshReplica(seed, [opA, opB]);
      const reverse = applyToFreshReplica(seed, [opB, opA]);
      expect(forward).toEqual(reverse);

      const defLinkId = (wf: WorkflowJSON): unknown =>
        (wf.definitions as { subgraphs: Array<{ links: Array<{ id: unknown }> }> }).subgraphs[0]!.links[0]!.id;
      expect(defLinkId(forward)).toBe(defLinkId(reverse));
      expect(linkNamed(forward, "top-level")[0]).toBe(linkNamed(reverse, "top-level")[0]);
    });
  });
});
