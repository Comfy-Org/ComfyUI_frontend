# Node Badge Store

Date: 2026-07-05
Status: Draft (design interview in progress; follow-up to the
[link topology store](link-topology-store.md),
[reroute chain store](reroute-chain-store.md), and the
[node data store draft](node-data-store.md))

Design record for extracting node badges off `LGraphNode` instances into
a dedicated store per [ADR 0008](../adr/0008-entity-component-system.md),
going straight to plain-data components — no interim closure storage.
Vocabulary: [domain glossary § Badges](domain-glossary.md#badges).

## Current state (what this replaces)

`LGraphNode.badges: (LGraphBadge | (() => LGraphBadge))[]` mixes three
things: a **core badge closure** (id / lifecycle / source, re-derived
independently by the Vue renderer, which skips it positionally via
`slice(1)`), **credits badge closures** (`creditsBadgeGetter`,
`buildWrapperAwarePriceBadge` — hand-rolled reactive computeds the
legacy canvas polls per frame), and a public push surface for
extensions. Badge changes are announced by a single manual
`node:property:changed` trigger in `usePriceBadge`; plain pushes are
invisible. Credits badges are classified by icon identity
(`icon.image === componentIconSvg`). Badges never serialize (verified:
no `badges` key in `serialize()`/`configure`).

Every closure is a reactive computed feeding an unreactive array, and
the Vue renderer has already re-implemented all of their reactivity as
store-tracked dependencies. The design deletes the closures and makes
the store rows the single truth both renderers read.

## Decision 1: Plain `BadgeData` rows, no interim shape

The store holds only plain data (ADR 0008 component rule):

```
BadgeData {
  kind: 'core' | 'credits' | 'extension'
  text: string
  fgColor?: string
  bgColor?: string
  iconKey?: string     // resolved via a small icon registry ('credits' → SVG)
}
```

No `onClick` (no producer exists; `LGraphButton`/`title_buttons` are a
separate surface and out of scope). No `Image` objects — icons are
referenced by key. A `commandId` field can be added if a clickable badge
requirement ever materialises.

Rejected: an interim `BadgeEntry { kind, source: LGraphBadge | thunk }`
phase. The public element type of `node.badges` breaks either way; one
break that lands on the end-state shape beats two.

## Decision 2: Store shape and keying

`nodeBadgeStore`: root-graph-scoped buckets (`rootGraph.id`) keyed by
`NodeId`, each holding an ordered reactive `BadgeData[]`. Register /
unregister / unregister-all trio at the `LGraph.add` / `LGraph.remove` /
`clear()` chokepoints, identity-checked deletes — the shipped store
conventions.

Rows are partitioned by `kind` at read time; the positional `slice(1)`
convention and icon-identity credits detection are deleted. Display
order is kind order (core, credits, extension), not insertion order.

## Decision 3: A reactive BadgeSystem writes the rows

One system module owns the recomputation: per registered node, an
`effectScope` runs a pure `computeBadges(sources) → BadgeData[]`
function inside a thin watch shell and writes the node's rows. Sources
are the existing stores: `nodeDefStore`, `settingStore`,
`colorPaletteStore`, `useNodePricing` revision refs, `widgetValueStore`,
`linkStore` input connectivity. The pure function is the future
command-pipeline phase body (ADR 0003 systems ADR); only the scheduler
shell changes when that lands.

`useNodeBadge` / `usePriceBadge` stop pushing closures; their derivation
logic moves into `computeBadges`. The manual `'badges'`
`node:property:changed` trigger, the `badges` case in
`useGraphNodeManager`, and `VueNodeData.badges` are deleted.
`usePartitionedBadges` collapses to a store query partitioned by kind;
its manual dependency-touching (`trackNodePrice`,
`trackSubgraphInnerNodePrices`) moves inside the system.

## Decision 4: Core badges are system-written rows too

Core (#id / lifecycle / source) badges are materialized by the system
like every other kind, so both renderers consume one uniform row set.
This kills the current dual derivation (legacy closure + Vue-side
re-derivation). Materialized-by-system is the ECS write path, not a
mirror: no other component stores this projection.

## Decision 5: Legacy canvas consumes rows via a draw cache

`drawBadges` renders from `BadgeData`, constructing and caching
`LGraphBadge` draw objects keyed by row content (the `Reroute` id-badge
pattern, memoized). `_boundingRect` hit-test state stays renderer-side.
Frame-budget parity per ADR 0008's render mitigations applies.

## Open decisions (interview pending)

1. **Legacy `node.badges` surface** — recommended: a converting
   accessor exposing the node's `BadgeData[]` proxy; bare
   `LGraphBadge`/thunk pushes auto-convert (thunk evaluated once,
   `Image` icons dropped) with a one-time deprecation warning pointing
   at the store API. Alternatives: delete the property outright, or a
   read-only view. Ecosystem scan found zero genuine third-party
   writers; ADR 0008 extension-impact guidance applies regardless.
2. **`node.badgePosition`** — recommended: delete (single writer sets a
   constant `TopRight` on every node; single reader; renderer policy,
   not badge data). Deprecated accessor warns on write.
3. **Subgraph credits aggregation triggers** — recommended: the three
   existing events (`litegraph:set-graph`, `subgraph-converted`,
   `afterConfigureGraph`) bump a revision the system watches; swap to
   reactive `SubgraphStructure` dependencies when that state is
   store-backed.

## Scope and sequencing

Slices: (A) store + `BadgeData` + system for core and credits +
chokepoint registration; (B) consumer cutover — Vue partition query,
legacy draw cache, trigger/`VueNodeData.badges` deletions, legacy
surface shim; extension-facing deprecation notes. Independent of the
pending `nodeDataStore` extraction and lands before it, shrinking its
Decision 4/6 scope (one less `VueNodeData` field, one less property
handler). `PartnerNodesList`'s `find(isCreditsBadge)` migrates to a
store query by kind.
