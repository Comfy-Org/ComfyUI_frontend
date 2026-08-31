/**
 * Concrete-input contention: `connect` is a stamp-gated LWW register.
 *
 * Amendment v1.2 of op-vocabulary-v1.md (schema §3): the occupant of a
 * CONCRETE input slot is a scalar target `("input", to_node, to_slot)` under
 * the same `[base_version, actor, op_id]` last-writer-wins comparison that
 * governs `set_widget`. Before the amendment only `set_widget`-family writes
 * were `__stamps`-gated, so a connect to an occupied input displaced the
 * occupant by ARRIVAL ORDER — and composed with delete-wins that escalated
 * from "a different link id" to "a link that exists in one interleaving and
 * not the other", contradicting schema §2.5.
 *
 * Found by adversarial testing (cloud PR #6722, FINDING 1), not by review.
 *
 * These tests are the permutation proof: for each scenario every
 * order-preserving interleaving of the two writers' causal sequences must
 * produce a byte-identical projection.
 */
import * as Y from "yjs";
import { describe, expect, it } from "vitest";
import {
  applyOps,
  mint,
  project,
  type ConnectOp,
  type DeleteNodeOp,
  type Op,
  type WorkflowJSON,
  type WorkflowNode,
} from "../src/index.js";
import { canonicalize, loadCatalog } from "./helpers.js";
import { checkGraphInvariants } from "./graph-invariant-oracle.js";

const catalog = loadCatalog();

const AGENT = "agent:th_8f2c:12";
const HUMAN = "human:u_41ab:tab_2";

const SAMPLER = 200;
const ENCODER = 300;
const OTHER_ENCODER = 310;
const FRESH = 400;
/** KSampler input index of `positive` — the contested concrete slot. */
const POSITIVE = 1;

// ---------------------------------------------------------------------------
// fixtures
// ---------------------------------------------------------------------------

function encoderNode(id: number, text: string): WorkflowNode {
  return {
    id,
    type: "CLIPTextEncode",
    pos: [40, 60],
    size: [240, 86],
    flags: {},
    order: 0,
    mode: 0,
    inputs: [{ name: "clip", type: "CLIP", link: null }],
    outputs: [{ name: "CONDITIONING", type: "CONDITIONING", links: [] }],
    properties: {},
    widgets_values: [text],
  };
}

function samplerNode(): WorkflowNode {
  return {
    id: SAMPLER,
    type: "KSampler",
    pos: [360, 60],
    size: [240, 290],
    flags: {},
    order: 1,
    mode: 0,
    inputs: [
      { name: "model", type: "MODEL", link: null },
      { name: "positive", type: "CONDITIONING", link: null },
      { name: "negative", type: "CONDITIONING", link: null },
      { name: "latent_image", type: "LATENT", link: null },
    ],
    outputs: [{ name: "LATENT", type: "LATENT", links: [] }],
    properties: {},
    widgets_values: [0, "fixed", 20, 8.0, "euler", "simple", 1.0],
  };
}

/** `200.positive` is EMPTY — the FINDING's own base. */
function baseWorkflow(): WorkflowJSON {
  return {
    last_node_id: 400,
    last_link_id: 0,
    nodes: [encoderNode(ENCODER, "the human's prompt"), samplerNode()],
    links: [],
    groups: [],
    config: {},
    extra: {},
    version: 0.4,
  };
}

/** `200.positive` is already WIRED (link 9000 from node 310) — the displacement case. */
function wiredBaseWorkflow(): WorkflowJSON {
  const other = encoderNode(OTHER_ENCODER, "the incumbent");
  (other.outputs as { links: number[] }[])[0]!.links = [9000];
  const sampler = samplerNode();
  (sampler.inputs as { link: number | null }[])[POSITIVE]!.link = 9000;
  return {
    last_node_id: 400,
    last_link_id: 9000,
    nodes: [encoderNode(ENCODER, "the human's prompt"), other, sampler],
    links: [[9000, OTHER_ENCODER, 0, SAMPLER, POSITIVE, "CONDITIONING"]],
    groups: [],
    config: {},
    extra: {},
    version: 0.4,
  };
}

// ---------------------------------------------------------------------------
// op builders — op_ids are 32 lowercase hex (vocabulary §8.2), and load-bearing
// ---------------------------------------------------------------------------

function opId(tag: string): string {
  return (tag + "0".repeat(32)).slice(0, 32);
}

function connectOp(
  tag: string,
  actor: string,
  baseVersion: number,
  linkId: number,
  fromNode: number,
  toNode: number,
  toSlot: number,
): ConnectOp {
  return {
    op: "connect",
    op_id: opId(tag),
    actor,
    base_version: baseVersion,
    stamp: [baseVersion, actor],
    link_id: linkId,
    from_node: fromNode,
    from_slot: 0,
    to_node: toNode,
    to_slot: toSlot,
    link_type: "CONDITIONING",
  };
}

function addEncoder(tag: string, actor: string, baseVersion: number, nodeId: number, text: string): Op {
  return {
    op: "add_node",
    op_id: opId(tag),
    actor,
    base_version: baseVersion,
    stamp: [baseVersion, actor],
    node_id: nodeId,
    class_type: "CLIPTextEncode",
    pos: [40, 300],
    node: encoderNode(nodeId, text),
  } as Op;
}

function deleteOp(tag: string, actor: string, baseVersion: number, nodeId: number, removed: number[]): DeleteNodeOp {
  return {
    op: "delete_node",
    op_id: opId(tag),
    actor,
    base_version: baseVersion,
    stamp: [baseVersion, actor],
    node_id: nodeId,
    removed_links: removed,
  };
}

// ---------------------------------------------------------------------------
// permutation harness
// ---------------------------------------------------------------------------

/** Every order-preserving interleaving of two causal sequences. */
function interleavings<T>(a: T[], b: T[]): T[][] {
  if (a.length === 0) return [b.slice()];
  if (b.length === 0) return [a.slice()];
  return [
    ...interleavings(a.slice(1), b).map((rest) => [a[0]!, ...rest]),
    ...interleavings(a, b.slice(1)).map((rest) => [b[0]!, ...rest]),
  ];
}

function tags(ops: Op[]): string {
  return ops.map((o) => o.op_id.replace(/0+$/, "")).join(",");
}

/**
 * `canonicalize` + a sort of every `outputs[].links` array.
 *
 * SEPARATE KNOWN GAP, deliberately NOT closed by amendment v1.2: an output
 * port's `links` array is appended in ARRIVAL ORDER, so two concurrent
 * connects out of one source node into two DIFFERENT inputs project the same
 * set in two different orders. That is an ordering artifact of a set-valued
 * field, not a lost or invented link — closing it means canonicalizing §7's
 * projection (and regenerating every fixture final, several of which record
 * unsorted out-links today), which is its own contract change. The pinning
 * test at the bottom of this file keeps it a tested fact; sorting here keeps
 * the register tests measuring the register.
 */
function comparable(wf: WorkflowJSON): string {
  const c = canonicalize(wf) as WorkflowJSON;
  const nodes = (c.nodes as WorkflowNode[]).map((n) => ({
    ...n,
    outputs: Array.isArray(n.outputs)
      ? (n.outputs as { links?: unknown[] }[]).map((o) =>
          Array.isArray(o.links) ? { ...o, links: [...o.links].sort() } : o,
        )
      : n.outputs,
  }));
  return JSON.stringify({ ...c, nodes });
}

/** Apply one arrival order to a fresh fork of a common snapshot (schema §9). */
function runOrder(base: WorkflowJSON, ops: Op[]): { json: string; wf: WorkflowJSON } {
  const minted = mint(base, catalog);
  const doc = new Y.Doc();
  Y.applyUpdate(doc, Y.encodeStateAsUpdate(minted));
  const res = applyOps(doc, ops, catalog);
  const failed = res.outcomes.find((outcome) => outcome.outcome === "rejected");
  expect(failed, `a legal interleaving must never abort the batch: ${JSON.stringify(failed)}`).toBeUndefined();
  const violations = checkGraphInvariants(doc);
  expect(violations, `graph invariant violation: ${JSON.stringify(violations)}`).toEqual([]);
  const wf = project(doc, catalog);
  return { json: comparable(wf), wf };
}

/** Assert every interleaving of two writers converges; return the agreed projection. */
function expectConvergent(base: WorkflowJSON, writerA: Op[], writerB: Op[]): WorkflowJSON {
  const orders = interleavings(writerA, writerB);
  expect(orders.length).toBeGreaterThan(1);
  let want: string | null = null;
  let agreed!: WorkflowJSON;
  for (const order of orders) {
    const { json, wf } = runOrder(base, order);
    if (want === null) {
      want = json;
      agreed = wf;
      continue;
    }
    expect(json, `interleaving [${tags(order)}] diverged`).toBe(want);
  }
  return agreed;
}

function inputLink(wf: WorkflowJSON, nodeId: number, slot: number): unknown {
  const node = wf.nodes.find((n) => String(n.id) === String(nodeId));
  expect(node, `node ${nodeId} missing from projection`).toBeDefined();
  return (node!.inputs as { link: unknown }[])[slot]!.link;
}

function linkIds(wf: WorkflowJSON): unknown[] {
  return wf.links.map((l) => (l as unknown[])[0]);
}

// ---------------------------------------------------------------------------
// 1. the FINDING's own repro
// ---------------------------------------------------------------------------

describe("FINDING 1 repro — connect vs connect+delete on one concrete input", () => {
  // Writer A: mint a fresh encoder and wire it into 200.positive.
  // Writer B: wire the EXISTING encoder into the same input, then delete it.
  //
  // Before the amendment: order A-then-B left `positive` empty (B's connect
  // displaced A's link, then B's delete retired B's link), while order
  // B-then-A left link 9003 in place. Same op set, two legal interleavings,
  // two different graphs.
  const writerB = (bv: number): Op[] => [
    connectOp("b1", HUMAN, bv, 9004, ENCODER, SAMPLER, POSITIVE),
    deleteOp("b2", HUMAN, bv, ENCODER, [9004]),
  ];
  const writerA = (bv: number): Op[] => [
    addEncoder("a1", AGENT, bv, FRESH, "replacement"),
    connectOp("a2", AGENT, bv, 9003, FRESH, SAMPLER, POSITIVE),
  ];

  it("converges in all 6 interleavings when the agent's connect holds the register", () => {
    // base_version 9 vs 5: the agent's connect is the higher stamp, so it owns
    // `positive` in EVERY order; the human's connect never lands, and its
    // delete cannot retire a link that was never created.
    const wf = expectConvergent(baseWorkflow(), writerA(9), writerB(5));
    expect(inputLink(wf, SAMPLER, POSITIVE)).toBe(9003);
    expect(linkIds(wf)).toEqual([9003]);
    // The displaced/losing link record is GONE, not orphaned.
    expect(linkIds(wf)).not.toContain(9004);
  });

  it("converges in all 6 interleavings when the human's connect holds the register", () => {
    // base_version 9 to the human: its connect wins the register in every
    // order, and its own delete then retires the winning link — so `positive`
    // is deterministically EMPTY and neither link survives.
    const wf = expectConvergent(baseWorkflow(), writerA(5), writerB(9));
    expect(inputLink(wf, SAMPLER, POSITIVE)).toBeNull();
    expect(linkIds(wf)).toEqual([]);
    // The agent's node still exists — only its link lost the register.
    expect(wf.nodes.map((n) => n.id)).toContain(FRESH);
  });

  it("converges on a tie broken by actor, then by op_id", () => {
    // Same base_version: 'agent:...' < 'human:...' by code point, so the human
    // wins on actor alone — no op_id needed.
    const wf = expectConvergent(baseWorkflow(), writerA(5), writerB(5));
    expect(inputLink(wf, SAMPLER, POSITIVE)).toBeNull();
    expect(linkIds(wf)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 2. the register rule stated directly
// ---------------------------------------------------------------------------

describe("the concrete input slot is a stamp-ordered register", () => {
  it("the higher stamp owns the input whichever connect arrives last", () => {
    const agentConnect = connectOp("c1", AGENT, 5, 9101, ENCODER, SAMPLER, POSITIVE);
    const humanAdd = addEncoder("c2", HUMAN, 9, FRESH, "rival");
    const humanConnect = connectOp("c3", HUMAN, 9, 9102, FRESH, SAMPLER, POSITIVE);

    const humanLast = runOrder(baseWorkflow(), [agentConnect, humanAdd, humanConnect]);
    const agentLast = runOrder(baseWorkflow(), [humanAdd, humanConnect, agentConnect]);

    expect(inputLink(humanLast.wf, SAMPLER, POSITIVE)).toBe(9102);
    expect(inputLink(agentLast.wf, SAMPLER, POSITIVE)).toBe(9102);
    expect(humanLast.json).toBe(agentLast.json);
    // The losing connect contributes NO link record in either order.
    expect(linkIds(humanLast.wf)).toEqual([9102]);
    expect(linkIds(agentLast.wf)).toEqual([9102]);
  });

  it("a lower-stamped connect neither displaces the occupant nor leaves a link", () => {
    const winner = connectOp("d1", HUMAN, 9, 9201, ENCODER, SAMPLER, POSITIVE);
    const loser = connectOp("d2", AGENT, 5, 9202, OTHER_ENCODER, SAMPLER, POSITIVE);
    const { wf } = runOrder(wiredBaseWorkflow(), [winner, loser]);
    expect(inputLink(wf, SAMPLER, POSITIVE)).toBe(9201);
    expect(linkIds(wf)).toEqual([9201]);
    // The loser's source output must not advertise a link that does not exist.
    const src = wf.nodes.find((n) => String(n.id) === String(OTHER_ENCODER))!;
    expect((src.outputs as { links: unknown[] }[])[0]!.links).toEqual([]);
  });

  it("distinct concrete inputs on the same node are independent registers", () => {
    // positive and negative are different targets: both connects land, in
    // either order.
    const a = connectOp("e1", AGENT, 5, 9301, ENCODER, SAMPLER, POSITIVE);
    const b = connectOp("e2", HUMAN, 9, 9302, OTHER_ENCODER, SAMPLER, 2);
    const wf = expectConvergent(wiredBaseWorkflow(), [a], [b]);
    expect(inputLink(wf, SAMPLER, POSITIVE)).toBe(9301);
    expect(inputLink(wf, SAMPLER, 2)).toBe(9302);
  });
});

// ---------------------------------------------------------------------------
// 3. composition with delete-wins
// ---------------------------------------------------------------------------

describe("register claim composes with delete-wins", () => {
  it("a winning connect whose source was concurrently deleted still clears the input", () => {
    // The second divergence the ungated path carried, independent of two-writer
    // contention: writer A rewires 200.positive from the incumbent (link 9000)
    // to node 300, while writer B deletes node 300.
    //   old behavior: connect-first retired 9000 and then lost its own link to
    //   the delete (input empty); delete-first made the connect a silent no-op
    //   and left 9000 in place. Two legal orders, two graphs.
    //   new behavior: the connect claims the register in both orders — the
    //   incumbent is retired — and the delete then denies it its link.
    const writerA: Op[] = [connectOp("f1", AGENT, 9, 9401, ENCODER, SAMPLER, POSITIVE)];
    const writerB: Op[] = [deleteOp("f2", HUMAN, 5, ENCODER, [])];
    const wf = expectConvergent(wiredBaseWorkflow(), writerA, writerB);
    expect(inputLink(wf, SAMPLER, POSITIVE)).toBeNull();
    expect(linkIds(wf)).toEqual([]);
  });

  it("a LOSING connect whose source was deleted leaves the winner untouched", () => {
    const writerA: Op[] = [
      connectOp("g1", AGENT, 5, 9501, ENCODER, SAMPLER, POSITIVE),
      deleteOp("g2", AGENT, 5, ENCODER, [9501]),
    ];
    const writerB: Op[] = [connectOp("g3", HUMAN, 9, 9502, OTHER_ENCODER, SAMPLER, POSITIVE)];
    const wf = expectConvergent(wiredBaseWorkflow(), writerA, writerB);
    expect(inputLink(wf, SAMPLER, POSITIVE)).toBe(9502);
    // The incumbent 9000 was retired by whichever connect claimed the register.
    expect(linkIds(wf)).toEqual([9502]);
  });

  it("deleting the DESTINATION still wins over any connect, in every order", () => {
    const writerA: Op[] = [connectOp("h1", AGENT, 9, 9601, ENCODER, SAMPLER, POSITIVE)];
    const writerB: Op[] = [deleteOp("h2", HUMAN, 5, SAMPLER, [9000])];
    const wf = expectConvergent(wiredBaseWorkflow(), writerA, writerB);
    expect(wf.nodes.map((n) => String(n.id))).not.toContain(String(SAMPLER));
    expect(linkIds(wf)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 4. autogrow stays UNGATED (the amendment's explicit carve-out)
// ---------------------------------------------------------------------------

describe("autogrow connects are not a shared register", () => {
  function batchImages(id: number): WorkflowNode {
    return {
      id,
      type: "BatchImagesNode",
      pos: [700, 60],
      size: [240, 100],
      flags: {},
      order: 2,
      mode: 0,
      inputs: [{ name: "images.image0", type: "IMAGE", link: null, grow_id: null }],
      outputs: [{ name: "IMAGE", type: "IMAGE", links: [] }],
      properties: {},
      widgets_values: [],
    };
  }

  function growConnect(tag: string, actor: string, bv: number, linkId: number, from: number): ConnectOp {
    return {
      ...connectOp(tag, actor, bv, linkId, from, 700, 0),
      to_slot: null,
      link_type: "IMAGE",
      grow: { name: "images.image0", type: "IMAGE" },
    };
  }

  it("two concurrent autogrows both survive, in both orders", () => {
    const base = baseWorkflow();
    base.nodes = [
      ...base.nodes,
      { ...encoderNode(500, "a"), type: "LoadImage", outputs: [{ name: "IMAGE", type: "IMAGE", links: [] }] },
      { ...encoderNode(510, "b"), type: "LoadImage", outputs: [{ name: "IMAGE", type: "IMAGE", links: [] }] },
      batchImages(700),
    ];
    const a = growConnect("i1", AGENT, 5, 9701, 500);
    const b = growConnect("i2", HUMAN, 9, 9702, 510);

    const forward = runOrder(base, [a, b]);
    const reverse = runOrder(base, [b, a]);
    // Both links exist in both orders: growing is non-clobbering by grow_id, so
    // the two writers never contend for one register (vocabulary §1.2).
    expect(linkIds(forward.wf).sort()).toEqual([9701, 9702]);
    expect(linkIds(reverse.wf).sort()).toEqual([9701, 9702]);
  });
});

// ---------------------------------------------------------------------------
// 5. generated interleavings — breadth over the hand-picked cases
// ---------------------------------------------------------------------------

describe("generated two-writer streams over a contested input", () => {
  /** Deterministic 32-bit LCG so a failure is reproducible from the seed. */
  function lcg(seed: number): () => number {
    let s = seed >>> 0;
    return () => {
      s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
      return s / 0x100000000;
    };
  }

  for (let seed = 1; seed <= 12; seed++) {
    it(`seed ${seed}: every interleaving converges`, () => {
      const rand = lcg(seed);
      const pick = <T>(xs: T[]): T => xs[Math.floor(rand() * xs.length)]!;
      const bvA = pick([3, 5, 7, 9]);
      const bvB = pick([3, 5, 7, 9]);
      const srcA = pick([ENCODER, OTHER_ENCODER, FRESH]);
      const srcB = pick([ENCODER, OTHER_ENCODER]);
      const slotA = pick([POSITIVE, 2]);
      const slotB = pick([POSITIVE, 2]);

      const writerA: Op[] = [
        addEncoder("j1", AGENT, bvA, FRESH, "generated"),
        connectOp("j2", AGENT, bvA, 9801, srcA, SAMPLER, slotA),
      ];
      const writerB: Op[] = [connectOp("j3", HUMAN, bvB, 9802, srcB, SAMPLER, slotB)];
      if (rand() < 0.5) writerB.push(deleteOp("j4", HUMAN, bvB, srcB, [9802]));

      expectConvergent(wiredBaseWorkflow(), writerA, writerB);
    });
  }
});

// ---------------------------------------------------------------------------
// 6. the batch-interior caveat, pinned honestly
// ---------------------------------------------------------------------------

describe("canonical source references", () => {
  it("projects outputs[].links in numeric link_id order", () => {
    // Two connects out of node 300 into two DIFFERENT inputs of node 200:
    // different registers, so both land in both orders — but the source's
    // out-links array stores arrival order, while projection gives this
    // set-valued field its canonical numeric link-id order (#156 option D).
    const a = connectOp("l1", AGENT, 5, 9001, ENCODER, SAMPLER, POSITIVE);
    const b = connectOp("l2", HUMAN, 9, 9002, ENCODER, SAMPLER, 2);
    const outLinks = (ops: Op[]): unknown[] => {
      const minted = mint(baseWorkflow(), catalog);
      const doc = new Y.Doc();
      Y.applyUpdate(doc, Y.encodeStateAsUpdate(minted));
      expect(applyOps(doc, ops, catalog).outcomes.find((outcome) => outcome.outcome === "rejected")).toBeUndefined();
      const wf = project(doc, catalog);
      const src = wf.nodes.find((n) => String(n.id) === String(ENCODER))!;
      return (src.outputs as { links: unknown[] }[])[0]!.links;
    };
    expect(outLinks([a, b])).toEqual([9001, 9002]);
    expect(outLinks([b, a])).toEqual([9001, 9002]);
  });
});

describe("ops minted in one batch share a base_version", () => {
  it("two connects to one input inside one batch resolve by op_id, not batch position", () => {
    // Documented in amendment v1.2 and TRUE OF set_widget SINCE THE FREEZE:
    // `apply_specs` stamps every op in a batch with the same base_version, so
    // a same-target pair inside one batch is decided by the op_id tiebreak.
    // Convergence holds (that is the point); "last spec wins" does not.
    const first = connectOp("k1", AGENT, 5, 9901, ENCODER, SAMPLER, POSITIVE);
    const second = connectOp("k0", AGENT, 5, 9902, OTHER_ENCODER, SAMPLER, POSITIVE);
    const { wf } = runOrder(baseWorkflow(), [first, second]);
    // "k0…" < "k1…" by code point, so the FIRST spec wins despite arriving first.
    expect(inputLink(wf, SAMPLER, POSITIVE)).toBe(9901);
    expect(linkIds(wf)).toEqual([9901]);
  });
});
