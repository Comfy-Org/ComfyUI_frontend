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
 *   5. IT IS NOT A WAY AROUND THE KA-11 READ GATE. `project()` refuses a
 *      document whose `meta.schema_version` this package cannot read (#38).
 *      This surface reads the SAME layout by the SAME key names, so every
 *      accessor refuses it too — see {@link assertSnapshotReadable} for the
 *      two clauses and why the empty-document one is load-bearing.
 *
 * Nothing here is a substitute for the write path: shared state changes go
 * through `applyOps` and nothing else.
 */

import * as Y from "yjs";
import {
  OPAQUE_WIDGETS_KEY,
  ROOT_APPLIED,
  ROOT_LINKS,
  ROOT_LINK_STATE,
  ROOT_META,
  ROOT_NODES,
  ROOT_STAMPS,
} from "./doc.js";
import { assertReadableSchema } from "./schema-version.js";
import { LINK_STATE_DESCRIPTOR_VERSION } from "./types.js";
import { WIDGET_FORM_KEY } from "./widget-form.js";

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
 * The reserved per-node key holding a node's OWN declared widget layout
 * (schema Amendment A24): the serialization shape, the ordered widget
 * identity its producer declared, and the verbatim residue of serialized keys
 * that are not widgets.
 *
 * Re-exported for the same reason as {@link OPAQUE_WIDGETS_KEY} and under the
 * same constraint (a string literal carries no reachability). A follower
 * rendering a document it holds no catalog for needs this key to tell the
 * three widget-storage strategies apart, and a node carrying this one is the
 * only kind it can position WITHOUT a catalog.
 */
export { WIDGET_FORM_KEY };

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
    const out = Object.create(null) as Record<string, unknown>;
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
    const out = Object.create(null) as Record<string, unknown>;
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
// The KA-11 read gate, on this surface
// ---------------------------------------------------------------------------

/**
 * Whether this document has ever integrated a struct.
 *
 * DELIBERATELY VOCABULARY-FREE, and that is the whole point. The obvious
 * implementation asks whether any of the schema §1 roots — `nodes`, `links`,
 * `definitions`, `meta`, `__applied`, `__stamps` — holds an entry. It is also
 * WRONG, in exactly the direction KA-11 cares about: those six names are v1's
 * names, and KA-11 says the layout whose change REQUIRES a version bump is
 * precisely the root-map names (`fixtures/golden-vectors/wire-layout.json`
 * spells this out: "Renaming any of them is a layout break"). So a v2 document
 * that renamed its roots — the repo's own worked example of what a v2 IS — is
 * the one document a name-keyed probe cannot see. Measured: such a document
 * carries 47 bytes and two structs, `project()` refuses it, and a name-keyed
 * probe called it EMPTY and handed back `{nodes:{},links:{}}`. On a follower
 * that diffs snapshots, an empty graph does not mean "nothing to draw"; it
 * means "delete every node".
 *
 * `doc.store.clients` is the set of integrated structs, keyed by client. It is
 * empty for a document that has never received anything, and non-empty the
 * moment one has been integrated under ANY root name — so it answers "does
 * this document carry something" without needing to know what v2 will call it.
 *
 * Three consequences worth being explicit about:
 *
 *   - a root REGISTERED but never written adds no struct, so `metaMap(doc)`
 *     called by an unrelated reader (the #20 defect, and something the
 *     frontend's own schema guard does on every frame) still leaves the
 *     document "carrying nothing". That was the reason the earlier probe keyed
 *     on content rather than root presence, and it survives here for free;
 *   - a document whose entries were all DELETED still carries structs, so it
 *     refuses rather than reading as empty. That is the fail-closed direction
 *     and it matches `project()`;
 *   - it touches no root, so there is no `Y.Doc#getMap` to throw a
 *     constructor clash and no `catch` to decide what a clash means. A
 *     previous version treated a clash as content, which made two 2-byte,
 *     zero-struct documents disagree on whether they were empty depending on
 *     which concrete Y type an unrelated caller had registered.
 *
 * Structs buffered as `store.pendingStructs` — an update whose dependencies
 * have not arrived — are deliberately NOT counted. No reader can see a pending
 * struct, so a replica holding only pending structs really is carrying nothing
 * YET, and a follower mid-arrival needs an empty read there rather than a
 * throw. Note this is not the same question as "has no bytes":
 * `encodeStateAsUpdate` DOES re-emit the buffered update, so such a document
 * is 20 bytes, not 2. Pinned by `stays empty for a document holding only
 * structs it cannot integrate`.
 *
 * The `structs.length > 0` test rather than `clients.size > 0` is defensive
 * and, as far as I could construct, EQUIVALENT: no document I could build —
 * empty transaction, `getMap`-only, set-then-delete, GC'd subtree, pending-only
 * — has a client key with an empty struct array. It is kept because it makes
 * the predicate true by construction rather than by a Yjs implementation
 * detail, and the mutant that swaps it survives the suite. Said here rather
 * than left as an unexplained survivor.
 */
function carriesContent(doc: Y.Doc): boolean {
  for (const structs of doc.store.clients.values()) {
    if (structs.length > 0) return true;
  }
  return false;
}

/**
 * The KA-11 read gate for this surface: **refuse a document that carries
 * content under a schema this package cannot read; stay empty for a document
 * that carries nothing.**
 *
 * WHY THIS EXISTS. `project()` refuses a document whose `meta.schema_version`
 * is missing, older, newer, or not a version at all (#38/#60), because reading
 * a v2 layout with v1 key names is the KA-11 mis-projection. This surface
 * reads the SAME layout by the SAME key names, so without a gate here a
 * consumer could route around `project()`'s refusal by calling `readGraph`
 * instead and get exactly the mis-keyed read KA-11 forbids. A guard a consumer
 * can walk around is decorative.
 *
 * WHY IT IS NOT JUST `assertReadableSchema`. A follower's document between
 * construction and its first `doc_update` frame has no roots at all —
 * `assertReadableSchema` alone would throw on it, because "no readable
 * `schema_version`" is one of its refusal cases. Three things make returning
 * empty the right answer there instead:
 *
 *   - there is no content to mis-key. KA-11 is about a reader silently
 *     MIS-PROJECTING an incompatible document; a document that carries nothing
 *     cannot be mis-projected, so refusing it buys no safety;
 *   - the surface already behaves that way on `main`, and two tests that
 *     landed with it pin the behaviour (`docCatalogPin` returns `""` for a
 *     `new Y.Doc()`; a full pass over a root-less document materializes no
 *     root). Refusing would be a regression, not a tightening;
 *   - `migrate()`, by contrast, DOES refuse that document (#30). That is a
 *     role split rather than a precedent to follow: `migrate()` is a host-only
 *     WRITE, and a caller asking to migrate a document that says nothing about
 *     its own version is asking for something incoherent. A pure read is not.
 *
 * So the two clauses are:
 *
 *   1. the document carries content, and its schema is not this package's →
 *      throw the same `SchemaVersionError` `project()` throws;
 *   2. the document carries nothing → return, and every accessor then yields
 *      its empty value (`{}`, `[]`, `""`, `false`).
 *
 * There is no third clause, and in particular no "read it anyway" arm: a
 * document that carries content and does not say which schema it is in is
 * refused, exactly as `project()` refuses it.
 *
 * ONE DISPOSITION DIVERGENCE FROM `project()`, and it is the whole content of
 * clause 2: the two share a PREDICATE (`readSchemaVersion`) and differ on what
 * they do about a document that carries nothing. `project()` refuses it —
 * Amendment A5 records that the doc host answers 400 for exactly that
 * document, where it used to answer 200 with an empty graph. This surface
 * returns empty. That is not parity lost by accident; it is the difference
 * between a projection, which promises a workflow, and a snapshot read, which
 * promises whatever is there.
 *
 * The version comparison itself is NOT redefined here. `readSchemaVersion` and
 * `assertReadableSchema` are `schema-version.ts`'s, so this surface, the
 * projection, and `migrate()` share one definition of "readable" and cannot
 * drift into three.
 */
function assertSnapshotReadable(doc: Y.Doc, context: string): void {
  if (!carriesContent(doc)) return;
  assertReadableSchema(doc, context);
}

// ---------------------------------------------------------------------------
// Graph snapshot
// ---------------------------------------------------------------------------

/**
 * The per-node keys a graph snapshot carries.
 *
 * Deliberately a SUBSET, not the whole node. A node also holds `inputs`,
 * `outputs`, `flags`, `properties`, `size`, `order`, `mode`, … and copying all
 * of them costs about TWICE as much per frame as copying these four — 4.0x a
 * raw live-handle read against `readGraph`'s 2.0x, re-measured at this commit
 * with `node scripts/bench-read.mjs` — for data no current consumer reads.
 * (An earlier "~5x" here was against a different baseline and is withdrawn;
 * README and ADR-005 both say "twice", and now so does this.) Adding a key here is a one-line,
 * reviewable change; handing back the whole node forever is not.
 *
 * `project(doc, catalog)` remains the full-fidelity read for a caller that has
 * the catalog and wants every field.
 */
const NODE_SNAPSHOT_KEYS: readonly string[] = ["type", "pos", "widgets", OPAQUE_WIDGETS_KEY, WIDGET_FORM_KEY];

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
  /**
   * The node's own declared widget layout (schema Amendment A24). Present
   * exactly when `widgets` is positioned by the node's declaration rather
   * than by the pinned catalog, which is what lets a catalog-less follower
   * place these values at all.
   */
  readonly [WIDGET_FORM_KEY]?: unknown;
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
  assertSnapshotReadable(doc, "readGraph");
  const nodes = Object.create(null) as Record<string, NodeSnapshot>;
  rootMap(doc, ROOT_NODES)?.forEach((node, id) => {
    if (!(node instanceof Y.Map)) return;
    const out = Object.create(null) as Record<string, unknown>;
    for (const key of NODE_SNAPSHOT_KEYS) {
      if (node.has(key)) out[key] = snapshot(node.get(key), 1);
    }
    nodes[id] = Object.freeze(out) as NodeSnapshot;
  });

  const links = Object.create(null) as Record<string, unknown>;
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
  assertSnapshotReadable(doc, "readMeta");
  return snapshotRoot(doc, ROOT_META);
}

/**
 * The widget-catalog SHA the document was minted with (KA-12, FC-10), or `""`
 * when the document carries no readable pin.
 *
 * `""` means "unknown, cannot compare" — the same normalization a host pin
 * guard has to do by hand, kept here so the KA-12 comparison is defined once.
 * O(1) and allocation-free: it reads two `meta` keys (the schema claim the gate
 * needs, then the pin) rather than copying all of `meta` — which carries the
 * `groups`/`extra` passthrough — so it is safe on a per-request guard path.
 */
export function docCatalogPin(doc: Y.Doc): string {
  assertSnapshotReadable(doc, "docCatalogPin");
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
  assertSnapshotReadable(doc, "hasNode");
  return rootMap(doc, ROOT_NODES)?.has(String(nodeId)) ?? false;
}

/**
 * Whether the document has already applied this `op_id` (schema §4 dedupe
 * ledger). Lets a host tell a genuine conflict from an idempotent replay
 * without copying a ledger that grows with document history.
 */
export function hasAppliedOp(doc: Y.Doc, opId: string): boolean {
  assertSnapshotReadable(doc, "hasAppliedOp");
  return rootMap(doc, ROOT_APPLIED)?.has(opId) ?? false;
}

/**
 * Every `op_id` the document has applied, in the map's own key order (which is
 * NOT a causal order — compare as a set).
 */
export function appliedOpIds(doc: Y.Doc): readonly string[] {
  assertSnapshotReadable(doc, "appliedOpIds");
  const root = rootMap(doc, ROOT_APPLIED);
  return Object.freeze(root === undefined ? [] : [...root.keys()]);
}

/**
 * The applied-op ledger as plain frozen data: `op_id` → the value the applier
 * recorded when it integrated that op (schema §4). Since amendment A8 that is
 * `sha256(canonicalOp(op))` as a 64-hex string (`opDigest`); a pre-A8 record
 * is the literal `1`. The value is returned as stored — a consumer that needs
 * to tell a digest from a legacy marker checks `typeof value === "string"`,
 * exactly as `applyOps`'s reuse gate does, so this surface stays a faithful
 * read rather than a second schema opinion.
 *
 * `appliedOpIds` answers "which ops"; this answers "which ops, recorded how",
 * which is what a ledger backfill or a cross-language conformance harness
 * compares. Symmetric with `readStamps`.
 */
export function readApplied(doc: Y.Doc): Readonly<Record<string, unknown>> {
  assertSnapshotReadable(doc, "readApplied");
  return snapshotRoot(doc, ROOT_APPLIED);
}

/**
 * The LWW ledger as plain frozen data: write-target key →
 * `[base_version, actor, op_id]` (schema §3/§4). This is where per-op actor
 * attribution is durably observable, and it is what a cross-language
 * conformance harness compares — no projection contains it.
 */
export function readStamps(doc: Y.Doc): Readonly<Record<string, unknown>> {
  assertSnapshotReadable(doc, "readStamps");
  return snapshotRoot(doc, ROOT_STAMPS);
}

/** Descriptor fields have already been copied into inert snapshot data. */
function descriptorRecord(value: unknown): Record<string, unknown> | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;
  return value as Record<string, unknown>;
}

/** Durable imported and operation-owned link descriptors as deep-frozen plain data. */
export function readLinkState(doc: Y.Doc): Readonly<Record<string, unknown>> {
  assertSnapshotReadable(doc, "readLinkState");
  const state = snapshotRoot(doc, ROOT_LINK_STATE);
  for (const [id, raw] of Object.entries(state)) {
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
      throw new TypeError(`readLinkState: link ${id} is not a descriptor`);
    }
    const descriptor = raw as Record<string, unknown>;
    const tuple = descriptor["tuple"];
    const destinationValue = descriptor["destination"];
    const destination = descriptorRecord(destinationValue);
    const validId = (value: unknown): boolean =>
      (typeof value === "string" && value.length > 0) || (typeof value === "number" && Number.isSafeInteger(value));
    const validSlot = (value: unknown): boolean => Number.isSafeInteger(value) && (value as number) >= 0;
    const slotRecord = descriptorRecord(destination?.["slot"]);
    const validSlotRecord = slotRecord !== undefined;
    const authority = descriptor["authority"];
    const operationAuthority = descriptorRecord(authority);
    const operationStamp = operationAuthority?.["stamp"];
    // Match validateEnvelope/stampKey, including the empty fallback actor and
    // non-empty opaque op IDs. Reading must not reject records our writer emits.
    const validAuthority = authority === "imported" ||
      (operationAuthority?.["kind"] === "operation" && Array.isArray(operationStamp) && operationStamp.length === 3 &&
       Number.isSafeInteger(operationStamp[0]) && (operationStamp[0] as number) >= 0 &&
       typeof operationStamp[1] === "string" &&
       typeof operationStamp[2] === "string" && operationStamp[2].length > 0);
    const requestValue = destination?.["request"];
    const request = descriptorRecord(requestValue);
    const inputcountValue = request?.["inputcount"];
    const inputcount = descriptorRecord(inputcountValue);
    const validRequest = destination?.["kind"] !== "autogrow" || authority === "imported" ||
      (request !== undefined && typeof request["name"] === "string" &&
       typeof request["type"] === "string" &&
       (request["widget"] === undefined || typeof request["widget"] === "string") &&
       (request["promoted"] === undefined || typeof request["promoted"] === "boolean") &&
       (request["inputcount"] === undefined ||
        (inputcount !== undefined && typeof inputcount["widget"] === "string" && "value" in inputcount)));
    if (descriptor["version"] !== LINK_STATE_DESCRIPTOR_VERSION || !validAuthority ||
        !Array.isArray(tuple) || tuple.length !== 6 || String(tuple[0]) !== id ||
        !validId(tuple[0]) || !validId(tuple[1]) || !validSlot(tuple[2]) ||
        !validId(tuple[3]) || !validSlot(tuple[4]) || destination === undefined ||
        !validSlot(destination["to_slot"]) || destination["to_slot"] !== tuple[4] || !validSlotRecord ||
        (slotRecord !== undefined && String(slotRecord["link"]) !== String(tuple[0])) ||
        !["concrete", "promoted", "autogrow"].includes(String(destination["kind"])) ||
        !validRequest ||
        (destination["kind"] === "promoted" && typeof destination["name"] !== "string")) {
      throw new TypeError(`readLinkState: link ${id} has an unsupported or malformed descriptor`);
    }
  }
  return state;
}
