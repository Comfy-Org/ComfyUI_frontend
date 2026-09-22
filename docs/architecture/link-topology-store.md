# Link Topology Store

Date: 2026-07-05 (retroactive design record; implemented in PR #13436)
Status: Accepted

Design record for extracting link topology into a dedicated store per
[ADR-ECS-0008](../adr/ECS-0008-entity-component-system.md). Amends the
`LinkEndpoints` component described there. The
[Reroute Chain Store](reroute-chain-store.md) builds directly on this
store; shared vocabulary lives in the
[Domain Glossary](domain-glossary.md).

## Decision 1: One state object, class reads through it

`LLink` no longer owns copies of its topology fields. A single plain
object,

```text
LinkTopology { id, graphId, originNodeId, originSlot, targetNodeId,
               targetSlot, type, parentId? }
```

backs the link: `LLink._state` holds it, and `id`, `type`, `origin_id`,
`origin_slot`, `target_id`, `target_slot`, and `parentId` are accessors
over it. Registration inserts that same object into the store by
reference and re-assigns `_state` to the reactive proxy read back from
the bucket, so subsequent class writes are Vue-tracked (the `BaseWidget`
pattern — see Decision 4 of the reroute chain store record). There is no
store-side copy to drift from the class: the store entry _is_ the
class's state.

The store is runtime state only; `LLink.asSerialisable` reads the same
fields it always did, and serialization goldens (key order plus
byte-identical round-trips) pin the wire format.

## Decision 2: Identity ownership with query-specific indexes

The topology store's root-scoped `byId` map is the sole authority for
`LinkId -> LinkTopology` identity. `LGraph.links` and `LGraph.floatingLinks`
are owner-filtered compatibility views over that map, partitioned by endpoint
state; `LGraph` does not keep separate topology maps. Query indexes are derived
from the authoritative components:

- `targetIndex`, keyed by
  `` `${owningGraphId}:${targetNodeId}:${targetSlot}` ``, answers
  input-connectivity queries in one lookup. It contains only links whose target
  slot is unique.
- `originIndex`, keyed by
  `` `${owningGraphId}:${originNodeId}:${originSlot}` ``, answers
  output-connectivity queries without scanning the graph.

Floating links do not have a unique target key but still belong to `byId`. The
store holds no `LLink` class instances; a weak resolver connects each component
to its compatibility shell.

Link ids are unique across the root graph and all of its subgraph definitions.
Persisted collisions are remapped before registration, including clipboard
imports. `graphId` is association data, not part of entity identity.

## Decision 3: Root-and-owner-scoped bucket lifecycle

Buckets use the shared graph-scoped lifecycle:

```text
RootGraphId -> { byId, idsByOwner, targetIndex, originIndex }
```

The root key groups one loaded workflow. `byId` is flat; `idsByOwner` is a
secondary membership index for owner-local iteration and teardown. Slot keys
include the owner because fixed subgraph boundary node ids are wire sentinels
shared by every definition.

Callers pass both parts as a `GraphScope`: `rootGraphId` selects the workflow
bucket, while `owningGraphId` identifies the graph that directly owns the node
and link endpoints. The two IDs are equal for root-graph nodes. A node inside a
subgraph definition still uses the root workflow's `rootGraphId`, but uses the
definition's ID as `owningGraphId`; querying it with the root graph as owner
would address a different slot. Code with an `LGraph` should derive this pair
with `graphScopeOf(graph)` rather than constructing it manually.

## Decision 4: Registration protocol

- `registerLink` returns the store-held reactive `LinkTopology` when
  registration succeeds or the same topology is already registered. It
  returns `undefined` when another topology owns the root-wide id or target
  slot.
- The `byId` map is the ownership check for deletion, re-registration, and
  endpoint updates. Query indexes never establish ownership.
- `deleteLink` is **identity-checked** (`toRaw` comparison): only the
  registered topology can vacate its slot.
- updateEndpoints validates a complete endpoint batch before mutation.
  Every participant must own its current placement, final target keys must
  be unique, and an occupied destination is valid only when its incumbent
  participates and vacates that key. After validation, the store removes all
  old placements, patches every reactive topology, and inserts all final
  placements. Swaps and rotations therefore commit without transient
  eviction; an invalid move leaves every topology and index unchanged.
  updateEndpoint is the single-item form and rejects occupied targets.
  Graph-owned systems disconnect links before removal because only the graph
  can coordinate callbacks, reroutes, and link-map lifecycle.

## Decision 5: Mutation chokepoints

All `graph.links` mutation funnels through its store-backed `LinkMap` and
`LGraph._addLink` / `_removeLink`, which perform store
registration/unregistration (and link-layout cleanup on removal).
`LinkMap` caches its owner-local regular or floating view so rendering can use
native `Map` reads and snapshot iterators without rebuilding topology on each
access. Store mutations centrally invalidate the reactive view.
`addFloatingLink` / `removeFloatingLink` apply floating-specific lifecycle
policy through the same topology collection. `LLink.disconnect` performs the
equivalent effects inline because it only holds a `LinkNetwork`, and
unregisters before reroute pruning so derived reroute counts exclude the dying
link. `clear()` and subgraph-definition GC unregister whole graphs
(`unregisterAllLinkTopologies` / `clearGraph`).

`addFloatingLink` is the defensive runtime and extension boundary. It mints
an id for a new link, treats re-adding the same registered link as a no-op,
and returns `undefined` after logging an error when a different link already
owns a supplied id. It does not remint an unexpected runtime collision.
Import and deserialization repair persisted id collisions before calling this
runtime API. See
[Link registration migration](../extensions/link-registration-migration.md)
for extension-facing return-value guidance.

## Decision 6: Link membership projected from the semantic document (2026-09-22, partial)

Amends Decision 2. The root bucket's `byId` map is still the identity
authority for live `LinkTopology` objects, but non-floating link
_membership_ (which link ids belong to which owning graph) is no longer
store-owned. Each root graph has one semantic Yjs document in
`semanticDocs` (`src/stores/semanticDoc.ts`); the store projects
`idsByOwner` from it the same way [node-data-store](node-data-store.md)
Decision 8 projects node membership.

```
┌──────────────────────── semantic document (per root graph) ───────────────┐
│ links.<id>                     -> LinkTuple owned by the root graph       │
│ definitions.<owner>.links.<id> -> LinkTuple owned by definition <owner>   │
└─────────────┬─────────────────────────────────────────▲───────────────────┘
              │ projectMembership(root, 'links', sink)  │ links.set/delete
              │ (seed, key add/delete, reseed on        │ inside transact with
              │  definition replacement)                │ LocalUpdateOrigin
              ▼                                         │
┌──────────── linkStore root bucket ────────────────┐   │
│ idsByOwner: Map<OwningGraphId, Set<LinkId>>       │   │ placeValidated
│   (derived from document keys)                    │   │ displace
│ floatingIdsByOwner: Map<OwningGraphId, Set<LinkId>>│   │ (replaceLink,
│   (local: reroute-chain state, never in the doc)  │   │  deleteLink,
│ byId, targetIndex, originIndex                    │───┘  updateEndpoints,
│   (local materialisation and slot indexes)        │      clearOwner,
└───────────────────────────────────────────────────┘      clearGraph)
```

Rules:

- A non-floating topology is written as a `LinkTuple`
  (`[id, originNodeId, originSlot, targetNodeId, targetSlot, type]`) under
  key `String(id)` in its owner's `links` map when the key is absent or
  names different endpoints. Registering a link that a merged remote frame
  already placed is therefore a pure local materialisation with no second
  write.
- Floating topologies (`targetNodeId` or `originNodeId` of `-1`) are
  reroute-chain state, not links. They live only in `floatingIdsByOwner`
  and are never written to the document.
- Every mutation chokepoint (Decision 5) runs inside one document
  transaction carrying a `LocalUpdateOrigin` so observers can separate
  local writes from `applyRemote`. Endpoint rewrites replace the tuple
  under the same key; deletes remove the key.
- `graphTopologies` yields document-projected ids first, then floating
  ids, skipping any id without a registered topology in `byId`. A key
  written to the document before the store has materialised the link (a
  remote frame ahead of the host object) stays invisible until
  registration; a remote key delete drops the id from `idsByOwner`
  immediately.
- `clearGraph` clears the root `links` map and every definition's
  `links` map before dropping the bucket and its observer, so a later
  bucket for the same root does not re-seed stale ids. Observers are also
  released when the store's effect scope disposes.

Known gaps (the projection is partial):

- `byId`, `targetIndex` and `originIndex` remain store-local. A remote key
  delete leaves a stale `byId` entry and slot-index entries until the
  owning graph re-registers or clears; slot connectivity reads may still
  see the dead link.
- A document filled only by local registration carries no host
  `meta.schema_version`, so `semanticDocs.readGraph` fails closed on it;
  tests read `ownerLinksMap(...).size` instead. The follower never stamps
  `meta`.
- `widgetValueStore` is still not a projection; the architecture guard
  keeps it as a `KNOWN GAP` expected failure.

Glossary: _semantic document_ — the per-root-graph Yjs `Y.Doc` holding
graph structure (`nodes`, `links`, `definitions`, `meta`); _owning graph_
— the root graph or subgraph definition a link belongs to; _LinkTuple_ —
the compact array form of a link shared with the multi-player package;
_LocalUpdateOrigin_ — the transaction origin `{ source: 'local', actor?,
opId? }` that marks follower-local writes; _floating topology_ — a
partially connected link used to anchor a reroute chain.

## Scope

This design covers link topology (endpoints, type, chain terminus).
Link visual state (`color`, path caches) and the layout store's link
_geometry_ records are out of scope. The `output.links` and `input.link`
slot mirrors have since been deleted — the store is the single source
for slot connectivity in both directions (see
[output slot connectivity](output-slot-connectivity.md) Decision 6);
the remaining fields are deprecated warning getters kept as extension
migration telemetry.
