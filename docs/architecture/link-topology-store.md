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

## Decision 2: Keyed by target input slot, not link id

The primary index is keyed by `` `${targetNodeId}:${targetSlot}` ``.
Two facts make this the right key:

- **The domain invariant**: at most one live link targets a given input
  slot. The key is unique by construction for live links.
- **The dominant query**: consumers ask "is this input slot connected,
  and by what?" (`isInputSlotConnected`, `getInputSlotLink`). The key
  answers it in one lookup with no scan.

Link _ids_ are only unique per owning graph, not per root graph, so an
id-keyed root bucket needed a load-time link-id dedup pass and a
first-wins registration protocol to survive collisions across sibling
subgraph definitions. Re-keying by target slot deleted both: colliding
link ids never touch the index, so workflows load without link-id
rewrites.

Rejected: keeping the id key plus dedup/first-wins. That machinery
existed only to compensate for a key the queries never used.

## Decision 3: Root-graph-scoped buckets, unkeyed side set

Buckets are scoped by `rootGraph.id` — subgraphs share their root's
bucket — matching `widgetValueStore` and the later `rerouteStore`.
Re-keying entries to their owning graph was evaluated and rejected: it
reintroduces per-graph lifecycle bookkeeping the root scope avoids, and
no query wants owning-graph granularity that `graphTopologies` filtering
doesn't already provide.

Links without a unique live target go in a per-graph side `Set` instead
of the primary index:

- **Floating links** — exactly one assigned endpoint; the other is
  `UNASSIGNED_NODE_ID`. A floating link attached to an input slot does
  not answer `isInputSlotConnected`, preserving `input.link` semantics.
- **Links targeting `SUBGRAPH_OUTPUT_ID`** — the id is a shared
  constant, so `targetNodeId:targetSlot` is not unique across the
  subgraphs sharing a root bucket.

## Decision 4: Registration protocol

- `registerLink` is **first-wins**: if a different topology already
  holds the target key, the call returns `undefined` and the loser
  stays detached. `link._graphId` records a won registration; it is the
  ownership marker that lets `unregisterLink` and re-registration no-op
  safely for losers.
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

## Scope

This design covers link topology (endpoints, type, chain terminus).
Link visual state (`color`, path caches) and the layout store's link
_geometry_ records are out of scope. The `output.links` and `input.link`
slot mirrors have since been deleted — the store is the single source
for slot connectivity in both directions (see
[output slot connectivity](output-slot-connectivity.md) Decision 6);
the remaining fields are deprecated warning getters kept as extension
migration telemetry.
