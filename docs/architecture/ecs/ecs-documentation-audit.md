# ECS migration documentation audit (PR 14246)

Status: Current implementation audit
Verified: 2026-08-16 against PR 14246
Scope: ADR 0003, ADR 0008, and architecture documents changed by PR 14246

The audit uses four document states:

- `Current`: describes behavior shipped on this branch.
- `Partial`: a shipped bridge or subset, with remaining migration work.
- `Target`: desired architecture not yet implemented.
- `Historical`: superseded design retained to explain decisions.

Verification confidence and missing behavioral scenarios are tracked in
[ecs-verification-audit.md](ecs-verification-audit.md).

## ADR roles and current accuracy

### ADR 0003: centralized CRDT layout

The ADR is the decision authority for canonical geometry in `layoutStore`, Yjs
storage, mutation operations, and renderer-independent layout state.

Status: `Partial`, despite the ADR header saying `Proposed`. Canonical
node/group/reroute geometry and scoped teardown are current. Collaboration,
multi-renderer inversion, and universal command-only mutation remain target.
The 2026-07-30 amendment accurately removes the unused operation log, but its
last sentence overstates command coverage.

### ADR 0008: entity/component direction

The ADR defines the architectural constraints and taxonomy: dedicated stores,
plain-data state, behavior outside components, graph ownership, and no
god-object growth.

Status: `Partial`, also headed `Proposed`. The original World, numeric
entity brands, slot entities, and generalized systems are target or historical.
Dedicated stores for widgets, topology, reroute chains, node shell state, and
layout are current. Legacy classes remain compatibility shells and still host
substantial behavior.

## Architecture-document inventory

| Document                         | Role                                    | Status and accuracy on this branch                                                                                                                                                                             |
| -------------------------------- | --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `appendix-ecs-pattern-survey.md` | External ECS pattern comparison         | **Target/historical.** Useful rationale; its command-executor comparisons describe a future seam, not the current general mutation model.                                                                      |
| `domain-glossary.md`             | Canonical topology vocabulary           | **Current.** The best terminology source for link, reroute, floating link, owner, and membership. It should be cited by topology records instead of redefining terms.                                          |
| `ecs-lifecycle-scenarios.md`     | Before/after operation narratives       | **Mixed current/target.** Diagrams interleave shipped `_addLink`/store behavior with hypothetical `ConnectivitySystem`, scope retagging, command batches, and serialization systems without consistent labels. |
| `ecs-migration-plan.md`          | Concise completed/remaining roadmap     | **Current + target.** Links its detailed claims to focused audits.                                                                                                                                             |
| `ecs-target-architecture.md`     | End-state model and transition diagrams | **Target with current inserts.** Shipped sections for topology/layout are useful, but slot-mirror and keying text has stale statements.                                                                        |
| `entity-interactions.md`         | Baseline relationship map               | **Current/partial.** Updated for stores, but the title correctly warns this remains the current legacy/store hybrid rather than the target ECS.                                                                |
| `entity-problems.md`             | Motivation and structural debt          | **Historical/current.** Some cited problems were reduced by this branch; retain them as historical motivation but mark resolved items.                                                                         |
| `link-topology-store.md`         | LinkStore decision record               | **Historical + current amendments.** Initial target-slot identity design is superseded by link-ID primary authority and owner-qualified secondary indexes.                                                     |
| `node-badge-store.md`            | Reversed badge-store decision           | **Historical.** The "store" did not remain; current state is derived `nodeBadges()` in `src/systems/badgeSystem.ts`. Its reversal should be prominent in title/status.                                         |
| `node-data-store.md`             | Node shell extraction record            | **Current/partial.** Accurate for `NodeState`, proxy adoption, renderer consumption, and teardown. Slot identity and broad command mutation remain deferred.                                                   |
| `output-slot-connectivity.md`    | Removal of slot connectivity mirrors    | **Current with stale pre-decision sections.** Decision 6 records the shipped result; Decisions 2 and 4 describe superseded implementation stages.                                                              |
| `proto-ecs-stores.md`            | Cross-store inventory                   | **Current/partial.** Broadly useful, but several key-format and remaining-gap rows lag the branch.                                                                                                             |
| `reroute-chain-store.md`         | Reroute chain decision record           | **Current plus one stale scope sentence.** Derived membership is accurate; `Reroute.pos` no longer mirrors layout state.                                                                                       |

## Concrete contradictions and exact corrections

### 1. Slot mirrors are described as still present

ADR 0008's Slot amendment says `input.link` and
`output.links` "remain un-migrated." `ecs-target-architecture.md`,
`ecs-lifecycle-scenarios.md`, and `proto-ecs-stores.md` repeat that the class
mirrors remain or are a migration gap. On this branch, concrete slot accessors
are deprecated, non-enumerable, store-derived compatibility views; writes warn
and are ignored. There is no mutable connectivity mirror.

Use the following wording:

> Runtime slot connectivity is owned by `useLinkStore`. `NodeInputSlot.link`
> and `NodeOutputSlot.links` are deprecated, read-only compatibility accessors
> derived from the store; they are not authoritative fields. Slot identity and
> visual state remain class-side.

### 2. LinkStore primary authority is misstated as target-slot keying

ADR 0008, `ecs-lifecycle-scenarios.md`, and parts of
`link-topology-store.md` say a target input slot is the store key or primary
identity and that duplicate link IDs cannot collide. Current
`useLinkStore` maintains root-wide `RootTopologyBucket.byId` authority;
`targetIndex` and `originIndex` are owner-qualified secondary indexes.
Duplicate link IDs are rejected/reminted across sibling definitions.

Use the following wording:

> `LinkId` is the root-workflow-wide primary identity. `targetIndex` enforces
> one fully assigned link per owner-qualified target slot; `originIndex`
> supports fan-out queries. Floating links share the ID namespace but are
> absent from endpoint indexes until fully assigned.

Update the ADR 0008 Link amendment, lifecycle load note, and key tables.

### 3. Output `originIndex` is documented as derived computed state

`output-slot-connectivity.md` Decision 2 shows a cached
`ComputedRef<OriginIndex>` rebuilt from `graphTopologies`. The implementation
stores `originIndex` in each `RootTopologyBucket` and maintains it atomically
with `byId` and `targetIndex` during registration, endpoint updates, and
deletion.

Replace the computed-index pseudocode with:

> `originIndex` is a reactive secondary index maintained in the same LinkStore
> mutation as primary topology and target occupancy. `getOutputSlotLinks`
> returns the indexed set; floating links are not indexed.

Mark the old computed design **Historical**, not current.

### 4. Command scope is generalized beyond implementation

ADR 0003 says all spatial mutations use explicit commands;
ADR 0008 says all external mutations submit serializable, idempotent commands
and systems handle them. `ecs-lifecycle-scenarios.md` then attributes free
undo/redo and atomic command batches to all entity operations. Current command
records are layout-specific (`LayoutOperation`/`useLayoutMutations`), while
link, node, reroute, and widget stores expose imperative actions and classes
still coordinate callbacks. Undo/redo remains snapshot-based in
`ChangeTracker`.

Use the following wording:

> Command-shaped operations are current for layout mutations. A cross-store
> command executor, transactional rollback, and command-based undo/replay are
> targets. Other stores currently expose validated imperative actions; graph
> lifecycle methods remain orchestration boundaries. Undo/redo is snapshot
> based through `ChangeTracker`.

Label `ConnectivitySystem`, `SerializationSystem`, and cross-store command
batches **Target** wherever diagrammed.

### 5. Layout keying tables describe raw node/link IDs

ADR 0008 and `proto-ecs-stores.md` still include variants of
"raw node/link IDs; scoped group/reroute IDs." ADR 0003's amendment and the
implementation scope nodes, groups, and reroutes with
`makeScopedLayoutKey(rootGraphId, id)`. Link segment geometry uses its separate
segment cache key and is not CRDT link topology.

Use the following wording:

> Persistent node, group, and reroute layout entries are keyed by
> `ScopedLayoutKey = makeScopedLayoutKey(rootGraphId, localId)`. Link topology
> does not live in LayoutStore. Transient link-segment geometry uses the
> segment-layout cache key and must not be listed as entity identity.

### 6. Reroute position is called a remaining mirror

The Scope section in `reroute-chain-store.md` says `Reroute.pos` is a class
field mirroring layout position. On this branch it is a compatibility geometry
view backed by the canonical layout entry; indexed and method mutations write
through.

Use the following wording:

> `Reroute.pos` is a stable compatibility view over LayoutStore geometry, not
> a second stored position. `RerouteChain` owns parent/floating topology;
> LayoutStore owns position.

### 7. Dedicated-store lifecycle is over-uniform

ADR 0008 says each dedicated store embeds graph scope in its
key and offers `clearGraph(graphId)`. Actual stores differ by concern:
LinkStore and RerouteStore use root buckets plus owner indexes; NodeDataStore
partitions by owning graph; LayoutStore uses root-scoped layout keys; global or
locator stores have different lifecycle contracts.

Replace the universal rule with:

> Every authoritative store defines an explicit workflow/owner lifecycle, but
> key shape and cleanup API are concern-specific. Inventory the primary
> identity, workflow bucket, owner association, and teardown operation
> separately.

### 8. NodeDataStore scope tables omit owner partitioning

`proto-ecs-stores.md` calls NodeDataStore simply root-scoped
and keyed by `NodeId`, which can imply one flat query namespace. The root bucket
owns ID uniqueness, while `NodeState.graphId` and owner indexes partition graph
membership and teardown.

Describe the identity/lifecycle split explicitly:

> Root workflow bucket + globally unique `NodeId`; owning `graphId` is an
> association/index used for graph-local queries and teardown, not an identity
> namespace.

### 9. Badge record status is easy to misread

A file named `node-badge-store.md` with `Status: Accepted`
looks like a current store design, although the record says the store was
deleted. ADR 0008 accurately records derivation, but inventories still count
stores inconsistently ("nine dedicated stores" while discussing the reversed
badge store nearby).

Change the record status to `Historical: reversed` and add a
one-line current result immediately below the title:

> Current result: no badge store; `nodeBadges()` derives `BadgeData` on read.

Store counts should enumerate current stores or be removed.

### 10. Lifecycle scenarios blur observation and destination

`ecs-lifecycle-scenarios.md` labels tables "Current vs ECS"
but later prose uses future `ConnectivitySystem`, `SerializationSystem`, scope
retagging, command rollback, and free undo as though implemented. Some current
rows also retain deleted slot writes and old LinkStore keying.

Prefix every diagram or table heading with `Current`, `Partial bridge`, or
`Target`. Keep current flows tied to stable symbols such as
`LGraph._addLink`, `useLinkStore.registerLink`, `detachGraphLayouts`, and
`ChangeTracker`; move hypothetical systems into target-only diagrams.

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

## Priority correction order

1. Correct LinkStore primary identity, slot-mirror status, and duplicate-link
   load behavior in ADR 0008 and lifecycle documentation.
2. Correct layout keying and command scope in ADR 0003/0008 summaries and all
   inventory tables.
3. Mark `originIndex` computed pseudocode and the badge store as historical.
4. Split current and target lifecycle diagrams.
5. Remove store counts and other drift-prone aggregate claims.

## Assessment

The branch's documents contain the right decisions, but amendments often sit
beside unrevised earlier claims. The most consequential errors are not wording:
they reverse authority (target slot versus LinkId), retain deleted slot
mirrors, describe a derived `originIndex` that is actually maintained, broaden
layout commands into a general executor, and report obsolete layout keys.
Consistent current/partial/target/historical labels would make the records
usable without erasing their design history.
