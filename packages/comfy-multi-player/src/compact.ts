/**
 * Fresh-checkpoint compaction (schema §4 rule 2; ADR 029 §4, risk 3).
 *
 * A Y.Doc never forgets: every `set_widget` leaves a Yjs tombstone behind the
 * value it replaced, and every applied op leaves an `__applied` row that is
 * never deleted (schema §4 rule 1's per-actor watermark is not implemented).
 * Encoded state therefore grows without bound under churn even when the live
 * projection is constant — the growth matrix (`test/growth-matrix.test.ts`)
 * pins that shape. The schema's conforming answer is a HOST-owned
 * "fresh-checkpoint re-mint": project the document, mint a new one from the
 * projection, and carry forward the bookkeeping that keeps convergence
 * semantics intact across the epoch boundary.
 *
 * `compact` is that primitive. It is pure with respect to the input: the
 * source document is only read; the result is a NEW `Y.Doc` with a new Yjs
 * lineage (its own client ids and clocks), so updates from the old lineage
 * cannot be applied to it. Cutting over replicas to the compacted snapshot is
 * the host's job (schema §9: every replica forks from ONE snapshot) and is
 * deliberately outside this function.
 *
 * What a naive `mint(project(doc))` loses, and how `compact` carries it:
 *
 *   ┌────────────────────────────┬───────────────────────────────────────────┐
 *   │ state                      │ carry-forward rule                        │
 *   ├────────────────────────────┼───────────────────────────────────────────┤
 *   │ node `__incarnation`       │ copied for every top-level and definition │
 *   │                            │ interior node still present (mint resets  │
 *   │                            │ every node to the legacy life "0", which  │
 *   │                            │ would turn a live agent's incarnation-    │
 *   │                            │ stamped `set_widget` into a silent no-op) │
 *   │ meta `__*` internals       │ copied except `__definitions_extra`,      │
 *   │ (`__definition_digests`)   │ which mint re-derives from the projection │
 *   │ `__link_state`             │ replaced whole by the source's map,       │
 *   │                            │ stranded descriptors included (§4 rule 2) │
 *   │ `__clock_reservations`     │ copied whole (Lamport max must not regress│
 *   │                            │ — `observedDocCounter` reads it)          │
 *   │ `__stamps`                 │ copied through the liveness filter below  │
 *   │ `__applied`                │ left EMPTY: a new lineage starts a new    │
 *   │                            │ idempotency ledger; LWW stamps, not the   │
 *   │                            │ ledger, reject a replayed older write     │
 *   │ `catalog_version`          │ re-pinned from the source (`docCatalogPin`)│
 *   │ `last_node_id`/`last_link` │ meta passthrough via the projection       │
 *   └────────────────────────────┴───────────────────────────────────────────┘
 *
 * Stamp liveness. Schema §4 rule 2 says "`__stamps` entries for still-live
 * targets". This implementation drops ONLY rows the applier itself already
 * treats as dead: `["widget", <top-level nodeKey>, incarnation, name]` whose
 * node is absent or whose incarnation no longer matches. Those rows are
 * exactly the set `clearObsoleteWidgetStamps` deletes on the next re-add, and
 * a `set_widget` against a mismatched incarnation no-ops before it ever
 * consults them. Every other row is kept — including `["node", id]` rows for
 * nodes that are no longer present. Dropping those would let a stale
 * concurrent `add_node` (older stamp than the delete that won) succeed on the
 * compacted replica while it loses on an uncompacted one, i.e. the outcome
 * would depend on whether compaction ran first (an arrival-order dependence,
 * FC-8). The retained rows are O(distinct targets ever written), which is the
 * bound the schema accepts; the unbounded terms (`__applied`, tombstones) are
 * what this function removes.
 */
import * as Y from "yjs";
import {
  ROOT_CLOCK_RESERVATIONS,
  definitionsMap,
  linkStateMap,
  metaMap,
  nodeIncarnation,
  nodesMap,
  stampsMap,
} from "./doc.js";
import { mint } from "./mint.js";
import { project } from "./project.js";
import { docCatalogPin } from "./read.js";
import { assertReadableSchema } from "./schema-version.js";
import { LEGACY_NODE_INCARNATION, NODE_INCARNATION_KEY, type WidgetCatalog } from "./types.js";

/** Meta internals that mint re-derives from the projection; copying them would shadow the fresh value. */
const REDERIVED_META_INTERNALS: readonly string[] = ["__definitions_extra"];

/**
 * Produce a fresh-lineage checkpoint of `doc` with identical projection and
 * carried-forward convergence bookkeeping. Refuses (KA-11) a document whose
 * schema this package cannot read; `catalog` must be the pinned catalog the
 * document was minted against (the compacted doc re-pins the same version).
 */
export function compact(doc: Y.Doc, catalog: WidgetCatalog): Y.Doc {
  assertReadableSchema(doc, "compact");
  const fresh = mint(project(doc, catalog), catalog, docCatalogPin(doc));
  fresh.transact(() => {
    carryNodeIncarnations(nodesMap(doc), nodesMap(fresh));
    carryDefinitionInternals(definitionsMap(doc), definitionsMap(fresh));
    carryMetaInternals(doc, fresh);
    replaceMap(linkStateMap(doc), linkStateMap(fresh));
    carryClockReservations(doc, fresh);
    carryLiveStamps(doc, fresh);
  });
  return fresh;
}

function carryNodeIncarnations(from: Y.Map<Y.Map<unknown>>, to: Y.Map<Y.Map<unknown>>): void {
  from.forEach((node, key) => {
    const target = to.get(key);
    if (!(node instanceof Y.Map) || !(target instanceof Y.Map)) return;
    const life = nodeIncarnation(node);
    if (life !== LEGACY_NODE_INCARNATION) target.set(NODE_INCARNATION_KEY, life);
  });
}

/**
 * Definitions are re-minted from their projection, which scrubs `__`-prefixed
 * keys and resets interior node incarnations. Walk source and fresh
 * definition maps in parallel (by id, recursively through nested
 * `definitions.subgraphs`) and restore both.
 */
function carryDefinitionInternals(from: Y.Map<Y.Map<unknown>>, to: Y.Map<Y.Map<unknown>>): void {
  from.forEach((definition, id) => {
    const target = to.get(id);
    if (!(definition instanceof Y.Map) || !(target instanceof Y.Map)) return;
    definition.forEach((value, key) => {
      if (key.startsWith("__") && !(value instanceof Y.AbstractType)) {
        target.set(key, structuredClone(value));
      }
    });
    const nodes = definition.get("nodes");
    const targetNodes = target.get("nodes");
    if (nodes instanceof Y.Map && targetNodes instanceof Y.Map) {
      carryNodeIncarnations(nodes as Y.Map<Y.Map<unknown>>, targetNodes as Y.Map<Y.Map<unknown>>);
    }
    const nested = nestedSubgraphs(definition);
    const targetNested = nestedSubgraphs(target);
    if (nested !== null && targetNested !== null) carryDefinitionInternals(nested, targetNested);
  });
}

function nestedSubgraphs(definition: Y.Map<unknown>): Y.Map<Y.Map<unknown>> | null {
  const container = definition.get("definitions");
  const subgraphs = container instanceof Y.Map ? container.get("subgraphs") : undefined;
  return subgraphs instanceof Y.Map ? (subgraphs as Y.Map<Y.Map<unknown>>) : null;
}

function carryMetaInternals(doc: Y.Doc, fresh: Y.Doc): void {
  const target = metaMap(fresh);
  metaMap(doc).forEach((value, key) => {
    if (!key.startsWith("__") || REDERIVED_META_INTERNALS.includes(key)) return;
    if (value instanceof Y.AbstractType) return; // meta holds plain values only (schema §6)
    target.set(key, structuredClone(value));
  });
}

/** Replace `to`'s contents with a plain-value copy of `from` (mint's reconstruction is discarded). */
function replaceMap(from: Y.Map<unknown>, to: Y.Map<unknown>): void {
  for (const key of [...to.keys()]) to.delete(key);
  from.forEach((value, key) => {
    if (value instanceof Y.AbstractType) return;
    to.set(key, structuredClone(value));
  });
}

/** The reservation root is lazy: create it on the fresh doc only when the source has one. */
function carryClockReservations(doc: Y.Doc, fresh: Y.Doc): void {
  if (doc.share.get(ROOT_CLOCK_RESERVATIONS) === undefined) return;
  const from = doc.getMap<unknown>(ROOT_CLOCK_RESERVATIONS);
  if (from.size === 0) return;
  replaceMap(from, fresh.getMap<unknown>(ROOT_CLOCK_RESERVATIONS));
}

function carryLiveStamps(doc: Y.Doc, fresh: Y.Doc): void {
  const nodes = nodesMap(fresh);
  const target = stampsMap(fresh);
  stampsMap(doc).forEach((stamp, targetKey) => {
    if (stamp instanceof Y.AbstractType) return;
    if (isDeadTopLevelWidgetStamp(targetKey, nodes)) return;
    target.set(targetKey, structuredClone(stamp));
  });
}

/**
 * `["widget", nodeKey, incarnation, name]` with a STRING nodeKey addresses a
 * top-level node; a path array addresses a definition interior and is always
 * kept (interior resolution is instance-relative and not worth re-deriving
 * here). Dead when the node is gone or lives a different life now.
 */
function isDeadTopLevelWidgetStamp(targetKey: string, nodes: Y.Map<Y.Map<unknown>>): boolean {
  let target: unknown;
  try {
    target = JSON.parse(targetKey);
  } catch {
    return false;
  }
  if (!Array.isArray(target) || target[0] !== "widget" || typeof target[1] !== "string") return false;
  const node = nodes.get(target[1]);
  if (!(node instanceof Y.Map)) return true;
  return nodeIncarnation(node) !== target[2];
}
