# Link Topology Store

Date: 2026-07-05 (retroactive design record; implemented in PR #13436)
Status: Accepted

Design record for extracting link topology into a dedicated store per
[ADR-ECS](../adr/ECS-entity-component-system.md). Amends the
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

## Scope

This design covers link topology (endpoints, type, chain terminus).
Link visual state (`color`, path caches) and the layout store's link
_geometry_ records are out of scope. The `output.links` and `input.link`
slot mirrors have since been deleted — the store is the single source
for slot connectivity in both directions (see
[output slot connectivity](output-slot-connectivity.md) Decision 6);
the remaining fields are deprecated warning getters kept as extension
migration telemetry.
