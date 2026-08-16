# ECS Decision Traceability

Status: Current implementation audit
Verified: 2026-08-16 against PR 14246

This document traces the implementation on `feature/ecs-migration` to the
principles recorded in [ADR 0003](../adr/0003-crdt-based-layout-system.md) and
[ADR 0008](../adr/0008-entity-component-system.md). The ADRs remain the
decision records; this is an implementation audit, not a replacement decision
or a proposal.

Status meanings:

- **Implemented** — the observed implementation satisfies the principle for
  its stated scope.
- **Partial** — an authoritative path exists, but legacy or uncovered concerns
  remain.
- **Remaining** — the decision is not materially implemented.
- **Superseded** — an ADR detail was replaced by a documented amendment.

For ownership by state concern, see the
[ECS State Authority Audit](ecs-state-authority-audit.md). Target descriptions
remain in [ECS Target Architecture](ecs-target-architecture.md), and sequencing
is recorded in [ECS Migration Plan](ecs-migration-plan.md).

## Traceability matrix

| Principle                                                       | Status                                                          | Implementation                                                                                                                                                                                              | Verification evidence                                                                                                                                                   | Concrete remaining work                                                                                                                                                                                    |
| --------------------------------------------------------------- | --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dedicated stores rather than a single World                     | **Implemented; original World superseded**                      | `useNodeDataStore`, `useWidgetValueStore`, `useLinkStore`, `useRerouteStore`, `layoutStore`, `useDomWidgetStore`, `useNodeOutputStore`, `useSubgraphNavigationStore`, and `usePreviewExposureStore`         | Store tests cover registration, identity collisions, graph isolation, queries, and cleanup; ADR 0008's 2026-06-19 amendment explicitly replaces `world/*`               | Continue moving the concerns still owned by LiteGraph classes; do not recreate a universal registry                                                                                                        |
| Plain-data components                                           | **Partial**                                                     | `NodeState`, `LinkTopology`, `RerouteChain`, widget state, layout records, and `BadgeData` are data records; stores and systems own their behavior                                                          | `nodeDataStore`, `linkStore`, and `rerouteStore` register records and return reactive proxies; `computeBadges` accepts and returns plain data                           | Extract slot data and remaining link visual/runtime state; `NodeInputSlot`, `NodeOutputSlot`, `LLink`, and widgets still contain behavior                                                                  |
| Behavior in systems                                             | **Partial**                                                     | `badgeSystem.computeBadges` is pure; `useLayoutMutations`, `graphLayoutAttachment`, `slotLinks`, and store actions isolate some behavior                                                                    | `badgeSystem.test.ts`, layout operation tests, link/reroute store tests, and slot-link tests exercise behavior without a renderer                                       | Move serialization, execution, connectivity orchestration, and render orchestration out of `LGraphNode`, `LGraph`, and `LGraphCanvas`; the ADR 0008 named systems are not generally present                |
| Command-driven mutation                                         | **Partial**                                                     | `LayoutOperation`, `layoutStore.applyOperation` / `applyOperations`, `useLayoutMutations`, and geometry attachment functions route layout writes through explicit operations                                | `layoutStore.test.ts` and `layoutMutations.test.ts` verify operation handling and batches; all Yjs layout mutations occur in store transactions                         | Define serializable command boundaries for node data, links, reroutes, widgets, slots, and graph lifecycle; their current store/class mutators are imperative and are not replayable commands              |
| Graph and workflow scope                                        | **Implemented for migrated stores**                             | `GraphScope`, `RootGraphId`, `OwningGraphId`, `graphScopeOf`; root buckets plus owner indexes in node/link/reroute stores; scoped layout keys; graph-prefixed `WidgetId`                                    | Store tests cover root isolation, owner-local queries, duplicate IDs, and subgraph cases; browser coverage includes subgraph serialization and link identity collisions | Normalize older stores whose scope/key conventions differ; keep mutable state instance-scoped if linked subgraph definitions become shared                                                                 |
| Entity lifecycle follows graph lifecycle                        | **Implemented for migrated concerns**                           | `LGraph.add` / `remove` register and unregister node, topology, reroute, and geometry state; `clearOwner`, `clearGraph`, `attach*Layout`, `detach*Layout`, and `detachGraphLayouts` perform teardown        | Identity-checked deletion tests prevent one instance vacating another's key; graph clear and replacement tests cover teardown and transfer                              | Remove lifecycle ownership from `LGraph` only when a replacement coordinator exists; audit transient DOM widgets and compatibility registries for the same owner-scoped teardown guarantees                |
| God-object reduction                                            | **Partial**                                                     | Node shell, geometry, topology, reroute chains, widget values/order, and badge derivation have moved behind stores or systems                                                                               | `NodeState` proxy drilling removed renderer mirrors; slot arrays are reactive by construction; topology reads use `slotLinks`                                           | `LGraphNode`, `LGraph`, and `LGraphCanvas` still coordinate slots, widgets, mutation, serialization, execution, drawing, and input; extract only behind real consumers and parity tests                    |
| Extension behavior and serialization preserved during migration | **Partial**                                                     | Legacy class accessors adopt store proxies; `input.link` and `output.links` remain deprecated derived reads; class mutation APIs remain compatibility entry points; existing workflow format remains in use | LiteGraph serialization/configuration, extension, widget, clipboard, replacement, and browser tests exercise old surfaces; deprecation tests cover slot mirrors         | Publish and complete migrations for direct slot writes and node property enumeration; preserve callbacks and old workflow loading while removing mirrors; no proof covers the entire custom-node ecosystem |
| CRDT-backed centralized layout                                  | **Implemented for persistent entity geometry; partial overall** | Yjs owns node, group, and reroute geometry in `LayoutStoreImpl`; scoped keys, observers, geometry views, and `LayoutOperation` provide renderer-independent updates                                         | `layoutStore.test.ts`, geometry-view tests, layout mutation tests, and Vue-node layout browser tests cover reads, writes, synchronization, and subgraphs                | Link paths, slot bounds, and other hit-test geometry remain transient plain maps; reintroduce transport APIs only when collaboration has a caller; undo/redo remains snapshot-based                        |

## Observed boundaries

- “Single source of truth” is per concern and workflow instance. It does not
  mean one global store.
- The proxy-returning registration pattern avoids a second copy for node shell,
  link topology, reroute chain, and widget state. A class accessor over the
  registered proxy is a compatibility view, not another authority.
- Layout command coverage must not be generalized to all ECS mutation. The
  other stores expose direct actions, and graph operations still coordinate
  imperative class callbacks.
- Yjs currently supplies mergeable layout state and notifications, not an
  application operation log. ADR 0003's amendment records removal of the
  unused history and transport seams.
- Badges intentionally have no authoritative store. `badgeSystem` derives
  transient `BadgeData` from authoritative settings, definitions, topology,
  pricing, widget, and graph state.
- The migration preserves extension-facing object surfaces, but compatibility
  has costs: enumerable node shell fields changed to accessors, direct slot
  mirror writes are ignored, and callback preservation remains a release
  constraint.

## Reference records

- [ADR 0003: Centralized Layout Management with CRDT](../adr/0003-crdt-based-layout-system.md)
- [ADR 0008: Entity Component System](../adr/0008-entity-component-system.md)
- [Node Data Store](node-data-store.md)
- [Link Topology Store](link-topology-store.md)
- [Reroute Chain Store](reroute-chain-store.md)
- [Node Badge Store design history](node-badge-store.md)
- [Output Slot Connectivity](output-slot-connectivity.md)
