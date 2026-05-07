# Entity ID Strategy: Opaque IDs and Normalized Identity Components

_A design proposal for migrating all six entity kinds in the ECS taxonomy
of [ADR 0008](../adr/0008-entity-component-system.md) — Node, Link, Widget,
Slot, Reroute, Group — from primitive or content-addressed identifiers to
**opaque UUIDs**, with identity data normalized into per-entity components
and the necessary secondary indices owned by domain stores. This document
is a follow-on to ADR 0008 and the [ECS Pattern Survey](appendix-ecs-pattern-survey.md).
Status: proposed, pending sign-off before implementation._

The motivating defect is in
[src/world/entityIds.ts](../../src/world/entityIds.ts) (the slice-1
identity contract for widgets and node containers), but the design
question generalizes: **identity should be a component, not encoded into
the entity-ID string, and entity IDs should be opaque across all kinds.**
This document defines that strategy uniformly so subsequent ECS migration
slices (per the [migration plan](ecs-migration-plan.md)) extend the same
pattern instead of recreating the choice for each kind.

---

## 1. Context

### 1.1 What ADR 0008 specifies

ADR 0008 §"Branded ID Design" specifies branded **numeric** IDs for all
six entity kinds:

```ts
type NodeEntityId = number & { readonly __brand: 'NodeEntityId' }
type LinkEntityId = number & { readonly __brand: 'LinkEntityId' }
type WidgetEntityId = number & { readonly __brand: 'WidgetEntityId' }
type SlotEntityId = number & { readonly __brand: 'SlotEntityId' }
type RerouteEntityId = number & { readonly __brand: 'RerouteEntityId' }
type GroupEntityId = number & { readonly __brand: 'GroupEntityId' }
type GraphId = string & { readonly __brand: 'GraphId' }
```

The ADR notes that widgets and slots currently lack independent IDs and
proposes to assign synthetic IDs at entity creation time via an
auto-incrementing counter (matching the pattern used by `lastNodeId`,
`lastLinkId` in `LGraphState`).

### 1.2 What the slice-1 implementation actually did

The first ECS slice ([src/world/](../../src/world/)) covers **widgets**
and **node containers**, and it departed from ADR 0008's "numeric ID"
contract in two ways:

1. IDs are **strings**, not numbers (`Brand<string, ...>`).
2. IDs are **content-addressed** — `widgetEntityId(g, n, w)` is computed
   from `(graphId, nodeId, widgetName)`, not minted from a counter:

   ```
   node:${graphId}:${nodeId}
   widget:${graphId}:${nodeId}:${name}
   ```

The departure was deliberate — content-addressing gives "an entity viewed
at different subgraph depths shares state" for free — but the rationale
was never recorded in an architecture doc, and it leaves the wire format
unauthorized by ADR 0008.

### 1.3 Three problems with the slice-1 scheme

1. **Silent corruption when nodeId contains a colon.**
   `parseWidgetEntityId`'s regex `/^widget:([^:]+):([^:]+):(.*)$/` captures
   `nodeId` as `[^:]+`, so a string nodeId like `"sg:42"` produces
   `widget:g:sg:42:name`, which the regex mis-parses as `(g, sg, 42:name)`.
   `widgetValueStore.getNodeWidgetsByName` then keys the returned `Map` by
   the wrong name. The defect is latent today — verified: every production
   producer stringifies a bare local NodeId — but the type
   `NodeId = number | string` makes no runtime guarantee, and any future
   migration toward `NodeLocatorId` (e.g. `<subgraph-uuid>:<id>`) trips
   the bug.

2. **Identity is the address.** Renaming a widget mints a new entity
   (different name → different `widgetEntityId`); rewriting `nodeId`
   mints a new entity. There is no concept of "the widget formerly known
   as X" — per-aspect components attach to the address-derived ID and
   are abandoned at rename. For features that need stable identity
   across relabels (promoted widgets, subgraph reparenting, CRDT
   replication of label changes), this is a structural mismatch.

3. **Identity is recovered by parsing.** The regex is the only path by
   which `getNodeWidgetsByName` knows which widget has which name. The
   data has no representation in the World — it lives only in the string.
   Every consumer that needs the name must round-trip through the
   parser.

### 1.4 Why this generalizes

The same three problems apply, in principle, to every other entity kind
that lacks an independent ID. **Slot** identity today is `(parent node,
direction, index)`; if we encoded that as a colon-joined string, the same
parser hazards reappear. **Link** identity is `LinkId = number` (already
opaque), but its endpoints `(origin_id, origin_slot, target_id,
target_slot)` are content-shaped — and any identity migration will face
the same "do we encode this into the ID, or normalize it into a
component?" choice. The design decision is the same across all six
kinds; this document makes it once.

---

## 2. Decision

Adopt the **opaque-entity-id + identity-as-component** pattern for all
six entity kinds. The pattern matches what mainstream ECS libraries
converge on (Flecs `(ChildOf, parent)` pairs, Bevy `Parent`+`Children`,
koota `relation()`, EnTT `relationship.parent`, miniplex
`entity.livesOn`); see §5 for the survey citations.

### 2.1 Entity IDs are opaque UUIDs across all kinds

```ts
// src/world/entityIds.ts (proposed)
export type NodeEntityId = Brand<string, 'NodeEntityId'>
export type LinkEntityId = Brand<string, 'LinkEntityId'>
export type WidgetEntityId = Brand<string, 'WidgetEntityId'>
export type SlotEntityId = Brand<string, 'SlotEntityId'>
export type RerouteEntityId = Brand<string, 'RerouteEntityId'>
export type GroupEntityId = Brand<string, 'GroupEntityId'>
export type EntityId =
  | NodeEntityId
  | LinkEntityId
  | WidgetEntityId
  | SlotEntityId
  | RerouteEntityId
  | GroupEntityId

export const mintNodeId = (): NodeEntityId =>
  crypto.randomUUID() as NodeEntityId
export const mintLinkId = (): LinkEntityId =>
  crypto.randomUUID() as LinkEntityId
export const mintWidgetId = (): WidgetEntityId =>
  crypto.randomUUID() as WidgetEntityId
export const mintSlotId = (): SlotEntityId =>
  crypto.randomUUID() as SlotEntityId
export const mintRerouteId = (): RerouteEntityId =>
  crypto.randomUUID() as RerouteEntityId
export const mintGroupId = (): GroupEntityId =>
  crypto.randomUUID() as GroupEntityId
```

UUIDs (rather than numeric counters) for three reasons. First, no
coordination required — `crypto.randomUUID` is universally available and
collision-resistant without `LGraphState.lastWidgetId++` bookkeeping.
Second, they're stable across CRDT replication (per ADR 0003) without an
ID-mapping layer. Third, the `Brand<string, ...>` type machinery in
[src/world/brand.ts](../../src/world/brand.ts) already phantom-types over
`string`, so retaining string concrete types keeps zero friction with
existing component declarations.

This **amends ADR 0008 §"Branded ID Design"**: the `& { readonly __brand: ... }`
discipline is preserved, but the underlying type is `string` (UUID) for
all kinds, not `number`.

**Deletions from current code:** `nodeEntityId`, `widgetEntityId`,
`parseWidgetEntityId`, `graphNodePrefix`, `graphWidgetPrefix`,
`isNodeIdForGraph`, `isWidgetIdForGraph`, the regex. The wire-format
concept goes away.

**Litegraph-numeric IDs are preserved as data** — `LGraphState.lastNodeId`
and friends continue to assign legacy numeric IDs that workflow JSON
serialization depends on (per ADR 0008 §"The internal ECS model and the
serialization format are deliberately separate concerns"). The legacy
numeric ID becomes a field on the entity's identity component (§2.2),
not the entity's identity itself.

### 2.2 Identity components per entity kind

Each entity kind gets a "BelongsTo"-style component carrying its
structural relationships (parent pointers) and any legacy identifiers
needed for serialization parity. This is the canonical "parent pointer
on child" pattern; see §3.1 and §5.

#### Node

```ts
export const NodeBelongsTo = defineComponentKey<
  {
    graphId: GraphId
    litegraphNodeId: NodeId // legacy `LGraphNode.id`, kept for serialization
  },
  NodeEntityId
>('NodeBelongsTo')
```

Nodes belong to a graph (their containing `LGraph` or `Subgraph`).
`litegraphNodeId` preserves the local-to-graph numeric ID that
`workflowSchema.json` round-tripping requires.

#### Link

```ts
export const LinkBelongsTo = defineComponentKey<
  {
    graphId: GraphId
    litegraphLinkId: LinkId // legacy `LLink.id`
  },
  LinkEntityId
>('LinkBelongsTo')

export const LinkEndpoints = defineComponentKey<
  {
    origin: SlotEntityId
    target: SlotEntityId
    type: ISlotType
  },
  LinkEntityId
>('LinkEndpoints')
```

`LinkEndpoints` (already proposed in ADR 0008 §"Component Decomposition")
becomes the structural relationship; under the new scheme its fields are
opaque `SlotEntityId`s, not `(node_id, slot_index)` tuples.

#### Widget

```ts
export const WidgetBelongsTo = defineComponentKey<
  {
    graphId: GraphId
    nodeId: NodeEntityId // parent pointer
    name: string // identity within the parent
  },
  WidgetEntityId
>('WidgetBelongsTo')
```

The widget-on-node parent pointer is the bug-relevant case. `name`
identifies the widget within its parent node and replaces the
parser-recovered name in `widgetEntityId`'s wire format.

#### Slot

```ts
export const SlotBelongsTo = defineComponentKey<
  {
    graphId: GraphId
    nodeId: NodeEntityId // parent pointer
    direction: 'input' | 'output'
    index: number // ordinal within the parent's input/output array
    name: string
  },
  SlotEntityId
>('SlotBelongsTo')
```

Slots are an extreme case of "identity is currently the address" —
today's identity is literally `(node, direction, index)`, with the index
shifting whenever a slot is inserted or removed. Under opaque UUIDs, slot
identity persists across reorderings; the `index` field becomes a
position in an ordered children list, not a name.

#### Reroute

```ts
export const RerouteBelongsTo = defineComponentKey<
  {
    graphId: GraphId
    parentRerouteId: RerouteEntityId | null // optional reroute parent
    litegraphRerouteId: RerouteId // legacy `Reroute.id`
  },
  RerouteEntityId
>('RerouteBelongsTo')
```

Reroutes can chain (`Reroute.parentId`); the parent-pointer pattern
applies recursively. Reroutes also reference the link they belong to via
`RerouteLinks` (ADR 0008 §"Reroute"); under opaque IDs that becomes a
list of `LinkEntityId`s.

#### Group

```ts
export const GroupBelongsTo = defineComponentKey<
  {
    graphId: GraphId
    litegraphGroupId: number // legacy `LGraphGroup` numeric id
  },
  GroupEntityId
>('GroupBelongsTo')

export const GroupChildren = defineComponentKey<
  { entityIds: (NodeEntityId | RerouteEntityId)[] },
  GroupEntityId
>('GroupChildren')
```

Groups own a heterogeneous children list (nodes and reroutes within
their bounds). `GroupChildren` is the denormalized cache (§2.3); each
member also carries an optional `MemberOf` back-pointer if downward
iteration is hot (it isn't currently).

### 2.3 Children lists on parents — denormalized caches

Where downward iteration is hot, the parent gets a denormalized
children-list component. The existing
[`WidgetComponentContainer`](../../src/world/widgets/widgetComponents.ts)
on the node side is the canonical example; this generalizes to:

| Parent | Children component                                                                    | Hot path justifying it             |
| ------ | ------------------------------------------------------------------------------------- | ---------------------------------- |
| Node   | `WidgetComponentContainer { widgetIds: [...] }`                                       | Per-frame Vue-node rendering       |
| Node   | `SlotChildren { inputs: [...], outputs: [...] }`                                      | Connection drawing, hit-testing    |
| Graph  | `GraphMembers { nodeIds: [...], linkIds: [...], rerouteIds: [...], groupIds: [...] }` | Top-level rendering, `clearGraph`  |
| Group  | `GroupChildren { entityIds: [...] }`                                                  | Group-bounding-box render          |
| Link   | `RerouteLinks { rerouteIds: [...] }`                                                  | Path rendering along reroute chain |

These are caches **derived from** the per-child `*BelongsTo` parent
pointer. They exist for performance and are maintained by the same
mutation API that owns the parent pointer (§2.4); callers outside that
API never write to them directly. This is the Bevy
`Parent`+`Children`-symmetric-management discipline.

### 2.4 Secondary indices live in domain stores

Under opaque UUIDs, the question "given some content-shaped key, find
the entity" is no longer answered by computing a string. Each domain
store keeps a private forward index whose key is built with
`makeCompositeKey` (already in
[src/utils/compositeKey.ts](../../src/utils/compositeKey.ts)) so the
encoding is injective by construction:

| Store                 | Forward index        | Key shape                                   |
| --------------------- | -------------------- | ------------------------------------------- |
| `widgetValueStore`    | `widgetByAddress`    | `ckey([graphId, nodeId, widgetName])`       |
| `widgetValueStore`    | `nodeByAddress`      | `ckey([graphId, litegraphNodeId])`          |
| (slot store, future)  | `slotByAddress`      | `ckey([graphId, nodeId, direction, index])` |
| (link store, future)  | `linkByLitegraphId`  | `ckey([graphId, litegraphLinkId])`          |
| (group store, future) | `groupByLitegraphId` | `ckey([graphId, litegraphGroupId])`         |

Plus per-graph entity sets for O(set-size) bulk clear, replacing the
slice-1 `isWidgetIdForGraph` startsWith-scan:

```ts
const widgetsByGraph = new Map<GraphId, Set<WidgetEntityId>>()
const nodesByGraph = new Map<GraphId, Set<NodeEntityId>>()
// (and analogous per-kind sets in each store as kinds migrate)
```

All indices are private and mutated only by the owning store's public
methods (`registerWidget` / `clearGraph` / a future `unregisterWidget`).
This is the centralized-mutation discipline that Bevy's hierarchy
plugin enforces through `Commands` extension methods — and that the ECS
literature unanimously identifies as the precondition for safely
denormalizing hierarchy state.

### 2.5 Surface area summary

| Layer                         | Primitive                                     | Role                                   |
| ----------------------------- | --------------------------------------------- | -------------------------------------- |
| `entityIds.ts`                | `mint{Node,Link,Widget,Slot,Reroute,Group}Id` | Opaque ID generation                   |
| domain `*Components.ts` files | `*BelongsTo` components                       | Parent pointers (identity)             |
| domain `*Components.ts` files | `*Children` / `*Container` components         | Denormalized caches                    |
| domain stores                 | `*ByAddress` indices                          | Forward content-address lookup         |
| domain stores                 | `*ByGraph` indices                            | Per-graph bulk clear                   |
| domain store public methods   | `register*` / `clearGraph` / `unregister*`    | Sole writers to indices and components |

---

## 3. Why this is the right shape

### 3.1 It's what the ECS literature converges on

Three independent surveys (Flecs/Bevy/EnTT, koota/miniplex, and
normalization-tradeoff literature) agree on the same finding:
**store the parent pointer on the child, add a denormalized children
list on the parent only when downward iteration is hot, and centralize
all mutations behind a small API**. This document proposes exactly that
pattern — uniformly across all six entity kinds.

### 3.2 It removes parsers as an attack surface — for every kind

`parseWidgetEntityId` does not exist in the new scheme. The temptation
to write a `parseSlotEntityId` (which would face the same hazards on
slot names) is removed before it appears. Identity is read structurally
from components.

### 3.3 It decouples address from identity

Today, `widget(g, n, "old-name")` and `widget(g, n, "new-name")` are
different entities. Slot reordering today changes slot identity
(because identity = ordinal index). Reparenting today rotates entity IDs
across graphs. Under opaque UUIDs none of these mutations rotates
identity — they're component edits. This unlocks features that need
identity continuity (promoted-widget identity preservation,
slot-reorder-without-reconnection, label-swapping in CRDT replication)
without touching the substrate.

### 3.4 It aligns with ADRs 0003 and 0008

ADR 0003's command pattern requires that all mutations be serializable
and replayable. Opaque UUIDs are easier to serialize coherently — they
don't carry a graphId-prefix that needs rewriting on subgraph remount,
and they don't depend on the serialization format encoding identity
tuples identically across versions. Component-resident identity makes
command shapes ("set `WidgetBelongsTo.name` on `<uuid>`") trivially
expressible.

ADR 0008's "world is the source of truth, serialization is a
translation" principle is reinforced: the World holds opaque UUIDs and
identity components; the SerializationSystem maps them to/from the
`workflowSchema.json` format that uses litegraph-numeric IDs.

### 3.5 It absorbs the colon-collision fix as a side effect

The bug that motivates this document is solved twice over by the design:
the parser is gone, AND the address index uses `makeCompositeKey`
(already injective). No assert, no regex, no caveat.

---

## 4. Costs and risks

### 4.1 Index hygiene — across more stores

For each migrated kind, the per-store invariant is the same: indices
must stay in lockstep with the World. The discipline that makes this
safe is API-confinement: **all mutation goes through the owning store's
public methods**. Direct `world.setComponent` calls bypass the indices
and corrupt them.

Mitigations (apply per-store):

- Document the contract in the file's top doc-comment.
- Add a unit test that asserts the indices match the World contents
  after a randomized sequence of register/clear operations.
- Optionally, add a debug-build-only `world.assertConsistentIndices()`
  check.

### 4.2 Debuggability of opaque IDs

UUIDs in stack traces require reading the corresponding `*BelongsTo`
component to recover the human-meaningful identity. This applies to
every kind, not just widgets.

Mitigations:

- Provide a `describeEntity(id)` helper per store that returns the
  identity tuple for logging.
- Vue DevTools / Pinia inspector should surface the `*BelongsTo`
  components for registered entities.

### 4.3 Migration effort, by kind

The slices below mirror the [migration plan](ecs-migration-plan.md)'s
incremental approach. Each kind ships independently:

| Kind           | Status today                                         | Migration cost                                                                                  |
| -------------- | ---------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Widget         | In World (slice 1, content-addressed strings)        | High: rewrite `entityIds.ts`, `widgetValueStore.ts`, ~6 test files. ~+250/-80 prod, ~+100 test. |
| Node container | In World (slice 1, content-addressed strings)        | Bundled with widget migration; same surface area.                                               |
| Slot           | Not in World; lives on `LGraphNode.{inputs,outputs}` | Per ADR 0008 migration plan. New: `slotEntityId`, `SlotBelongsTo`, slot store.                  |
| Link           | Not in World; lives on `LGraph.links`                | New: `linkEntityId`, `LinkBelongsTo`, `LinkEndpoints` (slot-keyed).                             |
| Reroute        | Not in World; lives on `LGraph.reroutes`             | New: `rerouteEntityId`, `RerouteBelongsTo`, `RerouteLinks`.                                     |
| Group          | Not in World; lives on `LGraph._groups`              | New: `groupEntityId`, `GroupBelongsTo`, `GroupChildren`.                                        |

The widget+node migration is the only slice that touches existing World
code and existing tests. All other kinds are greenfield extensions — the
strategy is fixed by this document so each slice executes mechanically
without re-litigating identity-format choices.

### 4.4 Re-registration after `clearGraph`

If `clearGraph(g)` cleans World components but leaves stale entries in
the per-store address indices, a subsequent `register*(g, ...)` returns
an old UUID and re-binds components on a "ghost" entity. This is
functionally equivalent to today's content-addressed re-use, but the
discipline must be enforced: **`clearGraph(g)` MUST clear all index
entries for graph `g` before returning.** Per-store unit tests should
include a `clear → re-register` round-trip case.

### 4.5 Tests that hand-construct entity IDs

Slice-1 tests synthesize `WidgetEntityId`/`NodeEntityId` strings directly
(e.g. `defineComponentKey<...>` typing assertions in
[world.test.ts](../../src/world/world.test.ts)). These will need to mint
UUIDs instead. The change is mechanical but touches several test files
and will recur for each subsequent slice.

### 4.6 Litegraph-numeric ID coexistence

`workflowSchema.json` round-tripping requires preserving the numeric IDs
emitted by `LGraphState.lastNodeId++` etc. Under opaque-UUID identity
those numbers become **data** on the `*BelongsTo` component
(`litegraphNodeId`, `litegraphLinkId`, `litegraphGroupId`,
`litegraphRerouteId`). The SerializationSystem reads them when emitting
JSON and assigns matching values when re-hydrating. This is the same
"World ID ≠ wire ID" decoupling that ADR 0008 requires.

---

## 5. Cross-references

### 5.1 ECS library survey

Detailed comparison in [appendix-ecs-pattern-survey.md](appendix-ecs-pattern-survey.md).
The pattern this document proposes — opaque IDs + parent-pointer-on-child

- denormalized children + centralized mutation — is what koota,
  miniplex, EnTT, and Bevy all converge on for hierarchy modeling. Flecs
  goes further by encoding the parent into the archetype, which JS ECSes
  don't have access to without significant substrate work.

### 5.2 Source citations for §2 and §3.1

- Flecs hierarchies and pairs:
  [Hierarchies Manual](https://www.flecs.dev/flecs/md_docs_2HierarchiesManual.html),
  [Relationships Manual](https://www.flecs.dev/flecs/md_docs_2Relationships.html)
- Bevy parent/children components:
  [bevy_hierarchy docs](https://docs.rs/bevy_hierarchy),
  [Bevy Cheat Book hierarchy](https://bevy-cheatbook.github.io/fundamentals/hierarchy.html)
- EnTT relationship guidance:
  skypjack, [ECS back and forth, part 4](https://skypjack.github.io/2019-09-25-ecs_baf_part_4/)
- koota relation primitive:
  [koota/relation source](https://github.com/pmndrs/koota/blob/main/packages/core/src/relation/relation.ts)
- miniplex entity-reference pattern:
  [miniplex README](https://github.com/hmans/miniplex)
- Normalization tradeoffs:
  Mertens, [Building Games in ECS with Entity Relationships](https://ajmmertens.medium.com/building-games-in-ecs-with-entity-relationships-657275ba2c6c);
  IceFall Games,
  [Managing game object hierarchy in an ECS](https://mtnphil.wordpress.com/2014/06/09/managing-game-object-hierarchy-in-an-entity-component-system/)

### 5.3 Related ADRs and architecture docs

- [ADR 0003: Centralized Layout Management with CRDT](../adr/0003-crdt-based-layout-system.md) —
  command-pattern requirement that opaque IDs simplify
- [ADR 0008: Entity Component System](../adr/0008-entity-component-system.md) —
  this document amends §"Branded ID Design" by reinterpreting "numeric"
  as "opaque UUID string" across all six entity kinds, and adds
  `*BelongsTo` identity components to §"Component Decomposition"
- [ECS Pattern Survey](appendix-ecs-pattern-survey.md) — substrate-level
  comparison
- [ECS Lifecycle Scenarios](ecs-lifecycle-scenarios.md) — concrete
  before/after walkthroughs that this document's identity model affects
- [ECS Migration Plan](ecs-migration-plan.md) — the slice progression
  this document's per-kind sections track against
- [ECS Target Architecture](ecs-target-architecture.md) — the world-shape
  this document refines for identity

---

## 6. Migration plan

Two horizons: a near-term implementation slice that ships now, and a
strategy locked in for subsequent ADR 0008 slices.

### 6.1 Near-term: widgets and node containers (slice 1.5)

Ship as a single PR after the colon-collision consolidation
([entityIds-consolidation.md](../../temp/plans/entityIds-consolidation.md))
lands and is verified. Sequencing rationale: the consolidation is a
defensive 1-file fix that does not commit to this larger architectural
direction. If this proposal is rejected or amended, the consolidation
still stands as a strict improvement over the current state.

Phases inside the PR (single commit boundary, but reviewable as separate
hunks):

1. Add `WidgetBelongsTo`, `NodeBelongsTo` components and the four
   indices in `widgetValueStore`. Populate them in `registerWidget`
   alongside the existing entity-ID derivation. The string-format
   `widgetEntityId` continues to exist; the new components are written
   redundantly. All tests still pass.
2. Switch `getWidget` / `getNodeWidgets` / `getNodeWidgetsByName` to
   read identity from `WidgetBelongsTo` instead of parsing the entity
   ID. Delete `parseWidgetEntityId`. Delete the regex.
3. Switch `clearGraph` to consume `widgetsByGraph` / `nodesByGraph`
   instead of `entitiesWith` + `isWidgetIdForGraph`. Delete the
   `isXForGraph` helpers.
4. Replace `widgetEntityId` / `nodeEntityId` constructors with
   `mintWidgetId` / `mintNodeId`. Switch the entity-ID format from
   content-addressed strings to UUIDs.
5. Update test fixtures that hand-construct entity-ID strings.

Each phase ends in a green test suite. Quality gates:
`pnpm test:unit && pnpm typecheck && pnpm lint && pnpm knip`.

### 6.2 Subsequent slices: slots, links, reroutes, groups

Per the [migration plan](ecs-migration-plan.md), each remaining kind
moves into the World in its own slice. For each, the strategy is fixed
by this document:

1. Add the kind's `mint*Id` to `entityIds.ts` and the `*EntityId` brand.
2. Define the `*BelongsTo` identity component plus any `*Children` /
   `*Endpoints` structural components per §2.2.
3. Create (or extend) the domain store that owns the per-graph and
   forward-address indices, with the centralized-mutation API discipline.
4. Add the bridge layer (per ADR 0008 §"Migration Strategy" step 2) so
   existing OOP consumers continue to read from the litegraph class
   while ECS readers read from the World.
5. Migrate consumers piecewise per ADR 0008 §"Migration Strategy"
   steps 3–5.

No new identity-format decisions are made per slice. The colon-collision
risk class is closed for the entire ECS, not just for widgets.

---

## 7. Open questions

1. **Should widgets and node containers ship in one PR or two?** Widget
   identity is the bug-relevant case; node identity is symmetric but not
   load-bearing. Splitting reduces review surface but leaves the
   substrate temporarily inconsistent (widgets opaque, node containers
   content-addressed). Recommendation: one PR, since both live in
   `widgetValueStore` and the indices interlock.

2. **Should `*BelongsTo.name` / `*BelongsTo.index` be mutable post-creation?**
   Today, rename mints a new entity; reorder rotates slot identity.
   Under opaque IDs these mutations could either (a) preserve identity
   (mutate component, rewrite address index) or (b) preserve current
   semantics (delete + remint). (a) is the new capability this refactor
   unlocks, but adopting it changes downstream behavior; should be a
   deliberate follow-up per kind.

3. **Do we want explicit `Is{Widget,Node,Slot,…}` marker components?**
   koota uses tag traits this way so `world.entitiesWith(IsWidget)` is
   the canonical "iterate all widgets" query, replacing the implicit
   `entitiesWith(WidgetComponentValue)` pattern. Optional ergonomic
   improvement, not required by the bug fix; decide per slice.

4. **Where does name/ordinal uniqueness within a parent belong?**
   For widgets: `(graphId, nodeId, name)` uniqueness is enforced by
   `widgetByAddress`. For slots: `(graphId, nodeId, direction, index)`
   uniqueness is enforced by `slotByAddress`. We should decide per kind
   whether second-registration is a no-op (`getOrRegister` semantics),
   an overwrite, or an error.

5. **Counter-based vs UUID-based minting.** ADR 0008 originally proposed
   counter-based (`lastWidgetId++`). UUIDs are simpler (no shared state,
   no CRDT mapping) but slightly larger and unpleasant in stack traces.
   Recommendation: UUIDs for now (matching this document's §2.1); revisit
   if profiling or debuggability demands otherwise.
