# ECS migration plan

Status: Scoped data centralization implemented; structural follow-up remains
Verified: 2026-08-21 against `73c3c633f`

This plan records completed ECS migration work and the work that remains.
Detailed evidence and unresolved risks are in the focused audits under
[References](#references).

The governing decisions remain
[ADR-LAYOUT](../../adr/LAYOUT-crdt-layout-intent-and-local-measurement.md) and
[ADR-ECS](../../adr/ECS-entity-component-system.md). This plan does not amend
them.

## Direction

Runtime graph state is moving from mutable LiteGraph object graphs into
dedicated stores, one store per concern. Legacy classes remain compatibility
facades while extensions and renderers migrate. Behavior moves into systems
only when there is a concrete consumer and a tested replacement path.

The implementation has no central ECS `World`. Each concern defines its own
identity, scope, storage, and cleanup. Layout uses Yjs. The other migrated
stores use reactive Pinia state.

### Scope of this phase

PR 14246 is a data-architecture phase. Its goal is to centralize Component and
Entity data so each durable concern has one store authority, then remove
duplicate representations and state-synchronization logic distributed across
classes, renderers, and stores.

This phase does not require a system-wide Command pattern, command-based undo or
replay, a workflow transaction bus, or CRDT compatibility beyond the existing
Yjs-backed layout store. Those remain possible later architecture work and are
documented so current APIs do not foreclose them, not as acceptance criteria for
this phase.

## Work completed

| Concern              | Current result                                                                                                                                                                                                                                                                                                                                      |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Node shell           | `nodeDataStore` owns `NodeState`. `LGraphNode` adopts the registered reactive proxy; renderer-only node mirrors and `useGraphNodeManager` were removed.                                                                                                                                                                                             |
| Link topology        | `linkStore` owns `LinkTopology` by root-wide `LinkId`, with owner, target, and origin indexes. `LLink` endpoint properties are compatibility accessors over the registered state.                                                                                                                                                                   |
| Slot connectivity    | Input and output connectivity is derived from `linkStore`. `input.link` and `output.links` are deprecated read-only compatibility accessors; writes are ignored.                                                                                                                                                                                    |
| Reroute chains       | `rerouteStore` owns parent/floating chain state. Link membership is derived from link parent chains rather than stored on reroutes.                                                                                                                                                                                                                 |
| Widget state         | `widgetValueStore` owns widget values, render metadata, and root-scoped per-node order. `BaseWidget` adopts registered state.                                                                                                                                                                                                                       |
| Layout               | Yjs-backed `layoutStore` owns persistent node, group, and reroute geometry. Entity lifecycle attaches geometry independently of renderer lifecycle, and layout writes use `LayoutOperation`.                                                                                                                                                        |
| Renderer integration | Vue and legacy renderers read the same persistent geometry. Vue slot endpoints reactively derive from store-owned node layout plus measured offsets. Renderer switches clear transient view geometry rather than reseeding entity layout.                                                                                                           |
| Renderer consumers   | `GraphCanvas` reads node shells from `nodeDataStore`; minimap topology reads `linkStore`; selection, arrangement, traversal, pricing, and widget consumers use store-backed topology or geometry where migrated. Live classes remain adapters for schema, callbacks, and legacy rendering.                                                          |
| Badges               | Badge rows are derived by `badgeSystem`; the temporary badge store was removed. Badge data is transient and is not serialized or independently mutated.                                                                                                                                                                                             |
| Error presentation   | Error stores are authoritative inputs for Vue error rendering. `node.has_errors` remains a legacy-canvas projection, including promoted-widget and container error resolution, rather than an independent persisted authority.                                                                                                                      |
| Identity             | Root graph allocation and import normalization enforce unique node, link, group, and reroute IDs across nested definitions. Owner indexes retain graph-local queries and teardown.                                                                                                                                                                  |
| Lifecycle            | Graph add, configure, replace, remove, subgraph release, and clear register, transfer, or release migrated state. Typed graph lifecycle events let internal observers avoid replacing extension callback slots. Clear handles reentrant and failing removal callbacks; failed and additive configure still have the cleanup limits described below. |
| Persistence          | Serialization, subgraph conversion, copy/paste, and workflow insertion preserve the existing workflow format while normalizing conflicting identities.                                                                                                                                                                                              |
| Compatibility        | Legacy graph, node, link, slot, widget, geometry, and callback surfaces remain available where practical. Changed behavior is documented in the extension migration references.                                                                                                                                                                     |

## PR 14246 change traceability

This table tracks every substantive production-code cluster in PR 14246.
Fixtures, snapshots, and test-only helpers are evidence for the listed concern,
not separate architecture changes.

| PR change cluster                  | Current result                                                                                                                                                                                                                                                                                                                               | Detailed record and evidence                                                                                                                                             |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Node shell and Vue lifecycle       | `nodeDataStore` replaces renderer-owned node mirrors; `useGraphNodeManager` and `useVueNodeLifecycle` are removed.                                                                                                                                                                                                                           | [State authority](ecs-state-authority-audit.md#node-shell), [verification](ecs-verification-audit.md#pr-change-coverage)                                                 |
| Link and slot connectivity         | `linkStore` owns topology and endpoint indexes; deprecated slot connectivity properties are read-only projections. Dynamic slot reorder realigns topology.                                                                                                                                                                                   | [State authority](ecs-state-authority-audit.md#link-topology), [verification](ecs-verification-audit.md#pr-change-coverage)                                              |
| Reroute chains                     | `rerouteStore` owns chain state and derives membership from link parent chains.                                                                                                                                                                                                                                                              | [State authority](ecs-state-authority-audit.md#reroute-chains), [lifecycle](ecs-lifecycle-audit.md)                                                                      |
| Widgets and promotion              | `widgetValueStore` owns value, render metadata, and order. Vue reconstructs rows from store order while live widget objects remain behavior adapters.                                                                                                                                                                                        | [State authority](ecs-state-authority-audit.md#widget-value-render-state-and-order), [verification](ecs-verification-audit.md#pr-change-coverage)                        |
| Promoted-widget panel behavior     | Parameter actions promote only to the current host and favorite the interior row node. Subgraph-editor demotion disconnects a connected boundary slot or removes an unconnected subgraph input.                                                                                                                                              | [Verification](ecs-verification-audit.md#widgets-and-promotions-good), [subgraph boundaries](../subgraph-boundaries-and-promotion.md)                                    |
| Layout and renderer switching      | Persistent entity geometry is store-owned. Vue slot tracking observes root-scoped node layout refs so cached endpoints follow store mutations without a second node-position mirror. Entering Vue clears transient view geometry; returning to legacy sorts by canonical z-order and reruns legacy arrangement.                              | [State authority](ecs-state-authority-audit.md#layout), [verification](ecs-verification-audit.md#pr-change-coverage)                                                     |
| Minimap and graph consumers        | The renderer-dependent minimap source split is removed. Minimap topology is owner-filtered from `linkStore`, while live class geometry and definition-locator execution state remain bridge inputs.                                                                                                                                          | [State authority](ecs-state-authority-audit.md#graph-instance-registries-and-scope), [verification](ecs-verification-audit.md#pr-change-coverage)                        |
| First-run-tour role inference      | Virtual consumers are excluded when collecting connected input-name evidence, so a real producer cannot be inferred solely from the input label of a virtual consumer.                                                                                                                                                                       | [Verification](ecs-verification-audit.md#pr-change-coverage)                                                                                                             |
| First-run-tour coach target        | Canvas coachmarks capture the current graph, read existing node layout by root graph ID, and return no target when layout is absent or the current graph changes. Tour observation no longer retains or creates entity layout state.                                                                                                         | [State authority](ecs-state-authority-audit.md#layout), [verification](ecs-verification-audit.md#pr-change-coverage)                                                     |
| Badge and error projections        | Badge rows are derived on read. Vue derives node/widget errors from error stores; legacy `node.has_errors` is synchronized as a canvas projection.                                                                                                                                                                                           | [State authority](ecs-state-authority-audit.md#badges), [verification](ecs-verification-audit.md#pr-change-coverage)                                                     |
| Lifecycle observers and cleanup    | Typed `node:added`, `node:before-removed`, and `node:removed` events serve internal multi-subscriber observers without clobbering extension callbacks.                                                                                                                                                                                       | [Lifecycle](ecs-lifecycle-audit.md#node-removal), [extension compatibility](ecs-extension-compatibility-audit.md)                                                        |
| Extension-facing compatibility     | Node shell fields moved from own enumerable properties to store-backed prototype accessors; `type` mutation warns; active Pinia is mandatory. Badge placement is fixed top-right and `badgePosition` is a deprecated no-op. The `node:slot-links:changed` and `node:slot-errors:changed` triggers were removed without compatibility events. | [Extension compatibility](ecs-extension-compatibility-audit.md), [node data](../node-data-store.md#decision-7-enumerability--extension-migration-implemented-2026-07-22) |
| Legacy custom-widget fixture       | The devtools legacy-widget constructor now returns its existing widget in the required `{ widget }` descriptor, allowing normal registration and tracking. This fixes fixture compliance rather than introducing a new constructor contract.                                                                                                 | [Extension compatibility](ecs-extension-compatibility-audit.md#custom-widget-constructors)                                                                               |
| Identity and recursive imports     | Root allocation, recursive definition normalization, replacement transfer, clipboard, and insertion preserve owner scope while preventing collisions.                                                                                                                                                                                        | [Identity and scope](ecs-identity-scope-audit.md), [verification](ecs-verification-audit.md#pr-change-coverage)                                                          |
| Direct workflow insertion          | Recursive workflow data converts directly to clipboard items without temporary graphs, canvases, or local-storage mutation.                                                                                                                                                                                                                  | [Identity and scope](ecs-identity-scope-audit.md#persistence-and-transfer-boundaries), [verification](ecs-verification-audit.md#clipboard-and-insertion-good)            |
| Unknown-node preservation          | Missing node types retain an opaque serialized-node fallback on the live class; that fallback overrides normal serialization and is not store-owned.                                                                                                                                                                                         | [State authority](ecs-state-authority-audit.md#unknown-node-fallback-records), [lifecycle](ecs-lifecycle-audit.md)                                                       |
| Execution order                    | Topology recomputation writes `node.order`, while load/save also restore and persist it for wire compatibility. It remains a class-side derived projection with ambiguous persisted authority.                                                                                                                                               | [State authority](ecs-state-authority-audit.md#execution-order), [mutation](ecs-mutation-audit.md)                                                                       |
| ID allocation state                | Serialized `LGraph.state` counters allocate node, link, group, and reroute IDs through direct mutable class state. Import and clipboard paths can also observe or assign counters.                                                                                                                                                           | [State authority](ecs-state-authority-audit.md#id-allocation-state), [identity and scope](ecs-identity-scope-audit.md#allocation-and-recursive-ownership)                |
| Widget value compatibility shadows | `widgetValueStore` owns registered widget state, but `node.widgets_values` and `widgets_values_named` remain delayed-load and extension compatibility arrays/maps; some production consumers mutate them beside live widgets, and property-bound widgets can mirror values in `node.properties`.                                             | [State authority](ecs-state-authority-audit.md#widget-value-render-state-and-order), [mutation](ecs-mutation-audit.md)                                                   |
| Serialization and undo bridge      | Existing workflow JSON remains the persistence contract; undo remains snapshot-based.                                                                                                                                                                                                                                                        | [Mutation](ecs-mutation-audit.md#replay-and-undo-today), [verification](ecs-verification-audit.md#serialization-strong)                                                  |

## Current boundaries

The scoped authority migration is complete. These structural boundaries remain:

- Slot descriptors sit behind a virtual extension-visible slot-class array.
  Native callback semantics are preserved, but complete reflection compatibility
  requires restoring real arrays at that boundary.
- `graphDefinitionStore` still contains live adapter instances, and persisted
  graph UUIDs remain runtime store keys. Populated graph IDs are immutable until
  an instance-scoped registry replaces that keying model.
- Store-driven persistence joins and extension adaptation still live in and
  around `LGraph`.
- Replacement configure is destructive on failure; additive configure provides
  only best-effort rollback rather than an atomic staged transaction.
- `SubgraphNode` still combines promoted-widget projection, preview hydration,
  and host persistence responsibilities.
- Prompt construction still awaits effectful widget `serializeValue` hooks.
- Link paths, slot bounds, and hit-test geometry remain transient renderer
  caches rather than persistent components.

The current implementation also has no system-wide command protocol, workflow
transaction, command replay, or command-based undo. These are factual limits,
but they are not blockers for completing this data-centralization phase.

## Work remaining

### 1. Prove the current bridge

Follow-up coverage in `ecsBridgeHistory.spec.ts` now proves that a promoted
subgraph with nested links and layout survives delete/undo and can be removed
again by redo. It also exercises geometry through subgraph navigation,
Vue-to-legacy switching, undo/redo, and serialization/reload. Focused tests now
pin virtual-consumer role inference and verify that first-run coach targets read
the root-scoped layout without creating layout state.

Before broadening or removing compatibility paths:

- Extend mixed undo/redo coverage to replacement or removal involving reroutes
  and groups, with direct store and callback-visible assertions. Promoted
  widgets, nested links, layout, renderer switching, and serialization now have
  browser coverage across delete/undo/redo.
- Prove failed workflow configuration leaves no node, link, reroute, widget,
  or layout ownership behind.
- Exercise recursive mixed-ID collisions through load, insertion, copy/paste,
  save, and reload.
- Prove store-order/live-widget reconciliation, promoted missing-media errors,
  lifecycle event ordering, and minimap topology/output identity behavior.
- Run a representative extension corpus against `LinkMap`, callback ordering,
  deprecated slot accessors, active-Pinia setup, node property enumeration,
  and geometry mutation.
- Establish measured renderer budgets for large-workflow drag, resize, link
  interaction, navigation, renderer switching, minimap refresh, and widget-row
  processing.

These are behavioral gates. Additional store-internal tests are lower priority
unless they cover a new invariant.

### 2. Centralize remaining Component and Entity data

All 19 scoped concerns are implemented. The authoritative commit-by-commit
record is in the Component and Entity data audit's
[progress record](ecs-component-entity-data-audit.md#progress-record), with
current boundaries under [verified current limitations](ecs-component-entity-data-audit.md#verified-current-limitations).

Remaining work is the audit's five-part
[structural follow-up plan](ecs-component-entity-data-audit.md#structural-follow-up-plan):
restore real slot arrays, introduce an instance-scoped plain graph record,
extract persistence from `LGraph`, make configure transactional, and decompose
subgraph hosting. These improvements do not reopen the completed 19-concern
authority migration.

### 3. Retire duplicate state and synchronization bridges

A compatibility path can be removed per concern only when:

- production reads and writes use the replacement API;
- serialization and undo parity are proven;
- extension usage has been measured and a migration is published;
- callback timing and rejection behavior are preserved or versioned;
- renderer performance meets the agreed budget; and
- rollback remains possible through the release containing the removal.

Likely retirement candidates include deprecated slot connectivity accessors,
indexed `graph.links[id]`, legacy layout aliases, duplicate widget-order
ownership, and class-owned component fields. They should not be removed as one
large final phase.

## Later architecture work outside this phase

- Define which graph-domain changes should become serializable commands.
- Introduce deterministic command reducers, idempotency, replay, and transport
  only when a concrete collaboration or operation-history consumer requires
  them.
- Define workflow-wide transaction or compensation semantics independently of
  state centralization.
- Decide whether undo remains snapshot-based or adopts command inverses.
- Separate prompt value resolution from effectful media capture/upload if queue
  retry or replay requirements demand it.
- Extend CRDT compatibility beyond layout only through the multiplayer
  integration contract, not by making every store Yjs-backed.

## Explicit non-goals

- Reintroducing a universal `World` registry.
- Creating a store for derived badge rows.
- Making transient renderer geometry persistent or CRDT-backed.
- Making every store Yjs-backed without a collaboration requirement.
- Adding a frontend-owned operation log or transport to `layoutStore`;
  collaboration belongs at the integration boundary with
  `@comfyorg/comfy-multi-player`.
- Creating slot IDs or component stores solely to match an abstract ECS model.
- Removing extension facades before migration evidence exists.

## Completion criteria

This data-centralization phase is complete when, for every durable Component or
Entity concern included in PR 14246:

1. One dedicated store is the documented runtime authority.
2. Lifecycle registration, transfer, teardown, and failed-operation behavior
   are explicit and tested across nested graphs.
3. Renderers, serialization, execution, and compatibility APIs read that
   authority rather than maintaining durable mirrors.
4. Derived and transient data cannot become competing persisted authorities.
5. Duplicate class/store representations and their synchronization logic are
   removed; retained class APIs are projections or behavior adapters.
6. Components are plain data and Entities have explicit scoped identity and
   lifecycle ownership.
7. Extension and renderer compatibility meet documented correctness and
   performance gates.

System-wide commands, command replay/undo, workflow transactions, and broader
CRDT compatibility are explicitly not completion criteria for this phase.

## References

- [Executive summary](ecs-migration-summary.md)
- [Decision traceability](ecs-decision-traceability.md)
- [State authority audit](ecs-state-authority-audit.md)
- [Component and Entity data audit](ecs-component-entity-data-audit.md)
- [Lifecycle audit](ecs-lifecycle-audit.md)
- [Mutation audit](ecs-mutation-audit.md)
- [Identity and scope audit](ecs-identity-scope-audit.md)
- [Extension compatibility audit](ecs-extension-compatibility-audit.md)
- [Verification audit](ecs-verification-audit.md)
- [Documentation audit](ecs-documentation-audit.md)
- [ECS target architecture](../ecs-target-architecture.md)
- [Link registration migration](../../extensions/link-registration-migration.md)
