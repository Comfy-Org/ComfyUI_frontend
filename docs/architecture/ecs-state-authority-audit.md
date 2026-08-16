# ECS State Authority Audit

Status: Current implementation audit
Verified: 2026-08-16 against PR 14246

This is an audit of observed state ownership on `feature/ecs-migration`. It
distinguishes an authoritative record from a compatibility accessor, derived
projection, or transient renderer cache. Dual sources are called out rather
than presented as completed migration.

The governing decisions remain
[ADR 0003](../adr/0003-crdt-based-layout-system.md) and
[ADR 0008](../adr/0008-entity-component-system.md). See
[ECS Decision Traceability](ecs-decision-traceability.md) for principle-level
status and [ECS Target Architecture](ecs-target-architecture.md) for the target.

## Node shell

- **Authority:** `useNodeDataStore`; one plain `NodeState` in a root-flat,
  owner-indexed bucket.
- **Compatibility view/mirror:** `LGraphNode` fields are accessors over
  `_state`, the store-returned reactive proxy. This is one object, not a copy.
- **Reads:** renderer components consume `NodeState`; legacy code reads
  `LGraphNode.title`, `mode`, colors, flags, slot arrays, and related accessors.
- **Writes:** class setters and direct proxy writes; `registerNodeState` adopts
  the proxy. These are not serializable commands.
- **Lifecycle:** `LGraph.add` registers; `LGraph.remove`, `clearOwner`, and
  `clearGraph` unregister with raw-identity checks.
- **Risks:** `LGraphNode` still owns substantial non-shell state and behavior;
  accessor fields differ from old enumerable own properties.
- **Desired endpoint:** store-owned plain node data, with class accessors only
  as an explicitly supported extension adapter until callers migrate.

## Layout

- **Authority:** Yjs maps in `LayoutStoreImpl` for node, group, and reroute
  position/size/bounds/z-order as applicable.
- **Compatibility view/mirror:** `LGraphNode`, `LGraphGroup`, and `Reroute`
  geometry accessors/views read and write the store; local tuple buffers and
  geometry versions support the legacy API and hot path.
- **Reads:** `getNodeLayoutRef`, geometry queries, `createGeometryView`, canvas
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
  by legacy drawing and extension APIs. **This is dual representation:** store
  order and class array order require reconciliation.
- **Reads:** store getters power Vue/UI/pricing paths; legacy renderer,
  serialization, and extensions read widget instances and `node.widgets`.
- **Writes:** `registerWidget`, `setValue`, `setNodeWidgetOrder`, deletion, and
  legacy widget/class APIs.
- **Lifecycle:** widget construction/attachment registers; removal unregisters;
  graph teardown calls `clearGraph`.
- **Risks:** renames and reordering can diverge across the store order and
  object array; promoted widgets have host-boundary identity rules.
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
- **Risks:** this geometry is intentionally not Yjs-backed or durable. Calling
  it authoritative without the “transient view” qualifier would imply a second
  layout source; stale caches can still produce visual/hit-test disagreement.
- **Desired endpoint:** derive and invalidate transient geometry from durable
  layout/topology plus viewport state; never serialize or CRDT-replicate caches.

## Summary of dual-source boundaries

1. Node, link, and reroute class fields generally share store proxies and are
   compatibility views, not duplicate state.
2. Widget store order and `LGraphNode.widgets` are genuine dual
   representations during migration.
3. Slot data/order remains class-array authority while slot connectivity is
   separately authoritative in `linkStore`.
4. `LGraph` object registries and dedicated plain-data stores coexist and rely
   on graph lifecycle chokepoints.
5. Durable entity geometry is Yjs-backed; link/slot/hit-test geometry is a
   separate transient cache, not durable authority.

Design details: [Node Data Store](node-data-store.md),
[Link Topology Store](link-topology-store.md),
[Reroute Chain Store](reroute-chain-store.md), and
[Output Slot Connectivity](output-slot-connectivity.md).
