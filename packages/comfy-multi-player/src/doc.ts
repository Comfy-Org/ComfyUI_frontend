/**
 * Doc layout helpers (schema v2 — docs/multiplayer-schema.md §1) and the
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
 *   ├── Y.Map '__applied'   — op_id → sha256 of the canonical op payload
 *   │                         (idempotency + op_id-reuse detection, §4
 *   │                         amendment A8; a legacy `1` is a pre-A8 record)
 *   └── Y.Map '__stamps'    — write-target key → [base_version, actor, op_id] (§4)
 */

import * as Y from "yjs";
import { assertNever } from "./exhaustive.js";
import {
  LEGACY_NODE_INCARNATION,
  NODE_INCARNATION_KEY,
  SCHEMA_VERSION,
  type WidgetCatalog,
  type WorkflowNode,
} from "./types.js";

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

/** Return a node's durable lifetime, translating a legacy node to life 0. */
export function nodeIncarnation(node: Y.Map<unknown>): string {
  const value = node.get(NODE_INCARNATION_KEY);
  return typeof value === "string" && value.length > 0 ? value : LEGACY_NODE_INCARNATION;
}

// ---------------------------------------------------------------------------
// Root maps
// ---------------------------------------------------------------------------

/**
 * The schema §1 root-map NAMES, as constants.
 *
 * The writer helpers below and the read-only snapshot surface (`src/read.ts`)
 * both address the document by these keys. Naming them once is what keeps the
 * two from drifting: a reader that hardcodes `"nodes"` while the layout moves
 * silently reads an empty graph, which is the failure mode a consumer
 * hand-mirroring the schema has (ADR-004).
 */
export const ROOT_NODES = "nodes";
export const ROOT_LINKS = "links";
export const ROOT_DEFINITIONS = "definitions";
export const ROOT_META = "meta";
export const ROOT_APPLIED = "__applied";
export const ROOT_STAMPS = "__stamps";

/** Root map holding one Y.Map per node, keyed by String(node id). */
export function nodesMap(doc: Y.Doc): Y.Map<Y.Map<unknown>> {
  return doc.getMap<Y.Map<unknown>>(ROOT_NODES);
}

/** Root map holding one link record per link, keyed by String(link id). */
export function linksMap(doc: Y.Doc): Y.Map<unknown> {
  return doc.getMap<unknown>(ROOT_LINKS);
}

/**
 * Root map holding subgraph definitions, keyed by definition id — first-class
 * so interior writes stay bounded (schema §5.1), never a meta blob.
 */
export function definitionsMap(doc: Y.Doc): Y.Map<Y.Map<unknown>> {
  return doc.getMap<Y.Map<unknown>>(ROOT_DEFINITIONS);
}

/** Root map holding schema_version, catalog_version, id high-water marks, and passthrough keys. */
export function metaMap(doc: Y.Doc): Y.Map<unknown> {
  return doc.getMap<unknown>(ROOT_META);
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
  return doc.getMap<unknown>(ROOT_APPLIED);
}

/** LWW bookkeeping: write-target key → winning stamp key (schema §3/§4). */
export function stampsMap(doc: Y.Doc): Y.Map<unknown> {
  return doc.getMap<unknown>(ROOT_STAMPS);
}

/**
 * Initialize the v1 layout on a fresh doc (idempotent). Creates the root maps
 * (including bookkeeping) and seeds meta with schema_version, the pinned
 * catalog_version, and the id high-water marks.
 *
 * NOTE: initializing a doc is not the bootstrap path for replicas — replicas
 * fork from one common mint() snapshot (schema §9), never re-seed.
 */
export function initDoc(doc: Y.Doc, catalogVersion = ""): void {
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
}

// ---------------------------------------------------------------------------
// Mutation instrumentation (schema §11 bounded-writes conformance)
//
// The applier routes every Y-level mutation through the helpers below so the
// per-op write count is observable. Counts Y operations (map set/delete,
// array insert/delete/push), matching the spike's accounting: inserting one
// node Y.Map is ONE mutation regardless of its field count.
// ---------------------------------------------------------------------------

const MUTATION_COUNT = Symbol("comfy-multi-player mutation count");
type InstrumentedDoc = Y.Doc & { [MUTATION_COUNT]?: number };

/** Reset one doc's Y-mutation counter (test instrumentation for the §11 bounded-writes rule). */
export function _resetMutationCount(doc: Y.Doc): void {
  (doc as InstrumentedDoc)[MUTATION_COUNT] = 0;
}

/** Y-mutations performed on one doc since its last reset. */
export function _getMutationCount(doc: Y.Doc): number {
  return (doc as InstrumentedDoc)[MUTATION_COUNT] ?? 0;
}

function countMutation(type: { readonly doc: Y.Doc | null }): void {
  const doc = type.doc;
  if (doc !== null) {
    const instrumented = doc as InstrumentedDoc;
    instrumented[MUTATION_COUNT] = (instrumented[MUTATION_COUNT] ?? 0) + 1;
  }
}

export function mset<T>(m: Y.Map<T>, key: string, value: T): void {
  countMutation(m);
  m.set(key, value);
}

export function mdel<T>(m: Y.Map<T>, key: string): void {
  countMutation(m);
  m.delete(key);
}

export function apush<T>(a: Y.Array<T>, item: T): void {
  countMutation(a);
  a.push([item]);
}

export function adel(a: Y.Array<unknown>, index: number, length = 1): void {
  countMutation(a);
  a.delete(index, length);
}

// ---------------------------------------------------------------------------
// Node ⇄ Y conversion
// ---------------------------------------------------------------------------

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

// ---------------------------------------------------------------------------
// What a Y.Doc can actually hold (KA-4 / D4)
// ---------------------------------------------------------------------------

/**
 * Whether Yjs can store `value` as a Y.Map VALUE — a faithful mirror of yjs
 * `typeMapSet`'s content switch.
 *
 * `structuredClone` is a necessary but NOT sufficient gate for a value on its
 * way into the document: `Map`, `Set`, `RegExp`, `Error` and `ArrayBuffer` all
 * clone happily and then throw `Unexpected content type` at the write. That
 * throw lands mid-handler — after `widgetsOf` created the widgets map, after
 * an autogrow appended its slot, after a node map was half integrated — which
 * is the KA-4 / D4 violation of issue #10 with a different trigger. Checking
 * up front is what keeps a rejected op byte-identical.
 *
 * A prototype-stripped or class instance is NOT rejected: `structuredClone`
 * turns both into plain objects, so the value that reaches the write is
 * storable. Check the CLONE, never the original.
 *
 * Pinned against a real `Y.Doc` write in `test/reject-no-mutation.regression.test.ts`
 * so this cannot drift from the yjs it mirrors.
 */
export function isStorableMapValue(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  switch ((value as object).constructor) {
    case Number:
    case Object:
    case Boolean:
    case Array:
    case String:
    case Date:
    case BigInt:
    case Uint8Array:
      return true;
    default:
      return value instanceof Y.AbstractType || value instanceof Y.Doc;
  }
}

/**
 * Whether Yjs can store `value` as a Y.Array ITEM — yjs
 * `typeListInsertGenerics`. NEITHER domain contains the other: an array insert
 * refuses `undefined` (it throws on a property read), `Date` and `BigInt`,
 * which a map accepts; a map refuses an `ArrayBuffer`, which an array accepts.
 * A value written both ways — a `connect`'s `link_id` is a destination slot's
 * `link` AND an item of the source port's `links` — must satisfy both.
 */
export function isStorableArrayItem(value: unknown): boolean {
  if (value === undefined) return false;
  if (value === null) return true;
  switch ((value as object).constructor) {
    case Number:
    case Object:
    case Boolean:
    case Array:
    case String:
    case Uint8Array:
    case ArrayBuffer:
      return true;
    default:
      return value instanceof Y.AbstractType || value instanceof Y.Doc;
  }
}

// ---------------------------------------------------------------------------
// What a Y.Doc can actually TRANSMIT (KA-1 / KA-3)
// ---------------------------------------------------------------------------

/** One place inside a value where encoding is not the identity. */
export interface EncodingLoss {
  /** Path from the value's root: `""` for the value itself, then `.key` / `[i]`. */
  path: string;
  /** What the encode → decode round trip does to it. */
  detail: string;
}

/**
 * Where a value would NOT survive its own encoding — a DIFFERENT question from
 * {@link isStorableMapValue}, and the reason both exist.
 *
 * Storability asks whether yjs accepts the write. Anything it accepts that is
 * not a Y type is held as `ContentAny`: yjs keeps the caller's object BY
 * REFERENCE and only lib0's `writeAny` (lib0 0.2.117 `encoding.js`) walks the
 * interior, at encode time, where a non-`Uint8Array` object is rewritten as a
 * bag of its own enumerable keys. So a `Map`, `Set`, `Date`, `RegExp`, `Error`,
 * `ArrayBuffer` or `DataView` NESTED inside an accepted plain object — and a
 * `Date` even at the top level, which storability accepts — is written as `{}`.
 * No throw, no rejection, byte-identical replicas: the replica that applied the
 * op holds the real value in memory and every replica that decodes the update
 * holds the coerced one (KA-1/KA-3 determinism, not KA-4 byte identity).
 *
 * This function REPORTS that; it rejects nothing. Narrowing the accepted
 * payload domain is a vocabulary amendment owed a comfy-cli counterpart, so a
 * host that wants to reject, warn or measure calls this and decides for itself.
 *
 * Give it the value AS IT WILL BE STORED — i.e. the `structuredClone`, not the
 * original — for the same reason the storability gate does: cloning is what
 * turns a class instance or a prototype-less object into a plain, faithfully
 * encodable one.
 *
 * A reference CYCLE is reported here too, and is the severe member: yjs accepts
 * it and `encodeStateAsUpdate` then throws `RangeError` forever, so the
 * document can never again be snapshotted, persisted or synced.
 *
 * Pinned against a real encode → decode round trip in
 * `test/nested-encoding-loss.regression.test.ts`, so a lib0 upgrade that widens
 * or narrows the coerced set fails the pin instead of drifting silently.
 */
export function encodingLosses(value: unknown): EncodingLoss[] {
  const out: EncodingLoss[] = [];
  walkForEncodingLoss(value, "", new Set<object>(), out, true);
  return out;
}

function walkForEncodingLoss(
  value: unknown,
  path: string,
  onPath: Set<object>,
  out: EncodingLoss[],
  isRoot: boolean,
): void {
  switch (typeof value) {
    // Every double survives, including NaN, ±Infinity and -0; `undefined`,
    // strings and booleans have their own wire types.
    case "undefined":
    case "boolean":
    case "number":
    case "string":
      return;
    case "bigint": {
      // TYPE 122 is `writeBigInt64` — anything wider is truncated, not refused.
      const kept = BigInt.asIntN(64, value);
      if (kept !== value) {
        out.push({ path, detail: `BigInt ${value} does not fit int64 and decodes as ${kept}` });
      }
      return;
    }
    case "function":
    case "symbol":
      out.push({ path, detail: `a ${typeof value} is written as undefined` });
      return;
  }
  if (value === null) return;
  const obj = value as object;
  // A Y type is stored as ContentType, not ContentAny — but only as the value
  // itself; nested inside a plain object it is walked like any other object.
  if (isRoot && (obj instanceof Y.AbstractType || obj instanceof Y.Doc)) return;
  if (onPath.has(obj)) {
    out.push({ path, detail: "a reference cycle; encodeStateAsUpdate never terminates" });
    return;
  }
  if (obj instanceof Uint8Array) return;
  onPath.add(obj);
  try {
    if (Array.isArray(obj)) {
      obj.forEach((item, i) => walkForEncodingLoss(item, `${path}[${String(i)}]`, onPath, out, false));
      return;
    }
    const proto = Object.getPrototypeOf(obj) as object | null;
    if (proto !== Object.prototype && proto !== null) {
      const keys = Object.keys(obj);
      out.push({
        path,
        detail: `${describeUnstorable(obj)} decodes as {${keys.join(", ")}} — its own enumerable keys and nothing else`,
      });
      // Reporting the coercion is not enough to stop here: `writeAny` still
      // walks those own keys, so a cycle underneath is still a
      // NON-TERMINATING encode — a strictly worse outcome than the coercion
      // above, and the one a host gating on this function must not miss.
      const cycle = referenceCyclePath(obj);
      if (cycle !== null) {
        out.push({
          path: `${path}${cycle}`,
          detail: "a reference cycle; encodeStateAsUpdate never terminates",
        });
      }
      return;
    }
    for (const [k, item] of Object.entries(obj)) {
      walkForEncodingLoss(item, `${path}.${k}`, onPath, out, false);
    }
  } finally {
    onPath.delete(obj);
  }
}

/**
 * Where a value contains a reference CYCLE that `writeAny` would follow, as a
 * path from the value's root (`.a.self`, `[0].back`), or `null`.
 *
 * A cycle is the one member of the encoding-loss family that is not a
 * divergence but a BRICK: yjs accepts a cyclic value like any other
 * `ContentAny`, the applier reports success, and `encodeStateAsUpdate` then
 * throws `RangeError: Maximum call stack size exceeded` for the rest of the
 * document's life — it can never again be snapshotted, persisted, synced, or
 * compared for the KA-4 byte-identity assertions, and `project()` throws
 * `Converting circular structure to JSON` (issue #14).
 *
 * The traversal mirrors lib0 `writeAny` EXACTLY, because only what the encoder
 * follows can make the encoder diverge:
 *  - an `Array` by index, any other object by its own ENUMERABLE keys — so a
 *    cycle through a `Map`'s entries is invisible to `writeAny` and is not
 *    reported here, while a cycle through an own key of an `Error` is;
 *  - a `Uint8Array` is a leaf (`ContentBinary`);
 *  - a Y type AS THE VALUE ITSELF is `ContentType`, never walked.
 * A shared reference that is not a back-edge (a DAG) is NOT a cycle: `writeAny`
 * duplicates it and terminates, so `seen`-style detection would refuse legal
 * payloads. The walk is iterative so an adversarially deep payload fails the
 * same way it fails today (inside `structuredClone`) rather than by overflowing
 * this stack.
 */
export function referenceCyclePath(value: unknown): string | null {
  if (typeof value !== "object" || value === null) return null;
  if (value instanceof Y.AbstractType || value instanceof Y.Doc) return null;
  if (value instanceof Uint8Array) return null;

  interface Frame {
    obj: object;
    path: string;
    keys: string[];
    next: number;
    isArray: boolean;
  }
  const frameFor = (obj: object, path: string): Frame =>
    Array.isArray(obj)
      ? { obj, path, keys: [], next: 0, isArray: true }
      : { obj, path, keys: Object.keys(obj), next: 0, isArray: false };

  const onPath = new Set<object>([value]);
  const stack: Frame[] = [frameFor(value, "")];
  while (stack.length > 0) {
    const frame = stack[stack.length - 1]!;
    const size = frame.isArray ? (frame.obj as unknown[]).length : frame.keys.length;
    if (frame.next >= size) {
      onPath.delete(frame.obj);
      stack.pop();
      continue;
    }
    const index = frame.next++;
    let child: unknown;
    let childPath: string;
    if (frame.isArray) {
      child = (frame.obj as unknown[])[index];
      childPath = `${frame.path}[${String(index)}]`;
    } else {
      const key = frame.keys[index]!;
      child = (frame.obj as Record<string, unknown>)[key];
      childPath = `${frame.path}.${key}`;
    }
    if (typeof child !== "object" || child === null) continue;
    if (child instanceof Uint8Array) continue;
    if (onPath.has(child)) return childPath;
    onPath.add(child);
    stack.push(frameFor(child, childPath));
  }
  return null;
}

/**
 * Whether a value's OWN encoding is the identity — "will this survive the
 * wire", which is a DIFFERENT question from {@link isStorableMapValue}'s "will
 * yjs accept the write", and the right one for a gate to ask.
 *
 * Being accepted is not being transmitted. yjs holds a non-Y value as
 * `ContentAny` BY REFERENCE and never inspects it; only lib0 `writeAny` walks
 * it, at encode time. Two values yjs accepts at a Y.Map slot do not come back:
 *
 *  - a `Date` — `writeAny` has no date type, so it takes the generic object
 *    branch and writes `{}` plus the value's own enumerable keys, of which a
 *    `Date` has none. One replica holds the `Date` and projects an ISO string;
 *    every replica that decodes the update holds `{}`. `Date` is documented as
 *    a legal widget value, so this is not exotic — it is what any JS producer
 *    writes for a timestamp;
 *  - a `BigInt` outside int64 — wire type 122 is `writeBigInt64`, which
 *    TRUNCATES rather than refusing: `2n**70n` decodes as `0n`. Silent numeric
 *    corruption. The boundary is exact and is pinned as such: `2n**63n - 1n`
 *    and `-(2n**63n)` survive, the next value either way does not.
 *
 * SHALLOW, deliberately: a container's interior is not walked, because
 * refusing a payload whose INTERIOR does not survive encoding narrows the
 * accepted payload domain and is a vocabulary amendment owed a comfy-cli
 * counterpart (decision D4). {@link encodingLosses} is the deep form, and is
 * still wired into no gate.
 */
export function survivesMapEncoding(value: unknown): boolean {
  if (typeof value === "bigint") return BigInt.asIntN(64, value) === value;
  if (typeof value !== "object" || value === null) return true;
  if (value instanceof Uint8Array) return true; // ContentBinary, round-trips verbatim
  if (value instanceof Y.AbstractType || value instanceof Y.Doc) return true; // ContentType/ContentDoc
  if (Array.isArray(value)) return true; // interior is D4's question, not this one
  const proto = Object.getPrototypeOf(value) as object | null;
  // `writeAny` rewrites any other object as a bag of its own enumerable keys,
  // so only a value that ALREADY is such a bag survives.
  return proto === Object.prototype || proto === null;
}

/**
 * Why a value must be refused before it is written to a Y.Map value slot, or
 * `null` to accept it. The single decision point for both gate sites (the
 * applier's `assertWritableValue` and `cloneForMap`), so the two cannot drift
 * again.
 *
 * THE BOUNDARY, stated once and enforced here. Three refusals:
 * unstorable-by-yjs (unchanged), a reference cycle (issue #14 — a bricked
 * document, and neither `JSON.stringify` nor Python's `json.dumps` can express
 * one, so no producer loses anything), and the two shallow encoding losses
 * above. What is deliberately NOT refused, pending decision D4:
 *
 *  - anything nested inside an accepted container — the whole of D4;
 *  - a boxed `Number`/`String`/`Boolean` object. These are accepted at depth 0
 *    today and are just as lossy as a `Date` (`new String("ab")` decodes as
 *    `{"0":"a","1":"b"}`, the other two as `{}`), but they are outside the
 *    `Date`/`BigInt` set D4's brief names, and refusing them is the same
 *    payload-domain narrowing that decision owns. `survivesMapEncoding` reports
 *    them truthfully; this gate lets them through on purpose.
 */
export function mapValueRefusal(value: unknown): string | null {
  if (!isStorableMapValue(value)) {
    return `${describeUnstorable(value)} cannot be stored in a Y.Doc`;
  }
  const cycle = referenceCyclePath(value);
  if (cycle !== null) return describeCycle(cycle);
  if (!survivesMapEncoding(value)) {
    if (isBoxedPrimitive(value)) return null; // D4-pending, see above
    if (typeof value === "bigint") {
      return `BigInt ${String(value)} does not fit int64 and would decode as ${String(BigInt.asIntN(64, value))}`;
    }
    return `${describeUnstorable(value)} does not survive encoding and would decode as {${Object.keys(value as object).join(", ")}}`;
  }
  return null;
}

/**
 * Why a value must be refused before it is written as a Y.Array ITEM, or
 * `null`. The array domain is not the map domain (see
 * {@link isStorableArrayItem}), and its storability gate ALREADY refuses
 * `Date`, `BigInt` and `undefined`, so the only correction it needs is the
 * cycle walk.
 *
 * Not refused, pending D4: an `ArrayBuffer`, which yjs stores as
 * `ContentBinary` and which therefore decodes as a `Uint8Array` — lossy in
 * type, and outside the cycle/`Date`/`BigInt` set this gate is scoped to.
 */
export function arrayItemRefusal(value: unknown): string | null {
  if (!isStorableArrayItem(value)) {
    return `${describeUnstorable(value)} cannot be stored in a Y.Array`;
  }
  const cycle = referenceCyclePath(value);
  if (cycle !== null) return describeCycle(cycle);
  return null;
}

function describeCycle(path: string): string {
  return `a reference cycle at ${path === "" ? "the value itself" : path}; the document could never be encoded again (#14)`;
}

function isBoxedPrimitive(value: unknown): boolean {
  const ctor = (value as object).constructor;
  return ctor === Number || ctor === String || ctor === Boolean;
}

/**
 * Defensive copy of a value destined for a Y.Map value slot, refused up front
 * if the doc cannot hold it or could not transmit it. Exported so `mint` gates
 * its passthrough writes through the same predicate the node builders use — the
 * two sites had drifted, and mint's ungated ones surfaced yjs's raw
 * `Unexpected content type` instead.
 */
export function cloneForMap(value: unknown, what: string): unknown {
  const cloned = structuredClone(value);
  const refusal = mapValueRefusal(cloned);
  if (refusal !== null) throw new TypeError(`${what}: ${refusal}`);
  return cloned;
}

/** Defensive copy of a value destined for a Y.Array item, refused up front if the doc cannot hold it. */
function cloneForArray(value: unknown, what: string): unknown {
  const cloned = structuredClone(value);
  const refusal = arrayItemRefusal(cloned);
  if (refusal !== null) throw new TypeError(`${what}: ${refusal}`);
  return cloned;
}

function describeUnstorable(value: unknown): string {
  if (value === undefined) return "undefined";
  const name = (value as object)?.constructor?.name;
  return typeof name === "string" && name.length > 0 ? `a ${name}` : "a prototype-less value";
}

function plainToYMap(obj: Record<string, unknown>, what: string): Y.Map<unknown> {
  const m = new Y.Map<unknown>();
  for (const [k, v] of Object.entries(obj)) m.set(k, cloneForMap(v, `${what}.${k}`));
  return m;
}

/** Input/output slot record → Y.Map. `links` arrays become Y.Arrays; `links: null` is preserved verbatim (schema §7). */
function slotToYMap(slot: unknown, what: string): Y.Map<unknown> | unknown {
  // A non-record slot is stored as an ITEM of the inputs/outputs Y.Array.
  if (!isPlainObject(slot)) return cloneForArray(slot, what);
  const m = new Y.Map<unknown>();
  for (const [k, v] of Object.entries(slot)) {
    if (k === "links" && Array.isArray(v)) {
      const arr = new Y.Array<unknown>();
      arr.push(v.map((x, i) => cloneForArray(x, `${what}.links[${String(i)}]`)));
      m.set(k, arr);
    } else {
      m.set(k, cloneForMap(v, `${what}.${k}`));
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
    wv.forEach((v, i) => widgets.set(order[i]!, cloneForMap(v, `widgets_values[${String(i)}]`)));
  } else if (isPlainObject(wv)) {
    for (const [k, v] of Object.entries(wv)) widgets.set(k, cloneForMap(v, `widgets_values.${k}`));
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
    if (k === OPAQUE_WIDGETS_KEY || k === "widgets" || k === NODE_INCARNATION_KEY) {
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
          m.set(OPAQUE_WIDGETS_KEY, cloneForMap(v, "widgets_values"));
          break;
        case "named":
          m.set("widgets", widgetsToYMap(node, v, widgetOrder));
          break;
        default:
          assertNever(storage, "createNodeMap: widget-storage strategy");
      }
    } else if (k === "flags" && isPlainObject(v)) {
      m.set("flags", plainToYMap(v, "flags"));
    } else if ((k === "inputs" || k === "outputs") && Array.isArray(v)) {
      const arr = new Y.Array<unknown>();
      arr.push(v.map((slot, i) => slotToYMap(slot, `${k}[${String(i)}]`)));
      m.set(k, arr);
    } else {
      m.set(k, cloneForMap(v, k));
    }
  }
  m.set(NODE_INCARNATION_KEY, LEGACY_NODE_INCARNATION);
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
 * Every node `type` that {@link resolveDefinition} maps to the definition
 * `defId` addresses: the definition's own map key, plus its cosmetic `name`
 * when that name is a legal alias.
 *
 * Three conditions, and the third is the one that cost a review. A name is an
 * alias only when:
 *
 *  1. no definition owns it as an ID — an id always wins over a name;
 *  2. no OTHER definition shares it — an ambiguous name resolves to nothing, so
 *     a node typed with it cannot be descended into at all; and
 *  3. **the pinned catalogue does not own it as a node CLASS.** A cosmetic
 *     display name is user-chosen and unvalidated, and naming a subgraph after
 *     the node it wraps is the obvious convention — three shipped cloud-snapshot
 *     templates name a definition `WanMoveTrackToVideo`, which is a real backend
 *     class instantiated inside that very definition. Counting such a node as an
 *     instance rejects a legal interior write with a message that is not even
 *     true ("instantiated 2 times" when it is instantiated once). A type the
 *     catalogue describes is a class, not a subgraph instance.
 *
 * Without a catalogue condition 3 cannot be evaluated, and the name is NOT
 * treated as an alias. That is deliberate: the name fallback is a legacy path
 * (the frontend always writes a definition's UUID into an instance `type`), so
 * an unverifiable name is far more likely to be a class than a legacy instance,
 * and guessing the other way turns a correctness fix into a false rejection.
 * The id half of the count — which is what every non-legacy document uses —
 * is unaffected and needs no catalogue.
 */
function definitionAliases(doc: Y.Doc, defId: string, catalog?: WidgetCatalog): Set<string> {
  const aliases = new Set<string>([defId]);
  const target = resolveDefinition(doc, defId);
  if (!target) return aliases;
  const defs = definitionsMap(doc);
  defs.forEach((dm, key) => {
    if (dm === target) aliases.add(key);
  });
  const name = String(target.get("name") ?? "");
  if (name === "" || defs.has(name)) return aliases; // unnamed, or shadowed by an id
  if (!catalog) return aliases; // no catalogue to ask: cannot verify, so not an alias
  if (Object.prototype.hasOwnProperty.call(catalog.types, name)) return aliases; // a node class
  let sameName = 0;
  defs.forEach((dm) => {
    if (String(dm.get("name") ?? "") === name) sameName++;
  });
  if (sameName === 1) aliases.add(name);
  return aliases;
}

/**
 * How many nodes (top-level + interior across all definitions) instantiate the
 * definition `defId` addresses — the schema §5.3 shared-definition guard input.
 *
 * This no longer mirrors comfy-cli `engine._count_instances`, which still
 * matches the literal id string. That is a deliberate, recorded divergence:
 * comfy-cli forks a shared definition where schema §5.3 requires this applier to
 * reject, and its own count misses the name-addressed pair the same way this one
 * used to. See `docs/decisions/EXCEPTIONS.md`.
 *
 * Counted by DEFINITION, not by literal type string. `resolveDefinition`
 * accepts a definition id or its unique cosmetic name, so one definition can be
 * instantiated under either spelling in the same workflow; matching the id
 * alone counted such a pair as ONE and let the §5.3 guard pass, so a single
 * interior `set_widget` mutated a definition backing two nodes while `applyOps`
 * reported success (KA-1: an op is the replication unit — it must not fan out
 * to N nodes).
 *
 * A `nodes` entry that is not a `Y.Map` is a malformed document, and this
 * function throws on it rather than skipping it. Skipping would UNDERCOUNT and
 * so make the §5.3 guard fail OPEN — quieter, and exactly backwards. The
 * interior sweep keeps its long-standing `instanceof` filter because a
 * definition whose `nodes` root is unreadable is already handled above it.
 */
export function countDefinitionInstances(doc: Y.Doc, defId: string, catalog?: WidgetCatalog): number {
  const aliases = definitionAliases(doc, defId, catalog);
  let count = 0;
  nodesMap(doc).forEach((node, key) => {
    if (!(node instanceof Y.Map)) {
      throw new TypeError(
        `countDefinitionInstances: nodes['${String(key)}'] is not a Y.Map (${typeof node}); the document is malformed and the schema §5.3 instance count cannot be trusted`,
      );
    }
    if (aliases.has(String(node.get("type") ?? ""))) count++;
  });
  definitionsMap(doc).forEach((dm) => {
    const inner = dm.get("nodes");
    if (inner instanceof Y.Map) {
      inner.forEach((node: unknown) => {
        if (node instanceof Y.Map && aliases.has(String(node.get("type") ?? ""))) count++;
      });
    }
  });
  return count;
}
