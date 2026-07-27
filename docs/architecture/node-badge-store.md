# Node Badge Store

Date: 2026-07-05 (updated 2026-07-15)
Status: Superseded on this branch by a derive-on-read prototype — see
[Prototype: derive-on-read](#prototype-derive-on-read-2026-07-15) below.
Slices A and B shipped as described; the prototype then removed the
store. Follow-up to the
[link topology store](link-topology-store.md),
[reroute chain store](reroute-chain-store.md), and the
[node data store draft](node-data-store.md)

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
BadgeData = CoreBadgeData | CreditsBadgeData   // discriminated on `kind`
  // core rows require `part`; credits rows may carry an `iconKey`
  // resolved via a small icon registry ('credits' → SVG)
```

There is no `extension` kind: resolved decision 1 below keeps
`node.badges` as the raw extension surface, so the store holds only
system-computed rows and the system replaces them wholesale per write.

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
convention and icon-identity credits detection are deleted. The system
emits rows in display order (core, then credits) and replaces a node's
array wholesale, so reads are identity-stable between writes.

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

## Implementation notes (slice A)

- Registration is bucket-key presence: the `LGraph.add`/`remove`/`clear`
  chokepoints call the import-light store trio
  (`registerNode`/`unregisterNode`/`clearGraph`), and the system watches
  `registeredNodeIds` to attach/detach per-node effect scopes. Litegraph
  never imports the system, so the pricing/nodeDef dependency graph
  (which runtime-imports the litegraph barrel) stays acyclic. The system
  takes `resolveGraphId`/`resolveNode` seams and is bootstrapped once at
  the app layer by the `Comfy.NodeBadge` extension (`useNodeBadge`).
  The graph id is resolved live on every recompute because
  `LGraph.clear()` and `configure()` reassign the root graph's id; a
  captured id strands the system on a dead bucket. Row writes are
  refused for unregistered nodes so a late effect flush cannot
  resurrect a bucket key the chokepoints deleted. `LGraph.add`
  registers the node only after `onNodeAdded`: the store write wakes
  the system's watcher and queues Vue's flush microtask, which must not
  overtake the paste-scan microtask `useErrorClearingHooks` enqueues
  from `onNodeAdded`.
- One write path: the system replaces a node's rows wholesale via
  `setBadges` on every recompute, so no intermediate per-kind state is
  ever observable.
- The shell still reads `node.constructor.nodeData` and `node.inputs`
  (untracked instance state) to map pricing input names to slot
  indices — parity with the legacy closures. Those reads become store
  lookups when slot data is store-backed (node data store draft).
- Core rows are fine-grained — one row per part, tagged
  `part: 'lifecycle' | 'id' | 'source'` and carrying the raw projected
  text — with one visibility rule (`badgeTextVisible`, the legacy
  semantics: `HideBuiltIn` respected for every part). Each renderer owns
  presentation: the legacy draw cache joins parts in id, lifecycle,
  source order and truncates; the Vue partition trims lifecycle
  brackets, and replaces a built-in node's source row with its
  Comfy-logo chip. Known unification effect: the Vue renderer gains
  `HideBuiltIn` handling for id and lifecycle badges on built-in nodes.
- A credits row is emitted only when the display price label is
  non-empty; async pricing fills it via the per-node revision ref.

## Implementation notes (slice B)

- Wrapper `SubgraphNode` credits rows are aggregated by the system over
  the inner (recursively collected, non-wrapper) api nodes — the same
  count basis as the old unconditional per-api-node badges: several
  collapse to `Partner Nodes x N` (localized), exactly one shows its
  price with the wrapper's promoted widget values overriding the inner
  node's own. The aggregation tracks the inner nodes' pricing
  revisions, the registered-node set, and a structure revision.
  `useNodePricing` caches labels per signature so a leaf's own read and
  its wrapper's override read do not evict each other and re-schedule
  forever.
- Legacy `drawBadges` renders the store rows through a per-node
  memoized `LGraphBadge` cache (decision 5) keyed on the rows array's
  identity — wholesale replacement makes identity the change signal, so
  the per-frame path allocates nothing on cache hits. `iconKey` resolves
  through a generic litegraph `badgeIconRegistry`, with the `credits`
  icon registered when the system starts.
- The Vue renderer samples `node.badges` whenever its partition computed
  re-runs; live array mutation and ticking thunks are visible per frame
  only in the legacy canvas. Array interception was considered and
  rejected: it cannot see thunk output changes (the dominant ecosystem
  pattern), so it buys property patching without covering the real case.
  If a pack demonstrably needs live Vue updates, the escalation is a
  reactive accessor declared on `LGraphNode` itself, not renderer-side
  `defineProperty`.

## Resolved decisions (2026-07-06 interview)

1. **Legacy `node.badges` surface — kept as a raw extension-only push
   surface.** Directive: delete unless actively used. A GitHub-wide scan
   found three custom-node packs actively writing it
   (ComfyUI-Wildcard-Pipeline pushes and splices `LGraphBadge`
   instances; ComfyUI-Enhancement-Utils and ComfyUI-XENodes push
   per-frame getter thunks for ticking execution-time badges), so the
   array stays, is no longer written by core/credits code, and both
   renderers append it after the store rows — thunks still evaluate per
   frame in the legacy canvas. The earlier "zero third-party writers"
   scan was wrong.
2. **`node.badgePosition` — deleted**, along with the `BadgePosition`
   enum. Zero uses outside this repo; the legacy canvas now always
   renders badges top-right (the only surviving behaviour). A no-op
   deprecated accessor remains and warns on access.
3. **Subgraph credits aggregation triggers — event-bumped revision.**
   `litegraph:set-graph`, `subgraph-converted`, and
   `afterConfigureGraph` bump `bumpSubgraphCreditsRevision()`; swap to
   reactive `SubgraphStructure` dependencies when that state is
   store-backed. Aggregation behaviour itself is preserved (explicit
   user requirement).

## Prototype: derive-on-read (2026-07-15)

Badge rows are derived presentation, not authoritative entity state:
every row is a pure projection of settings, node definitions, palette,
pricing, and graph structure. Materializing that projection into a store
made the registration/watcher/scope machinery cache invalidation. The
prototype replaces the store with a memoized derivation:

- `nodeBadges(node)` in `src/systems/badgeSystem.ts` — one lazy
  `computed` per node instance in a `WeakMap`. Entries die with their
  nodes (workflow loads create new instances), so registration,
  unregistration, teardown, and the stale-bucket bug class do not exist.
  `computeBadges` stays pure and data-first; the authoritative sources
  of truth remain the settings/def/palette/pricing stores and the graph.
- `LGraph`'s ref-backed `id` and `_version` (bumped by
  `incrementVersion()` at the `add`/`remove`/`clear` chokepoints and
  read by the `nodes` getter) — the revision signals replacing store
  bucket membership, `subgraphCreditsRevision`, and the live-graph-id
  seams: graph-id-keyed reads and subgraph aggregation re-resolve after
  loads and structural changes. Bumps only invalidate; recomputes happen
  lazily on the next read.
- `registerBadgeRowsProvider` (in `nodeBadgeDraw.ts`) — a one-function seam
  installed by `useNodeBadge`, so litegraph never imports the
  derivation's pricing/nodeDef dependency graph (same acyclicity
  property the store's import-light trio provided). The identity-keyed
  draw cache is unchanged: a computed returns the same array until it
  recomputes.

Trade-offs accepted: badge rows are no longer enumerable per graph
(`PartnerNodesList` traverses the graph via `mapUniqueNodes`
instead of querying a bucket), and the structure revision is coarse —
any structural change invalidates all badge computeds, which is cheap
because invalidation is a flag and recomputation is per-read.

Slices: (A) store + `BadgeData` + system for core and credits +
chokepoint registration; (B) consumer cutover — Vue partition query,
legacy draw cache, trigger/`VueNodeData.badges` deletions, legacy
surface shim; extension-facing deprecation notes. Independent of the
pending `nodeDataStore` extraction and lands before it, shrinking its
Decision 4/6 scope (one less `VueNodeData` field, one less property
handler). `PartnerNodesList`'s `find(isCreditsBadge)` migrates to a
store query by kind.
