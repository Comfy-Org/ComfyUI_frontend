# Link Topology Store

Date: 2026-07-05 (retroactive design record; implemented in PR #13436)
Status: Accepted

Design record for extracting link topology into a dedicated store per
[ADR 0008](../adr/0008-entity-component-system.md). Amends the
`LinkEndpoints` component described there. The
[Reroute Chain Store](reroute-chain-store.md) builds directly on this
store; shared vocabulary lives in the
[Domain Glossary](domain-glossary.md).

## Decision 1: One state object, class reads through it

`LLink` no longer owns copies of its topology fields. A single plain
object,

```
LinkTopology { id, originNodeId, originSlot, targetNodeId, targetSlot,
               type, parentId? }
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

`LGraph._links` remains the runtime authority for `LinkId -> LLink` identity.
The topology store holds an identity-based set of the plain `LinkTopology`
states accepted by that graph and derives query indexes from it:

- `targetIndex`, keyed by `` `${targetNodeId}:${targetSlot}` ``, answers
  input-connectivity queries in one lookup. It contains only links whose
  target slot is unique.
- `originIndex`, keyed by `` `${originNodeId}:${originSlot}` ``, answers
  output-connectivity queries without scanning the graph.

Floating links and links targeting `SUBGRAPH_OUTPUT_ID` do not have a unique
target key but still belong to the topology set. The store does not duplicate
the graph's link-id registry or hold `LLink` class instances.

Link ids are unique per owning graph, not per root graph. Owner partitioning
therefore isolates sibling subgraph definitions without rewriting otherwise
valid ids.

## Decision 3: Root-and-owner-scoped bucket lifecycle

Buckets use the shared graph-scoped lifecycle:

```
RootGraphId -> OwningGraphId -> GraphTopologyBucket
```

The root key groups one loaded workflow. The owner key isolates the root graph
and each subgraph definition within it. Link, reroute, and node-data stores
share the same lookup, creation, pruning, owner-clear, and root-clear
lifecycle so their graph ownership cannot drift independently.

## Decision 4: Registration protocol

- `registerLink` returns the store-held reactive `LinkTopology` when
  registration succeeds or the same topology is already registered. It
  returns `undefined` when another topology owns the target slot. Link-id
  collisions are rejected by the graph's runtime registry before registration.
- The topology set is the ownership check for deletion, re-registration, and
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

All `graph._links` map mutation funnels through `LGraph._addLink` /
`_removeLink`, which pair the map write with store
registration/unregistration (and link-layout cleanup on removal).
`addFloatingLink` / `removeFloatingLink` do the same for the floating
map. `LLink.disconnect` performs the equivalent effects inline because
it only holds a `LinkNetwork`, and unregisters before reroute pruning so
derived reroute counts exclude the dying link. `clear()` and
subgraph-definition GC unregister whole graphs
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
