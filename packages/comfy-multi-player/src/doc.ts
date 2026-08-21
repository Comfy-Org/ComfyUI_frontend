/**
 * Doc layout helpers (schema v1 — docs/multiplayer-schema.md §1) and the
 * node ⇄ Y conversion used by mint and the applier.
 *
 *   doc
 *   ├── Y.Map 'nodes'       — key: String(node id) → per-node Y.Map
 *   │     └── type: string, pos: number[], flags: Y.Map,
 *   │         widgets: Y.Map (widget NAME → value; positional
 *   │         widgets_values exists only in projection — §1.2),
 *   │         inputs: Y.Array<Y.Map>, outputs: Y.Array<Y.Map>, …
 *   ├── Y.Map 'links'       — key: String(link id) → plain link tuple
 *   ├── Y.Map 'definitions' — key: subgraph def id → def Y.Map with its own
 *   │                         nested 'nodes'/'links' (recursively — §5)
 *   ├── Y.Map 'meta'        — schema_version, catalog_version,
 *   │                         last_node_id, last_link_id,
 *   │                         groups/extra/… passthrough (plain values, §6)
 *   ├── Y.Map '__applied'   — op_id → 1 (idempotency, §4)
 *   └── Y.Map '__stamps'    — write-target key → [base_version, actor, op_id] (§4)
 */

import * as Y from "yjs";
import { assertNever } from "./exhaustive.js";
import { SCHEMA_VERSION, type WorkflowNode } from "./types.js";

// ---------------------------------------------------------------------------
// Opaque widgets (schema §1.2 — unknown classes)
// ---------------------------------------------------------------------------

/**
 * Reserved per-node key holding a whole `widgets_values` array VERBATIM, used
 * for a class the pinned catalog does not know and therefore cannot be
 * name-decomposed (schema §1.2).
 *
 * Frontend-only nodes (`Note`, `MarkdownNote`, …) are rendered by the ComfyUI
 * frontend and never appear in `object_info`, so they can never appear in a
 * catalog derived from it — there is no `widget_order` to key their values by,
 * and there never will be. Refusing to mint them made every workflow
 * containing a sticky note unmintable (most official templates have one).
 *
 * This does NOT reintroduce the §1.2 corruption. §1.2 bans ELEMENT-WISE
 * merging of a positional array: two writers editing the same index of a
 * 7-element `widgets_values`, exchanged as Yjs structs, merge to a length-8
 * array and every downstream widget shifts. An opaque value is a single plain
 * value under one key — it is never merged element-wise; concurrent writes
 * resolve as whole-value LWW, which is the correct semantics for an
 * annotation node whose content is one logical value.
 *
 * The cost, stated: the values under this key are NOT name-addressable, so
 * `set_widget` against such a node is rejected (`opaque_widgets`) rather than
 * silently dropped — see the applier.
 */
export const OPAQUE_WIDGETS_KEY = "__widgets_opaque";

/**
 * Whether a node's `widgets_values` must be stored opaquely: a NON-EMPTY
 * positional array whose class has no `widget_order` in the pinned catalog.
 *
 * Deliberately narrow. A `widget_order` that is present but SHORTER than
 * `widgets_values` is a genuine catalog/workflow mismatch and keeps failing
 * loudly (see `widgetsToYMap`) — this path is only for classes the catalog
 * does not describe at all.
 */
export function isOpaqueWidgets(wv: unknown, widgetOrder: readonly string[] | undefined): boolean {
  return widgetOrder === undefined && Array.isArray(wv) && wv.length > 0;
}

// ---------------------------------------------------------------------------
// Widget-storage strategy adapter (issue #21)
//
// A node's widget values are stored one of two ways, and the choice was
// previously re-derived independently in four modules — `doc.ts` decided it
// from `isOpaqueWidgets`, `applier.ts` re-read it as `node.has(
// OPAQUE_WIDGETS_KEY)`, `project.ts` re-read it as a key name in a `forEach`,
// and `mint.ts` inherited it through `createNodeMap`. Nothing named the set of
// strategies, so a third strategy could be added and every site that missed it
// would keep compiling.
//
// The strategy is now a named union with one classifier per direction. Every
// consumer switches on it and ends in an exhaustiveness guard, so a third
// member fails `tsc` at each site that does not handle it.
// ---------------------------------------------------------------------------

/** The widget-storage strategies a node may use (schema §1.2). */
export const WIDGET_STORAGE_STRATEGIES = ["named", "opaque"] as const;

/**
 * How a node's widget values are stored:
 *
 * - `named` — the name-keyed `widgets` Y.Map, decomposed from positional
 *   `widgets_values` through the pinned catalog's `widget_order`. The normal
 *   case; the only one that is name-addressable and therefore the only one
 *   `set_widget` can write.
 * - `opaque` — the whole `widgets_values` array verbatim under
 *   {@link OPAQUE_WIDGETS_KEY}, for a class the pinned catalog cannot
 *   describe (frontend-only `Note`/`MarkdownNote`). Whole-value LWW, never
 *   element-wise merge.
 */
export type WidgetStorage = (typeof WIDGET_STORAGE_STRATEGIES)[number];

/**
 * WRITE side: which strategy a `widgets_values` payload must use, given the
 * pinned catalog's `widget_order` for the node's class. Used by
 * `createNodeMap` (and therefore by `mint` and `add_node`).
 */
export function widgetStorageFor(
  wv: unknown,
  widgetOrder: readonly string[] | undefined,
): WidgetStorage {
  return isOpaqueWidgets(wv, widgetOrder) ? "opaque" : "named";
}

/**
 * READ side: which strategy a node already stored in the doc is using. A node
 * with no widget values at all reads as `named` — the name-keyed map is the
 * shape a first write would create, which is exactly what the applier needs to
 * know.
 *
 * `node` must be INTEGRATED (already inserted into a doc): `Y.Map#has` reads
 * the integrated map, so a preliminary Y.Map — e.g. a fresh `createNodeMap`
 * result before it is `set` into `nodes` — answers `false` for every key. The
 * applier and `project` only ever see integrated nodes; the write side uses
 * {@link widgetStorageFor} instead.
 */
export function widgetStorageOf(node: Y.Map<unknown>): WidgetStorage {
  return node.has(OPAQUE_WIDGETS_KEY) ? "opaque" : "named";
}

// ---------------------------------------------------------------------------
// Root maps
// ---------------------------------------------------------------------------

/** Root map holding one Y.Map per node, keyed by String(node id). */
export function nodesMap(doc: Y.Doc): Y.Map<Y.Map<unknown>> {
  return doc.getMap<Y.Map<unknown>>("nodes");
}

/** Root map holding one link record per link, keyed by String(link id). */
export function linksMap(doc: Y.Doc): Y.Map<unknown> {
  return doc.getMap<unknown>("links");
}

/**
 * Root map holding subgraph definitions, keyed by definition id — first-class
 * so interior writes stay bounded (schema §5.1), never a meta blob.
 */
export function definitionsMap(doc: Y.Doc): Y.Map<Y.Map<unknown>> {
  return doc.getMap<Y.Map<unknown>>("definitions");
}

/** Root map holding schema_version, catalog_version, id high-water marks, and passthrough keys. */
export function metaMap(doc: Y.Doc): Y.Map<unknown> {
  return doc.getMap<unknown>("meta");
}

/**
 * Idempotency bookkeeping: op_id → 1 (schema §4).
 *
 * FOLLOW-UP (schema §4 rule 1): per-actor watermark compaction is not
 * implemented yet — it needs the HOST to assign per-actor contiguous `seq`
 * numbers at ingest, which is a doc-host concern, not an applier one. Until
 * then the plain map plus snapshot compaction (§4 rule 2, host-owned) is the
 * schema's explicitly-conforming implementation.
 */
export function appliedMap(doc: Y.Doc): Y.Map<unknown> {
  return doc.getMap<unknown>("__applied");
}

/** LWW bookkeeping: write-target key → winning stamp key (schema §3/§4). */
export function stampsMap(doc: Y.Doc): Y.Map<unknown> {
  return doc.getMap<unknown>("__stamps");
}

/**
 * Initialize the v1 layout on a fresh doc (idempotent). Creates the root maps
 * (including bookkeeping) and seeds meta with schema_version, the pinned
 * catalog_version, and the id high-water marks.
 *
 * NOTE: initializing a doc is not the bootstrap path for replicas — replicas
 * fork from one common mint() snapshot (schema §9), never re-seed.
 */
export function initDoc(doc: Y.Doc, catalogVersion = ""): Y.Doc {
  doc.transact(() => {
    nodesMap(doc);
    linksMap(doc);
    definitionsMap(doc);
    appliedMap(doc);
    stampsMap(doc);
    const meta = metaMap(doc);
    if (meta.get("schema_version") === undefined) {
      meta.set("schema_version", SCHEMA_VERSION);
      meta.set("catalog_version", catalogVersion);
      meta.set("last_node_id", 0);
      meta.set("last_link_id", 0);
      // Passthrough keys (extra/groups/…) are opaque PLAIN values (schema §6),
      // never Y types — they are replaced whole, not field-merged.
      meta.set("extra", {});
    }
  });
  return doc;
}

// ---------------------------------------------------------------------------
// Mutation instrumentation (schema §11 bounded-writes conformance)
//
// The applier routes every Y-level mutation through the helpers below so the
// per-op write count is observable. Counts Y operations (map set/delete,
// array insert/delete/push), matching the spike's accounting: inserting one
// node Y.Map is ONE mutation regardless of its field count.
// ---------------------------------------------------------------------------

let mutations = 0;

/** Reset the Y-mutation counter (test instrumentation for the §11 bounded-writes rule). */
export function _resetMutationCount(): void {
  mutations = 0;
}

/** Y-mutations performed by the applier since the last reset. */
export function _getMutationCount(): number {
  return mutations;
}

export function mset<T>(m: Y.Map<T>, key: string, value: T): void {
  mutations++;
  m.set(key, value);
}

export function mdel<T>(m: Y.Map<T>, key: string): void {
  mutations++;
  m.delete(key);
}

export function apush<T>(a: Y.Array<T>, item: T): void {
  mutations++;
  a.push([item]);
}

export function adel(a: Y.Array<unknown>, index: number, length = 1): void {
  mutations++;
  a.delete(index, length);
}

// ---------------------------------------------------------------------------
// Node ⇄ Y conversion
// ---------------------------------------------------------------------------

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function plainToYMap(obj: Record<string, unknown>): Y.Map<unknown> {
  const m = new Y.Map<unknown>();
  for (const [k, v] of Object.entries(obj)) m.set(k, structuredClone(v));
  return m;
}

/** Input/output slot record → Y.Map. `links` arrays become Y.Arrays; `links: null` is preserved verbatim (schema §7). */
function slotToYMap(slot: unknown): Y.Map<unknown> | unknown {
  if (!isPlainObject(slot)) return structuredClone(slot);
  const m = new Y.Map<unknown>();
  for (const [k, v] of Object.entries(slot)) {
    if (k === "links" && Array.isArray(v)) {
      const arr = new Y.Array<unknown>();
      arr.push(v.map((x) => structuredClone(x)));
      m.set(k, arr);
    } else {
      m.set(k, structuredClone(v));
    }
  }
  return m;
}

/**
 * Build the name-keyed widgets Y.Map (schema §1.2) from a node's
 * `widgets_values`. A positional array requires the pinned catalog's
 * `widget_order` for the node's type; an already name-keyed record does not.
 * Anything else (comfy-cli `_widgets_as_list`: non-list, non-object) reads as
 * "no positional values known" — an empty map.
 *
 * A non-empty positional array for a class with NO `widget_order` never
 * reaches here — `createNodeMap` routes it to opaque storage
 * ({@link OPAQUE_WIDGETS_KEY}). A `widget_order` that is present but too
 * SHORT still throws: that is a catalog/workflow mismatch, not an unknown
 * class, and silently swallowing it would mis-key real widget values.
 */
function widgetsToYMap(
  node: WorkflowNode,
  wv: unknown,
  widgetOrder: readonly string[] | undefined,
): Y.Map<unknown> {
  const widgets = new Y.Map<unknown>();
  if (Array.isArray(wv)) {
    const order = widgetOrder ?? [];
    if (wv.length > order.length) {
      throw new TypeError(
        `createNodeMap(${node.type}): widgets_values has ${wv.length} entries but widget_order names only ${order.length}`,
      );
    }
    wv.forEach((v, i) => widgets.set(order[i]!, structuredClone(v)));
  } else if (isPlainObject(wv)) {
    for (const [k, v] of Object.entries(wv)) widgets.set(k, structuredClone(v));
  }
  return widgets;
}

/**
 * Build the per-node Y.Map for a workflow node — FAITHFUL passthrough: every
 * key present on the source node (and only those) is stored, so projection
 * reproduces the node without inventing defaults. Special-cased per schema §1.1:
 *
 * - `widgets_values` → the NAME-KEYED `widgets` Y.Map (schema §1.2 — the spike
 *   proved positional Y.Array widgets corrupt under same-index concurrency).
 *   The key is stored even when empty, so key presence round-trips.
 *   EXCEPTION: a non-empty positional array for a class absent from the pinned
 *   catalog is stored whole under {@link OPAQUE_WIDGETS_KEY} and round-trips
 *   verbatim — frontend-only classes (`Note`, `MarkdownNote`) can never have a
 *   `widget_order`.
 * - `flags` → nested Y.Map.
 * - `inputs` / `outputs` → Y.Array of slot Y.Maps; `outputs[].links: null`
 *   preserved verbatim, arrays become Y.Arrays (schema §7).
 * - everything else → plain clone, projected back verbatim.
 *
 * `widgetOrder` (the pinned catalog's `widget_order` for the node's type) is
 * required to decompose a non-empty positional `widgets_values` array; a node
 * whose `widgets_values` is already a name-keyed record needs no catalog.
 */
export function createNodeMap(node: WorkflowNode, widgetOrder?: readonly string[]): Y.Map<unknown> {
  const m = new Y.Map<unknown>();
  for (const [k, v] of Object.entries(node)) {
    if (k === OPAQUE_WIDGETS_KEY || k === "widgets") {
      // Both are DOC-INTERNAL storage keys owned by this module (schema §1.2);
      // a workflow node carries `widgets_values`, never either of these. An
      // untrusted payload that sets them directly would shadow the name-keyed
      // map with an arbitrary value and make `project()` throw for the whole
      // document on every subsequent read (#13).
      throw new TypeError(
        `createNodeMap(${String(node.type)}): node carries the reserved key '${k}' (doc-internal storage; schema §1.2 — a workflow node carries 'widgets_values')`,
      );
    } else if (k === "widgets_values") {
      const storage = widgetStorageFor(v, widgetOrder);
      switch (storage) {
        case "opaque":
          // Whole-value storage: never merged element-wise, so §1.2's
          // positional-array corruption cannot arise. See OPAQUE_WIDGETS_KEY.
          m.set(OPAQUE_WIDGETS_KEY, structuredClone(v));
          break;
        case "named":
          m.set("widgets", widgetsToYMap(node, v, widgetOrder));
          break;
        default:
          assertNever(storage, "createNodeMap: widget-storage strategy");
      }
    } else if (k === "flags" && isPlainObject(v)) {
      m.set("flags", plainToYMap(v));
    } else if ((k === "inputs" || k === "outputs") && Array.isArray(v)) {
      const arr = new Y.Array<unknown>();
      arr.push(v.map((slot) => slotToYMap(slot)));
      m.set(k, arr);
    } else {
      m.set(k, structuredClone(v));
    }
  }
  return m;
}

// ---------------------------------------------------------------------------
// Definition lookup (schema §5)
// ---------------------------------------------------------------------------

/**
 * Resolve a subgraph instance's `type` to its definition Y.Map: by definition
 * id first, then by unique cosmetic `name` as a legacy fallback (mirrors
 * comfy-cli `engine._subgraph_defs_by_id` — id always wins, ambiguous names
 * never resolve).
 */
export function resolveDefinition(doc: Y.Doc, key: string): Y.Map<unknown> | null {
  const defs = definitionsMap(doc);
  const byId = defs.get(key);
  if (byId) return byId;
  let found: Y.Map<unknown> | null = null;
  let count = 0;
  defs.forEach((dm) => {
    if (String(dm.get("name") ?? "") === key) {
      count++;
      found = dm;
    }
  });
  return count === 1 ? found : null;
}

/**
 * How many nodes (top-level + interior across all definitions) instantiate
 * `defId` — the schema §5.3 shared-definition guard input (mirrors comfy-cli
 * `engine._count_instances`).
 */
export function countDefinitionInstances(doc: Y.Doc, defId: string): number {
  let count = 0;
  nodesMap(doc).forEach((node) => {
    if (String(node.get("type") ?? "") === defId) count++;
  });
  definitionsMap(doc).forEach((dm) => {
    const inner = dm.get("nodes");
    if (inner instanceof Y.Map) {
      inner.forEach((node: unknown) => {
        if (node instanceof Y.Map && String(node.get("type") ?? "") === defId) count++;
      });
    }
  });
  return count;
}
