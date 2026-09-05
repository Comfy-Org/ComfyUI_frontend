/**
 * Mutation-driven kill tests (AUD-MUT-1). Each `it` here exists to kill a
 * specific surviving Stryker mutant on an invariant-bearing code path.
 */
import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import {
  applyOps,
  codePointCompare,
  mint,
  project,
  stampKey,
  type ConnectOp,
  type DeleteNodeOp,
  type GrowConnectOp,
  type InteriorSetWidgetOp,
  type Op,
  type SetWidgetOp,
  type WidgetCatalog,
  type WorkflowJSON,
} from "../src/index.js";

let seq = 0;
const env = (actor = "a", baseVersion = 1) => ({
  op_id: ("m" + String(seq++).padStart(4, "0")).padEnd(32, "0"),
  actor,
  base_version: baseVersion,
  stamp: [baseVersion, actor] as [number, string],
});

const bytes = (doc: Y.Doc) => Buffer.from(Y.encodeStateAsUpdate(doc));

// ---------------------------------------------------------------------------
// KT-1 / KT-2 — interior writes. Two rules: schema §5.3's shared-definition
// guard ("a conforming applier MUST reject an interior write whose head
// definition is shared by more than one instance"), and the interior no-pad
// rule, which the schema does not state — it is comfy-cli `_write_widget`
// parity (`extend=False`) under §5.1's bounded-interior-write decision, and
// `src/applier.ts` is the only place it is written down. Both blocks were
// NoCoverage.
// ---------------------------------------------------------------------------

const sgCatalog: WidgetCatalog = {
  types: {
    KSampler: {
      widget_order: ["seed", "control_after_generate", "steps", "cfg", "sampler_name", "scheduler", "denoise"],
    },
    CLIPTextEncode: { widget_order: ["text"] },
  },
};

const DEF_ID = "def-0001";

/** `instances` copies of one subgraph definition at top level. */
function sgWorkflow(instances: number): WorkflowJSON {
  return {
    nodes: Array.from({ length: instances }, (_, i) => ({
      id: 100 + i,
      type: DEF_ID,
      inputs: [],
      outputs: [],
    })),
    links: [],
    definitions: {
      subgraphs: [
        {
          id: DEF_ID,
          name: "Interior",
          nodes: [
            { id: 27, type: "CLIPTextEncode", widgets_values: ["old prompt"] },
            // widgets_values shorter than widget_order: projected length is 1,
            // so any widget at index >= 1 is out of range for an interior write.
            { id: 3, type: "KSampler", widgets_values: [42] },
          ],
          links: [],
        },
      ],
    },
  } as unknown as WorkflowJSON;
}

const interiorWrite = (over: Partial<InteriorSetWidgetOp> = {}): InteriorSetWidgetOp => ({
  op: "set_widget",
  ...env(),
  node_id: 100,
  path: ["100", "27"],
  widget: "text",
  inner_widget: "text",
  value: "new prompt",
  ...over,
});

describe("interior set_widget guards (schema §5.3, KA-1/KA-4)", () => {
  it("rejects an interior write to a definition instantiated more than once, leaving the doc byte-identical", () => {
    const doc = mint(sgWorkflow(2), sgCatalog);
    const before = bytes(doc);
    const res = applyOps(doc, [interiorWrite()], sgCatalog);
    expect(res.outcomes.find((o) => o.outcome === "rejected")?.reason.code).toBe("shared_definition_unforked");
    expect(res.outcomes.filter((o) => o.outcome === "applied").map((o) => o.op_id)).toEqual([]);
    expect(bytes(doc).equals(before)).toBe(true);
  });

  it("applies the same interior write when the definition has exactly one instance", () => {
    const doc = mint(sgWorkflow(1), sgCatalog);
    const res = applyOps(doc, [interiorWrite()], sgCatalog);
    expect(res.outcomes.some((o) => o.outcome === "rejected")).toBe(false);
    const sg = (project(doc, sgCatalog)["definitions"] as { subgraphs: { nodes: { id: unknown; widgets_values: unknown }[] }[] })
      .subgraphs[0]!;
    expect(sg.nodes.find((n) => n.id === 27)!.widgets_values).toEqual(["new prompt"]);
  });

  it("rejects an interior write past the node's current projected widgets length (interior writes never pad)", () => {
    const doc = mint(sgWorkflow(1), sgCatalog);
    const before = bytes(doc);
    // KSampler interior node 3 holds widgets_values [42] → projected length 1;
    // "steps" is widget_order index 2.
    const res = applyOps(doc, [interiorWrite({ path: ["100", "3"], inner_widget: "steps", value: 30 })], sgCatalog);
    expect(res.outcomes.find((o) => o.outcome === "rejected")?.reason.code).toBe("widget_out_of_range");
    expect(bytes(doc).equals(before)).toBe(true);
  });

  it("rejects an interior write at exactly the current projected length (>= is the boundary, not >)", () => {
    const doc = mint(sgWorkflow(1), sgCatalog);
    const before = bytes(doc);
    // widget_order index 1 against a projected length of 1: idx === len.
    const res = applyOps(
      doc,
      [interiorWrite({ path: ["100", "3"], inner_widget: "control_after_generate", value: "fixed" })],
      sgCatalog,
    );
    expect(res.outcomes.find((o) => o.outcome === "rejected")?.reason.code).toBe("widget_out_of_range");
    expect(bytes(doc).equals(before)).toBe(true);
  });

  it("rejects an interior write to a widget the pinned catalog does not know for the interior type", () => {
    const doc = mint(sgWorkflow(1), sgCatalog);
    const before = bytes(doc);
    const res = applyOps(doc, [interiorWrite({ inner_widget: "no_such_widget" })], sgCatalog);
    expect(res.outcomes.find((o) => o.outcome === "rejected")?.reason.code).toBe("unknown_widget");
    expect(bytes(doc).equals(before)).toBe(true);
  });

  it("interior write whose head instance is gone is a silent delete-wins no-op, not a throw", () => {
    const doc = mint(sgWorkflow(1), sgCatalog);
    const del: DeleteNodeOp = { op: "delete_node", ...env(), node_id: 100, removed_links: [] };
    const res = applyOps(doc, [del, interiorWrite()], sgCatalog);
    expect(res.outcomes.some((o) => o.outcome === "rejected")).toBe(false);
    expect(res.outcomes.filter((o) => o.outcome !== "rejected")).toHaveLength(2); // the no-op still consumes its op_id
  });

  it("rejects an interior descent into a subgraph that has no such interior node", () => {
    const doc = mint(sgWorkflow(1), sgCatalog);
    const before = bytes(doc);
    const res = applyOps(doc, [interiorWrite({ path: ["100", "999"] })], sgCatalog);
    expect(res.outcomes.find((o) => o.outcome === "rejected")?.reason.code).toBe("interior_node_not_found");
    expect(res.outcomes.filter((o) => o.outcome === "applied").map((o) => o.op_id)).toEqual([]);
    expect(bytes(doc).equals(before)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// KT-3 — a rejected grow connect must not have already mutated the doc.
// ---------------------------------------------------------------------------

const growCatalog: WidgetCatalog = {
  types: {
    Src: { widget_order: [] },
    Sink: { widget_order: [] },
    SinkTpl: { widget_order: [], autogrow_templates: { images: { prefix: "pic" } } },
  },
};

function growBase(sinkType = "Sink"): WorkflowJSON {
  return {
    nodes: [
      { id: 1, type: "Src", inputs: [], outputs: [{ name: "out", type: "X", links: null }] },
      { id: 2, type: sinkType, inputs: [{ name: "images", type: "X", link: null }], outputs: [] },
    ],
    links: [],
  } as unknown as WorkflowJSON;
}

const growConnect = (over: Partial<GrowConnectOp> = {}): GrowConnectOp => ({
  op: "connect",
  ...env(),
  link_id: 900 + seq,
  from_node: 1,
  from_slot: 0,
  to_node: 2,
  to_slot: null,
  link_type: "X",
  grow: { name: "images", type: "X" },
  ...over,
});

describe("connect grow path (KA-4 — a rejected op leaves the doc untouched)", () => {
  it("validates the source output slot BEFORE growing the input slot", () => {
    const doc = mint(growBase(), growCatalog);
    const before = bytes(doc);
    const res = applyOps(doc, [growConnect({ from_slot: 99 })], growCatalog);
    expect(res.outcomes.find((o) => o.outcome === "rejected")?.reason.code).toBe("output_slot_missing");
    // The grown slot must not survive the rejection: Y transactions do not roll
    // back, so validation has to precede the first mutation.
    expect(bytes(doc).equals(before)).toBe(true);
    const sink = project(doc, growCatalog).nodes.find((n) => n.id === 2)!;
    expect((sink.inputs as unknown[]).length).toBe(1);
  });

  it("rejects from_slot exactly equal to the output count (>= is the boundary, not >)", () => {
    const doc = mint(growBase(), growCatalog);
    const before = bytes(doc);
    // Node 1 has exactly one output, so slot index 1 is the first invalid one.
    const res = applyOps(doc, [growConnect({ from_slot: 1 })], growCatalog);
    expect(res.outcomes.find((o) => o.outcome === "rejected")?.reason.code).toBe("output_slot_missing");
    expect(bytes(doc).equals(before)).toBe(true);
  });

  it("rejects a grow payload missing name/type without mutating the doc", () => {
    const doc = mint(growBase(), growCatalog);
    const before = bytes(doc);
    const res = applyOps(doc, [growConnect({ grow: { type: "X" } as never })], growCatalog);
    expect(res.outcomes.find((o) => o.outcome === "rejected")?.reason.code).toBe("malformed_op");
    expect(bytes(doc).equals(before)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// KT-4 — autogrow collision naming, template-less and prefix arms (KA-3 parity
// with comfy-cli `_next_autogrow_name`).
// ---------------------------------------------------------------------------

describe("autogrow collision naming (KA-3 — parity with comfy-cli)", () => {
  /** Collide on the requested name N times and report the resulting slot names. */
  function grownNames(sinkType: string, requested: string, times: number): string[] {
    const wf = growBase(sinkType) as unknown as { nodes: { id: number; inputs: unknown[] }[] };
    wf.nodes[1]!.inputs = [{ name: requested, type: "X", link: null }];
    const doc = mint(wf as unknown as WorkflowJSON, growCatalog);
    const ops = Array.from({ length: times }, () => growConnect({ grow: { name: requested, type: "X" } }));
    expect(applyOps(doc, ops, growCatalog).outcomes.some((o) => o.outcome === "rejected")).toBe(false);
    const sink = project(doc, growCatalog).nodes.find((n) => n.id === 2)!;
    return (sink.inputs as { name: string }[]).map((i) => i.name);
  }

  it("with no catalog template, singularizes a trailing 's' on the base (images → images.image0)", () => {
    expect(grownNames("Sink", "images", 2)).toEqual(["images", "images.image0", "images.image1"]);
  });

  it("with no catalog template and a non-plural base, uses the base verbatim (mask → mask.mask0)", () => {
    expect(grownNames("Sink", "mask", 1)).toEqual(["mask", "mask.mask0"]);
  });

  it("a catalog prefix template overrides the singularized stem", () => {
    // SinkTpl pins prefix "pic", which differs from the stem "image" the
    // template-less arm would produce — the two arms are distinguishable.
    expect(grownNames("SinkTpl", "images", 1)).toEqual(["images", "images.pic0"]);
  });

  it("a widget-carrying grow bypasses the catalog template and records the widget on the slot", () => {
    const wf = growBase("SinkTpl") as unknown as { nodes: { id: number; inputs: unknown[] }[] };
    wf.nodes[1]!.inputs = [{ name: "images", type: "X", link: null }];
    const doc = mint(wf as unknown as WorkflowJSON, growCatalog);
    const op = growConnect({ grow: { name: "images", type: "X", widget: "value" } });
    expect(applyOps(doc, [op], growCatalog).outcomes.some((o) => o.outcome === "rejected")).toBe(false);
    const sink = project(doc, growCatalog).nodes.find((n) => n.id === 2)!;
    const grown = (sink.inputs as { name: string; widget?: unknown }[])[1]!;
    // grow.widget forces template = null, so the stem arm names the slot.
    expect(grown.name).toBe("images.image0");
    expect(grown.widget).toEqual({ name: "value" });
  });
});

// ---------------------------------------------------------------------------
// KT-5 — `outputs[].links: null` first-wire guard (comfy-cli `_apply_connect`).
// ---------------------------------------------------------------------------

describe("connect onto a never-wired output (schema §7 links:null)", () => {
  it("creates the output link list when the source output serialized links as null", () => {
    const wf: WorkflowJSON = {
      nodes: [
        { id: 1, type: "Src", inputs: [], outputs: [{ name: "out", type: "X", links: null }] },
        { id: 2, type: "Sink", inputs: [{ name: "in", type: "X", link: null }], outputs: [] },
      ],
      links: [],
    } as unknown as WorkflowJSON;
    const doc = mint(wf, growCatalog);
    const op: ConnectOp = {
      op: "connect",
      ...env(),
      link_id: 77,
      from_node: 1,
      from_slot: 0,
      to_node: 2,
      to_slot: 0,
      link_type: "X",
    };
    const res = applyOps(doc, [op], growCatalog);
    expect(res.outcomes.some((o) => o.outcome === "rejected")).toBe(false);
    const src = project(doc, growCatalog).nodes.find((n) => n.id === 1)!;
    expect((src.outputs as { links: unknown }[])[0]!.links).toEqual([77]);
  });
});

// ---------------------------------------------------------------------------
// KT-6 — delete_node envelope guard.
// ---------------------------------------------------------------------------

describe("delete_node envelope (KA-4 — reject loudly, never silently no-op)", () => {
  it("rejects delete_node with no node_id instead of consuming the op_id silently", () => {
    const doc = mint(growBase(), growCatalog);
    const before = bytes(doc);
    const op = { op: "delete_node", ...env() } as unknown as Op;
    const res = applyOps(doc, [op], growCatalog);
    expect(res.outcomes.find((o) => o.outcome === "rejected")?.reason.code).toBe("malformed_op");
    expect(res.outcomes.filter((o) => o.outcome === "applied").map((o) => o.op_id)).toEqual([]);
    expect(bytes(doc).equals(before)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// KT-7 — the ordering key is read from `op.stamp`, not the envelope
// (schema §3, KA-2 / FC-2).
// ---------------------------------------------------------------------------

describe("stampKey honours a two-element explicit stamp (KA-2, FC-2)", () => {
  it("prefers a length-2 op.stamp over base_version/actor", () => {
    // The whole point of `stamp` (vocabulary §8.1) is that it can differ from
    // the envelope's base_version/actor; a `> 2` length gate would silently
    // fall back to the envelope and change the LWW winner.
    const op = {
      op: "set_widget",
      op_id: "b".repeat(32),
      actor: "envelope-actor",
      base_version: 1,
      stamp: [9, "stamp-actor"] as [number, string],
      node_id: 4,
      widget: "value",
      value: 1,
    } as Op;
    expect(stampKey(op)).toEqual([9, "stamp-actor", "b".repeat(32)]);
  });

  it("an explicit stamp decides the LWW winner even when base_version says otherwise", () => {
    const wf: WorkflowJSON = {
      nodes: [{ id: 1, type: "CLIPTextEncode", inputs: [], outputs: [], widgets_values: ["x"] }],
      links: [],
    } as unknown as WorkflowJSON;
    const mk = (opId: string, bv: number, stamp: [number, string], value: string): SetWidgetOp =>
      ({
        op: "set_widget",
        op_id: opId.padEnd(32, "0"),
        actor: "a",
        base_version: bv,
        stamp,
        node_id: 1,
        widget: "text",
        value,
      }) as SetWidgetOp;
    // Higher base_version, lower stamp: the stamp must win.
    const loser = mk("s1", 99, [1, "a"], "loser");
    const winner = mk("s2", 1, [50, "a"], "winner");
    const doc = mint(wf, sgCatalog);
    expect(applyOps(doc, [winner, loser], sgCatalog).outcomes.some((o) => o.outcome === "rejected")).toBe(false);
    expect(project(doc, sgCatalog).nodes[0]!.widgets_values).toEqual(["winner"]);
  });
});

// ---------------------------------------------------------------------------
// KT-8 — codePointCompare at the BMP ceiling (schema §3 pin 1, KA-2).
// ---------------------------------------------------------------------------

describe("codePointCompare BMP boundary (KA-2)", () => {
  it("advances one code unit for U+FFFF, the highest BMP code point", () => {
    // A `>= 0xffff` step would consume two units here and desynchronize the
    // walk, silently changing the LWW winner for a non-ASCII actor.
    expect(codePointCompare("￿a", "￿b")).toBe(-1);
    expect(codePointCompare("￿b", "￿a")).toBe(1);
    expect(codePointCompare("a￿", "a￿")).toBe(0);
  });
});
