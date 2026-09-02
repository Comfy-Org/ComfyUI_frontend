# ECS state authority audit

Status: Current implementation audit
Verified: 2026-08-20 against `13a302eadda871b939b148ecb87e3d845ceefff2`

This audit records state ownership on `feature/ecs-migration`. It distinguishes
authoritative records from compatibility accessors, derived projections, and
transient renderer caches. It identifies dual sources where the migration is
not complete.

For PR 14246, the desired endpoints in this audit prioritize one store authority
per durable Component or Entity concern and removal of synchronization mirrors.
References to commands, replay, transactions, or CRDT transport describe possible
later architecture, not requirements for this data-centralization phase.

The governing decisions remain
[ADR-LAYOUT](../../adr/LAYOUT-crdt-layout-intent-and-local-measurement.md) and
[ADR-ECS](../../adr/ECS-entity-component-system.md). See
[ECS Decision Traceability](ecs-decision-traceability.md) for principle-level
status and [ECS Target Architecture](../ecs-target-architecture.md) for the
target.

## Node shell

- **Authority:** `useNodeDataStore`; one store-backed `NodeState` in a root-flat,
  owner-indexed bucket. As a transitional exception, its `inputs` and `outputs`
  still contain `NodeInputSlot` and `NodeOutputSlot` instances.
- **Compatibility view/mirror:** `LGraphNode` fields are accessors over
  `_state`, the store-returned reactive proxy. This is one object, not a copy.
- **Reads:** renderer components consume `NodeState`; legacy code reads
  `LGraphNode.title`, `mode`, colors, flags, slot arrays, and related accessors.
- **Writes:** class setters and direct proxy writes; `registerNodeState` adopts
  the proxy. These are not serializable commands.
- **Lifecycle:** `LGraph.add` registers; `LGraph.remove`, `clearOwner`, and
  `clearGraph` unregister with raw-identity checks.
- **Risks:** `LGraphNode` still owns substantial non-shell state and behavior;
  `boxcolor` is durable serialized render state outside `NodeState`; accessor
  fields differ from old enumerable own properties.
- **Desired endpoint:** store-owned plain node data, with class accessors only
  as an explicitly supported extension adapter until callers migrate.

## Layout

- **Authority:** Yjs maps in `LayoutStoreImpl` for node, group, and reroute
  position/size/bounds/z-order as applicable.
- **Compatibility view/mirror:** `LGraphNode`, `LGraphGroup`, and `Reroute`
  geometry accessors/views read and write the store; local tuple buffers and
  geometry versions support the legacy API and hot path.
- **Reads:** `getNodeLayoutRef`, geometry queries, `createMutationView`, canvas
  rendering, hit testing, and class geometry accessors.
- **Writes:** `LayoutOperation` through `applyOperation` / `applyOperations`,
  `useLayoutMutations`, and `graphLayoutAttachment` helpers.
- **Lifecycle:** entity attach/detach follows `LGraph.add` / `remove`; root
  teardown uses `layoutStore.clearGraph`, while owner detach removes entries.
- **Risks:** stale compatibility buffers are possible if synchronization
  contracts regress; Yjs transport and operation history are absent by design.
- **Desired endpoint:** every durable geometry mutation remains command-based
  and renderer-independent; compatibility buffers become read-through views.

## Link topology

- **Authority:** `useLinkStore` owns `LinkTopology` by link ID in root buckets,
  with owner, target-slot, and origin-slot indexes.
- **Compatibility view/mirror:** `LLink._state` is the registered reactive
  record. Endpoint class fields are accessors, not duplicate topology.
- **Reads:** `graphTopologies`, ID and endpoint queries, `slotLinks`, `LLink`,
  canvas connectors, serialization, and reroute membership derivation.
- **Writes:** `registerLink`, `replaceLink`, `updateEndpoint(s)`, and
  `deleteLink`, usually orchestrated by legacy graph/node connect APIs.
- **Lifecycle:** graph add/configure registers; disconnect/remove deletes;
  `clearOwner` and `clearGraph` release indexed state.
- **Risks:** link visual/runtime fields remain on `LLink`; topology mutation is
  transactional within the store but is not a serializable command protocol.
- **Desired endpoint:** topology and indexes remain singular store authority;
  connectivity orchestration moves to a system without changing extensions or
  serialized workflows.

## Reroute chains

- **Authority:** `useRerouteStore` owns plain `RerouteChain` parent/floating
  state; membership is derived from `linkStore` parent chains.
- **Compatibility view/mirror:** `Reroute._chain` adopts the reactive store
  record; `linkIds` and `floatingLinkIds` are derived views, not stored sets.
- **Reads:** reroute class accessors, graph/canvas traversal, serialization, and
  `getMembership`'s computed reverse index.
- **Writes:** `registerReroute`, class chain accessors, and `deleteReroute`;
  link membership changes by updating link topology.
- **Lifecycle:** graph registration/removal plus `clearOwner` / `clearGraph`;
  computed membership is dropped with its owner.
- **Risks:** chain and layout are intentionally split across two stores;
  malformed cycles and missing parents must remain bounded during traversal.
- **Desired endpoint:** keep chain state singular and membership derived; route
  cross-store chain edits through one validated connectivity operation.

## Widget value, render state, and order

- **Authority:** `useWidgetValueStore` owns `WidgetState`,
  `WidgetRenderState`, and per-node `WidgetId[]` order in root-workflow
  buckets.
- **Compatibility view/mirror:** `BaseWidget` adopts store state, while
  `LGraphNode.widgets` remains the ordered live widget-object collection used
  by legacy drawing and extension APIs. `node.widgets_values` and
  `widgets_values_named` remain delayed-load/wire compatibility shadows and are
  still mutated by some production consumers. Property-bound widgets can also
  mirror their value in `node.properties`. **This is at least triple
  representation:** store state/order, live widget objects, serialized
  arrays/maps, and for some widgets node properties require reconciliation.
- **Reads:** store getters power Vue/UI/pricing paths; legacy renderer,
  serialization, and extensions read widget instances and `node.widgets`.
- **Writes:** `registerWidget`, `setValue`, `setNodeWidgetOrder`, deletion, and
  legacy widget/class APIs.
- **Lifecycle:** widget construction/attachment registers; removal unregisters;
  graph teardown calls `clearGraph`.
- **Risks:** values, renames, and reordering can diverge across store state,
  object arrays, and serialized shadows; promoted widgets have host-boundary
  identity rules.
- **Desired endpoint:** store values/render metadata/order are canonical;
  widget instances become behavior adapters assembled from that order.

## Badges

- **Authority:** no badge authority exists. Source stores own settings, node
  definitions, colors, pricing inputs, widget values, and topology.
- **Compatibility view/mirror:** `nodeBadges` is a lazy computed projection;
  `registerBadgeRowsProvider` is an app-to-litegraph rendering seam.
- **Reads:** canvas badge drawing requests plain `BadgeData` rows.
- **Writes:** none to badge rows; `computeBadges` derives them from `BadgeSources`.
- **Lifecycle:** one computed projection per node instance, released with that
  instance/provider lifecycle; no serialization or graph cleanup record.
- **Risks:** the registration seam and class-dependent source gathering couple
  the app system to live node instances.
- **Desired endpoint:** a render system gathers authoritative sources and passes
  transient badge rows to renderers; do not add a badge cache/store by default.

## Slots

- **Authority:** slot identity, metadata, visuals, and behavior remain
  `NodeInputSlot` / `NodeOutputSlot` instances in shallow-reactive node arrays;
  `NodeState.inputs` / `outputs` hold those same arrays by reference.
- **Compatibility view/mirror:** `input.link` and `output.links` are deprecated,
  store-derived reads; assignments warn and have no effect. Connectivity
  authority is `linkStore` through `slotLinks`.
- **Reads:** renderer and interaction code read live slots; connectivity users
  call `inputLinkId`, `outputLinks`, and node connection helpers.
- **Writes:** array mutation/reordering edits slot ownership/order; graph/node
  connect APIs edit topology. Direct legacy mirror writes are ignored.
- **Lifecycle:** slots follow node construction/configuration/removal; topology
  cleanup follows link and graph lifecycle.
- **Risks:** **dual authorities by concern** are legitimate but easy to blur:
  slot object/array owns slot data/order, while `linkStore` owns connections.
- **Desired endpoint:** extract plain slot state only with a real consumer;
  preserve array order semantics and keep connectivity exclusively store-owned.

## Graph-instance registries and scope

- **Authority:** `GraphScope` (`rootGraphId`, `owningGraphId`) defines migrated
  store scope; `LGraph` remains the live graph-instance and lifecycle registry.
- **Compatibility view/mirror:** root buckets flatten identities while owner
  indexes restore graph-local queries; `subgraphNavigationStore` tracks the
  active navigation path, not graph-domain ownership.
- **Reads:** stores use `graphScopeOf`; graph algorithms and extensions still
  traverse `LGraph._nodes`, links, reroutes, groups, and subgraphs.
- **Writes:** `LGraph.add`, remove, configure, and clear coordinate instances
  and stores; dedicated stores enforce collision boundaries.
- **Lifecycle:** root clear drops the workflow bucket; owner clear detaches one
  graph without deleting sibling owners in the same root.
- **Risks:** **dual registries remain:** live object collections in `LGraph` and
  plain records/indexes in stores must attach and detach atomically.
- **Desired endpoint:** one explicit lifecycle coordinator maintains graph
  instances as compatibility shells while stores own domain data.

### ID allocation state

- **Authority:** serialized `LGraph.state` owns mutable node, link, group, and
  reroute allocation counters shared through the root graph.
- **Reads and persistence:** mint/observe helpers mutate ambient counters;
  configure restores them and graph serialization emits them. Compatibility
  setters and clipboard/import paths can assign or increment them directly.
- **Risk:** future durable identity depends on mutable class state outside its
  own authority, so creation and import paths can allocate inconsistently.
- **Desired endpoint:** workflow identity ownership behind one mutation
  boundary, with creation and import receiving deterministic assigned IDs.

### Durable graph and subgraph definitions

- **Authority:** `LGraph` owns ordered node/group membership, graph metadata,
  `config`, `extra`, `revision`, and the subgraph registry. `Subgraph` owns durable name,
  description, and ordered input/output/widget definitions.
- **Reads and persistence:** graph algorithms and renderers traverse live
  collections; `LGraph.asSerialisable` and subgraph serialization walk those
  objects directly.
- **Writes:** graph and subgraph methods mutate live arrays, maps, and metadata.
  There is no plain store record or serializable mutation boundary for these
  concerns.
- **Risk:** these classes are authorities, not only compatibility shells. The
  workflow cannot yet be reconstructed or serialized from dedicated stores.
- **Desired endpoint:** store-owned plain graph-definition records with live
  collections retained as runtime adapters.

### Graph invalidation revision

- **Authority:** mutable `LGraph._version` is incremented directly from graph,
  node, canvas, widget, slot, and subgraph mutation paths.
- **Risk:** invalidation is neither derived from authoritative store revisions
  nor emitted once at a committed workflow transaction boundary. Callers can
  miss, duplicate, or expose intermediate increments.
- **Desired endpoint:** derive concern revisions or emit one workflow revision
  after a successful mutation batch; retain `_version` only as a compatibility
  projection.

### Extension-controlled persistence hooks

- **Authority channel:** `LGraphNode.onSerialize` and `LGraph.onSerialize` can
  mutate complete node and workflow DTOs after canonical fields are assembled.
  Generic node configuration copies almost every serialized field onto the live
  class before `node.onConfigure`; graph configuration similarly exposes the
  input workflow and later invokes `graph.onConfigure`.
- **Risk:** these are unbounded durable mutation channels. Extensions can
  replace store-backed fields without a schema, ownership checks, validation,
  deterministic replay, transaction integration, or defined undo behavior.
- **Desired endpoint:** keep compatibility at a controlled serialization
  adapter, isolate namespaced extension payloads as validated copied plain data,
  and prevent hooks from mutating canonical workflow fields. A command/replay
  contract for extension payload changes is deferred beyond this phase.

### Unknown-node fallback records

- **Authority:** when a node type cannot be instantiated, the live node's
  `last_serialization` retains the complete opaque serialized record.
- **Reads and persistence:** `LGraphNode.serialize` returns this record instead
  of serializing current store-backed shell, slot, widget, and render state.
- **Writes:** workflow load, subgraph unpack, and API loading assign or patch
  the class field directly.
- **Risk:** one class-owned shadow record can override every migrated component
  at save time and lacks store ownership, scoped cleanup, or a command boundary.
- **Desired endpoint:** a scoped opaque serialized-node component with explicit
  ID remapping, replacement transfer, mutation, and teardown; keep the class
  field only as a facade.

### Execution order

- **Authority:** `computeExecutionOrder` derives scheduling order from topology
  and writes `LGraphNode.order`; configure also restores serialized `order`, and
  serialization emits it again.
- **Risk:** nominally derived scheduling data can behave as independently
  durable class state and bypass topology-derived recomputation.
- **Desired endpoint:** classify order as a derived projection. Either discard
  loaded values and recompute, or retain them only as explicit wire
  compatibility without a public mutation channel.

## Execution output and preview state

- **Authority:** `app.nodeOutputs` and `app.nodePreviewImages` remain legacy
  authorities mirrored by `nodeOutputStore`; some load paths assign the app
  maps directly. Legacy rendering also projects output into `node.imgs`,
  `node.images`, and `node.imageIndex`.
- **Reads:** Vue/store consumers use store getters, while legacy and loading
  paths still read or write the app and node fields.
- **Writes:** store actions update both Pinia refs and app maps; job loading can
  bypass the store.
- **Risk:** direct legacy writes can leave store consumers stale, so output and
  preview rendering do not yet have one authority.
- **Desired endpoint:** canonical output and preview maps in
  `nodeOutputStore`, with app and node fields as compatibility projections.

## Renderer projections still backed by live objects

- **Node order:** layout owns `zIndex`, while legacy drawing also depends on
  `LGraph._nodes` order. `bringToFront` updates both; `sendToBack` updates only
  the legacy array. Renderer switching sorts the array from layout state.
- **Minimap:** topology is owner-filtered from `linkStore`, but geometry comes
  through live node/group facades and execution state uses definition
  locators. The former renderer-specific minimap data-source split is removed.
- **Widgets:** Vue starts from store-owned `WidgetId[]` order, filters against
  live `node.widgets`, reconstructs connection metadata from `linkStore`, and
  invokes live widget callbacks as behavior adapters.
- **Errors:** Vue derives node and widget errors from error stores, including
  promoted-widget and container resolution. `node.has_errors` is an untracked
  legacy-canvas projection synchronized by app hooks. Input
  `SlotBase.hasErrors` is another mutable legacy drawing projection populated
  by the same synchronization path.
- **Risk:** z-order is a true competing rendering authority; widget existence,
  schema, callbacks, and node/slot legacy error flags remain class-side bridge
  inputs.
- **Desired endpoint:** render snapshots from store-owned durable data, with
  live callbacks isolated to explicit interaction and extension adapters.

## Transient view geometry

- **Authority:** `layoutStore` plain maps and spatial indexes own link paths,
  link segments, slot bounds, and projected reroute hit-test geometry;
  `canvasStore` owns current graph, selection, zoom, and canvas view state.
- **Compatibility view/mirror:** LiteGraph canvas fields and render-link objects
  hold frame/interactions views; DOM widget positioning is in `domWidgetStore`.
- **Reads:** canvas draw, hover, hit testing, link interaction, Vue overlays,
  and selection toolbox positioning.
- **Writes:** renderer synchronization calls `update*Layout` / clear methods;
  canvas interactions update view stores and temporary render objects.
- **Lifecycle:** rebuilt or cleared on render/configuration/graph switch;
  DOM widgets register/unregister or activate/deactivate separately.
- **Derivation:** Vue slot positions combine a measured DOM-relative offset
  with the reactive root-scoped node layout. Node movement invalidates the
  slot cache from the durable layout authority rather than synchronizing a
  second node position.
- **Risks:** this geometry is intentionally not Yjs-backed or durable. Calling
  it authoritative without the “transient view” qualifier would imply a second
  layout source; stale caches can still produce visual/hit-test disagreement.
- **Desired endpoint:** derive and invalidate transient geometry from durable
  layout/topology plus viewport state; never serialize or CRDT-replicate caches.

## Dual-source boundaries

1. Node, link, and reroute class fields generally share store proxies and are
   compatibility views, not duplicate state.
2. Widget store state/order, `LGraphNode.widgets`, and serialized
   `widgets_values` shadows are genuine competing representations during
   migration.
3. Slot data/order remains class-array authority while slot connectivity is
   separately authoritative in `linkStore`.
4. `LGraph` object registries and dedicated plain-data stores coexist and rely
   on graph lifecycle chokepoints.
5. `boxcolor` remains class-owned durable node visual state.
6. Graph invalidation `_version` and durable graph metadata remain directly
   class-owned.
7. Serialized allocation counters remain mutable class-owned workflow state.
8. Unknown-node `last_serialization` can shadow the complete store-backed node
   record during persistence.
9. Execution order is topology-derived but also class-owned and persisted.
10. Output and preview maps are mirrored between `nodeOutputStore` and legacy
    app/node fields.
11. Node z-order and legacy `_nodes` ordering can independently affect visible
    stacking.
12. Durable entity geometry is Yjs-backed; link/slot/hit-test geometry is a
    separate transient cache, not durable authority.

Related design documents are [Node Data Store](../node-data-store.md),
[Link Topology Store](../link-topology-store.md),
[Reroute Chain Store](../reroute-chain-store.md), and
[Output Slot Connectivity](../output-slot-connectivity.md).
