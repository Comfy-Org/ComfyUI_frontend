# Reroute Chain Store

Date: 2026-07-04
Status: Accepted (design review; follow-up to the
[link topology store](link-topology-store.md), PR #13436)

Design record for extracting reroute connectivity state into a dedicated
store per [ADR-ECS](../adr/ECS-entity-component-system.md). Amends the
`RerouteLinks` component described there.

## Decision 1: The chain is the single source of truth for membership

"Which links pass through reroute R" is encoded twice today: each link's
`parentId` chain (`link.parentId` names the terminal reroute;
`reroute.parentId` walks upstream), and per-reroute `linkIds` /
`floatingLinkIds` Sets maintained by hand at roughly ten write sites
(`LGraphNode.connect`, `LLink.disconnect`, `LGraph.addFloatingLink` /
`removeFloatingLink` / `createReroute`, subgraph unpack,
`SubgraphInput/Output.connect`, `LinkConnector`), with
`Reroute.validateLinks` repairing drift at configure time.

The chain is primary. Membership becomes a derived reverse index:

```text
linksThrough(R) = { L : R ∈ chain(L.parentId) }
```

computed over the link store's topologies plus the reroute chain states,
cached, and invalidated on chain mutation. The `Reroute` class exposes
`linkIds` / `floatingLinkIds` as derived accessors. The membership write
sites and `validateLinks` are deleted.

Rejected: storing membership Sets in the store (the `LLink._state`
pattern applied to whole membership). It keeps one _stored_ copy but
preserves the domain-level redundancy — chain and membership can still
disagree, and every dual write site survives.

## Decision 2: Store shape and keying

`rerouteStore` holds per-reroute chain state objects, registered by
reference (the class reads through them, mirroring `LLink._state`):

```text
RerouteChain { id, graphId, parentId?, floating? }
```

Buckets use the shared graph-scoped lifecycle:

```text
RootGraphId -> { chains, idsByOwner, membershipByOwner }
```

The root key groups one loaded workflow. `chains` is a flat root-wide identity
map; `idsByOwner` is a secondary index for owner-local lookup and teardown.
`graphId` associates a chain with its owning graph without namespacing its
identity.

`RerouteId` is the domain key because runtime allocation is already
per-root-unique: `Subgraph.state` delegates to the root graph's state, so
all graphs increment one shared `lastRerouteId` counter.

## Decision 3: Load-time reroute-id dedup

Serialized workflows from older frontends or external tools can carry
colliding reroute ids anywhere in one root graph. Registration does not
overwrite the incumbent, so import repairs those collisions before
registration.

On configure, colliding subgraph reroute ids are rewritten to fresh ids
from the shared counter, patching that subgraph's `link.parentId` and
`reroute.parentId` references — the same repair the node-id and link-id
dedup passes already perform. Rewritten ids serialize back changed.

Rejected: a first-wins registration protocol (losers detached via an
ownership flag). That is the apparatus the target-keyed link store
redesign existed to delete.

## Decision 4: Registration returns the reactive proxy

The derived membership index requires observable chain mutation.
`BaseWidget` already establishes the pattern: the store bucket is a
`reactive(Map)`, registration inserts the raw state and returns the
value read back from the map — the reactive proxy — and the class holds
that proxy as `_state` (`BaseWidget.setNodeId`,
`widgetValueStore.registerWidget`). Every subsequent class write goes
through the proxy and is tracked.

`rerouteStore.registerReroute` follows this: it returns the proxy when
registration succeeds or the same chain is already registered, and returns
`undefined` when another chain owns the id. This matches `registerLink`; both
APIs leave a colliding state detached instead of returning the incumbent.
The `Reroute` class reads and writes chain state through a successful proxy,
so `reroute.parentId` mutations are tracked with no action chokepoint.

Each root bucket keeps one derived membership `ComputedRef` per owner. The
chain map and owner indexes are reactive, so chain, link, and lifecycle changes
invalidate the relevant membership view.

`LLink` previously deviated — `registerLinkTopology` left `link._state`
raw, which is why `linkStore.updateEndpoint` must re-wrap with
`reactive()` before patching, and why bare `link.parentId` writes were
invisible to effects. This migration aligns it with the `BaseWidget`
pattern: link registration re-assigns `_state` to the store proxy,
making `link.parentId` writes tracked. `updateEndpoint` keeps its
`reactive()` wrap as a guard — the store is public API and may be
handed a raw topology object.

## Decision 5: Serialization

`SerialisableReroute.linkIds` remains in the wire format, emitted from
the derived membership in ascending link-id order. All runtime producers
append links in ascending id order and the serialization goldens hold
ascending arrays, so chain-consistent workflows round-trip byte-identical.

Workflows whose stored `linkIds` contradict their chains are repaired on
the next save (membership re-derived, stale ids dropped, order
normalized). A reroute that no chain reaches at all is dropped at load —
where `validateLinks` used to preserve it if its stored ids named live
links — because the chain is primary. No compatibility shim for such
files. `floatingLinkIds` stays unserialized, rebuilt at runtime as
before.

## Scope

This design covers chain state, derived membership, and the `LLink`
proxy retrofit from Decision 4 (a small self-contained change, done
first). Reroute visual state (`_colour`, badge) is out of scope.
`Reroute.pos` is a stable compatibility view over LayoutStore geometry rather
than a second stored position. Position remains outside this chain-state
record.
