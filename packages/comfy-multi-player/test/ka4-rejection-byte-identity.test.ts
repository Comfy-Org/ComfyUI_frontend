/**
 * KA-4, the rejection half: **a rejected op leaves the document byte-identical
 * and does not consume its `op_id`.**
 *
 * `src/applier.ts:18` states it ("preconditions validated before the first
 * mutation so a rejected op leaves the doc untouched") and
 * `docs/api-contract-proposal.md` D4 repeats it, but the property was pinned
 * one rejection code at a time. Two earlier audits (kept outside this
 * repository, in the in-app-agent workspace) found
 * it held only for `set_widget` and non-grow `connect`, and narrowed the
 * remaining gap to `delete_node`, `clear` and
 * `reset_doc` and asked for ONE table-driven sweep instead of three more
 * one-offs. This is that sweep, widened to every rejection code the applier can
 * reach so a new code cannot be added without a row.
 *
 * Two assertions per row, because they fail independently:
 *
 *  1. `Y.encodeStateAsUpdate` is byte-identical. Not "the projection is
 *     unchanged" — a write into `__stamps` or `__applied` is invisible to
 *     `project()` but is a real struct divergence between two replicas that saw
 *     the rejection in different orders.
 *  2. The `op_id` is absent from `__applied`. A handler that mutates and then
 *     throws also skips its bookkeeping write, so it is silently
 *     non-idempotent: the retry re-runs the partial mutation.
 *
 * ISSUE #10 IS CLOSED FOR THIS SWEEP. Four `connect` rejections used to mutate
 * the document before throwing — Yjs does not roll a `transact` body back on
 * throw, so "untouched on reject" is a property of write order inside each
 * handler, and those four validated after their first write. PR #34 hoisted the
 * checks; the rows moved from `KNOWN_KA4_VIOLATIONS` into `CASES` and the block
 * that asserted the bug was deleted, exactly as its own failure message
 * instructed. `KNOWN_KA4_VIOLATIONS` is kept, empty, so a future regression has
 * somewhere to be recorded rather than being bolted on again.
 *
 * Amendment A9 closes the cloneable-but-unstorable, `connect.link_id`, and
 * `delete_node.removed_links` write-order holes. Amendment A10 closes reference
 * cycles; Amendment A14 closes the `connect.link_type` shape hole.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import {
  OPAQUE_WIDGETS_KEY,
  applyOps,
  mint,
  project,
  type Op,
  type WidgetCatalog,
  type WorkflowJSON,
} from "../src/index.js";
import { appliedMap } from "../src/doc.js";

const catalog: WidgetCatalog = {
  types: {
    Src: { widget_order: [] },
    Sink: { widget_order: ["inputcount"] },
    KSampler: { widget_order: ["seed", "steps"] },
    Inner: { widget_order: ["text"] },
  },
};

const DEF = "def-1";

/** One fixture for every row: a wired link, a grown-slot host, an opaque node, and a subgraph. */
function baseWorkflow(): WorkflowJSON {
  return {
    nodes: [
      { id: 1, type: "Src", inputs: [], outputs: [{ name: "o", type: "X", links: [] }] },
      { id: 2, type: "Src", inputs: [], outputs: [{ name: "o", type: "X", links: [7] }] },
      {
        id: 3,
        type: "Sink",
        inputs: [
          { name: "in", type: "X", link: 7 },
          { name: "image_1", type: "X", link: null },
        ],
        outputs: [],
      },
      { id: 4, type: "KSampler", inputs: [], outputs: [], widgets_values: [1, 2] },
      // `Note` is absent from the catalog above, so its values are stored opaquely (§1.2).
      { id: 5, type: "Note", inputs: [], outputs: [], widgets_values: ["hi"] },
      { id: 6, type: DEF, inputs: [], outputs: [] },
      // A class the catalog above does NOT describe, carrying no widgets_values,
      // so it is stored name-keyed rather than opaquely (#31).
      { id: 7, type: "Uncatalogued", inputs: [], outputs: [] },
    ],
    links: [[7, 2, 0, 3, 0, "X"]],
    definitions: {
      subgraphs: [
        { id: DEF, name: "D", nodes: [{ id: 27, type: "Inner", widgets_values: ["t"] }], links: [] },
      ],
    },
  } as unknown as WorkflowJSON;
}

let seq = 0;
const env = () => {
  const op_id = ("r" + String(seq++).padStart(4, "0")).padEnd(32, "0");
  return { op_id, actor: "a", base_version: 1, stamp: [1, "a"] as [number, string] };
};
const bytes = (doc: Y.Doc) => Buffer.from(Y.encodeStateAsUpdate(doc));

interface Row {
  /** The op kind under test — `envelope` for rejections that never reach a handler. */
  kind: string;
  /** What makes this op illegal. */
  why: string;
  /** The rejected outcome code the applier must return. */
  code: string;
  build: () => Op;
}

const CASES: Row[] = [
  // ---- envelope gate (validateEnvelope), reached by every kind -------------
  {
    kind: "envelope",
    why: "empty op_id",
    code: "malformed_op",
    build: () => ({ op: "clear", ...env(), op_id: "", removed_nodes: [] }) as unknown as Op,
  },
  {
    kind: "envelope",
    why: "op kind outside the frozen vocabulary",
    code: "unknown_op",
    build: () => ({ op: "frobnicate", ...env() }) as unknown as Op,
  },
  {
    kind: "envelope",
    why: "op is not an object",
    code: "malformed_op",
    build: () => "not-an-op" as unknown as Op,
  },

  // ---- reset_doc (vocabulary §1.6 — deferred, never applied) ---------------
  {
    kind: "reset_doc",
    why: "deferred by the vocabulary until un-deferred by amendment",
    code: "op_deferred",
    build: () => ({ op: "reset_doc", ...env(), workflow: baseWorkflow() }) as unknown as Op,
  },

  // ---- clear ---------------------------------------------------------------
  // `applyClear` has no reachable throw of its own: every `clear` that passes
  // the envelope gate applies. Its only rejection surface IS the envelope, so
  // both rows here address it through an `op: "clear"` envelope rather than
  // pretending the handler validates something it does not.
  {
    kind: "clear",
    why: "non-string op_id",
    code: "malformed_op",
    build: () => ({ op: "clear", ...env(), op_id: 42, removed_nodes: [] }) as unknown as Op,
  },

  // ---- delete_node ---------------------------------------------------------
  {
    kind: "delete_node",
    why: "missing node_id",
    code: "malformed_op",
    build: () => ({ op: "delete_node", ...env(), removed_links: [] }) as unknown as Op,
  },
  {
    kind: "delete_node",
    why: "missing node_id, with removed_links naming a real link",
    code: "malformed_op",
    // The link scrub must not run either: `removed_links` alone would delete
    // link 7 if the guard were moved after the link sweep.
    build: () => ({ op: "delete_node", ...env(), removed_links: [7] }) as unknown as Op,
  },

  // ---- add_node ------------------------------------------------------------
  {
    kind: "add_node",
    why: "missing node_id and node payload",
    code: "malformed_op",
    build: () => ({ op: "add_node", ...env() }) as unknown as Op,
  },
  {
    kind: "add_node",
    why: "payload carries the reserved opaque-widgets key",
    code: "invalid_node_payload",
    build: () =>
      ({
        op: "add_node",
        ...env(),
        node_id: 9,
        node: { id: 9, type: "Src", [OPAQUE_WIDGETS_KEY]: [1] },
      }) as unknown as Op,
  },

  // ---- set_widget ----------------------------------------------------------
  {
    kind: "set_widget",
    why: "top-level write with no widget name",
    code: "malformed_op",
    build: () => ({ op: "set_widget", ...env(), node_id: 4, value: 1 }) as unknown as Op,
  },
  {
    kind: "set_widget",
    why: "interior write with no inner_widget",
    code: "malformed_op",
    build: () =>
      ({ op: "set_widget", ...env(), node_id: 6, widget: "x", value: 1, path: ["6", "27"] }) as unknown as Op,
  },
  {
    kind: "set_widget",
    why: "widget name the pinned catalog does not know",
    code: "unknown_widget",
    build: () => ({ op: "set_widget", ...env(), node_id: 4, widget: "nope", value: 1 }) as unknown as Op,
  },
  {
    kind: "set_widget",
    why: "name-addressed write against an opaquely-stored node (§1.2)",
    code: "opaque_widgets",
    build: () => ({ op: "set_widget", ...env(), node_id: 5, widget: "text", value: 1 }) as unknown as Op,
  },
  {
    kind: "set_widget",
    why: "interior path descending through a node that is not a subgraph",
    code: "not_a_subgraph",
    build: () =>
      ({
        op: "set_widget",
        ...env(),
        node_id: 4,
        widget: "seed",
        value: 1,
        path: ["4", "27"],
        inner_widget: "text",
      }) as unknown as Op,
  },
  {
    kind: "set_widget",
    why: "interior node id absent from the definition",
    code: "interior_node_not_found",
    build: () =>
      ({
        op: "set_widget",
        ...env(),
        node_id: 6,
        widget: "t",
        value: 1,
        path: ["6", "999"],
        inner_widget: "text",
      }) as unknown as Op,
  },
  {
    kind: "set_widget",
    why: "interior widget name the pinned catalog does not know",
    code: "unknown_widget",
    build: () =>
      ({
        op: "set_widget",
        ...env(),
        node_id: 6,
        widget: "t",
        value: 1,
        path: ["6", "27"],
        inner_widget: "nope",
      }) as unknown as Op,
  },

  {
    kind: "set_widget",
    why: "named write to a class the pinned catalog does not describe (#31, schema §1.2)",
    code: "uncatalogued_widget_write",
    build: () =>
      ({
        op: "set_widget",
        ...env(),
        node_id: 7,
        widget: "anything",
        value: 1,
      }) as unknown as Op,
  },
  // ---- set_widget, promoted host write (Amendment A15) ---------------------
  {
    kind: "set_widget",
    why: "promoted host write whose value_index is not a non-negative integer",
    code: "malformed_op",
    build: () =>
      ({
        op: "set_widget",
        ...env(),
        node_id: 6,
        widget: "text",
        value: "v",
        promoted: { value_index: -1, instance_path: ["6"], host_widgets_values: ["v"] },
      }) as unknown as Op,
  },
  {
    kind: "set_widget",
    why: "promoted host write whose host_widgets_values does not cover value_index",
    code: "malformed_op",
    build: () =>
      ({
        op: "set_widget",
        ...env(),
        node_id: 6,
        widget: "text",
        value: "v",
        promoted: { value_index: 3, instance_path: ["6"], host_widgets_values: ["v"] },
      }) as unknown as Op,
  },
  {
    kind: "set_widget",
    why: "promoted host write that also carries an interior path (two destinations)",
    code: "malformed_op",
    build: () =>
      ({
        op: "set_widget",
        ...env(),
        node_id: 6,
        widget: "text",
        value: "v",
        path: ["6", "27"],
        inner_widget: "text",
        promoted: { value_index: 0, instance_path: ["6"], host_widgets_values: ["v"] },
      }) as unknown as Op,
  },
  {
    kind: "set_widget",
    why: "promoted host write descending into an interior node the definition does not hold",
    code: "interior_node_not_found",
    build: () =>
      ({
        op: "set_widget",
        ...env(),
        node_id: "6/99",
        widget: "text",
        value: "v",
        promoted: { value_index: 0, instance_path: ["6", "99"], host_widgets_values: ["v"] },
      }) as unknown as Op,
  },

  // ---- connect (the rows that DO hold on this branch) ----------------------
  {
    kind: "connect",
    why: "to_slot is null with no grow payload",
    code: "malformed_op",
    build: () =>
      ({
        op: "connect",
        ...env(),
        link_id: 90,
        from_node: 1,
        from_slot: 0,
        to_node: 3,
        to_slot: null,
        link_type: "X",
      }) as unknown as Op,
  },
  {
    kind: "connect",
    why: "to_slot out of range on the destination",
    code: "input_slot_missing",
    build: () =>
      ({
        op: "connect",
        ...env(),
        link_id: 91,
        from_node: 1,
        from_slot: 0,
        to_node: 3,
        to_slot: 99,
        link_type: "X",
      }) as unknown as Op,
  },
  {
    kind: "connect+grow",
    why: "from_slot out of range on the source (grow path validates first)",
    code: "output_slot_missing",
    build: () =>
      ({
        op: "connect",
        ...env(),
        link_id: 94,
        from_node: 1,
        from_slot: 99,
        to_node: 3,
        to_slot: null,
        link_type: "X",
        grow: { name: "g", type: "X" },
      }) as unknown as Op,
  },
  {
    kind: "connect+grow",
    why: "grow payload missing name/type",
    code: "malformed_op",
    build: () =>
      ({
        op: "connect",
        ...env(),
        link_id: 95,
        from_node: 1,
        from_slot: 0,
        to_node: 3,
        to_slot: null,
        link_type: "X",
        grow: { type: "X" },
      }) as unknown as Op,
  },
  {
    kind: "connect+grow",
    why: "inputcount grow onto an opaquely-stored destination",
    code: "opaque_widgets",
    build: () =>
      ({
        op: "connect",
        ...env(),
        link_id: 96,
        from_node: 1,
        from_slot: 0,
        to_node: 5,
        to_slot: null,
        link_type: "X",
        grow: { name: "image_1", type: "X", inputcount: { widget: "inputcount", value: 2 } },
      }) as unknown as Op,
  },
  // ---- issue #10: MIGRATED from KNOWN_KA4_VIOLATIONS when PR #34 landed -----
  // These four validated after their first write until #34 hoisted the checks.
  // They are ordinary rows now; the `KA-4 known violations` block that asserted
  // the bug is gone, exactly as its own failure message instructed.
  {
    kind: "connect",
    why: "from_slot out of range, empty destination slot",
    code: "output_slot_missing",
    build: () =>
      ({ op: "connect", ...env(), link_id: 80, from_node: 1, from_slot: 99, to_node: 3, to_slot: 1, link_type: "X" }) as unknown as Op,
  },
  {
    kind: "connect",
    why: "from_slot out of range, OCCUPIED destination slot (the issue #10 repro)",
    code: "output_slot_missing",
    build: () =>
      ({ op: "connect", ...env(), link_id: 81, from_node: 1, from_slot: 99, to_node: 3, to_slot: 0, link_type: "X" }) as unknown as Op,
  },
  {
    kind: "connect+grow",
    why: "inputcount widget absent from the destination's widget_order",
    code: "unknown_widget",
    build: () =>
      ({
        op: "connect", ...env(), link_id: 82, from_node: 1, from_slot: 0, to_node: 3, to_slot: null, link_type: "X",
        grow: { name: "image_2", type: "X", inputcount: { widget: "nope", value: 2 } },
      }) as unknown as Op,
  },
  {
    kind: "connect+grow",
    why: "non-string inputcount widget",
    code: "malformed_op",
    build: () =>
      ({
        op: "connect", ...env(), link_id: 83, from_node: 1, from_slot: 0, to_node: 3, to_slot: null, link_type: "X",
        grow: { name: "image_3", type: "X", inputcount: { widget: 7, value: 2 } },
      }) as unknown as Op,
  },
];

/**
 * Rejections known to violate KA-4. EMPTY since #34 (issue #10) landed: the
 * four `connect` rows it held are ordinary `CASES` rows now.
 *
 * Kept rather than deleted so a future regression has somewhere to be recorded
 * deliberately, with the same discipline #58 used — assert the bug, name the
 * fix, and let the assertion go red when it lands. If you add a row here, add
 * a matching block that asserts it STILL breaks byte-identity today.
 */
const KNOWN_KA4_VIOLATIONS: readonly string[] = [];

describe("KA-4: a rejected op leaves the doc byte-identical and does not consume its op_id", () => {
  it.each(CASES.map((c) => [`${c.kind}: ${c.why} → ${c.code}`, c] as const))("%s", (_name, row) => {
    const doc = mint(baseWorkflow(), catalog);
    const before = bytes(doc);
    const beforeProjection = project(doc, catalog);
    const op = row.build();

    const res = applyOps(doc, [op], catalog);

    expect(res.outcomes.find((outcome) => outcome.outcome === "rejected")?.reason.code).toBe(row.code);
    expect(res.outcomes.findIndex((outcome) => outcome.outcome === "rejected")).toBe(0);
    expect(bytes(doc).equals(before), "encodeStateAsUpdate must be byte-identical").toBe(true);
    expect(project(doc, catalog)).toEqual(beforeProjection);
    // A rejected op is not an applied op: it must be retryable, so its op_id
    // must not have been burned in `__applied`.
    const opId = (op as { op_id?: unknown })?.op_id;
    if (typeof opId === "string" && opId.length > 0) {
      expect(appliedMap(doc).has(opId), "a rejected op must not consume its op_id").toBe(false);
    }
    expect(res.outcomes.filter((outcome) => outcome.outcome === "applied")).toEqual([]);
    expect(res.outcomes.filter((outcome) => outcome.outcome !== "rejected")).toHaveLength(0);
  });

  it("covers every kind the follow-up named, and records that issue #10 leaves none of them broken", () => {
    // Guards against the table quietly losing a kind in a future edit.
    const kinds = new Set(CASES.map((c) => c.kind));
    for (const k of ["envelope", "reset_doc", "clear", "delete_node", "add_node", "set_widget", "connect", "connect+grow"]) {
      expect(kinds.has(k), `no KA-4 rejection row for '${k}'`).toBe(true);
    }
    // #34 (issue #10) landed: all four former violations are ordinary CASES rows now.
    expect(KNOWN_KA4_VIOLATIONS.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Rejection codes that need their own fixture or catalog, and so cannot ride
// the shared `CASES` table. Same two assertions.
// ---------------------------------------------------------------------------

/** `catalog_required`: positional `widgets_values` with no catalog to decompose them. */
function catalogRequiredCase(): { doc: Y.Doc; op: Op; catalog?: WidgetCatalog; code: string } {
  return {
    doc: mint(baseWorkflow(), catalog),
    op: {
      op: "add_node",
      ...env(),
      node_id: 40,
      node: { id: 40, type: "KSampler", inputs: [], outputs: [], widgets_values: [1, 2] },
    } as unknown as Op,
    code: "catalog_required",
  };
}

/** `catalog_required`, promoted form (Amendment A15): a host write onto a name-keyed instance with no catalog to tell it from an unseen class. */
function promotedCatalogRequiredCase(): { doc: Y.Doc; op: Op; catalog?: WidgetCatalog; code: string } {
  return {
    doc: mint(baseWorkflow(), catalog),
    op: {
      op: "set_widget",
      ...env(),
      node_id: 6,
      widget: "text",
      value: "v",
      promoted: { value_index: 0, instance_path: ["6"], host_widgets_values: ["v"] },
    } as unknown as Op,
    code: "catalog_required",
  };
}

/** `widget_out_of_range`: an interior write past the node's current positional length. */
function widgetOutOfRangeCase(): { doc: Y.Doc; op: Op; catalog?: WidgetCatalog; code: string } {
  // `Inner` declares two widgets but the fixture node carries one value, so
  // index 1 is out of range — interior writes never pad (schema §8, applier).
  const twoWidget: WidgetCatalog = { types: { ...catalog.types, Inner: { widget_order: ["text", "extra"] } } };
  return {
    doc: mint(baseWorkflow(), twoWidget),
    op: {
      op: "set_widget",
      ...env(),
      node_id: 6,
      widget: "extra",
      value: "x",
      path: ["6", "27"],
      inner_widget: "extra",
    } as unknown as Op,
    catalog: twoWidget,
    code: "widget_out_of_range",
  };
}

/**
 * `shared_definition_unforked`: the rejection this branch's `src/doc.ts` fix
 * newly reaches. Two nodes instantiate ONE definition — one by id, one by its
 * unique cosmetic name — so schema §5.3 rejects the interior write.
 */
function sharedDefinitionCase(): { doc: Y.Doc; op: Op; catalog?: WidgetCatalog; code: string } {
  const wf = {
    nodes: [
      { id: 10, type: DEF, inputs: [], outputs: [] },
      { id: 11, type: "D", inputs: [], outputs: [] },
    ],
    links: [],
    definitions: {
      subgraphs: [
        { id: DEF, name: "D", nodes: [{ id: 27, type: "Inner", widgets_values: ["t"] }], links: [] },
        { id: "def-2", name: "Other", nodes: [{ id: 27, type: "Inner", widgets_values: ["u"] }], links: [] },
      ],
    },
  } as unknown as WorkflowJSON;
  return {
    doc: mint(wf, catalog),
    op: {
      op: "set_widget",
      ...env(),
      node_id: 10,
      widget: "text",
      value: "CORRUPTION",
      path: ["10", "27"],
      inner_widget: "text",
    } as unknown as Op,
    catalog,
    code: "shared_definition_unforked",
  };
}

const FIXTURE_CASES = [
  ["add_node without a catalog", catalogRequiredCase],
  ["promoted host write without a catalog", promotedCatalogRequiredCase],
  ["interior set_widget past the positional length", widgetOutOfRangeCase],
  ["interior set_widget into a definition two nodes instantiate", sharedDefinitionCase],
] as const;

describe("KA-4: the rejection codes that need their own fixture", () => {
  it.each(FIXTURE_CASES)("%s", (_name, make) => {
    const { doc, op, catalog: cat, code } = make();
    const before = bytes(doc);
    const beforeProjection = project(doc, cat ?? catalog);

    const res = applyOps(doc, [op], cat as WidgetCatalog);

    expect(res.outcomes.find((outcome) => outcome.outcome === "rejected")?.reason.code).toBe(code);
    expect(bytes(doc).equals(before), "encodeStateAsUpdate must be byte-identical").toBe(true);
    expect(project(doc, cat ?? catalog)).toEqual(beforeProjection);
    const opId = (op as { op_id?: unknown })?.op_id;
    expect(appliedMap(doc).has(String(opId)), "a rejected op must not consume its op_id").toBe(false);
    expect(res.outcomes.filter((outcome) => outcome.outcome === "applied")).toEqual([]);
    expect(res.outcomes.filter((outcome) => outcome.outcome !== "rejected")).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Completeness, by CODE rather than by kind, and the known violations made
// self-retiring.
// ---------------------------------------------------------------------------

/**
 * Every code `src/applier.ts` can throw. `apply_failed` is the deliberate
 * exclusion: it is the wrapper for an unexpected internal error, so forcing it
 * would mean planting a fault rather than sending a legal-shaped bad op.
 */
const ALL_REJECTION_CODES = [
  "malformed_op",
  "unknown_op",
  "op_deferred",
  "catalog_required",
  "invalid_node_payload",
  "unknown_widget",
  "opaque_widgets",
  "widget_out_of_range",
  "input_slot_missing",
  "output_slot_missing",
  "uncatalogued_widget_write",
  "not_a_subgraph",
  "interior_node_not_found",
  "shared_definition_unforked",
] as const;

// These require an already-consumed op_id or an intentionally deep payload;
// their byte-identity rows live in the focused issue-#12 regression suite.
const OP_ID_REJECTION_CODES = ["op_id_reuse", "payload_too_deep"] as const;

describe("KA-4 sweep completeness", () => {
  it("has a row for every rejection code the applier can reach", () => {
    const covered = new Set<string>([...CASES.map((c) => c.code), ...FIXTURE_CASES.map(([, make]) => make().code)]);
    for (const code of ALL_REJECTION_CODES) {
      expect(covered.has(code), `no KA-4 rejection row for code '${code}'`).toBe(true);
    }
  });

  it("names every code the applier actually throws, so a new one cannot be added silently", () => {
    const src = readFileSync(new URL("../src/applier.ts", import.meta.url), "utf8");
    const thrown = new Set(Array.from(src.matchAll(/new OpRejectedError\(\s*"([a-z_]+)"/g), (m) => m[1] as string));
    const known = new Set<string>([
      ...ALL_REJECTION_CODES,
      ...OP_ID_REJECTION_CODES,
      "apply_failed",
    ]);
    for (const code of thrown) {
      expect(known.has(code), `src/applier.ts throws '${code}', which this sweep does not know about`).toBe(true);
    }
  });
});

describe("KA-4 abort-remainder: a rejection mid-batch leaves exactly the applied prefix (vocabulary §4)", () => {
  const goodDelete = () => ({ op: "delete_node", ...env(), node_id: 1, removed_links: [] }) as unknown as Op;
  const badDelete = () => ({ op: "delete_node", ...env(), removed_links: [7] }) as unknown as Op;
  const goodClear = () => ({ op: "clear", ...env(), removed_nodes: [1, 2, 3, 4, 5, 6] }) as unknown as Op;
  const deferred = () => ({ op: "reset_doc", ...env(), workflow: baseWorkflow() }) as unknown as Op;

  it.each([
    ["delete_node then a rejected delete_node", goodDelete, badDelete],
    ["clear then a deferred reset_doc", goodClear, deferred],
  ])("%s", (_name, good, bad) => {
    const prefixOp = good();
    const failOp = bad();

    // One doc, so the comparison is not confounded by per-doc client ids: apply
    // the prefix, snapshot, then apply the same batch again — the prefix is now
    // an idempotent skip, so anything the bytes gain came from the rejected op.
    const doc = mint(baseWorkflow(), catalog);
    expect(applyOps(doc, [prefixOp], catalog).outcomes.find((outcome) => outcome.outcome === "rejected")).toBeUndefined();
    const afterPrefix = bytes(doc);

    const res = applyOps(doc, [prefixOp, failOp], catalog);

    expect(res.outcomes.findIndex((outcome) => outcome.outcome === "rejected")).toBe(1);
    expect(res.outcomes.filter((outcome) => outcome.outcome === "no-op").map((outcome) => outcome.op_id))
      .toEqual([(prefixOp as { op_id: string }).op_id]);
    expect(res.outcomes.filter((outcome) => outcome.outcome === "applied")).toEqual([]);
    // The whole point: the failure adds nothing on top of the prefix.
    expect(bytes(doc).equals(afterPrefix)).toBe(true);
    expect(appliedMap(doc).has((failOp as { op_id: string }).op_id)).toBe(false);
  });

  it("a rejected op is retryable: re-applying it after the fix path succeeds normally", () => {
    const doc = mint(baseWorkflow(), catalog);
    const bad = { op: "delete_node", ...env(), removed_links: [] } as unknown as Op;
    expect(
      applyOps(doc, [bad], catalog).outcomes.find((outcome) => outcome.outcome === "rejected")?.reason.code,
    ).toBe("malformed_op");
    // Same op_id, now well-formed — it must still be applyable, which is only
    // true because the rejection did not burn the id.
    const fixed = { ...(bad as object), node_id: 1 } as unknown as Op;
    expect(applyOps(doc, [fixed], catalog).outcomes.find((outcome) => outcome.outcome === "rejected")).toBeUndefined();
    expect(project(doc, catalog).nodes.some((n) => n.id === 1)).toBe(false);
  });
});
