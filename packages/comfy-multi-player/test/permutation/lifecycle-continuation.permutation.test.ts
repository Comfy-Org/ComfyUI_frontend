/**
 * Extension of incarnation-stamps.test.ts and rejection-retry-parity.test.ts.
 * 2 removals × 2 batch boundaries × 4 stale-write positions = 16 histories.
 * Each compares all eight logical root maps, probes a common continuation, and
 * recovers a snapshot-seeded follower after a dropped delta. Yjs struct bytes
 * need not match between independently edited authorities; duplicate delivery
 * must be byte-identical on each recipient. No projection normalization or
 * broad divergence classifier is used here.
 *
 * This is a bounded package-level transport simulation, not a WebSocket,
 * browser, persistence, or arbitrary-op-stream completeness proof (KA-4/10,
 * FC-1/5/7). Never send one authority's Yjs updates to the other authority.
 */
import * as Y from "yjs";
import { describe, expect, it } from "vitest";
import {
  LEGACY_NODE_INCARNATION,
  applyOps,
  mint,
  project,
  readStamps,
  type Op,
  type SetWidgetOp,
  type WorkflowJSON,
} from "../../src/index.js";
import { loadCatalog } from "../helpers.js";
import { checkGraphInvariants } from "../graph-invariant-oracle.js";

const catalog = loadCatalog();
const roots = ["nodes", "links", "definitions", "meta", "__applied", "__stamps", "__link_state", "__clock_reservations"] as const;
const base: WorkflowJSON = {
  nodes: [{ id: 1, type: "CLIPTextEncode", pos: [0, 0], inputs: [], outputs: [], widgets_values: ["life-1"] }],
  links: [], last_node_id: 1, last_link_id: 0,
};
const id = (serial: number) => serial.toString(16).padStart(32, "0");
const envelope = (serial: number, counter: number) => ({
  op_id: id(serial), actor: "human:continuation", base_version: counter,
  stamp: [counter, "human:continuation"] as [number, string],
});

function write(serial: number, counter: number, value: string, incarnation: string): SetWidgetOp {
  return {
    op: "set_widget", ...envelope(serial, counter), node_id: 1,
    widget: "text", value, node_incarnation: incarnation,
  };
}

function fork(snapshot: Uint8Array): Y.Doc {
  const doc = new Y.Doc();
  Y.applyUpdate(doc, snapshot);
  return doc;
}

function logical(doc: Y.Doc) {
  // Empty root types emit no snapshot structs (KA-10). Compare contents while
  // leaving absent roots absent; getMap only materializes already-present types.
  return Object.fromEntries(roots.map((name) => [name, doc.share.has(name) ? doc.getMap(name).toJSON() : {}]));
}

describe("same-target logical state, beyond projection equality", () => {
  it("compares empty root contents without creating absent roots", () => {
    const host = new Y.Doc();
    host.getMap("__clock_reservations");
    const follower = fork(Y.encodeStateAsUpdate(host));
    try {
      const hostRoots = [...host.share.keys()];
      const followerRoots = [...follower.share.keys()];
      expect(hostRoots).toEqual(["__clock_reservations"]);
      expect(followerRoots).toEqual([]);
      expect(logical(follower)).toEqual(logical(host));
      expect([...host.share.keys()]).toEqual(hostRoots);
      expect([...follower.share.keys()]).toEqual(followerRoots);
    } finally {
      host.destroy();
      follower.destroy();
    }
  });

  it.each(["together", "split"] as const)("%s: contested writes admit the same continuation", (mode) => {
    const seed = mint(base, catalog);
    const snapshot = Y.encodeStateAsUpdate(seed);
    seed.destroy();
    const low = write(10, 10, "low", "0");
    const high = write(11, 30, "high", "0");
    const docs = [fork(snapshot), fork(snapshot)];
    try {
      for (const [index, history] of [[low, high], [high, low]].entries()) {
        const doc = docs[index]!;
        const outcomes = (mode === "together" ? [history] : history.map((op) => [op]))
          .flatMap((batch) => applyOps(doc, batch, catalog).outcomes);
        expect(outcomes).toEqual(index === 0
          ? [{ op_id: low.op_id, outcome: "applied" }, { op_id: high.op_id, outcome: "applied" }]
          : [{ op_id: high.op_id, outcome: "applied" }, { op_id: low.op_id, outcome: "lww-dropped" }]);
        expect(project(doc, catalog).nodes[0]?.widgets_values).toEqual(["high"]);
      }
      expect(logical(docs[0]!)).toEqual(logical(docs[1]!));
      for (const [op, outcome, value] of [
        [write(12, 20, "middle", "0"), "lww-dropped", "high"],
        [write(13, 40, "later", "0"), "applied", "later"],
      ] as const) {
        for (const doc of docs) {
          expect(applyOps(doc, [op], catalog).outcomes).toEqual([{ op_id: op.op_id, outcome }]);
          expect(project(doc, catalog).nodes[0]?.widgets_values).toEqual([value]);
        }
        expect(logical(docs[0]!)).toEqual(logical(docs[1]!));
      }
    } finally {
      for (const doc of docs) doc.destroy();
    }
  });
});

describe("lifetime continuations and snapshot-delta recovery", () => {
  for (const removalKind of ["delete_node", "clear"] as const) {
    for (const mode of ["together", "split"] as const) {
      it(`${removalKind}/${mode}: four stale positions preserve logical state and subsequent behavior`, () => {
        const seed = mint(base, catalog);
        const snapshot = Y.encodeStateAsUpdate(seed);
        seed.destroy();
        const removal: Op = removalKind === "delete_node"
          ? { op: "delete_node", ...envelope(1, 10), node_id: 1, removed_links: [] }
          : { op: "clear", ...envelope(1, 10), removed_nodes: [1] };
        const replacement: Op = {
          op: "add_node", ...envelope(2, 20), node_id: 1,
          node_incarnation: id(2), class_type: "CLIPTextEncode", pos: [0, 0],
          node: { ...base.nodes[0]!, widgets_values: ["life-2"] },
        };
        const stale = write(3, 100, "old lifetime", LEGACY_NODE_INCARNATION);
        const fresh = write(4, 30, "fresh", replacement.op_id);
        const authorities: Y.Doc[] = [];
        const followers: Y.Doc[] = [];
        try {
          for (let position = 0; position < 4; position++) {
            const host = fork(snapshot);
            const follower = fork(snapshot);
            authorities.push(host);
            followers.push(follower);
            const history = [removal, replacement, fresh];
            history.splice(position, 0, stale);
            const batches = mode === "together" ? [history] : history.map((op) => [op]);
            for (const batch of batches) {
              expect(applyOps(host, batch, catalog).outcomes.some((o) => o.outcome === "rejected")).toBe(false);
            }
            expect(project(host, catalog).nodes[0]?.widgets_values).toEqual(["fresh"]);
            expect(readStamps(host)[JSON.stringify(["widget", "1", "0", "text"])]).toBeUndefined();
            expect(logical(host), `stale position ${position}`).toEqual(logical(authorities[0]!));
            expect(checkGraphInvariants(host)).toEqual([]);

            // Replays consume neither new IDs nor Yjs clocks, even when the
            // original operation removed the node or targeted a previous life.
            const beforeRetry = Y.encodeStateAsUpdate(host);
            expect(applyOps(host, history, catalog).outcomes).toEqual(
              history.map((op) => ({ op_id: op.op_id, outcome: "no-op" })),
            );
            expect(Y.encodeStateAsUpdate(host)).toEqual(beforeRetry);
          }

          // Lower current-life write, much newer wrong-life write, then higher
          // current-life write. Matching projections alone cannot certify this:
          // a lost stamp or incarnation changes one of these exact outcomes.
          const continuation = [
            { op: write(5, 25, "loser", id(2)), outcome: "lww-dropped", value: "fresh" },
            { op: write(6, 1000, "stale continuation", "0"), outcome: "no-op", value: "fresh" },
            { op: write(7, 40, "continued", id(2)), outcome: "applied", value: "continued" },
          ];
          for (const { op, outcome, value } of continuation) {
            for (const host of authorities) {
              expect(applyOps(host, [op], catalog).outcomes).toEqual([{ op_id: op.op_id, outcome }]);
              expect(project(host, catalog).nodes[0]?.widgets_values).toEqual([value]);
              expect(logical(host)).toEqual(logical(authorities[0]!));
            }
          }

          for (const [index, host] of authorities.entries()) {
            const follower = followers[index]!;
            // The follower missed the entire lifecycle and continuation delta.
            // Deliver a later incremental update first, then recover against
            // its actual state vector. The host is the only semantic writer.
            const beforeLast = Y.encodeStateVector(host);
            const last = write(8, 50, "after gap", id(2));
            expect(applyOps(host, [last], catalog).outcomes).toEqual([{ op_id: last.op_id, outcome: "applied" }]);
            Y.applyUpdate(follower, Y.encodeStateAsUpdate(host, beforeLast));
            expect(project(follower, catalog).nodes[0]?.widgets_values).not.toEqual(["after gap"]);
            const delta = Y.encodeStateAsUpdate(host, Y.encodeStateVector(follower));
            Y.applyUpdate(follower, delta);
            expect(logical(follower)).toEqual(logical(host));
            expect(project(follower, catalog).nodes[0]?.widgets_values).toEqual(["after gap"]);
            expect(checkGraphInvariants(follower)).toEqual([]);
            const beforeDuplicate = Y.encodeStateAsUpdate(follower);
            Y.applyUpdate(follower, delta);
            expect(Y.encodeStateAsUpdate(follower)).toEqual(beforeDuplicate);

            // Continued host writes still update the SAME follower after gap
            // recovery; no destroy/re-mint or full-document replacement.
            const resumedVector = Y.encodeStateVector(follower);
            const resumed = write(9, 60, "after reconnect", id(2));
            expect(applyOps(host, [resumed], catalog).outcomes).toEqual([{ op_id: resumed.op_id, outcome: "applied" }]);
            Y.applyUpdate(follower, Y.encodeStateAsUpdate(host, resumedVector));
            expect(logical(follower)).toEqual(logical(host));
            expect(project(follower, catalog).nodes[0]?.widgets_values).toEqual(["after reconnect"]);
          }
          expect(authorities).toHaveLength(4);
        } finally {
          for (const doc of [...authorities, ...followers]) doc.destroy();
        }
      });
    }
  }
});

describe("precise rejection vs consumed no-op and batch abort", () => {
  // https://github.com/Comfy-Org/comfy-multi-player/pull/184#discussion_r3993662324
  // The matrix below cannot compare whole-batch bytes when a valid prefix
  // changes the document. Isolate the rejected suffix after that same prefix.
  it("preserves post-deletion bytes across a rejected suffix and its retry", () => {
    const doc = mint({
      ...base,
      nodes: [...base.nodes, { ...base.nodes[0]!, id: 2, widgets_values: ["untouched"] }],
      last_node_id: 2,
    }, catalog);
    const deletion: Op = { op: "delete_node", ...envelope(20, 10), node_id: 1, removed_links: [] };
    const candidate: SetWidgetOp = { ...write(21, 20, "candidate", "0"), widget: null as unknown as string };
    const suffix: Op = { ...write(22, 30, "suffix", "0"), node_id: 2 };
    try {
      expect(applyOps(doc, [deletion], catalog).outcomes).toEqual([
        { op_id: deletion.op_id, outcome: "applied" },
      ]);
      expect(project(doc, catalog).nodes.map((node) => node.id)).toEqual([2]);
      const before = Y.encodeStateAsUpdate(doc);
      const rootNames = [...doc.share.keys()].sort();
      for (let attempt = 0; attempt < 2; attempt++) {
        const result = applyOps(doc, [candidate, suffix], catalog);
        expect(result.outcomes).toEqual([
          { op_id: candidate.op_id, outcome: "rejected", reason: expect.objectContaining({ code: "malformed_op" }) },
          { op_id: suffix.op_id, outcome: "rejected", reason: expect.objectContaining({ code: "batch_aborted" }) },
        ]);
        expect(Y.encodeStateAsUpdate(doc), `rejected suffix attempt ${attempt}`).toEqual(before);
        expect([...doc.share.keys()].sort()).toEqual(rootNames);
        expect([...doc.getMap("__applied").keys()]).toEqual([deletion.op_id]);
      }
      // The aborted suffix is still eligible on a subsequent independent call.
      expect(applyOps(doc, [suffix], catalog).outcomes).toEqual([
        { op_id: suffix.op_id, outcome: "applied" },
      ]);
      expect(project(doc, catalog).nodes[0]?.widgets_values).toEqual(["suffix"]);
    } finally {
      doc.destroy();
    }
  });

  // A6's document-dependent unknown-widget rejection is intentionally NOT
  // conflated with op-only malformed shape. Include the valid neighbor so an
  // implementation rejecting every candidate cannot satisfy this matrix.
  for (const shape of ["valid", "malformed", "unknown-widget"] as const) {
    for (const deletedFirst of [false, true]) {
      const widget = { valid: "text", malformed: null as unknown as string, "unknown-widget": "absent-widget" }[shape];
      const code = {
        valid: undefined,
        malformed: "malformed_op",
        "unknown-widget": deletedFirst ? undefined : "unknown_widget",
      }[shape];
      it.each(["together", "split"] as const)(`${shape}/deletedFirst=${deletedFirst}/%s`, (mode) => {
        const doc = mint({
          ...base,
          nodes: [...base.nodes, { ...base.nodes[0]!, id: 2, widgets_values: ["untouched"] }],
          last_node_id: 2,
        }, catalog);
        const deletion: Op = { op: "delete_node", ...envelope(20, 10), node_id: 1, removed_links: [] };
        const candidate: SetWidgetOp = {
          ...write(21, 20, "candidate", "0"),
          widget,
        };
        const suffix: Op = { ...write(22, 30, "suffix", "0"), node_id: 2 };
        const history = deletedFirst ? [deletion, candidate, suffix] : [candidate, deletion, suffix];
        const candidateIndex = deletedFirst ? 1 : 0;
        const expected = history.map((op, index) => {
          if (index === candidateIndex && code !== undefined) {
            return { op_id: op.op_id, outcome: "rejected", code };
          }
          if (mode === "together" && code !== undefined && index > candidateIndex) {
            return { op_id: op.op_id, outcome: "rejected", code: "batch_aborted" };
          }
          return {
            op_id: op.op_id,
            outcome: index === candidateIndex && deletedFirst ? "no-op" : "applied",
            code: undefined,
          };
        });
        try {
          const actual = [];
          for (const batch of mode === "together" ? [history] : history.map((op) => [op])) {
            const before = Y.encodeStateAsUpdate(doc);
            const result = applyOps(doc, batch, catalog);
            actual.push(...result.outcomes.map((o) => ({
              op_id: o.op_id, outcome: o.outcome, code: o.outcome === "rejected" ? o.reason.code : undefined,
            })));
            if (result.outcomes.every((o) => o.outcome === "rejected")) {
              expect(Y.encodeStateAsUpdate(doc)).toEqual(before);
            }
          }
          expect(actual).toEqual(expected);
          expect([...doc.getMap("__applied").keys()].sort()).toEqual(
            expected.filter((o) => o.outcome !== "rejected").map((o) => o.op_id).sort(),
          );
          expect(project(doc, catalog).nodes.find((node) => node.id === 2)?.widgets_values).toEqual(
            [code !== undefined && mode === "together" ? "untouched" : "suffix"],
          );
          expect(project(doc, catalog).nodes.some((node) => node.id === 1)).toBe(
            !deletedFirst && code !== undefined && mode === "together",
          );
          expect(checkGraphInvariants(doc)).toEqual([]);
        } finally {
          doc.destroy();
        }
      });
    }
  }
});
