/**
 * The RUNTIME half of issue #17.
 *
 * `test/types/invalid-states.negative.ts` pins what this repo's call sites can
 * no longer construct. That protects nobody on its own: ops arrive over a wire
 * from comfy-cli and any other implementation, and a JSON payload does not
 * type-check. So every state made unrepresentable there is audited here for
 * what the applier ACTUALLY does when it arrives anyway, and the answers are
 * pinned — including the uncomfortable ones.
 *
 * Two groups, and the distinction is the whole point:
 *
 *  - REJECTED — the runtime refuses the op with a named code and leaves the
 *    doc byte-identical. The type change is pure hygiene; the document was
 *    never at risk.
 *  - ACCEPTED — the runtime applies the op. Usually it then silently does
 *    something other than what the op says; the type change closes this repo's
 *    door while the wire door stays open. These tests exist so the behaviour
 *    is named and any future change to it is deliberate rather than
 *    accidental. They are NOT an endorsement: tightening any of them changes
 *    what is legal on the wire and needs a comfy-cli counterpart first.
 *    TWO EXCEPTIONS inside that group are invariant-MANDATED rather than
 *    mishandled — see the group 2 banner below before "fixing" either.
 */
import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import {
  applyOps,
  mint,
  project,
  type Op,
  type WidgetCatalog,
  type WorkflowJSON,
} from "../src/index.js";

const catalog: WidgetCatalog = {
  types: {
    KSampler: { widget_order: ["seed", "steps", "cfg", "sampler_name", "scheduler", "denoise"] },
    CheckpointLoaderSimple: { widget_order: ["ckpt_name"] },
  },
};

let seq = 0;
const env = () => {
  const actor = "peer";
  return {
    op_id: `i17_${seq++}`.padEnd(32, "0"),
    actor,
    base_version: 1,
    stamp: [1, actor] as [number, string],
  };
};

function baseDoc(): Y.Doc {
  const wf: WorkflowJSON = {
    nodes: [
      {
        id: 1,
        type: "KSampler",
        pos: [0, 0],
        inputs: [{ name: "model", type: "MODEL", link: null }],
        outputs: [{ name: "LATENT", type: "LATENT", links: [] }],
        widgets_values: [1, 2, 3, "a", "b", 1],
      },
      {
        id: 2,
        type: "CheckpointLoaderSimple",
        pos: [0, 0],
        inputs: [],
        outputs: [{ name: "MODEL", type: "MODEL", links: [] }],
        widgets_values: ["x.ckpt"],
      },
    ],
    links: [],
    last_node_id: 2,
    last_link_id: 0,
  } as unknown as WorkflowJSON;
  return mint(wf, catalog);
}

const bytes = (doc: Y.Doc) => Buffer.from(Y.encodeStateAsUpdate(doc)).toString("hex");

/**
 * An op shape this repo's types no longer permit. Every call site below goes
 * through here so the cast is never incidental: it marks a value that can only
 * originate outside this package.
 */
const wireOp = (shape: Record<string, unknown>): Op => shape as unknown as Op;

// ---------------------------------------------------------------------------
// Group 1 — REJECTED at runtime, with a named code, doc untouched
//
// "Doc untouched" is asserted per case here and holds for all three, but it is
// NOT a general property of rejection in this package and must not be read as
// one. Named so this file's three green byte-identity assertions are not
// mistaken for a survey.
//
// NARROWED (issue #10, PR #34) — and deliberately not retired. The two
// rejection codes this note named are now hoisted above the slot append:
// `malformed_op` for a non-string `grow.inputcount.widget` and `unknown_widget`
// for one the catalogue cannot describe both reject byte-identically, pinned by
// `test/reject-no-mutation.regression.test.ts`.
//
// Amendment A9 closes the cloneable-but-unstorable, `connect.link_id`, and
// `delete_node.removed_links` write-order holes. Amendment A10 closes reference
// cycles, and Amendment A14 closes the `connect.link_type` shape hole.
//
// A `Symbol` or throwing-`valueOf` `base_version` used to be a third trigger
// here. Hoisting `stampKey` into `requireOpOnlyValid` closed it on every
// `connect` path; measured byte-identical afterwards.
// ---------------------------------------------------------------------------

describe("#17 group 1: invalid states the runtime already rejects", () => {
  it("connect with a null to_slot and no grow is malformed_op", () => {
    const doc = baseDoc();
    const before = bytes(doc);
    const result = applyOps(
      doc,
      [
        wireOp({
          op: "connect",
          ...env(),
          link_id: 100,
          from_node: 2,
          from_slot: 0,
          to_node: 1,
          to_slot: null,
          link_type: "MODEL",
        }),
      ],
      catalog,
    );
    expect(result.outcomes.find((o) => o.outcome === "rejected")?.reason.code).toBe("malformed_op");
    expect(result.outcomes.find((o) => o.outcome === "rejected")?.reason.message).toMatch(/to_slot must be a number unless grow is present/);
    expect(result.outcomes.filter((o) => o.outcome === "applied").map((o) => o.op_id)).toEqual([]);
    expect(bytes(doc)).toBe(before);
  });

  it("set_widget with a non-empty path and no inner_widget is malformed_op", () => {
    const doc = baseDoc();
    const before = bytes(doc);
    const result = applyOps(
      doc,
      [
        wireOp({
          op: "set_widget",
          ...env(),
          node_id: 1,
          widget: "steps",
          value: 42,
          path: ["1", "27"],
        }),
      ],
      catalog,
    );
    expect(result.outcomes.find((o) => o.outcome === "rejected")?.reason.code).toBe("malformed_op");
    expect(result.outcomes.find((o) => o.outcome === "rejected")?.reason.message).toMatch(/interior write without inner_widget/);
    expect(bytes(doc)).toBe(before);
  });

  it("reset_doc is op_deferred — removing it from `Op` did not weaken the wire path", () => {
    // The type-level change (#17) took `ResetDocOp` out of `Op`. The runtime
    // rejection comes from `DEFERRED_OPS`, a runtime array, and is unchanged.
    const doc = baseDoc();
    const before = bytes(doc);
    const result = applyOps(
      doc,
      [wireOp({ op: "reset_doc", ...env(), workflow: { nodes: [], links: [] } })],
      catalog,
    );
    expect(result.outcomes.find((o) => o.outcome === "rejected")?.reason.code).toBe("op_deferred");
    expect(result.outcomes.filter((o) => o.outcome === "applied").map((o) => o.op_id)).toEqual([]);
    expect(result.ops_seen).toBe(0);
    expect(bytes(doc)).toBe(before);
  });
});

// ---------------------------------------------------------------------------
// Group 2 — ACCEPTED at runtime; behaviour pinned so a change to it is
// deliberate. Most of these are genuine silent mishandling. TWO ARE NOT, and
// the distinction is load-bearing rather than pedantic:
//
//  - the `stamp`-contradicts-envelope case is REQUIRED by KA-2/FC-2 (see
//    `Stamp` in `src/types.ts` and `test/ka2-stamp-inside-op.test.ts`);
//    "tightening" it would collapse ordering onto the server-assigned scalar
//    FC-2 forecloses. It is here because the relationship between the three
//    fields is not expressible in the type system, not because it is a bug;
//  - the `op_id` shape case is an envelope-hygiene gap: the op does exactly
//    what it says, nothing is mishandled, and the contract that is unenforced
//    is a FORMAT rule (vocabulary §8.2), not a field combination.
//
// Neither is reachable only from outside this package either — both shapes are
// valid `Op` literals today, so the `wireOp()` marker on them is about keeping
// the call sites uniform, not about a type this repo can no longer construct.
// ---------------------------------------------------------------------------

describe("#17 group 2: invalid states the wire still accepts (behaviour pinned, not endorsed)", () => {
  it("add_node whose node.id differs from node_id stores under node_id and PROJECTS the other id", () => {
    // The severe one. The doc keys the node by `op.node_id` while the payload
    // is inserted verbatim, so `project()` emits a node whose `id` is not the
    // key anything addresses it by — schema §1.1 says the key IS
    // `String(node.id)`. Every later op still resolves (they use the key), so
    // the divergence only shows up in the projection, where the link tuple
    // below points at a node id that no projected node carries.
    const doc = baseDoc();
    const result = applyOps(
      doc,
      [
        wireOp({
          op: "add_node",
          ...env(),
          node_id: 9,
          class_type: "KSampler",
          pos: [0, 0],
          node: {
            id: 77,
            type: "KSampler",
            inputs: [{ name: "model", type: "MODEL", link: null }],
            outputs: [],
          },
        }),
        // Addressed at 9 — the key — and it lands.
        wireOp({
          op: "connect",
          ...env(),
          link_id: 500,
          from_node: 2,
          from_slot: 0,
          to_node: 9,
          to_slot: 0,
          link_type: "MODEL",
        }),
      ],
      catalog,
    );
    expect(result.outcomes.some((o) => o.outcome === "rejected")).toBe(false);
    expect(result.outcomes.filter((o) => o.outcome === "applied").map((o) => o.op_id)).toHaveLength(2);

    const wf = project(doc, catalog);
    const ids = wf.nodes.map((n) => n.id);
    expect(ids).toContain(77);
    expect(ids).not.toContain(9);
    // A link whose destination node id exists in NO projected node: the
    // workflow JSON this produces is internally inconsistent.
    expect(wf.links).toEqual([[500, 2, 0, 9, 0, "MODEL"]]);
    expect(ids).not.toContain((wf.links[0] as unknown[])[3]);
  });

  it("add_node whose node payload has no id at all projects a node with no id", () => {
    const doc = baseDoc();
    const result = applyOps(
      doc,
      [
        wireOp({
          op: "add_node",
          ...env(),
          node_id: 9,
          class_type: "KSampler",
          pos: [0, 0],
          node: { type: "KSampler" },
        }),
      ],
      catalog,
    );
    expect(result.outcomes.some((o) => o.outcome === "rejected")).toBe(false);
    const added = project(doc, catalog).nodes.find((n) => n.type === "KSampler" && !("pos" in n))!;
    expect(added).toBeDefined();
    expect("id" in added).toBe(false);
  });

  it("add_node ignores class_type and pos entirely — the node payload decides both", () => {
    const doc = baseDoc();
    const result = applyOps(
      doc,
      [
        wireOp({
          op: "add_node",
          ...env(),
          node_id: 9,
          class_type: "CheckpointLoaderSimple", // contradicts node.type
          pos: [500, 500], // contradicts node.pos
          node: { id: 9, type: "KSampler", pos: [1, 1] },
        }),
      ],
      catalog,
    );
    expect(result.outcomes.some((o) => o.outcome === "rejected")).toBe(false);
    const added = project(doc, catalog).nodes.find((n) => n.id === 9)!;
    expect(added.type).toBe("KSampler");
    expect(added.pos).toEqual([1, 1]);
  });

  it("connect with both grow and a concrete to_slot grows a slot and ignores to_slot", () => {
    const doc = baseDoc();
    const result = applyOps(
      doc,
      [
        wireOp({
          op: "connect",
          ...env(),
          link_id: 100,
          from_node: 2,
          from_slot: 0,
          to_node: 1,
          to_slot: 0, // names slot 0 …
          link_type: "MODEL",
          grow: { name: "images.image0", type: "MODEL" }, // … but grow wins
        }),
      ],
      catalog,
    );
    expect(result.outcomes.some((o) => o.outcome === "rejected")).toBe(false);
    const node1 = project(doc, catalog).nodes.find((n) => n.id === 1)!;
    // Slot 0 is untouched; a new slot 1 was grown and wired instead.
    expect(node1.inputs).toEqual([
      { name: "model", type: "MODEL", link: null },
      { name: "images.image0", type: "MODEL", link: 100, grow_id: 100 },
    ]);
    // Sharper still: a grow WITHOUT `grow.inputcount` — this one — is
    // identity-only and claims no LWW register, because the grown slot is
    // keyed by `grow_id` and there is nothing to contest (schema §3's
    // autogrow row). Amendment A7 does record canonicalization metadata. The
    // same op WITHOUT `grow` would claim `["input","1",0]`,
    // so a caller who believed `to_slot: 0` meant something got neither the
    // slot nor the LWW protection that goes with it.
    //
    // Scoped deliberately: this is NOT true of every autogrow. A grow that
    // carries `grow.inputcount` DOES claim `("widget", to_node, inputcount)`,
    // sharing the connect's stamp (schema §8.3, vocabulary §8.4). Pinned
    // directly below so the two cases cannot be conflated again.
    expect([...doc.getMap("__stamps").keys()]).toEqual([
      JSON.stringify(["link", "100"]),
      JSON.stringify(["grow", "1", "100", "images"]),
      JSON.stringify(["grow_request", "1", "100", "images"]),
    ]);
  });

  it("an autogrow connect carrying grow.inputcount DOES claim a stamped register", () => {
    // Guards the scoping of the comment above: "autogrow is not gated" is a
    // statement about the grown SLOT, not about the op. One op, two registers.
    const doc = baseDoc();
    const result = applyOps(
      doc,
      [
        wireOp({
          op: "connect",
          ...env(),
          link_id: 101,
          from_node: 2,
          from_slot: 0,
          to_node: 1,
          to_slot: null,
          link_type: "MODEL",
          grow: { name: "images.image0", type: "MODEL", inputcount: { widget: "steps", value: 7 } },
        }),
      ],
      catalog,
    );
    expect(result.outcomes.some((o) => o.outcome === "rejected")).toBe(false);
    expect([...doc.getMap("__stamps").keys()]).toEqual([
      JSON.stringify(["link", "101"]),
      JSON.stringify(["grow", "1", "101", "images"]),
      JSON.stringify(["grow_request", "1", "101", "images"]),
      JSON.stringify(["widget", "1", "0", "steps"]),
    ]);
  });

  it("set_widget with an inner_widget but no path writes the OUTER widget, not the named one", () => {
    const doc = baseDoc();
    const result = applyOps(
      doc,
      [
        wireOp({
          op: "set_widget",
          ...env(),
          node_id: 1,
          widget: "steps",
          value: 42,
          inner_widget: "seed", // names `seed` …
        }),
      ],
      catalog,
    );
    expect(result.outcomes.some((o) => o.outcome === "rejected")).toBe(false);
    const node1 = project(doc, catalog).nodes.find((n) => n.id === 1)!;
    // … and `steps` (index 1) is what changed; `seed` (index 0) did not.
    expect(node1.widgets_values).toEqual([1, 42, 3, "a", "b", 1]);
  });

  it("set_widget with an EMPTY path and an inner_widget behaves the same way", () => {
    const doc = baseDoc();
    const result = applyOps(
      doc,
      [
        wireOp({
          op: "set_widget",
          ...env(),
          node_id: 1,
          widget: "steps",
          value: 43,
          path: [],
          inner_widget: "seed",
        }),
      ],
      catalog,
    );
    expect(result.outcomes.some((o) => o.outcome === "rejected")).toBe(false);
    const node1 = project(doc, catalog).nodes.find((n) => n.id === 1)!;
    expect(node1.widgets_values).toEqual([1, 43, 3, "a", "b", 1]);
  });

  it("an interior set_widget ignores node_id when it disagrees with path[0]", () => {
    // `node_id` is required on every set_widget but is dead weight on the
    // interior path — the head node comes from `path[0]`, and the LWW target
    // key is built from the path, so the two never even contest one register.
    const doc = baseDoc();
    const result = applyOps(
      doc,
      [
        wireOp({
          op: "set_widget",
          ...env(),
          node_id: 999, // no such node
          widget: "steps",
          value: 44,
          path: ["1"],
          inner_widget: "steps",
        }),
      ],
      catalog,
    );
    expect(result.outcomes.some((o) => o.outcome === "rejected")).toBe(false);
    const node1 = project(doc, catalog).nodes.find((n) => n.id === 1)!;
    expect(node1.widgets_values).toEqual([1, 44, 3, "a", "b", 1]);
    expect([...doc.getMap("__stamps").keys()]).toEqual([
      JSON.stringify(["widget", ["1"], "0", "steps"]),
    ]);
  });

  it("a stamp that contradicts base_version/actor is HONOURED — the KA-2 design, not a defect", () => {
    // NOT a mishandled state, and listed here only because the type system
    // cannot express the relationship between the three fields. `stamp` is
    // AUTHORITATIVE by design: #56 landed that on `Stamp` in `src/types.ts`
    // ("the ordering key is read out of THIS field whenever the op carries
    // one; the envelope reading is a fallback... A minter may set it to
    // something the envelope does not imply"), because reading the envelope
    // instead would collapse ordering onto the server-assigned scalar FC-2
    // forecloses. `test/ka2-stamp-inside-op.test.ts` is the conformance suite
    // for exactly this, at every register.
    //
    // What is pinned HERE is only the consequence a caller must know: because
    // `stampKey` prefers the stamp, an op's envelope `base_version`/`actor` do
    // not decide its order, so a high-base_version op with a low stamp loses.
    // Tightening this — requiring `stamp` to equal `[base_version, actor]` —
    // would REJECT a currently-legal op and break KA-2/FC-2. Do not.
    const doc = baseDoc();
    const high = applyOps(
      doc,
      [
        wireOp({
          op: "set_widget",
          op_id: "s1".padEnd(32, "0"),
          actor: "zoe",
          base_version: 99,
          stamp: [1, "aaa"], // contradicts base_version 99 / actor zoe
          node_id: 1,
          widget: "steps",
          value: "high-base_version",
        }),
      ],
      catalog,
    );
    expect(high.outcomes.some((o) => o.outcome === "rejected")).toBe(false);

    const low = applyOps(
      doc,
      [
        wireOp({
          op: "set_widget",
          op_id: "s2".padEnd(32, "0"),
          actor: "aaa",
          base_version: 2,
          stamp: [2, "aaa"],
          node_id: 1,
          widget: "steps",
          value: "low-base_version",
        }),
      ],
      catalog,
    );
    expect(low.outcomes.some((o) => o.outcome === "rejected")).toBe(false);

    const node1 = project(doc, catalog).nodes.find((n) => n.id === 1)!;
    expect(Array.isArray(node1.widgets_values) ? node1.widgets_values[1] : undefined).toBe("low-base_version");
  });

  it("op_id is accepted whatever its shape — the uuid4-hex contract is unenforced", () => {
    // Vocabulary §8.2 pins op_id as 32 lowercase hex chars, and it is the
    // final LWW tiebreak, so its FORM is load-bearing for conflict outcomes.
    // `validateEnvelope` only checks non-empty string.
    const doc = baseDoc();
    const result = applyOps(
      doc,
      [wireOp({ op: "set_widget", op_id: "!", actor: "a", base_version: 1, stamp: [1, "a"], node_id: 1, widget: "steps", value: 7 })],
      catalog,
    );
    expect(result.outcomes.some((o) => o.outcome === "rejected")).toBe(false);
    expect(result.outcomes.filter((o) => o.outcome === "applied").map((o) => o.op_id)).toEqual(["!"]);
  });
});
