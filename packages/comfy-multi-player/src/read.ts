/**
 * Read-only snapshot surface — the supported way to READ a shared document
 * without being handed anything you can write.
 *
 * WHY THIS EXISTS. The entrypoint deliberately re-exports only ADR-004's three
 * layout reads and the KA-1 encoding diagnostic from `src/doc.ts` (issue #18):
 * the same import that hands you `nodesMap` for a read hands you a
 * live `Y.Map`, and a `.set()` on it is an UNSTAMPED write — invisible to
 * ordering (KA-2), to the LWW tiebreak, and to duplicate-op rejection (KA-4),
 * so the replica silently diverges (KA-1, FC-5). Read-only *intent* was never
 * the problem; reachability was.
 *
 * But every consumer call site that #18 broke is a READ, and the op layer is
 * for writes. `project(doc, catalog)` is the supported FULL read and remains
 * the right answer whenever the caller has the document's pinned catalog and
 * wants canonical workflow JSON. The functions here cover the reads
 * `project()` cannot serve:
 *
 *   - a follower that renders a document it holds NO catalog for, so it cannot
 *     project (and must not — ADR-004);
 *   - the doc host's pre-apply guards, which must read `meta.catalog_version`
 *     and probe node/op identity BEFORE (and precisely in order to decide
 *     whether) projecting is safe;
 *   - the cross-language conformance harness, which compares the `__applied`
 *     and `__stamps` ledgers that no projection contains.
 *
 * WHAT MAKES IT SAFE — three properties, each covered by
 * `test/readonly-surface.test.ts`:
 *
 *   1. NO LIVE HANDLE ESCAPES. Every value reachable from a return value is a
 *      primitive, or a plain `Array`/`Object` this module constructed. No
 *      `Y.AbstractType` instance is ever returned, at any depth.
 *   2. IT IS A COPY, NOT A VIEW. `Y.Map#get`/`#toJSON` return the SAME object
 *      reference that lives inside the Yjs item for a plain value, so handing
 *      that back would let `snapshot.nodes["7"].pos[0] = 9` mutate the document
 *      in place — an unstamped write through a "read" API. Every non-primitive
 *      is rebuilt here.
 *   3. IT IS DEEP-FROZEN. Every constructed object and array is
 *      `Object.freeze`d, so a write attempt throws `TypeError` under ES module
 *      strict mode rather than silently no-oping.
 *
 * ...and one more that matters to a follower specifically:
 *
 *   4. READS NEVER MATERIALIZE A ROOT. `Y.Doc#getMap(name)` CREATES the root
 *      type when the document does not have it. A follower's document between
 *      construction and its first `doc_update` frame has no roots at all, and a
 *      read must not give it any. Every accessor here gates on
 *      `doc.share.has(name)` first.
 *
 * Nothing here is a substitute for the write path: shared state changes go
 * through `applyOps` and nothing else.
 */

import * as Y from "yjs";
import {
  OPAQUE_WIDGETS_KEY,
  ROOT_APPLIED,
  ROOT_LINKS,
  ROOT_META,
  ROOT_NODES,
  ROOT_STAMPS,
} from "./doc.js";

/**
 * The reserved per-node key holding a whole `widgets_values` array verbatim for
 * a class the pinned catalog cannot describe (schema §1.2).
 *
 * This is the only `doc.ts` constant the entrypoint re-exports, and it is a
 * string literal: a primitive carries no reachability, so it cannot be a route
 * back to a live Y type. A follower that needs to tell "no widgets" from "opaque
 * widgets" needs this key, and hardcoding `"__widgets_opaque"` on the consumer
 * side is exactly the schema-drift ADR-004 closed.
 */
export { OPAQUE_WIDGETS_KEY };

/**
 * Depth ceiling for the snapshot walk.
 *
 * Yjs stores plain values by reference, so a self-referential value placed on a
 * document in memory would make an unbounded walk recurse forever. Workflow
 * JSON nests a handful of levels; 64 is far above anything legitimate and turns
 * a hostile or corrupt document into a loud, bounded failure instead of a hung
 * render loop.
 */
const MAX_SNAPSHOT_DEPTH = 64;

const EMPTY_RECORD: Readonly<Record<string, unknown>> = Object.freeze({});

/**
 * Y value (or plain value read out of one) → deep-cloned, deep-frozen plain
 * data. This is the whole enforcement mechanism; see the module header.
 */
function snapshot(value: unknown, depth: number): unknown {
  if (depth > MAX_SNAPSHOT_DEPTH) {
    throw new RangeError(
      `read: document value nests deeper than ${MAX_SNAPSHOT_DEPTH} levels — refusing to walk it`,
    );
  }
  if (value instanceof Y.Map) {
    const out: Record<string, unknown> = {};
    value.forEach((v, k) => {
      out[k] = snapshot(v, depth + 1);
    });
    return Object.freeze(out);
  }
  if (value instanceof Y.Array) {
    const items = value.toArray();
    const out = new Array<unknown>(items.length);
    for (let i = 0; i < items.length; i++) out[i] = snapshot(items[i], depth + 1);
    return Object.freeze(out);
  }
  if (value instanceof Y.AbstractType) {
    // Schema v1 uses only Y.Map/Y.Array, but a foreign document may carry a
    // Y.Text or Y.Xml* root. Convert to plain and keep walking — never return
    // the live type.
    return snapshot(value.toJSON(), depth + 1);
  }
  if (Array.isArray(value)) {
    const out = new Array<unknown>(value.length);
    for (let i = 0; i < value.length; i++) out[i] = snapshot(value[i], depth + 1);
    return Object.freeze(out);
  }
  if (typeof value === "object" && value !== null) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = snapshot(v, depth + 1);
    return Object.freeze(out);
  }
  // Primitives (including null and undefined) are immutable by construction.
  return value;
}

/**
 * A root map, WITHOUT materializing it when it is absent (property 4 above).
 *
 * `doc.share.has(name)` is the presence test rather than `doc.share.get(name)
 * instanceof Y.Map`, because a root that arrived through `Y.applyUpdate` is a
 * generic `AbstractType` until `doc.getMap` coerces it — the coercion is a
 * client-side reinterpretation of structs that already exist, so it adds no
 * bytes to `encodeStateAsUpdate`.
 *
 * A document whose root of this name is a different concrete Y type is
 * malformed; `doc.getMap` throws on it, and failing closed is the read-path
 * posture (KA-11).
 */
function rootMap(doc: Y.Doc, name: string): Y.Map<unknown> | undefined {
  if (!doc.share.has(name)) return undefined;
  return doc.getMap<unknown>(name);
}

function snapshotRoot(doc: Y.Doc, name: string): Readonly<Record<string, unknown>> {
  const root = rootMap(doc, name);
  if (root === undefined) return EMPTY_RECORD;
  return snapshot(root, 0) as Readonly<Record<string, unknown>>;
}

// ---------------------------------------------------------------------------
// Graph snapshot
// ---------------------------------------------------------------------------

/**
 * The per-node keys a graph snapshot carries.
 *
 * Deliberately a SUBSET, not the whole node. A node also holds `inputs`,
 * `outputs`, `flags`, `properties`, `size`, `order`, `mode`, … and copying all
 * of them costs ~5x more per frame than copying these four (see the PR's cost
 * analysis) for data no current consumer reads. Adding a key here is a one-line,
 * reviewable change; handing back the whole node forever is not.
 *
 * `project(doc, catalog)` remains the full-fidelity read for a caller that has
 * the catalog and wants every field.
 */
const NODE_SNAPSHOT_KEYS: readonly string[] = ["type", "pos", "widgets", OPAQUE_WIDGETS_KEY];

/**
 * One node, as plain frozen data. Every field is typed `unknown` because the
 * document is untrusted input: a caller must validate exactly as it would when
 * reading the Y.Map directly. Absent keys are absent, not `undefined`, so key
 * presence round-trips.
 */
export interface NodeSnapshot {
  /** Node class name (`class_type`). */
  readonly type?: unknown;
  /** Canvas position, verbatim (`[x, y]` for a well-formed node). */
  readonly pos?: unknown;
  /** Name-keyed widget values (schema §1.2), as a plain record. */
  readonly widgets?: unknown;
  /** Verbatim `widgets_values` for a class the pinned catalog cannot describe. */
  readonly [OPAQUE_WIDGETS_KEY]?: unknown;
}

/** Root-graph nodes and links as plain frozen data, keyed by String(id). */
export interface GraphSnapshot {
  readonly nodes: Readonly<Record<string, NodeSnapshot>>;
  readonly links: Readonly<Record<string, unknown>>;
}

/**
 * Root-graph nodes and links, as deep-frozen plain data.
 *
 * For a follower that renders a document it holds no catalog for. Subgraph
 * definitions are NOT included — no consumer reads them today, and an unread
 * export is future reachability.
 *
 * A `nodes` entry that is not a Y.Map is skipped, matching what every consumer
 * already does when walking the root map by hand.
 */
export function readGraph(doc: Y.Doc): GraphSnapshot {
  const nodes: Record<string, NodeSnapshot> = {};
  rootMap(doc, ROOT_NODES)?.forEach((node, id) => {
    if (!(node instanceof Y.Map)) return;
    const out: Record<string, unknown> = {};
    for (const key of NODE_SNAPSHOT_KEYS) {
      if (node.has(key)) out[key] = snapshot(node.get(key), 1);
    }
    nodes[id] = Object.freeze(out) as NodeSnapshot;
  });

  const links: Record<string, unknown> = {};
  rootMap(doc, ROOT_LINKS)?.forEach((raw, id) => {
    links[id] = snapshot(raw, 1);
  });

  return Object.freeze({ nodes: Object.freeze(nodes), links: Object.freeze(links) });
}

// ---------------------------------------------------------------------------
// Meta
// ---------------------------------------------------------------------------

/**
 * The document's `meta` root as deep-frozen plain data — `schema_version`,
 * `catalog_version`, the id high-water marks, and the schema §6 passthrough
 * keys. Empty (frozen) for a document that has no `meta` root yet.
 */
export function readMeta(doc: Y.Doc): Readonly<Record<string, unknown>> {
  return snapshotRoot(doc, ROOT_META);
}

/**
 * The widget-catalog SHA the document was minted with (KA-12, FC-10), or `""`
 * when the document carries no readable pin.
 *
 * `""` means "unknown, cannot compare" — the same normalization a host pin
 * guard has to do by hand, kept here so the KA-12 comparison is defined once.
 * O(1) and allocation-free: it reads one key rather than copying all of `meta`
 * (which carries `groups`/`extra` passthrough), so it is safe on a
 * per-request guard path.
 */
export function docCatalogPin(doc: Y.Doc): string {
  const raw = rootMap(doc, ROOT_META)?.get("catalog_version");
  return typeof raw === "string" ? raw : "";
}

// ---------------------------------------------------------------------------
// Identity probes and bookkeeping ledgers
// ---------------------------------------------------------------------------

/**
 * Whether a node id already exists in the root graph.
 *
 * A boolean probe rather than "snapshot the graph and look": a host deciding
 * whether an incoming `add_node` collides must not pay for a copy of the whole
 * graph per op.
 */
export function hasNode(doc: Y.Doc, nodeId: string | number): boolean {
  return rootMap(doc, ROOT_NODES)?.has(String(nodeId)) ?? false;
}

/**
 * Whether the document has already applied this `op_id` (schema §4 dedupe
 * ledger). Lets a host tell a genuine conflict from an idempotent replay
 * without copying a ledger that grows with document history.
 */
export function hasAppliedOp(doc: Y.Doc, opId: string): boolean {
  return rootMap(doc, ROOT_APPLIED)?.has(opId) ?? false;
}

/**
 * Every `op_id` the document has applied, in the map's own key order (which is
 * NOT a causal order — compare as a set).
 */
export function appliedOpIds(doc: Y.Doc): readonly string[] {
  const root = rootMap(doc, ROOT_APPLIED);
  return Object.freeze(root === undefined ? [] : [...root.keys()]);
}

/**
 * The LWW ledger as plain frozen data: write-target key →
 * `[base_version, actor, op_id]` (schema §3/§4). This is where per-op actor
 * attribution is durably observable, and it is what a cross-language
 * conformance harness compares — no projection contains it.
 */
export function readStamps(doc: Y.Doc): Readonly<Record<string, unknown>> {
  return snapshotRoot(doc, ROOT_STAMPS);
}
