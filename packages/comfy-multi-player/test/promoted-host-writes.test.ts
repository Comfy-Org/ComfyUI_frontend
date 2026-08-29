/**
 * Promoted subgraph widgets live on the HOST instance (ComfyUI_frontend ADR
 * 0009): `widgets_values[i]` on the instance node, positional over the
 * definition's widget-backed inputs. comfy-cli (PR #815, pinned at
 * `ba0b0b92abcc86b01e8a6704d07088f92afe7aa7`) now mints two op shapes for
 * that, and this suite mirrors its `test_workflow_edit_promoted.py` cases
 * against this applier (schema Amendment A15):
 *
 *  1. a `set_widget` carrying `promoted: {value_index, instance_path,
 *     host_widgets_values}` — a POSITIONAL write into the instance's opaque
 *     array (the instance `type` is a definition UUID, never in the catalog);
 *  2. a `connect` carrying `grow.promoted: true` — materialize the declared
 *     input on the instance (ONE register named by the definition; reuse an
 *     existing entry, never number a collision) and wire it.
 *
 * Fixture: the z-image turbo template shape (instance 57 of definition
 * `f2fdebf6-…`, eight declared inputs, instance `widgets_values: []`),
 * trimmed to the nodes the cases touch.
 */
import * as Y from "yjs";
import { describe, expect, it } from "vitest";
import { OPAQUE_WIDGETS_KEY, _getMutationCount, _resetMutationCount, appliedMap, nodesMap, stampsMap } from "../src/doc.js";
import {
  applyOps,
  mint,
  project,
  stampTargetKey,
  type AddNodeOp,
  type ConnectOp,
  type DeleteNodeOp,
  type Op,
  type SetWidgetOp,
  type WidgetCatalog,
  type WorkflowJSON,
  type WorkflowNode,
} from "../src/index.js";
import { canonicalize, loadCatalog } from "./helpers.js";

// ---------------------------------------------------------------------------
// Fixture
// ---------------------------------------------------------------------------

const DEF = "f2fdebf6-dfaf-43b6-9eb2-7f70613cfdc1";
const INNER_DEF = "0a4b7c2e-1111-4d2a-9c3b-5e6f7a8b9c0d";
const PROMPT =
  "Latina female with thick wavy hair, harbor boats and pastel houses behind. Breezy seaside light, warm tones, cinematic close-up. ";
/** comfy-cli `Z_IMAGE_HOST_DEFAULTS`: one entry per widget-backed definition input, in declaration order. */
const HOST_DEFAULTS = [PROMPT, 1024, 1024, 0, 8, "z_image_turbo_bf16.safetensors", "qwen_3_4b.safetensors", "ae.safetensors"];

/** The pinned fixture catalog plus the interior classes the template uses (still no entry for a definition UUID). */
const catalog: WidgetCatalog = {
  types: {
    ...loadCatalog().types,
    EmptySD3LatentImage: { widget_order: ["width", "height", "batch_size"] },
    UNETLoader: { widget_order: ["unet_name", "weight_dtype"] },
    CLIPLoader: { widget_order: ["clip_name", "type", "device"] },
    VAELoader: { widget_order: ["vae_name"] },
    PrimitiveInt: { widget_order: ["value", "control_after_generate"] },
  },
};

function definition(): Record<string, unknown> {
  return {
    id: DEF,
    name: "Text to Image (Z-Image-Turbo)",
    inputs: [
      { name: "text", type: "STRING" },
      { name: "width", type: "INT" },
      { name: "height", type: "INT" },
      { name: "seed", type: "INT" },
      { name: "steps", type: "INT" },
      { name: "unet_name", type: "COMBO" },
      { name: "clip_name", type: "COMBO" },
      { name: "vae_name", type: "COMBO" },
    ],
    outputs: [{ name: "IMAGE", type: "IMAGE" }],
    nodes: [
      { id: 27, type: "CLIPTextEncode", inputs: [{ name: "text", type: "STRING", link: 34, widget: { name: "text" } }], outputs: [], widgets_values: [PROMPT] },
      {
        id: 13,
        type: "EmptySD3LatentImage",
        inputs: [
          { name: "width", type: "INT", link: 35, widget: { name: "width" } },
          { name: "height", type: "INT", link: 36, widget: { name: "height" } },
        ],
        outputs: [],
        widgets_values: [1024, 1024, 1],
      },
      { id: 3, type: "KSampler", inputs: [], outputs: [], widgets_values: [0, "randomize", 8, 1, "res_multistep", "simple", 1] },
      { id: 28, type: "UNETLoader", inputs: [], outputs: [], widgets_values: ["z_image_turbo_bf16.safetensors", "default"] },
      { id: 30, type: "CLIPLoader", inputs: [], outputs: [], widgets_values: ["qwen_3_4b.safetensors", "lumina2", "default"] },
      { id: 29, type: "VAELoader", inputs: [], outputs: [], widgets_values: ["ae.safetensors"] },
    ],
    links: [
      { id: 34, origin_id: -10, origin_slot: 0, target_id: 27, target_slot: 1, type: "STRING" },
      { id: 35, origin_id: -10, origin_slot: 1, target_id: 13, target_slot: 0, type: "INT" },
      { id: 36, origin_id: -10, origin_slot: 2, target_id: 13, target_slot: 1, type: "INT" },
    ],
  };
}

function instance(id: number, widgets_values: unknown[] = []): WorkflowNode {
  return {
    id,
    type: DEF,
    pos: [400, 200],
    size: [300, 200],
    flags: {},
    order: 1,
    mode: 0,
    inputs: [{ name: "text", type: "STRING", link: null, widget: { name: "text" } }],
    outputs: [{ name: "IMAGE", type: "IMAGE", links: [] }],
    properties: {},
    widgets_values,
  };
}

/** The trimmed z-image template: instance 57 + SaveImage 9 wired to it. */
function zImage(): WorkflowJSON {
  const host = instance(57);
  (host.outputs as { links: number[] }[])[0]!.links = [62];
  return {
    last_node_id: 57,
    last_link_id: 62,
    nodes: [
      { id: 9, type: "SaveImage", pos: [800, 200], size: [200, 100], flags: {}, order: 2, mode: 0, inputs: [{ name: "images", type: "IMAGE", link: 62 }], outputs: [], properties: {}, widgets_values: ["z-image-turbo"] },
      host,
    ],
    links: [[62, 57, 0, 9, 0, "IMAGE"]],
    groups: [],
    config: {},
    extra: {},
    version: 0.4,
    definitions: { subgraphs: [definition()] },
  } as unknown as WorkflowJSON;
}

/**
 * Nested shape: top-level 57 is an instance of DEF; inside DEF, node 61 is an
 * instance of INNER_DEF (which declares one widget-backed input `width`), and
 * DEF's own `width` is promoted THROUGH 61. A host write for that promotion
 * lands on 61's `widgets_values` inside DEF — `instance_path: ["57", "61"]`.
 */
function nested(): WorkflowJSON {
  const wf = zImage();
  const defs = (wf["definitions"] as { subgraphs: Record<string, unknown>[] }).subgraphs;
  const outer = defs[0]!;
  (outer["nodes"] as WorkflowNode[]).push({
    id: 61,
    type: INNER_DEF,
    inputs: [{ name: "width", type: "INT", link: 35, widget: { name: "width" } }],
    outputs: [],
    widgets_values: [],
  });
  defs.push({
    id: INNER_DEF,
    name: "Latent size",
    inputs: [{ name: "width", type: "INT" }],
    outputs: [],
    nodes: [{ id: 5, type: "EmptySD3LatentImage", inputs: [], outputs: [], widgets_values: [1024, 1024, 1] }],
    links: [],
  });
  return wf;
}

// ---------------------------------------------------------------------------
// Op builders
// ---------------------------------------------------------------------------

let seq = 0;
function opId(prefix = "p"): string {
  return (prefix + String(seq++).padStart(4, "0")).padEnd(32, "0");
}
function env(actor = "cli", base = 0) {
  return { op_id: opId(), actor, base_version: base, stamp: [base, actor] as [number, string] };
}

interface HostWriteArgs {
  node_id?: string | number;
  widget?: string;
  value: unknown;
  value_index: number;
  instance_path?: string[];
  host_widgets_values?: unknown[];
  actor?: string;
  base?: number;
  old?: unknown;
}

/** The exact shape comfy-cli `_set_widget_impl` mints for a host write (no `path`, no `inner_widget`). */
function hostWrite(a: HostWriteArgs): SetWidgetOp {
  const values = a.host_widgets_values ?? [...HOST_DEFAULTS];
  if (a.host_widgets_values === undefined) values[a.value_index] = a.value;
  return {
    op: "set_widget",
    ...env(a.actor, a.base),
    node_id: a.node_id ?? 57,
    widget: a.widget ?? "width",
    value: a.value,
    old: a.old ?? HOST_DEFAULTS[a.value_index],
    promoted: { value_index: a.value_index, instance_path: a.instance_path ?? ["57"], host_widgets_values: values },
  };
}

const widthWrite = (value: number, actor = "cli", base = 0) => hostWrite({ value, value_index: 1, actor, base });
const heightWrite = (value: number, actor = "cli", base = 0) => hostWrite({ value, value_index: 2, widget: "height", actor, base });

function primitive(id: number, value = 640): AddNodeOp {
  return {
    op: "add_node",
    ...env(),
    node_id: id,
    class_type: "PrimitiveInt",
    pos: [0, 0],
    node: {
      id,
      type: "PrimitiveInt",
      pos: [0, 0],
      size: [210, 82],
      flags: {},
      order: 0,
      mode: 0,
      inputs: [],
      outputs: [{ name: "INT", type: "INT", links: [] }],
      properties: {},
      widgets_values: [value, "fixed"],
    },
  };
}

/** The exact shape comfy-cli `_connect_impl` mints when the destination is a declared subgraph input. */
function promotedConnect(
  link_id: number,
  from_node: number,
  name = "width",
  opts: { widget?: string | null; actor?: string; base?: number; type?: string } = {},
): ConnectOp {
  const grow: Record<string, unknown> = { name, type: opts.type ?? "INT", promoted: true };
  if (opts.widget !== null) grow["widget"] = opts.widget ?? name;
  return {
    op: "connect",
    ...env(opts.actor, opts.base),
    link_id,
    from_node,
    from_slot: 0,
    to_node: 57,
    to_slot: null,
    link_type: opts.type ?? "INT",
    grow,
  } as ConnectOp;
}

const del = (node_id: number, removed_links: number[] = []): DeleteNodeOp => ({ op: "delete_node", ...env(), node_id, removed_links });

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const bytes = (doc: Y.Doc) => Buffer.from(Y.encodeStateAsUpdate(doc));
const fork = (doc: Y.Doc) => {
  const f = new Y.Doc();
  Y.applyUpdate(f, Y.encodeStateAsUpdate(doc));
  return f;
};
const node = (wf: WorkflowJSON, id: string | number) => wf.nodes.find((n) => String(n.id) === String(id))!;
const interior = (wf: WorkflowJSON, defId: string, id: number) => {
  const defs = (wf["definitions"] as { subgraphs: { id: string; nodes: WorkflowNode[] }[] }).subgraphs;
  return defs.find((d) => d.id === defId)!.nodes.find((n) => String(n.id) === String(id))!;
};
const inputs = (n: WorkflowNode) => n.inputs as Record<string, unknown>[];
const inputNamed = (n: WorkflowNode, name: string) => inputs(n).find((i) => i["name"] === name);
const outcome = (res: ReturnType<typeof applyOps>, i = 0) => res.outcomes[i]!;

// ---------------------------------------------------------------------------
// 1. Host writes
// ---------------------------------------------------------------------------

describe("promoted host write: `set_widget` with `promoted` lands on the instance's positional array", () => {
  it("materializes the host array from host_widgets_values and sets value_index; the interior default is untouched", () => {
    const doc = mint(zImage(), catalog);
    const op = widthWrite(768);
    const res = applyOps(doc, [op], catalog);
    expect(outcome(res)).toEqual({ op_id: op.op_id, outcome: "applied" });

    const wf = project(doc, catalog);
    const expected = [...HOST_DEFAULTS];
    expected[1] = 768;
    expect(node(wf, 57).widgets_values).toEqual(expected);
    expect(interior(wf, DEF, 13).widgets_values).toEqual([1024, 1024, 1]);
    // The register is the SAME one a top-level named write on 57.width claims
    // (comfy-cli `_write_target`), incarnation-namespaced per Amendment A16 —
    // a minted node carries the legacy token "0".
    expect(stampTargetKey(op)).toBe(JSON.stringify(["widget", "57", "0", "width"]));
    expect(stampsMap(doc).get(stampTargetKey(op))).toEqual([0, "cli", op.op_id]);
  });

  it("stores the instance opaquely afterwards — one storage key, never a name-keyed decomposition", () => {
    const doc = mint(zImage(), catalog);
    applyOps(doc, [widthWrite(768)], catalog);
    const inst = nodesMap(doc).get("57")!;
    expect(inst.has(OPAQUE_WIDGETS_KEY)).toBe(true);
    expect(inst.has("widgets")).toBe(false);
    expect(inst.get(OPAQUE_WIDGETS_KEY)).toEqual([PROMPT, 768, 1024, 0, 8, "z_image_turbo_bf16.safetensors", "qwen_3_4b.safetensors", "ae.safetensors"]);
  });

  it("a second write touches ONE slot of the already-materialized array", () => {
    const doc = mint(zImage(), catalog);
    applyOps(doc, [widthWrite(768)], catalog);
    // comfy-cli seeds host_widgets_values from ITS view; the doc's existing entries win.
    const second = heightWrite(512);
    (second.promoted as { host_widgets_values: unknown[] }).host_widgets_values = [...HOST_DEFAULTS];
    (second.promoted as { host_widgets_values: unknown[] }).host_widgets_values[2] = 512;
    expect(outcome(applyOps(doc, [second], catalog)).outcome).toBe("applied");
    const wv = node(project(doc, catalog), 57).widgets_values as unknown[];
    expect(wv[1]).toBe(768);
    expect(wv[2]).toBe(512);
    expect(wv.length).toBe(8);
    expect([wv[0], ...wv.slice(3)]).toEqual([HOST_DEFAULTS[0], ...HOST_DEFAULTS.slice(3)]);
  });

  it("an instance that already carries a host array (post-migration template) keeps its other entries", () => {
    const wf = zImage();
    node(wf, 57).widgets_values = ["custom prompt", 640, 640, 7, 4, "u.safetensors", "c.safetensors", "v.safetensors"];
    const doc = mint(wf, catalog);
    expect(node(project(doc, catalog), 57).widgets_values).toEqual(["custom prompt", 640, 640, 7, 4, "u.safetensors", "c.safetensors", "v.safetensors"]);
    applyOps(doc, [widthWrite(768)], catalog);
    expect(node(project(doc, catalog), 57).widgets_values).toEqual(["custom prompt", 768, 640, 7, 4, "u.safetensors", "c.safetensors", "v.safetensors"]);
  });

  it("a stored array SHORTER than value_index+1 is extended from host_widgets_values, existing entries kept", () => {
    const wf = zImage();
    node(wf, 57).widgets_values = ["only the prompt"];
    const doc = mint(wf, catalog);
    applyOps(doc, [hostWrite({ value: 4, value_index: 4, widget: "steps" })], catalog);
    expect(node(project(doc, catalog), 57).widgets_values).toEqual(["only the prompt", 1024, 1024, 0, 4, "z_image_turbo_bf16.safetensors", "qwen_3_4b.safetensors", "ae.safetensors"]);
  });

  it("mint/project round-trips a definition's interior links in the frontend's OBJECT form (found by this fixture)", () => {
    const wf = zImage();
    const links = (wf["definitions"] as { subgraphs: { links: unknown[] }[] }).subgraphs[0]!.links;
    expect(links.map((l) => (l as { id: number }).id)).toEqual([34, 35, 36]);
    const out = project(mint(wf, catalog), catalog);
    expect((out["definitions"] as { subgraphs: { links: unknown[] }[] }).subgraphs[0]!.links).toEqual(links);
  });

  it("project() hands the positional array back unchanged (no catalog entry for a definition UUID)", () => {
    const wf = zImage();
    node(wf, 57).widgets_values = [...HOST_DEFAULTS];
    const doc = mint(wf, catalog);
    expect(canonicalize(project(doc, catalog))).toEqual(canonicalize(wf));
    applyOps(doc, [widthWrite(768)], catalog);
    const again = mint(project(doc, catalog), catalog);
    expect(project(again, catalog)).toEqual(project(doc, catalog));
  });

  it("is bounded: one opaque set + one stamp set (+ retiring the empty named map on first conversion)", () => {
    const doc = mint(zImage(), catalog);
    _resetMutationCount(doc);
    applyOps(doc, [widthWrite(768)], catalog);
    expect(_getMutationCount(doc)).toBeLessThanOrEqual(4); // + the __applied record
    _resetMutationCount(doc);
    applyOps(doc, [heightWrite(512)], catalog);
    expect(_getMutationCount(doc)).toBeLessThanOrEqual(3);
  });

  it("replays idempotently by op_id (byte-identical) and reports no-op", () => {
    const doc = mint(zImage(), catalog);
    const op = widthWrite(768);
    applyOps(doc, [op], catalog);
    const before = bytes(doc);
    const res = applyOps(doc, [op], catalog);
    expect(outcome(res)).toEqual({ op_id: op.op_id, outcome: "no-op" });
    expect(bytes(doc).equals(before)).toBe(true);
    expect(node(project(doc, catalog), 57).widgets_values).toEqual([PROMPT, 768, ...HOST_DEFAULTS.slice(2)]);
  });

  it("LWW: a lower stamp is dropped, and both arrival orders converge on the higher one", () => {
    const low = widthWrite(768, "agent:a", 0);
    const high = widthWrite(512, "agent:b", 1);
    const base = mint(zImage(), catalog);
    const d1 = fork(base);
    const d2 = fork(base);
    const r1 = applyOps(d1, [low, high], catalog);
    const r2 = applyOps(d2, [high, low], catalog);
    expect(r1.outcomes.map((o) => o.outcome)).toEqual(["applied", "applied"]);
    expect(r2.outcomes.map((o) => o.outcome)).toEqual(["applied", "lww-dropped"]);
    expect(appliedMap(d2).has(low.op_id)).toBe(true); // a dropped write still consumes its op_id
    expect(node(project(d1, catalog), 57).widgets_values).toEqual(node(project(d2, catalog), 57).widgets_values);
    expect((node(project(d1, catalog), 57).widgets_values as unknown[])[1]).toBe(512);
  });

  it("concurrent writes to DIFFERENT promoted inputs both survive in either order", () => {
    const w = widthWrite(768, "agent:a", 0);
    const h = heightWrite(512, "agent:b", 0);
    const base = mint(zImage(), catalog);
    const d1 = fork(base);
    const d2 = fork(base);
    applyOps(d1, [w, h], catalog);
    applyOps(d2, [h, w], catalog);
    const p1 = project(d1, catalog);
    expect(p1).toEqual(project(d2, catalog));
    expect(node(p1, 57).widgets_values).toEqual([PROMPT, 768, 512, ...HOST_DEFAULTS.slice(3)]);
  });

  it("an interior `path` write to the widget BEHIND the promotion is a different register (documented, not unified)", () => {
    const doc = mint(zImage(), catalog);
    const host = widthWrite(768);
    const interiorOp: SetWidgetOp = {
      op: "set_widget",
      ...env(),
      node_id: "57/13",
      widget: "width",
      value: 256,
      path: ["57", "13"],
      inner_widget: "width",
    };
    expect(stampTargetKey(interiorOp)).not.toBe(stampTargetKey(host));
    const res = applyOps(doc, [host, interiorOp], catalog);
    expect(res.outcomes.map((o) => o.outcome)).toEqual(["applied", "applied"]);
    const wf = project(doc, catalog);
    expect((node(wf, 57).widgets_values as unknown[])[1]).toBe(768);
    expect((interior(wf, DEF, 13).widgets_values as unknown[])[0]).toBe(256);
  });

  it("delete wins: a host write whose instance is gone is a silent no-op that still consumes its op_id", () => {
    const doc = mint(zImage(), catalog);
    applyOps(doc, [del(57, [62])], catalog);
    const before = project(doc, catalog);
    const op = widthWrite(768);
    const res = applyOps(doc, [op], catalog);
    expect(outcome(res)).toEqual({ op_id: op.op_id, outcome: "no-op" });
    expect(appliedMap(doc).has(op.op_id)).toBe(true);
    expect(project(doc, catalog)).toEqual(before);
  });

  it("a top-level host write does NOT descend into the definition, so a shared definition is fine", () => {
    const wf = zImage();
    wf.nodes.push(instance(58));
    const doc = mint(wf, catalog);
    const res = applyOps(doc, [widthWrite(768), hostWrite({ node_id: 58, value: 640, value_index: 1, instance_path: ["58"] })], catalog);
    expect(res.outcomes.map((o) => o.outcome)).toEqual(["applied", "applied"]);
    const p = project(doc, catalog);
    expect((node(p, 57).widgets_values as unknown[])[1]).toBe(768);
    expect((node(p, 58).widgets_values as unknown[])[1]).toBe(640);
    expect(interior(p, DEF, 13).widgets_values).toEqual([1024, 1024, 1]);
  });
});

describe("promoted host write: nested instance_path resolves like an interior `path`", () => {
  const nestedWrite = (value: number) =>
    hostWrite({ node_id: "57/61", value, value_index: 0, instance_path: ["57", "61"], host_widgets_values: [value], old: 1024 });

  it("lands on the inner instance's widgets_values inside the outer definition", () => {
    const doc = mint(nested(), catalog);
    const op = nestedWrite(768);
    expect(outcome(applyOps(doc, [op], catalog)).outcome).toBe("applied");
    const wf = project(doc, catalog);
    expect(interior(wf, DEF, 61).widgets_values).toEqual([768]);
    expect(node(wf, 57).widgets_values).toEqual([]);
    expect(interior(wf, INNER_DEF, 5).widgets_values).toEqual([1024, 1024, 1]);
    // Register: comfy-cli mints node_id as the joined path for a nested host.
    // Incarnation-namespaced per Amendment A16 (minted node → legacy token "0").
    expect(stampTargetKey(op)).toBe(JSON.stringify(["widget", "57/61", "0", "width"]));
  });

  it("delete of the HEAD instance wins over a nested host write", () => {
    const doc = mint(nested(), catalog);
    applyOps(doc, [del(57, [62])], catalog);
    const res = applyOps(doc, [nestedWrite(768)], catalog);
    expect(outcome(res).outcome).toBe("no-op");
  });

  it("rejects a nested host write into a SHARED outer definition exactly as an interior write does (schema §5.3)", () => {
    const wf = nested();
    wf.nodes.push(instance(58));
    const doc = mint(wf, catalog);
    const before = bytes(doc);
    const op = nestedWrite(768);
    const res = applyOps(doc, [op], catalog);
    expect(outcome(res)).toMatchObject({ outcome: "rejected", reason: { code: "shared_definition_unforked" } });
    expect(bytes(doc).equals(before)).toBe(true);
    expect(appliedMap(doc).has(op.op_id)).toBe(false);
  });

  it("rejects a path segment that is not an interior node, byte-identical and without consuming the op_id", () => {
    const doc = mint(nested(), catalog);
    const before = bytes(doc);
    const op = hostWrite({ node_id: "57/99", value: 1, value_index: 0, instance_path: ["57", "99"], host_widgets_values: [1] });
    expect(outcome(applyOps(doc, [op], catalog))).toMatchObject({ outcome: "rejected", reason: { code: "interior_node_not_found" } });
    expect(bytes(doc).equals(before)).toBe(true);
    expect(appliedMap(doc).has(op.op_id)).toBe(false);
  });
});

describe("promoted host write: rejections are loud, op-only, and leave the doc byte-identical (KA-4)", () => {
  const malformed: [string, (op: SetWidgetOp) => void][] = [
    ["value_index negative", (op) => ((op.promoted as { value_index: unknown }).value_index = -1)],
    ["value_index fractional", (op) => ((op.promoted as { value_index: unknown }).value_index = 1.5)],
    ["value_index a string", (op) => ((op.promoted as { value_index: unknown }).value_index = "1")],
    ["value_index missing", (op) => delete (op.promoted as { value_index?: unknown }).value_index],
    ["host_widgets_values not an array", (op) => ((op.promoted as { host_widgets_values: unknown }).host_widgets_values = { 1: 768 })],
    ["host_widgets_values missing", (op) => delete (op.promoted as { host_widgets_values?: unknown }).host_widgets_values],
    ["host_widgets_values shorter than value_index+1", (op) => ((op.promoted as { host_widgets_values: unknown }).host_widgets_values = [PROMPT])],
    ["instance_path empty", (op) => ((op.promoted as { instance_path: unknown }).instance_path = [])],
    ["instance_path not an array", (op) => ((op.promoted as { instance_path: unknown }).instance_path = "57")],
    ["promoted not an object", (op) => ((op as { promoted: unknown }).promoted = true)],
    ["promoted carries a path too (host writes never do)", (op) => ((op as { path?: unknown }).path = ["57", "13"])],
  ];

  it.each(malformed)("malformed_op: %s", (_name, mutate) => {
    const doc = mint(zImage(), catalog);
    const before = bytes(doc);
    const op = widthWrite(768);
    mutate(op);
    const res = applyOps(doc, [op], catalog);
    expect(outcome(res)).toMatchObject({ outcome: "rejected", reason: { code: "malformed_op" } });
    expect(bytes(doc).equals(before)).toBe(true);
    expect(appliedMap(doc).has(op.op_id)).toBe(false);
  });

  it("malformed_op: instance_path must name the node `node_id` names, so the register and the mutated node cannot diverge", () => {
    const wf = zImage();
    wf.nodes.push(instance(58));
    const doc = mint(wf, catalog);
    const before = bytes(doc);
    // node_id 57 claims ("widget","57","width") while instance_path would mutate 58.
    const op = hostWrite({ node_id: 57, value: 768, value_index: 1, instance_path: ["58"] });
    const res = applyOps(doc, [op], catalog);
    expect(outcome(res)).toMatchObject({ outcome: "rejected", reason: { code: "malformed_op" } });
    expect(bytes(doc).equals(before)).toBe(true);
    expect(appliedMap(doc).has(op.op_id)).toBe(false);
    // The nested spelling: node_id is the joined path.
    const nestedOk = hostWrite({ node_id: "57/61", value: 1, value_index: 0, instance_path: ["57", "61"], host_widgets_values: [1] });
    const nestedBad = hostWrite({ node_id: 57, value: 1, value_index: 0, instance_path: ["57", "61"], host_widgets_values: [1] });
    const nestedDoc = mint(nested(), catalog);
    expect(outcome(applyOps(nestedDoc, [nestedOk], catalog)).outcome).toBe("applied");
    expect(outcome(applyOps(nestedDoc, [nestedBad], catalog))).toMatchObject({ outcome: "rejected", reason: { code: "malformed_op" } });
    // Numeric segments spell the same node as their string form.
    const numeric = hostWrite({ node_id: 58, value: 640, value_index: 1, instance_path: [58 as unknown as string] });
    expect(outcome(applyOps(doc, [numeric], catalog)).outcome).toBe("applied");
  });

  it("the instance_path/node_id check is op-only: rejected identically whether or not either node exists", () => {
    const op = hostWrite({ node_id: 57, value: 768, value_index: 1, instance_path: ["58"] });
    const alive = mint(zImage(), catalog);
    const gone = mint(zImage(), catalog);
    applyOps(gone, [del(57, [62])], catalog);
    for (const doc of [alive, gone]) {
      const before = bytes(doc);
      const res = applyOps(doc, [op], catalog);
      expect(outcome(res)).toMatchObject({ outcome: "rejected", reason: { code: "malformed_op" } });
      expect(bytes(doc).equals(before)).toBe(true);
      expect(appliedMap(doc).has(op.op_id)).toBe(false);
    }
  });

  it("abort-remainder: a valid host write after a rejected one is batch_aborted and the doc is byte-identical", () => {
    const doc = mint(zImage(), catalog);
    const before = bytes(doc);
    const bad = widthWrite(768);
    (bad.promoted as { value_index: unknown }).value_index = -1;
    const good = heightWrite(512);
    const res = applyOps(doc, [bad, good], catalog);
    expect(res.outcomes.map((o) => o.outcome)).toEqual(["rejected", "rejected"]);
    expect(outcome(res, 1)).toMatchObject({ op_id: good.op_id, reason: { code: "batch_aborted" } });
    expect(bytes(doc).equals(before)).toBe(true);
    expect(appliedMap(doc).has(bad.op_id)).toBe(false);
    expect(appliedMap(doc).has(good.op_id)).toBe(false);
    expect(node(project(doc, catalog), 57).widgets_values).toEqual([]);
    // The retried batch, fixed, applies both.
    const fixed = widthWrite(768);
    const retry = applyOps(doc, [fixed, good], catalog);
    expect(retry.outcomes.map((o) => o.outcome)).toEqual(["applied", "applied"]);
  });

  it("malformed_op is decided from the op alone: rejected identically whether or not the instance still exists", () => {
    const op = widthWrite(768);
    (op.promoted as { value_index: unknown }).value_index = -1;
    const alive = mint(zImage(), catalog);
    const gone = mint(zImage(), catalog);
    applyOps(gone, [del(57, [62])], catalog);
    expect(outcome(applyOps(alive, [op], catalog)).outcome).toBe("rejected");
    expect(outcome(applyOps(gone, [op], catalog)).outcome).toBe("rejected");
  });

  it("catalog_required: without a catalog the host cannot tell a subgraph instance from an unseen class", () => {
    const doc = mint(zImage(), catalog);
    const before = bytes(doc);
    const op = widthWrite(768);
    const res = applyOps(doc, [op]);
    expect(outcome(res)).toMatchObject({ outcome: "rejected", reason: { code: "catalog_required" } });
    expect(bytes(doc).equals(before)).toBe(true);
    expect(appliedMap(doc).has(op.op_id)).toBe(false);
  });

  it("…but an instance the doc ALREADY stores opaquely needs no catalog to take a positional write", () => {
    const wf = zImage();
    node(wf, 57).widgets_values = [...HOST_DEFAULTS];
    const doc = mint(wf, catalog);
    expect(outcome(applyOps(doc, [widthWrite(768)])).outcome).toBe("applied");
    expect((node(project(doc, catalog), 57).widgets_values as unknown[])[1]).toBe(768);
  });

  it("uncatalogued_widget_write: a node holding NAMED values the catalog cannot describe is not silently re-keyed", () => {
    const wf = zImage();
    // A name-keyed record mints without a catalog entry (schema §1.2); with this
    // catalog the node is unprojectable, and a positional write must not paper over it.
    node(wf, 57).widgets_values = { text: "named" } as unknown as unknown[];
    const doc = mint(wf, catalog);
    const before = bytes(doc);
    const op = widthWrite(768);
    const res = applyOps(doc, [op], catalog);
    expect(outcome(res)).toMatchObject({ outcome: "rejected", reason: { code: "uncatalogued_widget_write" } });
    expect(bytes(doc).equals(before)).toBe(true);
    expect(appliedMap(doc).has(op.op_id)).toBe(false);
  });

  it("falls back to the named path when the target has a catalog entry (defined, if never minted by comfy-cli)", () => {
    const wf = zImage();
    wf.nodes.push({ id: 3, type: "KSampler", inputs: [], outputs: [], widgets_values: [0, "fixed", 20, 8, "euler", "normal", 1] });
    const doc = mint(wf, catalog);
    const op = hostWrite({ node_id: 3, widget: "steps", value: 30, value_index: 2, instance_path: ["3"], host_widgets_values: [0, "fixed", 30, 8, "euler", "normal", 1] });
    expect(outcome(applyOps(doc, [op], catalog)).outcome).toBe("applied");
    const ks = nodesMap(doc).get("3")!;
    expect(ks.has(OPAQUE_WIDGETS_KEY)).toBe(false);
    expect((ks.get("widgets") as Y.Map<unknown>).get("steps")).toBe(30);
    expect(node(project(doc, catalog), 3).widgets_values).toEqual([0, "fixed", 30, 8, "euler", "normal", 1]);
  });
});

// ---------------------------------------------------------------------------
// 2. Connect that materializes a promoted input
// ---------------------------------------------------------------------------

describe("promoted connect: `grow.promoted` materializes the declared input on the instance and wires it", () => {
  const PRIM = 4503599627370501;

  it("appends {name, type, link, grow_id, widget:{name}} for a widget-backed input and wires the link", () => {
    const doc = mint(zImage(), catalog);
    const c = promotedConnect(9001, PRIM);
    const res = applyOps(doc, [primitive(PRIM), c], catalog);
    expect(res.outcomes.map((o) => o.outcome)).toEqual(["applied", "applied"]);
    const wf = project(doc, catalog);
    const host = node(wf, 57);
    expect(inputs(host).map((i) => i["name"])).toEqual(["text", "width"]);
    expect(inputNamed(host, "width")).toEqual({ name: "width", type: "INT", link: 9001, grow_id: 9001, widget: { name: "width" } });
    expect(wf.links).toContainEqual([9001, PRIM, 0, 57, 1, "INT"]);
    expect((node(wf, PRIM).outputs as { links: number[] }[])[0]!.links).toEqual([9001]);
    // The host array is untouched: the link is the value's source of truth now.
    expect(host.widgets_values).toEqual([]);
  });

  it("omits `widget` for a socket-only input (no grow.widget)", () => {
    const doc = mint(zImage(), catalog);
    applyOps(doc, [primitive(PRIM), promotedConnect(9001, PRIM, "seed", { widget: null })], catalog);
    expect(inputNamed(node(project(doc, catalog), 57), "seed")).toEqual({ name: "seed", type: "INT", link: 9001, grow_id: 9001 });
  });

  it("reuses an entry that already carries the declared name: the input is ONE register, never numbered", () => {
    const doc = mint(zImage(), catalog);
    const first = promotedConnect(9001, PRIM, "width", { base: 0 });
    const second = promotedConnect(9002, PRIM, "width", { base: 1 });
    const res = applyOps(doc, [primitive(PRIM), first, second], catalog);
    expect(res.outcomes.map((o) => o.outcome)).toEqual(["applied", "applied", "applied"]);
    const wf = project(doc, catalog);
    const host = node(wf, 57);
    expect(inputs(host).map((i) => i["name"])).toEqual(["text", "width"]);
    expect(inputNamed(host, "width")!["link"]).toBe(9002);
    // The register's winner owns the slot: `grow_id` follows the winning link.
    expect(inputNamed(host, "width")!["grow_id"]).toBe(9002);
    // The displaced link is retired whole (tuple + the source's out-link entry).
    expect(wf.links.map((l) => (l as unknown[])[0])).not.toContain(9001);
    expect((node(wf, PRIM).outputs as { links: number[] }[])[0]!.links).toEqual([9002]);
  });

  it("reuses an input the instance carried at mint (`text`), at its existing index", () => {
    const wf = zImage();
    wf.nodes.push({ id: 77, type: "CLIPTextEncode", inputs: [], outputs: [{ name: "STRING", type: "STRING", links: [] }], widgets_values: ["x"] });
    const doc = mint(wf, catalog);
    applyOps(doc, [promotedConnect(9003, 77, "text", { type: "STRING" })], catalog);
    const p = project(doc, catalog);
    const host = node(p, 57);
    expect(inputs(host).map((i) => i["name"])).toEqual(["text"]);
    expect(inputNamed(host, "text")).toEqual({ name: "text", type: "STRING", link: 9003, widget: { name: "text" } });
    expect(p.links).toContainEqual([9003, 77, 0, 57, 0, "STRING"]);
  });

  it("is LWW-gated as one register: the lower stamp is dropped and both arrival orders converge", () => {
    const low = promotedConnect(9001, PRIM, "width", { actor: "agent:a", base: 0 });
    const high = promotedConnect(9002, PRIM, "width", { actor: "agent:b", base: 1 });
    const base = mint(zImage(), catalog);
    applyOps(base, [primitive(PRIM)], catalog);
    const d1 = fork(base);
    const d2 = fork(base);
    const r1 = applyOps(d1, [low, high], catalog);
    const r2 = applyOps(d2, [high, low], catalog);
    expect(r1.outcomes.map((o) => o.outcome)).toEqual(["applied", "applied"]);
    expect(r2.outcomes.map((o) => o.outcome)).toEqual(["applied", "lww-dropped"]);
    expect(project(d1, catalog)).toEqual(project(d2, catalog));
    expect(inputNamed(node(project(d1, catalog), 57), "width")!["link"]).toBe(9002);
    expect(project(d1, catalog).links.map((l) => (l as unknown[])[0])).toEqual([62, 9002]);
  });

  it("replays idempotently by op_id", () => {
    const doc = mint(zImage(), catalog);
    const c = promotedConnect(9001, PRIM);
    applyOps(doc, [primitive(PRIM), c], catalog);
    const before = bytes(doc);
    expect(outcome(applyOps(doc, [c], catalog)).outcome).toBe("no-op");
    expect(bytes(doc).equals(before)).toBe(true);
  });

  it("delete wins on the destination: no register, no slot", () => {
    const doc = mint(zImage(), catalog);
    applyOps(doc, [primitive(PRIM), del(57, [62])], catalog);
    const before = project(doc, catalog);
    expect(outcome(applyOps(doc, [promotedConnect(9001, PRIM)], catalog)).outcome).toBe("no-op");
    expect(project(doc, catalog)).toEqual(before);
  });

  it("racing the SOURCE's deletion converges: the input is materialized empty in both orders", () => {
    const base = mint(zImage(), catalog);
    applyOps(base, [primitive(PRIM)], catalog);
    // Minted AFTER the add so the delete outranks it on ("node", PRIM) —
    // op_id is the tiebreak at equal base_version.
    const c = promotedConnect(9001, PRIM);
    const d = del(PRIM);
    const d1 = fork(base);
    const d2 = fork(base);
    applyOps(d1, [c, d], catalog);
    applyOps(d2, [d, c], catalog);
    expect(project(d1, catalog)).toEqual(project(d2, catalog));
    expect(inputNamed(node(project(d1, catalog), 57), "width")!["link"]).toBeNull();
  });

  it("malformed grow payloads are rejected before any write", () => {
    const doc = mint(zImage(), catalog);
    applyOps(doc, [primitive(PRIM)], catalog);
    const before = bytes(doc);
    const bad = promotedConnect(9001, PRIM);
    delete (bad.grow as { name?: unknown }).name;
    const res = applyOps(doc, [bad], catalog);
    expect(outcome(res)).toMatchObject({ outcome: "rejected", reason: { code: "malformed_op" } });
    expect(bytes(doc).equals(before)).toBe(true);
    expect(appliedMap(doc).has(bad.op_id)).toBe(false);
  });

  it("abort-remainder: a valid promoted connect after a rejected one is batch_aborted and the doc is byte-identical", () => {
    const doc = mint(zImage(), catalog);
    applyOps(doc, [primitive(PRIM)], catalog);
    const before = bytes(doc);
    const bad = promotedConnect(9001, PRIM);
    delete (bad.grow as { type?: unknown }).type;
    const good = promotedConnect(9002, PRIM, "height");
    const res = applyOps(doc, [bad, good], catalog);
    expect(res.outcomes.map((o) => o.outcome)).toEqual(["rejected", "rejected"]);
    expect(outcome(res, 1)).toMatchObject({ op_id: good.op_id, reason: { code: "batch_aborted" } });
    expect(bytes(doc).equals(before)).toBe(true);
    expect(appliedMap(doc).has(good.op_id)).toBe(false);
    expect(inputs(node(project(doc, catalog), 57)).map((i) => i["name"])).toEqual(["text"]);
  });

  // (1) The register is the FULL declared name (comfy-cli #818 amendment v1.5):
  // subgraph input names may contain dots, and two of them must not share one slot.
  it("registers a promoted input under its FULL declared name: `foo.bar` and `foo.baz` are two registers, autogrow still keys by base", () => {
    const bar = promotedConnect(9001, PRIM, "foo.bar");
    const baz = promotedConnect(9002, PRIM, "foo.baz");
    expect(stampTargetKey(bar)).toBe(JSON.stringify(["input", "57", "grow", "foo.bar"]));
    expect(stampTargetKey(baz)).toBe(JSON.stringify(["input", "57", "grow", "foo.baz"]));
    expect(stampTargetKey(promotedConnect(9003, PRIM, "width"))).toBe(JSON.stringify(["input", "57", "grow", "width"]));
    const autogrow: ConnectOp = { ...promotedConnect(9004, PRIM, "images.image0"), grow: { name: "images.image0", type: "IMAGE" } } as ConnectOp;
    expect(stampTargetKey(autogrow)).toBe(JSON.stringify(["input", "57", "grow", "images"]));

    const doc = mint(zImage(), catalog);
    applyOps(doc, [primitive(PRIM), bar, baz], catalog);
    const host = node(project(doc, catalog), 57);
    expect(inputs(host).map((i) => i["name"])).toEqual(["text", "foo.bar", "foo.baz"]);
    expect(inputNamed(host, "foo.bar")!["link"]).toBe(9001);
    expect(inputNamed(host, "foo.baz")!["link"]).toBe(9002);
    expect(project(doc, catalog).links.map((l) => (l as unknown[])[0])).toEqual([62, 9001, 9002]);
  });

  it("a later host write and the wired input coexist (comfy-cli redirects the write to the primitive; the doc host applies what it is sent)", () => {
    const doc = mint(zImage(), catalog);
    applyOps(doc, [primitive(PRIM), promotedConnect(9001, PRIM), widthWrite(768)], catalog);
    const host = node(project(doc, catalog), 57);
    expect(inputNamed(host, "width")!["link"]).toBe(9001);
    expect((host.widgets_values as unknown[])[1]).toBe(768);
  });
});

// ---------------------------------------------------------------------------
// 3. Types: the shapes compile as this repo's own call sites use them
// ---------------------------------------------------------------------------

describe("op types admit the comfy-cli shapes", () => {
  it("a host write and a promoted grow type-check without casts", () => {
    const host: SetWidgetOp = {
      op: "set_widget",
      ...env(),
      node_id: 57,
      widget: "width",
      value: 768,
      old: 1024,
      promoted: { value_index: 1, instance_path: ["57"], host_widgets_values: [...HOST_DEFAULTS] },
      redirected_from: "57/13.width",
    };
    const grow: ConnectOp = {
      op: "connect",
      ...env(),
      link_id: 1,
      from_node: 2,
      from_slot: 0,
      to_node: 57,
      to_slot: null,
      link_type: "INT",
      grow: { name: "width", type: "INT", promoted: true, widget: "width" },
    };
    const ops: Op[] = [host, grow];
    expect(ops).toHaveLength(2);
  });
});
