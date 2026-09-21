/**
 * Applier semantics pinned as PERMANENT tests (graduated from the spike's
 * throwaway checks):
 *  - idempotency: re-applying every op and the full stream twice leaves the
 *    doc byte-identical (`encodeStateAsUpdate`);
 *  - abort-remainder batches with the `failed:{index, op, code}` accounting
 *    and the applied prefix retained;
 *  - reset_doc rejected as deferred (vocabulary §1.6);
 *  - delete-wins no-ops that still consume their op_id;
 *  - clear semantics (§6): groups only if present, id marks + extra +
 *    definitions + stamps preserved;
 *  - inputcount two-register grow (§8.4): one op_id, slot + stamped count
 *    write, LWW-coherent with explicit set_widget in both orders;
 *  - autogrow collision renaming via the catalog template;
 *  - §11 bounded writes: per-op Y-mutation counts stay under a small constant
 *    for every non-clear op across the whole corpus.
 */
import * as Y from "yjs";
import { describe, expect, it } from "vitest";
import { _getMutationCount, _resetMutationCount, appliedMap, stampsMap } from "../src/doc.js";
import {
  applyOps,
  mint,
  project,
  type ClearOp,
  type ConnectOp,
  type DeleteNodeOp,
  type Op,
  type ResetDocOp,
  type SetWidgetOp,
  type WidgetCatalog,
  type WorkflowJSON,
  type WorkflowNode,
} from "../src/index.js";
import { noOpIds, rejectedOutcome } from "./apply-result-helpers.js";
import { canonicalize, loadCatalog, loadLwwVectors, loadSession, sessionFiles } from "./helpers.js";

const catalog = loadCatalog();
const lww = loadLwwVectors();

let opSeq = 0;
/** Deterministic 32-lowercase-hex op_id for synthetic test ops (freeze §8.2 shape). */
function testOpId(prefix = "a"): string {
  return (prefix + String(opSeq++).padStart(4, "0")).padEnd(32, "0");
}

function envelope(actor: string, baseVersion: number) {
  return { op_id: testOpId(), actor, base_version: baseVersion, stamp: [baseVersion, actor] as [number, string] };
}

function processedOpIds(result: ReturnType<typeof applyOps>): string[] {
  return result.outcomes.filter((outcome) => outcome.outcome !== "rejected").map((outcome) => outcome.op_id);
}

describe("idempotency (byte-identical re-apply)", () => {
  for (const file of sessionFiles()) {
    it(`${file}: full stream twice + every op re-applied → byte-identical state`, () => {
      const { header, ops } = loadSession(file);
      const doc = mint(header.base_workflow, catalog);
      expect(rejectedOutcome(applyOps(doc, ops, catalog))).toBeUndefined();
      const bytes = Buffer.from(Y.encodeStateAsUpdate(doc));

      // Whole stream again: every op an idempotent duplicate.
      const again = applyOps(doc, ops, catalog);
      expect(rejectedOutcome(again)).toBeUndefined();
      expect(again.outcomes.every((outcome) => outcome.outcome === "no-op")).toBe(true);
      expect(noOpIds(again)).toHaveLength(ops.length);
      expect(Buffer.from(Y.encodeStateAsUpdate(doc)).equals(bytes)).toBe(true);

      // Each op individually re-applied.
      for (const op of ops) {
        const res = applyOps(doc, [op], catalog);
        expect(res.outcomes).toEqual([{ op_id: op.op_id, outcome: "no-op" }]);
        expect(noOpIds(res)).toEqual([op.op_id]);
      }
      expect(Buffer.from(Y.encodeStateAsUpdate(doc)).equals(bytes)).toBe(true);
    });
  }
});

describe("abort-remainder (vocabulary §4)", () => {
  const base = lww.base_workflow;
  const ksampler = 3308598398221244;

  it("stops at the failing index, keeps the applied prefix, reports {index, op, code}", () => {
    const doc = mint(base, catalog);
    const good1: SetWidgetOp = { op: "set_widget", ...envelope("alice", 1), node_id: ksampler, widget: "steps", value: 25 };
    const bad: SetWidgetOp = { op: "set_widget", ...envelope("alice", 2), node_id: ksampler, widget: "no_such_widget", value: 1 };
    const good2: SetWidgetOp = { op: "set_widget", ...envelope("alice", 3), node_id: ksampler, widget: "cfg", value: 3.5 };

    const res = applyOps(doc, [good1, bad, good2], catalog);
    expect(processedOpIds(res)).toEqual([good1.op_id]);
    expect(res.outcomes.filter((outcome) => outcome.outcome !== "rejected")).toHaveLength(1);
    expect(res.outcomes[1]).toMatchObject({ op_id: bad.op_id, outcome: "rejected", reason: { code: "unknown_widget" } });
    expect(res.outcomes[1]!.op_id).toBe(bad.op_id);
    // The prefix landed; the remainder did not.
    const node = project(doc, catalog).nodes.find((n) => n.id === ksampler)!;
    const order = catalog.types["KSampler"]!.widget_order;
    expect((node.widgets_values as unknown[])[order.indexOf("steps")]).toBe(25);
    expect((node.widgets_values as unknown[])[order.indexOf("cfg")]).toBe(8.0);
    // A rejected op does not consume its op_id: the fixed batch can be retried.
    expect(appliedMap(doc).has(bad.op_id)).toBe(false);
    expect(appliedMap(doc).has(good2.op_id)).toBe(false);

    // Retry with the failing op fixed: prefix dedupes, remainder applies.
    const fixed: SetWidgetOp = { ...bad, widget: "sampler_name", value: "euler_ancestral" };
    const retry = applyOps(doc, [good1, fixed, good2], catalog);
    expect(rejectedOutcome(retry)).toBeUndefined();
    expect(retry.outcomes).toEqual([
      { op_id: good1.op_id, outcome: "no-op" },
      { op_id: fixed.op_id, outcome: "applied" },
      { op_id: good2.op_id, outcome: "applied" },
    ]);
  });

  it("rejects an unknown kind loudly", () => {
    const doc = mint(base, catalog);
    const res = applyOps(doc, [{ op: "move_node", ...envelope("alice", 1) } as unknown as Op], catalog);
    expect(res.outcomes[0]).toMatchObject({ outcome: "rejected", reason: { code: "unknown_op" } });
  });

  it("a rejected op leaves the doc byte-identical (validation precedes mutation)", () => {
    const doc = mint(base, catalog);
    const bytes = Buffer.from(Y.encodeStateAsUpdate(doc));
    const bad: SetWidgetOp = { op: "set_widget", ...envelope("alice", 1), node_id: ksampler, widget: "nope", value: 1 };
    expect(rejectedOutcome(applyOps(doc, [bad], catalog))).toMatchObject({ reason: { code: "unknown_widget" } });
    expect(Buffer.from(Y.encodeStateAsUpdate(doc)).equals(bytes)).toBe(true);
  });
});

describe("reset_doc stays deferred (vocabulary §1.6)", () => {
  it("rejects with a typed op_deferred failure and applies nothing", () => {
    const doc = mint(lww.base_workflow, catalog);
    const bytes = Buffer.from(Y.encodeStateAsUpdate(doc));
    const reset: ResetDocOp = {
      op: "reset_doc",
      ...envelope("alice", 5),
      workflow: { nodes: [], links: [] },
    };
    // Since #17 `ResetDocOp` is NOT an `Op` — `Op` is what `applyOps`
    // implements, and a `reset_doc` is always refused. It reaches the applier
    // only as wire data from a peer, which is what this cast models; the
    // runtime rejection below is unchanged.
    const res = applyOps(doc, [reset] as unknown as Op[], catalog);
    expect(res.outcomes[0]).toMatchObject({ outcome: "rejected", reason: { code: "op_deferred" } });
    expect(rejectedOutcome(res)?.reason.message).toMatch(/reset_doc/);
    expect(processedOpIds(res)).toEqual([]);
    expect(Buffer.from(Y.encodeStateAsUpdate(doc)).equals(bytes)).toBe(true);
  });
});

describe("delete-wins (silent no-ops that consume the op_id)", () => {
  const clipId = 2339450755010078;

  it("set_widget on a deleted node is a no-op, op_id consumed", () => {
    const doc = mint(lww.base_workflow, catalog);
    const del: DeleteNodeOp = { op: "delete_node", ...envelope("alice", 1), node_id: clipId, removed_links: [] };
    const write: SetWidgetOp = { op: "set_widget", ...envelope("bob", 2), node_id: clipId, widget: "text", value: "late" };
    const res = applyOps(doc, [del, write], catalog);
    expect(rejectedOutcome(res)).toBeUndefined();
    expect(processedOpIds(res)).toEqual([del.op_id, write.op_id]);
    expect(project(doc, catalog).nodes.some((n) => n.id === clipId)).toBe(false);
    // Replaying the write stays a duplicate — never a late resurrection.
    expect(noOpIds(applyOps(doc, [write], catalog))).toEqual([write.op_id]);
  });

  it("connect with a deleted endpoint is a no-op, op_id consumed", () => {
    const doc = mint(lww.base_workflow, catalog);
    const del: DeleteNodeOp = { op: "delete_node", ...envelope("alice", 1), node_id: clipId, removed_links: [] };
    const connect: ConnectOp = {
      op: "connect",
      ...envelope("bob", 2),
      link_id: 999000111,
      from_node: clipId,
      from_slot: 0,
      to_node: 3308598398221244,
      to_slot: 1,
      link_type: "CONDITIONING",
    };
    const res = applyOps(doc, [del, connect], catalog);
    expect(rejectedOutcome(res)).toBeUndefined();
    expect(processedOpIds(res)).toEqual([del.op_id, connect.op_id]);
    expect(project(doc, catalog).links).toEqual([]);
  });

  it("deleting an already-absent node is a no-op", () => {
    const doc = mint(lww.base_workflow, catalog);
    const del: DeleteNodeOp = { op: "delete_node", ...envelope("alice", 1), node_id: 42, removed_links: [] };
    expect(rejectedOutcome(applyOps(doc, [del], catalog))).toBeUndefined();
    expect(project(doc, catalog).nodes.length).toBe(2);
  });
});

describe("ApplyResult per-op outcomes (#16)", () => {
  it("distinguishes a landed write, an LWW drop, and a delete-wins no-op", () => {
    const doc = mint(lww.base_workflow, catalog);
    const nodeId = 3308598398221244;
    const landed: SetWidgetOp = { op: "set_widget", ...envelope("bob", 10), node_id: nodeId, widget: "steps", value: 30 };
    const dropped: SetWidgetOp = { op: "set_widget", ...envelope("alice", 9), node_id: nodeId, widget: "steps", value: 20 };
    const missing: SetWidgetOp = { op: "set_widget", ...envelope("alice", 11), node_id: 42, widget: "steps", value: 10 };

    expect(applyOps(doc, [landed, dropped, missing], catalog)).toEqual({
      outcomes: [
        { op_id: landed.op_id, outcome: "applied" },
        { op_id: dropped.op_id, outcome: "lww-dropped" },
        { op_id: missing.op_id, outcome: "no-op" },
      ],
      ops_seen: 3,
    });
  });
});

describe("clear semantics (schema §6)", () => {
  it("empties nodes/links, resets groups only when present, preserves everything else", () => {
    const base = lww.base_workflow; // has groups + extra + config
    const doc = mint(base, catalog);
    const stampsBefore = stampsMap(doc).size;
    // `removed_nodes` is the authoritative target set (§6 amendment A3): a
    // minter records every node present at mint time, so the list is what a
    // real `clear` carries. Deriving it from live `nodes.keys()` was the #11
    // arrival-order hole.
    const clear: ClearOp = {
      op: "clear",
      ...envelope("alice", 9),
      removed_nodes: base.nodes.map((n) => n.id),
    };
    expect(rejectedOutcome(applyOps(doc, [clear], catalog))).toBeUndefined();

    const wf = project(doc, catalog);
    expect(wf.nodes).toEqual([]);
    expect(wf.links).toEqual([]);
    expect(wf["groups"]).toEqual([]); // key existed → reset
    expect(wf["extra"]).toEqual(base["extra"]); // untouched
    expect(wf["config"]).toEqual(base["config"]);
    expect(wf["last_node_id"]).toBe(base["last_node_id"]); // id-reuse guard
    expect(wf["last_link_id"]).toBe(base["last_link_id"]);
    // clear records one node-presence stamp per removed node so concurrent
    // re-adds resolve by stamp rather than arrival order (#11).
    expect(stampsMap(doc).size).toBe(stampsBefore + base.nodes.length);
  });

  it("does not invent a groups key on a workflow without one", () => {
    const base: WorkflowJSON = { nodes: [], links: [], last_node_id: 0, last_link_id: 0 };
    const doc = mint(base, catalog);
    const clear: ClearOp = { op: "clear", ...envelope("alice", 1), removed_nodes: [] };
    expect(rejectedOutcome(applyOps(doc, [clear], catalog))).toBeUndefined();
    expect("groups" in project(doc, catalog)).toBe(false);
  });

  it("does not touch definitions", () => {
    const doc = mint(lww.subgraph_base_workflow, catalog);
    const clear: ClearOp = {
      op: "clear",
      ...envelope("alice", 1),
      removed_nodes: lww.subgraph_base_workflow.nodes.map((n) => n.id),
    };
    expect(rejectedOutcome(applyOps(doc, [clear], catalog))).toBeUndefined();
    const wf = project(doc, catalog);
    expect(wf.nodes).toEqual([]);
    expect(wf["definitions"]).toEqual(lww.subgraph_base_workflow["definitions"]);
  });
});

describe("inputcount two-register grow (freeze §8.4)", () => {
  const multiCatalog: WidgetCatalog = {
    types: {
      ...catalog.types,
      TestMulti: { widget_order: ["inputcount"] },
    },
  };
  const multiNode: WorkflowNode = {
    id: 1,
    type: "TestMulti",
    inputs: [
      { name: "image_1", type: "IMAGE", link: null },
      { name: "image_2", type: "IMAGE", link: null },
    ],
    outputs: [],
    widgets_values: [2],
  };
  const srcNode: WorkflowNode = {
    id: 2,
    type: "LoadImage",
    inputs: [],
    outputs: [{ name: "IMAGE", type: "IMAGE", links: [] }],
    widgets_values: ["a.png"],
  };
  const base: WorkflowJSON = { nodes: [multiNode, srcNode], links: [], last_node_id: 2, last_link_id: 0 };

  function growConnect(actor: string, bv: number, linkId: number, plannedCount: number): ConnectOp {
    return {
      op: "connect",
      ...envelope(actor, bv),
      link_id: linkId,
      from_node: 2,
      from_slot: 0,
      to_node: 1,
      to_slot: null,
      link_type: "IMAGE",
      grow: { name: "image_3", type: "IMAGE", inputcount: { widget: "inputcount", value: plannedCount } },
    };
  }

  it("one op grows the bare-named slot AND LWW-writes the count widget under one op_id", () => {
    const doc = mint(base, multiCatalog);
    const op = growConnect("alice", 3, 501, 3);
    const res = applyOps(doc, [op], multiCatalog);
    expect(rejectedOutcome(res)).toBeUndefined();
    expect(processedOpIds(res)).toEqual([op.op_id]); // ONE __applied entry for both effects

    const node = project(doc, multiCatalog).nodes.find((n) => n.id === 1)!;
    const inputs = node.inputs as { name: string; link: unknown; grow_id?: unknown }[];
    expect(inputs.map((i) => i.name)).toEqual(["image_1", "image_2", "image_3"]);
    expect(inputs[2]!.grow_id).toBe(501);
    expect(inputs[2]!.link).toBe(501);
    expect(node.widgets_values).toEqual([3]); // the count register
    // The count write shares the connect's stamp on the normal widget target.
    // Node ids in a stamp key are String()-normalized (amendment v1.2), so
    // node 1 keys as "1" — see test/stamp-target-identity.test.ts.
    expect(stampsMap(doc).get(JSON.stringify(["widget", "1", "0", "inputcount"]))).toEqual([3, "alice", op.op_id]);

    // Idempotent replay: no second slot, no double bump.
    const bytes = Buffer.from(Y.encodeStateAsUpdate(doc));
    expect(noOpIds(applyOps(doc, [op], multiCatalog))).toEqual([op.op_id]);
    expect(Buffer.from(Y.encodeStateAsUpdate(doc)).equals(bytes)).toBe(true);
  });

  it("collision grows the next free BARE key, never the dotted autogrow shape", () => {
    const doc = mint(base, multiCatalog);
    const first = growConnect("alice", 3, 601, 3);
    const second = growConnect("bob", 3, 602, 3); // same requested name image_3
    expect(rejectedOutcome(applyOps(doc, [first, second], multiCatalog))).toBeUndefined();
    const node = project(doc, multiCatalog).nodes.find((n) => n.id === 1)!;
    const names = (node.inputs as { name: string }[]).map((i) => i.name);
    expect(names).toEqual(["image_1", "image_2", "image_3", "image_4"]);
  });

  it("the count register is LWW-coherent with an explicit set_widget in both orders", () => {
    const connect = growConnect("bob", 5, 701, 3);
    const explicit: SetWidgetOp = {
      op: "set_widget",
      ...envelope("zed", 5), // same bv; actor 'zed' > 'bob' → explicit wins
      node_id: 1,
      widget: "inputcount",
      value: 7,
    };
    for (const order of [[connect, explicit] as Op[], [explicit, connect] as Op[]]) {
      const doc = mint(base, multiCatalog);
      expect(rejectedOutcome(applyOps(doc, order, multiCatalog))).toBeUndefined();
      const node = project(doc, multiCatalog).nodes.find((n) => n.id === 1)!;
      expect(node.widgets_values, order.map((o) => o.op).join("→")).toEqual([7]);
      // Both orders still grow the slot — only the count register is contested.
      expect((node.inputs as unknown[]).length).toBe(3);
    }
  });
});

describe("autogrow collision rename (catalog template)", () => {
  it("renames a colliding dotted autogrow slot via autogrow_templates", () => {
    const batchNode: WorkflowNode = {
      id: 10,
      type: "BatchImagesNode",
      inputs: [{ name: "images", type: "COMFY_AUTOGROW_V3", link: null }],
      outputs: [],
      widgets_values: [],
    };
    const src: WorkflowNode = {
      id: 11,
      type: "LoadImage",
      inputs: [],
      outputs: [{ name: "IMAGE", type: "IMAGE", links: [] }],
      widgets_values: ["a.png"],
    };
    const base: WorkflowJSON = { nodes: [batchNode, src], links: [], last_node_id: 11, last_link_id: 0 };
    const mk = (actor: string, linkId: number): ConnectOp => ({
      op: "connect",
      ...envelope(actor, 2),
      link_id: linkId,
      from_node: 11,
      from_slot: 0,
      to_node: 10,
      to_slot: null,
      link_type: "IMAGE",
      grow: { name: "images.image0", type: "IMAGE" }, // both request image0
    });
    const doc = mint(base, catalog);
    expect(rejectedOutcome(applyOps(doc, [mk("alice", 801), mk("bob", 802)], catalog))).toBeUndefined();
    const node = project(doc, catalog).nodes.find((n) => n.id === 10)!;
    const names = (node.inputs as { name: string }[]).map((i) => i.name);
    // Non-clobbering: both survive; the loser is renamed via the template prefix.
    expect(names).toEqual(["images", "images.image0", "images.image1"]);
  });
});

describe("bounded writes (schema §11)", () => {
  // The spike measured max 7 Y-mutations for any non-clear op; the name-keyed
  // widgets map only shrinks that. 12 is the loud-failure ceiling.
  const LIMIT = 12;

  for (const file of sessionFiles()) {
    it(`${file}: every non-clear op stays ≤ ${LIMIT} Y-mutations`, () => {
      const { header, ops } = loadSession(file);
      const doc = mint(header.base_workflow, catalog);
      let worst = 0;
      for (const op of ops) {
        _resetMutationCount(doc);
        const res = applyOps(doc, [op], catalog);
        expect(rejectedOutcome(res)).toBeUndefined();
        if (op.op === "clear") continue; // O(doc) by design, standalone-only
        worst = Math.max(worst, _getMutationCount(doc));
        expect(_getMutationCount(doc), `${op.op} ${op.op_id}`).toBeLessThanOrEqual(LIMIT);
      }
      expect(worst).toBeGreaterThan(0);
    });
  }
});

// ---------------------------------------------------------------------------
// Opaque widgets — classes the pinned catalog cannot describe (schema §1.2)
// ---------------------------------------------------------------------------

describe("opaque widgets (frontend-only classes)", () => {
  const notes = loadSession("session-frontend-only-notes.session.jsonl").header.base_workflow;
  const noteNode = notes.nodes.find((n) => n.type === "Note")!;
  const noteValues = noteNode.widgets_values as unknown[];

  it("mints and projects a sticky note the catalog has no entry for", () => {
    // The regression: this used to throw at mint, so ANY workflow containing a
    // sticky note failed to mint — and most official templates contain one.
    expect(catalog.types["Note"]).toBeUndefined();
    const doc = mint(notes, catalog);
    const projected = project(doc, catalog).nodes.find((n) => String(n.id) === String(noteNode.id))!;
    expect(JSON.stringify(projected.widgets_values)).toBe(JSON.stringify(noteValues));
  });

  it("REFUSES a set_widget against an opaque node instead of silently no-oping", () => {
    const doc = mint(notes, catalog);
    const bytes = Buffer.from(Y.encodeStateAsUpdate(doc));
    const op: SetWidgetOp = {
      op: "set_widget",
      ...envelope("alice", 1),
      node_id: noteNode.id,
      widget: "text",
      value: "hijacked",
    };
    const res = applyOps(doc, [op], catalog);
    expect(res.outcomes[0]).toMatchObject({ outcome: "rejected", reason: { code: "opaque_widgets" } });
    expect(rejectedOutcome(res)?.reason.message).toMatch(/not name-addressable/);
    expect(processedOpIds(res)).toEqual([]);
    // A rejected op consumes nothing and mutates nothing (§4 retryability).
    expect(appliedMap(doc).has(op.op_id)).toBe(false);
    expect(Buffer.from(Y.encodeStateAsUpdate(doc)).equals(bytes)).toBe(true);
    // And the document still projects: a silent write would have created a
    // name-keyed widgets map for an uncatalogued class, making EVERY later
    // project() throw.
    const after = project(doc, catalog).nodes.find((n) => String(n.id) === String(noteNode.id))!;
    expect(JSON.stringify(after.widgets_values)).toBe(JSON.stringify(noteValues));
  });

  it("add_node of an uncatalogued class stores its values opaquely and round-trips", () => {
    const doc = mint({ nodes: [], links: [] }, catalog);
    const node: WorkflowNode = {
      id: 8391847293013,
      type: "MarkdownNote",
      pos: [10, 20],
      flags: {},
      widgets_values: ["# added\n\nverbatim — 100%"],
    };
    const op = { op: "add_node", ...envelope("alice", 1), node_id: node.id, class_type: node.type, pos: [10, 20], node } as Op;
    expect(rejectedOutcome(applyOps(doc, [op], catalog))).toBeUndefined();
    const projected = project(doc, catalog).nodes[0]!;
    expect(JSON.stringify(projected.widgets_values)).toBe(JSON.stringify(node.widgets_values));
  });

  it("a catalog-LESS host still refuses positional widgets_values (catalog_required)", () => {
    // No catalog at all cannot distinguish "unknown class" from "class I just
    // can't see", so the pre-existing rejection stands — the fix is narrow.
    const doc = mint({ nodes: [], links: [] }, catalog);
    const node: WorkflowNode = { id: 77, type: "KSampler", widgets_values: [1, "fixed", 20] };
    const op = { op: "add_node", ...envelope("alice", 1), node_id: 77, class_type: "KSampler", pos: [0, 0], node } as Op;
    expect(rejectedOutcome(applyOps(doc, [op]))?.reason).toMatchObject({ code: "catalog_required" });
  });

  it("refuses an inputcount grow onto an opaque destination BEFORE growing the slot", () => {
    const base: WorkflowJSON = {
      nodes: [
        {
          id: 1,
          type: "LoadImage",
          inputs: [],
          outputs: [{ name: "IMAGE", type: "IMAGE", links: null }],
          widgets_values: ["photo.png"],
        },
        // Uncatalogued *Multi-family node: its widgets_values are opaque, so
        // the §8.4 count-widget write cannot be expressed.
        { id: 2, type: "ImageBatchMulti", inputs: [], outputs: [], widgets_values: [2] },
      ],
      links: [],
    };
    const doc = mint(base, catalog);
    const bytes = Buffer.from(Y.encodeStateAsUpdate(doc));
    const op: ConnectOp = {
      op: "connect",
      ...envelope("alice", 1),
      link_id: 9001,
      from_node: 1,
      from_slot: 0,
      to_node: 2,
      to_slot: null,
      link_type: "IMAGE",
      grow: { name: "image_2", type: "IMAGE", inputcount: { widget: "inputcount", value: 2 } },
    };
    const res = applyOps(doc, [op], catalog);
    expect(res.outcomes[0]).toMatchObject({ outcome: "rejected", reason: { code: "opaque_widgets" } });
    expect(Buffer.from(Y.encodeStateAsUpdate(doc)).equals(bytes)).toBe(true);
  });
});
