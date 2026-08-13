/**
 * The op applier — a faithful TypeScript port of comfy-cli
 * `workflow_ops.apply_op` (op-vocabulary-v1.md §1–§4, §8) onto the v1 Y.Doc
 * layout (docs/multiplayer-schema.md), with the widget write path adapted to
 * the name-keyed widgets Y.Map (schema §1.2 — the one deliberate departure
 * from the positional-array spike prototype).
 *
 * Guarantees (spike-verified semantics, pinned by the test suite):
 *  - idempotent per `op_id` (`__applied`, checked before ANY mutation so a
 *    duplicate apply is a byte-level no-op);
 *  - LWW for widget writes via `__stamps` with the exact
 *    `[base_version, actor, op_id]` code-point comparison (vocabulary §8.1);
 *  - delete-wins: an op whose target is gone is a silent no-op that still
 *    consumes its op_id; malformed/unknown ops are rejected loudly;
 *  - abort-remainder batches (vocabulary §4): on failure, ops after the
 *    failing index are not applied and the applied prefix is retained;
 *  - one Y transaction per op (schema §2.4), preconditions validated before
 *    the first mutation so a rejected op leaves the doc untouched.
 */

import * as Y from "yjs";
import {
  adel,
  appliedMap,
  apush,
  countDefinitionInstances,
  createNodeMap,
  linksMap,
  mdel,
  metaMap,
  mset,
  nodesMap,
  resolveDefinition,
  stampsMap,
} from "./doc.js";
import { compareStampKeys, stampKey, stampTargetKey } from "./stamps.js";
import {
  DEFERRED_OPS,
  FROZEN_OPS,
  OpRejectedError,
  type AddNodeOp,
  type ApplyFailure,
  type ApplyResult,
  type ConnectOp,
  type DeleteNodeOp,
  type Op,
  type SetWidgetOp,
  type StampKey,
  type WidgetCatalog,
} from "./types.js";

/**
 * Apply a batch of stamped ops to the doc, one transaction per op.
 * Idempotent per op_id; convergent under reordering via the
 * `[base_version, actor, op_id]` stamp order (schema §3).
 *
 * `catalog` (the pinned object_info projection) is needed to decompose an
 * `add_node` payload's positional `widgets_values` into the name-keyed
 * widgets map, for autogrow collision renames, and to validate widget names;
 * without it, catalog-dependent ops that can degrade safely do (widget-name
 * validation is skipped — writes are name-keyed either way) and ops that
 * cannot are rejected with `catalog_required`.
 */
export function applyOps(doc: Y.Doc, ops: Op[], catalog?: WidgetCatalog): ApplyResult {
  const bookkeeping = appliedMap(doc);
  const applied: string[] = [];
  const skipped: string[] = [];
  let failed: ApplyFailure | null = null;

  for (let index = 0; index < ops.length; index++) {
    const op = ops[index]!;
    try {
      validateEnvelope(op);
      if (bookkeeping.has(op.op_id)) {
        // Idempotency gate BEFORE any mutation/transaction: a duplicate apply
        // is a true no-op (byte-identical encodeStateAsUpdate).
        skipped.push(op.op_id);
        continue;
      }
      doc.transact(() => {
        dispatch(doc, op, catalog);
        // comfy-cli records the op_id even for delete-wins/LWW-dropped no-ops.
        mset(bookkeeping, op.op_id, 1);
      }, op.actor);
      applied.push(op.op_id);
    } catch (err) {
      failed = {
        index,
        op,
        code: err instanceof OpRejectedError ? err.code : "apply_failed",
        message: err instanceof Error ? err.message : String(err),
      };
      break; // abort-remainder (vocabulary §4)
    }
  }

  return { applied, skipped, failed, applied_count: applied.length, version: bookkeeping.size };
}

const FROZEN = new Set<string>(FROZEN_OPS);
const DEFERRED = new Set<string>(DEFERRED_OPS);

function validateEnvelope(op: Op): void {
  if (typeof op !== "object" || op === null || typeof op.op !== "string") {
    throw new OpRejectedError("malformed_op", "op is not an object with a string 'op' kind");
  }
  if (DEFERRED.has(op.op)) {
    throw new OpRejectedError(
      "op_deferred",
      `unknown op '${op.op}' — defined by the vocabulary but deferred (op-vocabulary-v1.md §1.6); rejected until un-deferred by amendment`,
    );
  }
  if (!FROZEN.has(op.op)) {
    throw new OpRejectedError("unknown_op", `unknown op '${op.op}'`);
  }
  if (typeof op.op_id !== "string" || op.op_id.length === 0) {
    throw new OpRejectedError("malformed_op", `${op.op}: missing op_id`);
  }
}

function dispatch(doc: Y.Doc, op: Op, catalog?: WidgetCatalog): void {
  switch (op.op) {
    case "add_node":
      applyAddNode(doc, op, catalog);
      return;
    case "set_widget":
      applySetWidget(doc, op, catalog);
      return;
    case "connect":
      applyConnect(doc, op, catalog);
      return;
    case "delete_node":
      applyDeleteNode(doc, op);
      return;
    case "clear":
      applyClear(doc);
      return;
    default:
      // unreachable — validateEnvelope already rejected unknown/deferred kinds
      throw new OpRejectedError("unknown_op", `unknown op '${(op as Op).op}'`);
  }
}

// ---------------------------------------------------------------------------
// add_node
// ---------------------------------------------------------------------------

function applyAddNode(doc: Y.Doc, op: AddNodeOp, catalog?: WidgetCatalog): void {
  if (op.node_id === undefined || typeof op.node !== "object" || op.node === null) {
    throw new OpRejectedError("malformed_op", "add_node: missing node_id or node payload");
  }
  const nodes = nodesMap(doc);
  const key = String(op.node_id);
  if (nodes.has(key)) return; // structural idempotency: id already present → no-op

  // The op.node payload is authoritative (vocabulary §8.5) — inserted
  // verbatim, never re-derived from the catalog. The catalog IS needed here,
  // unlike in Python: decomposing the payload's positional widgets_values
  // into the name-keyed widgets map (schema §1.2) requires widget_order.
  const wv = op.node.widgets_values;
  const order = catalog?.types[op.node.type]?.widget_order;
  if (Array.isArray(wv) && wv.length > 0 && !order) {
    throw new OpRejectedError(
      "catalog_required",
      `add_node(${op.node.type}): positional widgets_values needs the pinned catalog widget_order to decompose into the name-keyed widgets map (schema §1.2)`,
    );
  }
  let nodeMap: Y.Map<unknown>;
  try {
    nodeMap = createNodeMap(op.node, order ?? []);
  } catch (err) {
    throw new OpRejectedError(
      "invalid_node_payload",
      `add_node(${op.node.type}): ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  mset(nodes, key, nodeMap);

  // last_node_id is a max-register (vocabulary §8.3): write only on increase.
  const meta = metaMap(doc);
  const cur = meta.get("last_node_id");
  const curN = typeof cur === "number" ? cur : 0;
  if (typeof op.node_id === "number" && op.node_id > curN) {
    mset(meta, "last_node_id", op.node_id);
  }
}

// ---------------------------------------------------------------------------
// set_widget
// ---------------------------------------------------------------------------

/** Reject a widget name the pinned catalog does not know for this type (comfy-cli `_widget_index` raises). Skipped when the catalog or the type entry is unavailable — the write is name-keyed either way. */
function validateWidgetName(
  catalog: WidgetCatalog | undefined,
  nodeType: string,
  widget: string,
): void {
  const entry = catalog?.types[nodeType];
  if (entry && !entry.widget_order.includes(widget)) {
    throw new OpRejectedError(
      "unknown_widget",
      `widget '${widget}' not found on ${nodeType}; available: ${entry.widget_order.join(", ") || "(none — all inputs are links)"}`,
    );
  }
}

function widgetsOf(node: Y.Map<unknown>): Y.Map<unknown> {
  let widgets = node.get("widgets");
  if (!(widgets instanceof Y.Map)) {
    // comfy-cli creates widgets_values on first write; mirror by creating the map.
    widgets = new Y.Map<unknown>();
    mset(node, "widgets", widgets);
  }
  return widgets as Y.Map<unknown>;
}

function applySetWidget(doc: Y.Doc, op: SetWidgetOp, catalog?: WidgetCatalog): void {
  const interior = Array.isArray(op.path) && op.path.length > 0;
  if (interior && typeof op.inner_widget !== "string") {
    throw new OpRejectedError("malformed_op", "set_widget: interior write without inner_widget");
  }
  if (!interior && typeof op.widget !== "string") {
    throw new OpRejectedError("malformed_op", "set_widget: missing widget name");
  }

  // LWW gate first (comfy-cli `_apply_set_widget`): a lower-or-equal stamp is
  // dropped — a protocol-level apply that still consumes its op_id.
  const stamps = stampsMap(doc);
  const targetKey = stampTargetKey(op);
  const prior = stamps.get(targetKey) as StampKey | undefined;
  const key = stampKey(op);
  if (prior != null && compareStampKeys(key, prior) <= 0) return; // lww-dropped

  if (interior) {
    const target = resolveInteriorNode(doc, op.path!.map(String));
    if (target === null) return; // head instance concurrently deleted → no-op (delete wins)
    const nodeType = String(target.get("type") ?? "");
    const widget = op.inner_widget!;
    const entry = catalog?.types[nodeType];
    if (entry) {
      const idx = entry.widget_order.indexOf(widget);
      if (idx < 0) {
        validateWidgetName(catalog, nodeType, widget); // throws unknown_widget
      }
      // Interior writes never pad (comfy-cli `_write_widget` extend=False):
      // the projected positional index must already be inside the node's
      // current widgets_values length.
      const len = projectedWidgetsLength(target, entry.widget_order);
      if (idx >= len) {
        throw new OpRejectedError(
          "widget_out_of_range",
          `widget index ${idx} out of range for ${nodeType} (interior writes never pad)`,
        );
      }
    }
    mset(widgetsOf(target), widget, structuredClone(op.value));
    mset(stamps, targetKey, key);
    return;
  }

  const node = nodesMap(doc).get(String(op.node_id));
  if (!node) return; // target concurrently deleted → no-op (delete wins)
  validateWidgetName(catalog, String(node.get("type") ?? ""), op.widget);
  // Top-level writes may extend past the current positional length — comfy-cli
  // pads with None; here the name-keyed map makes padding a projection concern.
  mset(widgetsOf(node), op.widget, structuredClone(op.value));
  mset(stamps, targetKey, key);
}

/** The node's current projected widgets_values length: 1 + highest widget_order index present in the name-keyed map. */
function projectedWidgetsLength(node: Y.Map<unknown>, order: readonly string[]): number {
  const widgets = node.get("widgets");
  if (!(widgets instanceof Y.Map)) return 0;
  let max = -1;
  widgets.forEach((_v: unknown, name: string) => {
    const i = order.indexOf(name);
    if (i > max) max = i;
  });
  return max + 1;
}

/**
 * Walk a resolved interior path (["57","27",…]) into (possibly nested)
 * subgraph definitions. Returns the interior node Y.Map, or null when the
 * head instance is gone (delete wins). Mirrors comfy-cli
 * `engine._resolve_node_path` — except that a shared definition is REJECTED,
 * not forked: schema §5.3 pins that a conforming applier must reject interior
 * writes to shared definitions until forking is specced and fixtured.
 */
function resolveInteriorNode(doc: Y.Doc, path: string[]): Y.Map<unknown> | null {
  const head = nodesMap(doc).get(path[0]!);
  if (!head) return null;
  let cur: Y.Map<unknown> = head;
  for (const seg of path.slice(1)) {
    const curType = String(cur.get("type") ?? "");
    const def = resolveDefinition(doc, curType);
    if (!def) {
      throw new OpRejectedError(
        "not_a_subgraph",
        `node ${String(cur.get("id"))} is not a subgraph; cannot descend to '${seg}'`,
      );
    }
    const defId = String(def.get("id") ?? curType);
    const instances = countDefinitionInstances(doc, defId);
    if (instances > 1) {
      throw new OpRejectedError(
        "shared_definition_unforked",
        `definition ${defId} is instantiated ${instances} times; interior writes to shared definitions are rejected until forking is specced (schema §5.3)`,
      );
    }
    const innerNodes = def.get("nodes");
    const inner = innerNodes instanceof Y.Map ? innerNodes.get(seg) : undefined;
    if (!(inner instanceof Y.Map)) {
      throw new OpRejectedError(
        "interior_node_not_found",
        `interior node ${seg} not found in subgraph ${defId}`,
      );
    }
    cur = inner;
  }
  return cur;
}

// ---------------------------------------------------------------------------
// connect
// ---------------------------------------------------------------------------

/** The source node's `outputs` array, with `from_slot` validated before any mutation. */
function requireOutputSlot(src: Y.Map<unknown>, op: ConnectOp): Y.Array<unknown> {
  const outs = src.get("outputs");
  if (!(outs instanceof Y.Array) || typeof op.from_slot !== "number" || op.from_slot >= outs.length) {
    throw new OpRejectedError(
      "output_slot_missing",
      `connect: output slot ${op.from_slot} not found on node ${String(op.from_node)}`,
    );
  }
  return outs as Y.Array<unknown>;
}

function applyConnect(doc: Y.Doc, op: ConnectOp, catalog?: WidgetCatalog): void {
  const nodes = nodesMap(doc);
  const dst = nodes.get(String(op.to_node));
  // The destination is gone → the target slot does not exist and never will
  // (ids are never reused), so there is no register to claim: delete wins.
  if (!dst) return;

  let toIdx: number;
  if (op.grow != null) {
    // Autogrow is NOT a shared register: every grow mints its own slot keyed by
    // `grow_id`, so two concurrent grows onto one base both survive and there
    // is nothing to gate (vocabulary §1.2 / amendment v1.2's carve-out).
    const src = nodes.get(String(op.from_node));
    if (!src) return; // source concurrently deleted → no-op (delete wins)
    requireOutputSlot(src, op);
    toIdx = growInputSlot(doc, dst, op, catalog);
  } else {
    if (typeof op.to_slot !== "number") {
      throw new OpRejectedError("malformed_op", "connect: to_slot must be a number unless grow is present");
    }
    toIdx = op.to_slot;
    const ins = dst.get("inputs");
    if (!(ins instanceof Y.Array) || toIdx >= ins.length) {
      throw new OpRejectedError(
        "input_slot_missing",
        `connect: input slot ${toIdx} not found on node ${String(op.to_node)}`,
      );
    }
    const slot = ins.get(toIdx);
    if (!(slot instanceof Y.Map)) {
      throw new OpRejectedError("input_slot_missing", `connect: input slot ${toIdx} is not a slot record`);
    }

    // ---- The concrete-input LWW register (op-vocabulary-v1.md amendment v1.2)
    //
    // A concrete input holds at most one link, so "who occupies this slot" is a
    // SCALAR target — `("input", to_node, to_slot)` — gated by exactly the
    // `[base_version, actor, op_id]` comparison `set_widget` uses. Without this
    // gate the occupant was decided by ARRIVAL ORDER, and composed with
    // delete-wins that produced graphs where a link exists in one interleaving
    // and not in another (schema §2.5 violated; found adversarially, cloud
    // PR #6722 FINDING 1).
    const stamps = stampsMap(doc);
    const targetKey = stampTargetKey(op);
    const prior = stamps.get(targetKey) as StampKey | undefined;
    const key = stampKey(op);
    if (prior != null && compareStampKeys(key, prior) <= 0) return; // lww-dropped

    // Claiming the register is UNCONDITIONAL once the gate passes — the prior
    // occupant is retired even if this op then turns out to be a delete-wins
    // no-op below. Deferring the retirement until the link is known to be
    // installable would reintroduce order dependence: whether the incumbent
    // survives would depend on whether the concurrent delete of THIS op's
    // source had arrived yet.
    mset(stamps, targetKey, key);
    const prev = slot.get("link");
    if (prev != null && prev !== op.link_id) removeLink(doc, prev);
  }

  const src = nodes.get(String(op.from_node));
  // Source concurrently deleted → the winning connect leaves the input EMPTY
  // (delete wins over the link, not over the register claim).
  if (!src) return;
  const outs = requireOutputSlot(src, op);

  const links = linksMap(doc);
  const linkKey = String(op.link_id);
  if (!links.has(linkKey)) {
    mset(links, linkKey, [op.link_id, op.from_node, op.from_slot, op.to_node, toIdx, op.link_type]);
  }
  const ins = dst.get("inputs") as Y.Array<Y.Map<unknown>>;
  mset(ins.get(toIdx)!, "link", op.link_id);
  const outPort = outs.get(op.from_slot) as Y.Map<unknown>;
  let outLinks = outPort.get("links");
  if (!(outLinks instanceof Y.Array)) {
    // Mirrors the `"links": null` guard in `_apply_connect`: a never-wired
    // output serialized as null gets a fresh list on first wire.
    outLinks = new Y.Array<unknown>();
    mset(outPort, "links", outLinks);
  }
  if (!(outLinks as Y.Array<unknown>).toArray().includes(op.link_id)) {
    apush(outLinks as Y.Array<unknown>, op.link_id);
  }
}

/**
 * Autogrow: find or append the grown input slot, keyed by `grow_id` (the
 * link id) so replay is idempotent AND non-clobbering. Returns the slot index.
 * The inputcount family (§8.4) additionally performs the stamped count-widget
 * write when (and only when) the slot is actually grown.
 */
function growInputSlot(
  doc: Y.Doc,
  dst: Y.Map<unknown>,
  op: ConnectOp,
  catalog?: WidgetCatalog,
): number {
  const grow = op.grow!;
  if (typeof grow.name !== "string" || typeof grow.type !== "string") {
    throw new OpRejectedError("malformed_op", "connect: grow payload needs name and type");
  }
  let ins = dst.get("inputs");
  if (!(ins instanceof Y.Array)) {
    ins = new Y.Array<unknown>();
    mset(dst, "inputs", ins);
  }
  const insArr = ins as Y.Array<unknown>;
  let existing = -1;
  insArr.forEach((slot: unknown, idx: number) => {
    if (slot instanceof Y.Map && slot.get("grow_id") === op.link_id) existing = idx;
  });
  if (existing >= 0) return existing;

  let name: string;
  if (grow.inputcount != null) {
    // Bare-key family: collision grows the next free BARE `{elem}_N` key,
    // never the dotted autogrow shape (comfy-cli `_next_inputcount_name`).
    name = nextInputcountName(insArr, grow.name);
  } else {
    const base = grow.name.split(".", 1)[0]!;
    const template = grow.widget
      ? null
      : (catalog?.types[String(dst.get("type") ?? "")]?.autogrow_templates?.[base] ?? null);
    name = nextAutogrowName(insArr, grow.name, template);
  }
  const slot = new Y.Map<unknown>();
  slot.set("name", name);
  slot.set("type", grow.type);
  slot.set("link", null);
  slot.set("grow_id", op.link_id);
  if (grow.widget) slot.set("widget", { name: grow.widget });
  apush(insArr, slot);
  const toIdx = insArr.length - 1;

  if (grow.inputcount != null) {
    applyInputcountBump(doc, dst, op, catalog);
  }
  return toIdx;
}

/**
 * §8.4 second register: a stamped write of the family's count widget, sharing
 * the connect's op_id/stamp, through the SAME LWW gate as an explicit
 * set_widget on `("widget", to_node, widget)`. The written value is the
 * mint-time-planned count carried by the op — never re-derived post-collision.
 *
 * Deviation from Python, documented: comfy-cli skips the bump when it has no
 * catalog (it cannot resolve name→index without one); this applier's widget
 * writes are name-keyed and need no index, so the bump is unconditional.
 */
function applyInputcountBump(
  doc: Y.Doc,
  dst: Y.Map<unknown>,
  op: ConnectOp,
  catalog?: WidgetCatalog,
): void {
  const ic = op.grow!.inputcount!;
  if (typeof ic.widget !== "string") {
    throw new OpRejectedError("malformed_op", "connect: grow.inputcount needs a widget name");
  }
  const pseudo: SetWidgetOp = {
    op: "set_widget",
    op_id: op.op_id,
    actor: op.actor,
    base_version: op.base_version,
    stamp: op.stamp,
    node_id: op.to_node,
    widget: ic.widget,
    value: ic.value,
  };
  const stamps = stampsMap(doc);
  const targetKey = stampTargetKey(pseudo);
  const prior = stamps.get(targetKey) as StampKey | undefined;
  const key = stampKey(pseudo);
  if (prior != null && compareStampKeys(key, prior) <= 0) return; // lww-dropped
  validateWidgetName(catalog, String(dst.get("type") ?? ""), ic.widget);
  mset(widgetsOf(dst), ic.widget, structuredClone(ic.value));
  mset(stamps, targetKey, key);
}

function slotNames(ins: Y.Array<unknown>): Set<unknown> {
  const taken = new Set<unknown>();
  ins.forEach((slot: unknown) => {
    if (slot instanceof Y.Map) taken.add(slot.get("name"));
  });
  return taken;
}

/** comfy-cli `_next_autogrow_name` + `_first_free_autogrow_index`: prefer the requested name; on collision, the lowest free `{base}.{elem(N)}`. */
function nextAutogrowName(
  ins: Y.Array<unknown>,
  requested: string,
  template: { prefix?: string; names?: string[] } | null | undefined,
): string {
  const taken = slotNames(ins);
  if (!taken.has(requested)) return requested;
  const base = requested.split(".", 1)[0]!;
  const elem = (n: number): string => {
    if (template?.names?.length) {
      return n < template.names.length
        ? template.names[n]!
        : `${template.names[template.names.length - 1]!}${n}`;
    }
    if (template?.prefix) return `${template.prefix}${n}`;
    const stem = base.endsWith("s") ? base.slice(0, -1) : base;
    return `${stem}${n}`;
  };
  let n = 0;
  while (taken.has(`${base}.${elem(n)}`)) n++;
  return `${base}.${elem(n)}`;
}

/** comfy-cli `_next_inputcount_name`: bare `{elem}_N` keys, next free N on collision. */
function nextInputcountName(ins: Y.Array<unknown>, requested: string): string {
  const taken = slotNames(ins);
  if (!taken.has(requested)) return requested;
  const sep = requested.lastIndexOf("_");
  const elem = sep >= 0 ? requested.slice(0, sep) : "";
  const nStr = sep >= 0 ? requested.slice(sep + 1) : requested;
  let n = /^[0-9]+$/.test(nStr) ? parseInt(nStr, 10) : 1;
  let name = `${elem}_${n}`;
  while (taken.has(name)) {
    n++;
    name = `${elem}_${n}`;
  }
  return name;
}

/** Drop a link tuple and scrub every input/output reference to it (comfy-cli `_remove_link`). */
function removeLink(doc: Y.Doc, linkId: unknown): void {
  const links = linksMap(doc);
  const key = String(linkId);
  if (links.has(key)) mdel(links, key);
  nodesMap(doc).forEach((node) => {
    const ins = node.get("inputs");
    if (ins instanceof Y.Array) {
      ins.forEach((slot: unknown) => {
        if (slot instanceof Y.Map && slot.get("link") === linkId) mset(slot, "link", null);
      });
    }
    const outs = node.get("outputs");
    if (outs instanceof Y.Array) {
      outs.forEach((port: unknown) => {
        if (!(port instanceof Y.Map)) return;
        const outLinks = port.get("links");
        if (outLinks instanceof Y.Array) {
          const arr = outLinks.toArray();
          for (let i = arr.length - 1; i >= 0; i--) {
            if (arr[i] === linkId) adel(outLinks, i);
          }
        }
      });
    }
  });
}

// ---------------------------------------------------------------------------
// delete_node
// ---------------------------------------------------------------------------

function applyDeleteNode(doc: Y.Doc, op: DeleteNodeOp): void {
  if (op.node_id === undefined) {
    throw new OpRejectedError("malformed_op", "delete_node: missing node_id");
  }
  const nodes = nodesMap(doc);
  const key = String(op.node_id);
  if (nodes.has(key)) mdel(nodes, key); // absent target → still a no-op-with-cleanup (delete wins)

  const links = linksMap(doc);
  const removed = new Set<unknown>(op.removed_links ?? []);
  const toDelete: string[] = [];
  links.forEach((ln: unknown, k: string) => {
    const tuple = ln as unknown[];
    if (removed.has(tuple[0]) || tuple[1] === op.node_id || tuple[3] === op.node_id) toDelete.push(k);
  });
  for (const k of toDelete) mdel(links, k);

  const keptIds = new Set<unknown>();
  links.forEach((ln: unknown) => keptIds.add((ln as unknown[])[0]));
  // Scrub dangling references (write count bounded by the deleted node's degree;
  // the scan is O(nodes) read cost, accepted — schema §11).
  nodes.forEach((node) => {
    const ins = node.get("inputs");
    if (ins instanceof Y.Array) {
      ins.forEach((slot: unknown) => {
        if (!(slot instanceof Y.Map)) return;
        const l = slot.get("link");
        if (l != null && !keptIds.has(l)) mset(slot, "link", null);
      });
    }
    const outs = node.get("outputs");
    if (outs instanceof Y.Array) {
      outs.forEach((port: unknown) => {
        if (!(port instanceof Y.Map)) return;
        const outLinks = port.get("links");
        if (outLinks instanceof Y.Array) {
          const arr = outLinks.toArray();
          for (let i = arr.length - 1; i >= 0; i--) {
            if (!keptIds.has(arr[i])) adel(outLinks, i);
          }
        }
      });
    }
  });
}

// ---------------------------------------------------------------------------
// clear
// ---------------------------------------------------------------------------

/**
 * Empty nodes and links; reset `groups` to `[]` ONLY if the key already
 * exists (schema §6). Preserves `extra`, `definitions`,
 * `last_node_id`/`last_link_id` (id-reuse guard), and `__stamps` (post-clear
 * writes still LWW correctly). O(doc) writes — inherent, standalone-only.
 */
function applyClear(doc: Y.Doc): void {
  const nodes = nodesMap(doc);
  for (const k of [...nodes.keys()]) mdel(nodes, k);
  const links = linksMap(doc);
  for (const k of [...links.keys()]) mdel(links, k);
  const meta = metaMap(doc);
  if (meta.has("groups")) mset(meta, "groups", []);
}
