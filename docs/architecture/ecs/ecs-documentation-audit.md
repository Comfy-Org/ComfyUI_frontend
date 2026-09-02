# ECS migration documentation audit (PR 14246)

Status: Current implementation audit
Verified: 2026-08-20 against `13a302eadda871b939b148ecb87e3d845ceefff2`
Scope: ADR-LAYOUT, ADR-ECS, and architecture documents changed by PR 14246

The audit uses four document states:

- `Current`: describes behavior shipped on this branch.
- `Partial`: a shipped bridge or subset, with remaining migration work.
- `Target`: desired architecture not yet implemented.
- `Historical`: superseded design retained to explain decisions.

Verification confidence and missing behavioral scenarios are tracked in
[ecs-verification-audit.md](ecs-verification-audit.md).

The contradictions found during this audit were corrected in the same PR. The
sections below preserve the findings and the wording used to resolve them.

## ADR roles and current accuracy

### ADR-LAYOUT: centralized CRDT layout

The ADR is the decision authority for canonical geometry in `layoutStore`, Yjs
storage, mutation operations, and renderer-independent layout state.

Implementation status: `Partial`; the ADR decision status remains `Proposed`.
Canonical
node/group/reroute geometry and scoped teardown are current. Collaboration,
multi-renderer inversion, and universal command-only mutation remain target.
The 2026-07-30 amendment accurately removes the unused operation log, but its
last sentence overstates command coverage.

### ADR-ECS: entity/component direction

The ADR defines the architectural constraints and taxonomy: dedicated stores,
plain-data state, behavior outside components, graph ownership, and no
god-object growth.

Implementation status: `Partial`; the ADR decision status remains `Proposed`.
The original World, numeric
entity brands, slot entities, and generalized systems are target or historical.
Dedicated stores for widgets, topology, reroute chains, node shell state, and
layout are current. Legacy classes remain compatibility shells and still host
substantial behavior.

## Architecture-document inventory

| Document                         | Role                                      | Status and accuracy on this branch                                                                                                                                    |
| -------------------------------- | ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `appendix-ecs-pattern-survey.md` | External ECS pattern comparison           | **Historical survey with current conclusions.** Deleted World details were removed; retained conclusions match dedicated stores and partial command coverage.         |
| `domain-glossary.md`             | Canonical topology vocabulary             | **Current.** The best terminology source for link, reroute, floating link, owner, and membership. It should be cited by topology records instead of redefining terms. |
| `ecs-lifecycle-scenarios.md`     | Current lifecycle and target requirements | **Partial.** Current ownership and failure boundaries are separated from target requirements; no hypothetical API is presented as shipped.                            |
| `ecs-migration-plan.md`          | Concise completed/remaining roadmap       | **Current + target.** Links its detailed claims to focused audits.                                                                                                    |
| `ecs-target-architecture.md`     | End-state model and transition diagrams   | **Target with current inserts.** Shipped topology, slot-accessor, and layout-keying inserts are labeled as current.                                                   |
| `entity-interactions.md`         | Baseline relationship map                 | **Current/partial.** Updated for stores, but the title correctly warns this remains the current legacy/store hybrid rather than the target ECS.                       |
| `entity-problems.md`             | Motivation and structural debt            | **Historical/current.** Some cited problems were reduced by this branch; retain them as historical motivation but mark resolved items.                                |
| `link-topology-store.md`         | LinkStore decision record                 | **Historical + current amendments.** Initial target-slot identity design is superseded by link-ID primary authority and owner-qualified secondary indexes.            |
| `node-badge-store.md`            | Reversed badge-store decision             | **Historical.** Title and status identify the reversal; current state is derived `nodeBadges()` in `src/systems/badgeSystem.ts`.                                      |
| `node-data-store.md`             | Node shell extraction record              | **Current/partial.** Accurate for `NodeState`, proxy adoption, renderer consumption, and teardown. Slot identity and broad command mutation remain deferred.          |
| `output-slot-connectivity.md`    | Removal of slot connectivity mirrors      | **Current with labeled history.** Decision 6 records the shipped result; superseded computed-index and mirror stages are historical.                                  |
| `proto-ecs-stores.md`            | Cross-store inventory                     | **Current/partial.** Key formats and extraction gaps match the branch.                                                                                                |
| `reroute-chain-store.md`         | Reroute chain decision record             | **Current.** Derived membership and the store-backed `Reroute.pos` compatibility view are explicit.                                                                   |

## Corrections applied

### 1. Slot mirrors were described as still present

The audit found ADR-ECS, `ecs-target-architecture.md`,
`ecs-lifecycle-scenarios.md`, and `proto-ecs-stores.md` describing mutable class
mirrors as current. On this branch, concrete slot accessors
are deprecated, non-enumerable, store-derived compatibility views; writes warn
and are ignored. There is no mutable connectivity mirror.

Applied wording:

> Runtime slot connectivity is owned by `useLinkStore`. `NodeInputSlot.link`
> and `NodeOutputSlot.links` are deprecated, read-only compatibility accessors
> derived from the store; they are not authoritative fields. Slot identity and
> visual state remain class-side.

### 2. LinkStore primary authority was misstated as target-slot keying

The audit found target-slot primary-key claims in ADR-ECS,
`ecs-lifecycle-scenarios.md`, and historical parts of
`link-topology-store.md`. Current
`useLinkStore` maintains root-wide `RootTopologyBucket.byId` authority;
`targetIndex` and `originIndex` are owner-qualified secondary indexes.
Duplicate link IDs are rejected/reminted across sibling definitions.

Applied wording:

> `LinkId` is the root-workflow-wide primary identity. `targetIndex` enforces
> one fully assigned link per owner-qualified target slot; `originIndex`
> supports fan-out queries. Floating links share the ID namespace but are
> absent from endpoint indexes until fully assigned.

The ADR-ECS Link amendment, lifecycle load note, and key tables were updated.

### 3. Output `originIndex` was documented as derived computed state

The original `output-slot-connectivity.md` Decision 2 showed a cached
`ComputedRef<OriginIndex>` rebuilt from `graphTopologies`. The implementation
stores `originIndex` in each `RootTopologyBucket` and maintains it atomically
with `byId` and `targetIndex` during registration, endpoint updates, and
deletion.

Applied current wording:

> `originIndex` is a reactive secondary index maintained in the same LinkStore
> mutation as primary topology and target occupancy. `getOutputSlotLinks`
> returns the indexed set; floating links are not indexed.

The old computed design is marked **Historical**.

### 4. Command scope was generalized beyond implementation

The audit found ADR and lifecycle wording that attributed serializable commands,
free undo/redo, and atomic command batches to all entity operations. Current command
records are layout-specific (`LayoutOperation`/`useLayoutMutations`), while
link, node, reroute, and widget stores expose imperative actions and classes
still coordinate callbacks. Undo/redo remains snapshot-based in
`ChangeTracker`.

Applied wording:

> Command-shaped operations are current for layout mutations. A cross-store
> command executor, transactional rollback, and command-based undo/replay are
> targets. Other stores currently expose validated imperative actions; graph
> lifecycle methods remain orchestration boundaries. Undo/redo is snapshot
> based through `ChangeTracker`.

`ConnectivitySystem`, `SerializationSystem`, and cross-store command batches
are labeled **Target** wherever diagrammed.

### 5. Layout keying tables described raw node/link IDs

The audit found variants of "raw node/link IDs; scoped group/reroute IDs" in
inventory tables. ADR-LAYOUT's amendment and the
implementation scope nodes, groups, and reroutes with
`makeScopedLayoutKey(rootGraphId, id)`. Link segment geometry uses its separate
segment cache key and is not CRDT link topology.

Applied wording:

> Persistent node, group, and reroute layout entries are keyed by
> `ScopedLayoutKey = makeScopedLayoutKey(rootGraphId, localId)`. Link topology
> does not live in LayoutStore. Transient link-segment geometry uses the
> segment-layout cache key and must not be listed as entity identity.

### 6. Reroute position was called a remaining mirror

The audit found `Reroute.pos` described as a class field mirroring layout
position. On this branch it is a compatibility geometry
view backed by the canonical layout entry; indexed and method mutations write
through.

Applied wording:

> `Reroute.pos` is a stable compatibility view over LayoutStore geometry, not
> a second stored position. `RerouteChain` owns parent/floating topology;
> LayoutStore owns position.

### 7. Dedicated-store lifecycle was over-uniform

The audit found a universal graph-key and `clearGraph(graphId)` rule in ADR-ECS. Actual stores differ by concern:
LinkStore and RerouteStore use root buckets plus owner indexes; NodeDataStore
partitions by owning graph; LayoutStore uses root-scoped layout keys; global or
locator stores have different lifecycle contracts.

Applied replacement:

> Every authoritative store defines an explicit workflow/owner lifecycle, but
> key shape and cleanup API are concern-specific. Inventory the primary
> identity, workflow bucket, owner association, and teardown operation
> separately.

### 8. NodeDataStore scope tables omitted owner partitioning

The audit found NodeDataStore described only as root-scoped and keyed by
`NodeId`, implying one flat query namespace. The root bucket
owns ID uniqueness, while `NodeState.graphId` and owner indexes partition graph
membership and teardown.

Applied identity/lifecycle wording:

> Root workflow bucket + globally unique `NodeId`; owning `graphId` is an
> association/index used for graph-local queries and teardown, not an identity
> namespace.

### 9. Badge record status was easy to misread

The audit found the removed badge store presented with an accepted-looking
title/status and a drift-prone aggregate store count.

The record now says `Historical: reversed` and gives the current result below
the title:

> Current result: no badge store; `nodeBadges()` derives `BadgeData` on read.

The aggregate store count was removed.

### 10. Lifecycle scenarios blurred observation and destination

The audit found future `ConnectivitySystem`, `SerializationSystem`, scope
retagging, command rollback, and free undo mixed with current behavior. Some
current rows also retained deleted slot writes and old LinkStore keying.

Diagrams are now prefixed with `Current bridge` or `Target`. Current flows are
tied to stable symbols such as
`LGraph._addLink`, `useLinkStore.registerLink`, `detachGraphLayouts`, and
`ChangeTracker`; hypothetical systems are target-only.

## Second-pass corrections

A second independent pass found and corrected additional drift:

- `node-data-store.md` no longer describes the deleted
  `LGraphNodeProperties` instrumentation or `type` as read-only.
- The ADR supporting table, output-index record, proto-store inventory, slot
  extraction status, and target key-type description now match current code.
- The migration traceability table explicitly covers extension-facing shell and
  badge behavior, direct workflow insertion, unknown-node fallback records, and
  execution order.
- State, lifecycle, and mutation audits now identify `last_serialization` as a
  full class-owned persistence shadow and execution order as a derived value
  with an ambiguous persisted compatibility path.
- A third pass added removed graph-trigger migration, serialized allocation
  counters, delayed widget-value shadows, and historical labels for the deleted
  World prototype survey.
- A fourth pass replaced stale lifecycle and deleted-World narratives with
  concise current/target records and added promoted-panel behavior, tour role
  inference, `boxcolor`, graph metadata, and `_version` invalidation gaps.

## Recommended document status convention

Use a small front matter block on every architecture record:

```text
Status: Current | Partial | Target | Historical
Verified: YYYY-MM-DD against <PR or commit>
Supersedes: <optional document/decision>
Superseded by: <optional document/decision>
```

For mixed documents, status each section with one of the same four labels.
Dated amendments should say what they supersede and should replace, not merely
append to, false summaries and key tables. Label pseudocode `Illustrative
target` unless it matches a named current symbol. Historical
records should remain available, but their title/status must prevent them from
being mistaken for API guidance.

## Resolution

The audit corrections were applied in priority order:

1. LinkStore primary identity, slot-accessor status, and duplicate-link load
   behavior are current in ADR-ECS and lifecycle documentation.
2. Layout keying and command scope are current in ADR-LAYOUT/ADR-ECS and inventory
   tables.
3. Computed `originIndex` pseudocode and the removed badge store are historical.
4. Stale lifecycle diagrams were replaced by current bridge facts and explicit
   target requirements.
5. Drift-prone aggregate store counts were removed.

## Assessment

The focused records now agree on the current authority boundaries: `LinkId` is
primary topology identity, slot connectivity accessors are derived,
`originIndex` is maintained, persistent entity layout uses scoped keys, and
general graph mutation remains imperative and snapshot-undone. Historical and
target designs remain available without presenting them as shipped behavior.
