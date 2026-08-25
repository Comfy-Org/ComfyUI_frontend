# ECS migration plan

Status: Partial
Verified: 2026-08-20 against `13a302eadda871b939b148ecb87e3d845ceefff2`

This plan records completed ECS migration work and the work that remains.
Detailed evidence and unresolved risks are in the focused audits under
[References](#references).

The governing decisions remain
[ADR 0003](../../adr/0003-crdt-based-layout-system.md) and
[ADR 0008](../../adr/0008-entity-component-system.md). This plan does not amend
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

| Concern              | Current result                                                                                                                                                                                                                                                                                                                                                           |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Node shell           | `nodeDataStore` owns `NodeState`. `LGraphNode` adopts the registered reactive proxy; renderer-only node mirrors and `useGraphNodeManager` were removed.                                                                                                                                                                                                                  |
| Link topology        | `linkStore` owns `LinkTopology` by root-wide `LinkId`, with owner, target, and origin indexes. `LLink` endpoint properties are compatibility accessors over the registered state.                                                                                                                                                                                        |
| Slot connectivity    | Input and output connectivity is derived from `linkStore`. `input.link` and `output.links` are deprecated read-only compatibility accessors; writes are ignored.                                                                                                                                                                                                         |
| Reroute chains       | `rerouteStore` owns parent/floating chain state. Link membership is derived from link parent chains rather than stored on reroutes.                                                                                                                                                                                                                                      |
| Widget state         | `widgetValueStore` owns widget values, render metadata, and root-scoped per-node order. `BaseWidget` adopts registered state.                                                                                                                                                                                                                                            |
| Layout               | Yjs-backed `layoutStore` owns persistent node, group, and reroute geometry. Entity lifecycle attaches geometry independently of renderer lifecycle, and layout writes use `LayoutOperation`.                                                                                                                                                                             |
| Renderer integration | Vue and legacy renderers read the same persistent geometry. Vue slot endpoints reactively derive from store-owned node layout plus measured offsets. Renderer switches clear transient view geometry rather than reseeding entity layout.                                                                                                                                |
| Renderer consumers   | `GraphCanvas` reads node shells from `nodeDataStore`; minimap topology reads `linkStore`; selection, arrangement, traversal, pricing, and widget consumers use store-backed topology or geometry where migrated. Live classes remain adapters for schema, callbacks, and legacy rendering.                                                                               |
| Badges               | Badge rows are derived by `badgeSystem`; the temporary badge store was removed. Badge data is transient and is not serialized or independently mutated.                                                                                                                                                                                                                  |
| Error presentation   | Error stores are authoritative inputs for Vue error rendering. `node.has_errors` remains a legacy-canvas projection, including promoted-widget and container error resolution, rather than an independent persisted authority.                                                                                                                                           |
| Identity             | Root graph allocation and import normalization enforce unique node, link, group, and reroute IDs across nested definitions. Owner indexes retain graph-local queries and teardown.                                                                                                                                                                                       |
| Lifecycle            | Graph add, configure, replace, remove, subgraph release, and clear register, transfer, or release migrated state. Typed graph lifecycle events let internal observers avoid replacing extension callback slots. Clear handles reentrant and failing removal callbacks; normal node removal can retain widget entries, and `configure(keep_old)` provides weaker cleanup. |
| Persistence          | Serialization, subgraph conversion, copy/paste, and workflow insertion preserve the existing workflow format while normalizing conflicting identities.                                                                                                                                                                                                                   |
| Compatibility        | Legacy graph, node, link, slot, widget, geometry, and callback surfaces remain available where practical. Changed behavior is documented in the extension migration references.                                                                                                                                                                                          |

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

The following authority boundaries remain in this phase:

- `NodeState.inputs` and `outputs` contain slot class instances. Slot data is
  not yet a plain component model.
- Widget order exists in both the store and `LGraphNode.widgets` during the
  compatibility period. Vue filters store order through live widget objects and
  still invokes their callbacks.
- Live graph object registries and store records coexist and must be attached
  and detached together.
- Graph membership, graph metadata, groups, subgraph definitions and ordered
  interfaces, node properties, group presentation, and extension-owned data
  remain authoritative on live `LGraph`, `Subgraph`, node, and group objects.
- `LGraphNode.boxcolor` remains class-owned durable render state outside
  `NodeState`, despite other shell visual fields being store-backed.
- Unknown nodes retain `last_serialization`, an opaque full-node record that
  overrides normal serialization and can shadow migrated node, slot, widget,
  and render state.
- Execution `order` is recomputed from topology but also restored and persisted
  on `LGraphNode`; its derived-versus-wire-compatibility contract is not yet
  enforced.
- Serialized `LGraph.state` allocation counters are directly mutable and
  influence future durable IDs outside a command/store boundary.
- `node.widgets_values` and `widgets_values_named` form another widget-value
  representation used for delayed dynamic-widget restoration and direct
  production writes; property-bound widgets can also mirror values in
  `node.properties`.
- `nodeOutputStore` mirrors `app.nodeOutputs` and `app.nodePreviewImages`, and
  legacy render output also projects into live node image fields. It is not yet
  the sole output authority.
- `LGraph._version` is manually incremented across graph, node, canvas, widget,
  slot, and subgraph mutation callers rather than derived at one committed
  transaction boundary.
- Durable graph `config`, `extra`, and `revision` metadata remains class-owned
  and directly mutable; graph metadata is not yet included in the explicit
  command schema.
- Node and graph `onSerialize` hooks can mutate complete persistence DTOs, while
  generic configure assignment and `onConfigure` expose equivalent load-time
  mutation channels. These extension hooks can override store-backed fields
  without schema, ownership, replay, transaction, or undo boundaries.
- Prompt construction awaits arbitrary widget `serializeValue` hooks. Current
  hooks can mutate widget/workflow shadows, choose random values, capture media,
  upload files, and update UI state, so execution input assembly is neither a
  pure store read nor isolated from unrelated effects.
- Node z-order exists in layout state and legacy `_nodes` ordering.
  `sendToBack` currently updates only the legacy ordering path.
- Node and input-slot error flags are mutable legacy drawing projections of
  error-store state and require synchronization by app hooks.
- Widget and preview stores lack the owner-scoped cleanup available in node,
  link, and reroute stores. Subgraph release and failed operations can retain
  records until root cleanup.
- Link paths, slot bounds, and hit-test geometry are transient renderer caches,
  not persistent layout components.

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

- Add plain store-owned graph and subgraph definition records for membership,
  metadata, ordered entity IDs, and subgraph interfaces. Keep live object
  registries as runtime adapters rather than serialization authorities.
- Move remaining durable node visuals, including `boxcolor`, into the
  store-owned shell or a focused visual component.
- Make `nodeOutputStore` authoritative for output and preview maps; expose
  legacy `app` and node-image fields as compatibility projections.
- Make one layout ordering action update both Vue z-index and the legacy draw
  projection; remove the asymmetric `sendToBack` mutation.
- Extract serialization only after stores contain sufficient authoritative
  data and parity can be checked against the existing wire format.
- Move legacy geometry projection ownership out of `LGraphNode` without
  changing `pos` and `size` extension behavior.
- Separate remaining link visual/runtime state when a renderer or interaction
  system can consume plain records directly.
- Extract plain slot state only when it removes a real class dependency; retain
  array order semantics and keep connectivity in `linkStore`.
- Move node properties, group presentation, preview-exposure persistence, and
  extension-owned durable fields behind scoped store actions while retaining
  compatibility property facades.
- Preserve serialization compatibility through a controlled adapter: isolate
  namespaced extension payloads as validated plain data and prevent persistence
  hooks from mutating canonical workflow and store-backed fields.
- Move graph `config`, `extra`, and `revision` into a focused store-owned plain
  data record while preserving serialization compatibility.
- Derive graph invalidation from authoritative store revisions or one
  centralized compatibility projection; remove scattered caller-owned
  `_version` increments.
- Store opaque unknown-node fallback records by scoped node identity, define
  their remapping and replacement lifecycle, and retain `last_serialization`
  only as a compatibility facade.
- Treat execution order as a derived topology projection. Define whether
  serialized `order` is ignored and recomputed or retained only as explicit
  wire compatibility, not as an independent mutation channel.
- Move allocation counters behind the workflow identity owner. Creation/import
  must no longer derive IDs from mutable state distributed across class and
  import paths.
- Route delayed widget restoration through scoped store state and isolate
  serialized widget arrays/maps as wire compatibility projections rather than
  production mutation channels.
- Add owner/node cleanup for widget and preview records before treating failed
  configure, replacement, and subgraph release as contained operations.

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
- [Lifecycle audit](ecs-lifecycle-audit.md)
- [Mutation audit](ecs-mutation-audit.md)
- [Identity and scope audit](ecs-identity-scope-audit.md)
- [Extension compatibility audit](ecs-extension-compatibility-audit.md)
- [Verification audit](ecs-verification-audit.md)
- [Documentation audit](ecs-documentation-audit.md)
- [ECS target architecture](../ecs-target-architecture.md)
- [Link registration migration](../../extensions/link-registration-migration.md)
