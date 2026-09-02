# ECS lifecycle audit

Status: Current implementation audit
Verified: 2026-08-20 against `13a302eadda871b939b148ecb87e3d845ceefff2`

This audit records the current lifecycle rather than restating the target
architecture. The governing records are
[ADR-LAYOUT](../../adr/LAYOUT-crdt-layout-intent-and-local-measurement.md) and
[ADR-ECS](../../adr/ECS-entity-component-system.md). See also the
[decision traceability matrix](ecs-decision-traceability.md).

## Scope and ownership model

One loaded workflow has a root graph ID. Nodes, links, and reroutes in every
subgraph definition share the root bucket, but carry the ID of the graph that
directly owns them. `graphScopeOf` produces this pair. Node, link, and reroute
IDs are unique across the root. Widget and layout keys include the root graph
ID.

| Concern                | Runtime authority           | Ownership index or attachment                                            |
| ---------------------- | --------------------------- | ------------------------------------------------------------------------ |
| Node shell             | `useNodeDataStore`          | `byId` plus `idsByOwner`; `LGraphNode._graphScope`                       |
| Link topology          | `useLinkStore`              | `byId`, owner, target-slot, and origin-slot indexes; `LLink._graphScope` |
| Reroute chain          | `useRerouteStore`           | `chains` plus `idsByOwner`; `Reroute._graphScope`                        |
| Widget value/order     | `useWidgetValueStore`       | root graph ID, then `WidgetId` and node ID                               |
| Entity geometry        | `layoutStore`               | `makeScopedLayoutKey(rootGraphId, localId)` plus weak attachments        |
| Legacy graph structure | `LGraph` and entity classes | `_nodes`, `_nodes_by_id`, `_subgraphs`, groups and callbacks             |

Subgraphs are ownership scopes and reusable definitions. They are not a
separate ECS entity kind. `LGraph.rootGraph`, `graphScopeOf`, and the root
graph's shared allocation state bind nested definitions to one workflow.

## Lifecycle flow matrix

| Entity          | Create and register                                                                                                                                                                                              | Configure and read                                                                                                                                                                                                                              | Serialize                                                                                                                                                            | Remove and clear                                                                                                                                                                                                                 |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Node            | `LGraph.add` assigns or remints the ID, sets `graph`, calls `registerNodeState`, registers widgets, inserts legacy indexes, runs add callbacks, then `attachNodeLayout`.                                         | `LGraph.configure` adds every shell before calling `LGraphNode.configure`, so links and peer nodes resolve. Shell accessors read the adopted `NodeState` proxy; geometry accessors read the layout store.                                       | `LGraphNode.serialize` reads accessors, slots, properties, and widget proxies. `LGraph.asSerialisable` serializes owner-local nodes and topology.                    | `LGraph.remove` disconnects topology, releases unreachable subgraphs, runs callbacks, unregisters state and layout, nulls `graph`, then removes legacy indexes. `clear` tears down all owned graphs before resetting containers. |
| Link            | Connect paths construct `LLink`; `LGraph._addLink`, `addFloatingLink`, and store-backed `LinkMap` call `registerLinkTopology`. Registration adopts the store proxy and rejects ID or occupied-target collisions. | Endpoint getters read `_state`. Endpoint setters call `useLinkStore.updateEndpoint`; `parentId` and `type` write the proxy directly. `LinkMap` gives owner-filtered compatibility views.                                                        | `LLink.asSerialisable` reads topology state. `serialiseOwnedTopology` emits owner-local regular and floating links.                                                  | Disconnect orchestration unregisters topology before pruning reroutes. `_removeLink` also drops transient link geometry. Bulk paths call `unregisterAllLinkTopologies` or clear the root bucket.                                 |
| Reroute         | `LGraph.setReroute` allocates or observes an ID and creates a `Reroute`; `_addReroute` registers chain state, inserts the legacy map, then `materializeRerouteLayout`.                                           | Chain fields read the adopted proxy. Position reads the layout store through `createMutationView`. `linkIds` and `floatingLinkIds` are computed by `useRerouteStore.buildMembershipIndex` from link parent chains.                              | `Reroute.serialize` emits chain state and derived membership. `LGraph.asSerialisable` emits owner-local reroutes.                                                    | `removeReroute` rewires child reroutes and links before `_removeReroute` unregisters chain and layout. Disconnect also removes newly empty reroutes. Bulk teardown unregisters chains by owner or root.                          |
| Widget          | Widget constructors hold detached state. After node ID and graph ownership exist, `BaseWidget.setNodeId` calls `registerWidget` and adopts its proxy. `LGraph.add` also records node widget order.               | `BaseWidget.value` reads and writes `_state`. Named configure data restores by widget name; positional values and class-side `widgets_values` shadows remain fallbacks. Some production consumers mutate both the live widget and shadow array. | `LGraphNode.serialize` emits plain `widgets_values` and `widgets_values_named`, skipping `serialize === false`. Object values are deproxied through JSON conversion. | Individual widgets call `deleteWidget`; root `LGraph.clear` calls `widgetValueStore.clearGraph`. Normal node removal does not independently delete every widget entry.                                                           |
| Layout          | `attachNodeLayout`, `attachGroupLayout`, and `materializeRerouteLayout` adopt an existing entry or submit a serializable create operation.                                                                       | Entity geometry accessors synchronize local array views with `layoutStore`; moves and resizes submit operations. Link and slot geometry is view-scoped, derived renderer data.                                                                  | Nodes, groups, and reroutes serialize through entity accessors, not by dumping Yjs. Link/slot view geometry is not persisted.                                        | Single detach submits a delete operation. `detachGraphLayouts` batches owner-local deletes in one Yjs transaction. Root clear submits `clearGraph`; `clearViewGeometry` separately drops renderer caches and listeners.          |
| Unknown node    | Missing-type load creates a compatibility node and assigns the complete wire record to `last_serialization`.                                                                                                     | Load and API paths can patch the opaque class field directly.                                                                                                                                                                                   | `LGraphNode.serialize` returns the fallback record instead of current component projections.                                                                         | Follows live-node lifecycle only; there is no scoped store record or independent teardown.                                                                                                                                       |
| Execution order | `computeExecutionOrder` derives and assigns `node.order`.                                                                                                                                                        | Configure can also restore persisted order before recomputation.                                                                                                                                                                                | Node serialization emits order for wire compatibility.                                                                                                               | Recomputed after graph mutations; not independently cleaned or command-driven.                                                                                                                                                   |

## Concrete sequences

### Graph load and configure

1. `LGraph.configure` dispatches `configuring`, starts the named-widget shadow
   load, normalizes topology, and clears or detaches the old graph.
2. It adopts the graph ID and clears root buckets or only the current owner.
3. It registers links first, then reroutes, and normalizes subgraph definitions.
4. It creates every node shell and calls `LGraph.add` before any node configure.
5. It configures nodes in a second pass. Connection callbacks can now resolve
   peer nodes and pre-registered links; widgets restore after slots.
6. It registers floating links, removes unreachable reroutes, realigns input
   link indexes, creates groups, and updates execution order.
7. It runs proxy-widget migration, preview exposure, `onConfigure`, and canvas
   restoration. The `configured` event and shadow-load cleanup run in `finally`.

This ordering is part of the compatibility contract. Serialization,
registration, and subgraph tests require links before nodes, all nodes before
node configuration, and layout attachment before configure-time position
writes.

### Node removal

1. `LGraph.remove` rejects absent, protected, or already-removing nodes. The
   module-level `nodesBeingRemoved` weak set is the reentrancy guard.
2. `removeNode` calls `beforeChange` and dispatches `node:before-removed` while
   the node is still attached.
3. Inputs, outputs, and floating links disconnect. Unreachable subgraph
   definitions run their node lifecycles before their stores and layouts leave.
4. `node.onRemoved` runs while `node.graph` is still set.
5. Node state and layout detach, then `node.graph` becomes `null`.
6. Canvas selection and graph indexes are removed. `onNodeRemoved` and
   `node:removed` observe a detached node absent from `getNodeById`.
7. Change hooks, dirtying, and execution-order recomputation finish the flow.

`LGraph.test.ts` pins these callback observations and guards recursive removal.

### Replacement in place

`replaceWithMapping` in `useNodeReplacement` does not perform remove plus add.
It prepares the new shell, verifies legacy indexes and both ownership
attachments, runs old `onRemoved`, then calls `transferReplacementOwnership`.
That function transfers layout first and the registered `NodeState` second.
Only then does the orchestrator swap `_nodes` and `_nodes_by_id`, attach graph
references, register new widgets, restore data, reconnect mappings, and issue
the replacement callbacks. The old node receives a detached copy of state.

The preflight and second ownership check prevent a callback from silently
stealing the slot. Neither check rolls back arbitrary callback side effects or
a failure after ownership transfer.

### Clear and subgraph release

`LGraph.clear` always runs `resetAfterClear` in `finally`:

1. `teardownOwnedGraphs` snapshots root plus known subgraphs and fires node
   removal lifecycles while topology and graph references remain available.
2. Its `finally` expands ownership again, catching entities and subgraphs added
   reentrantly, then unregisters all links, reroutes, nodes, and attachments.
3. Root reset clears preview, widget, link, reroute, node, and layout buckets,
   assigns a fresh graph ID, and resets legacy containers and canvases.
4. A subgraph clear removes only that owner and submits individual layout
   deletes, preserving siblings in the shared root bucket.

Tests in `LGraph.test.ts` pin recursive callbacks, entities added during clear,
idempotent repeated clear, nested lifecycle count, selected-owner isolation,
and teardown after a callback throws. If one callback throws, later callbacks
do not run, but structural teardown completes before the error escapes.

## Remaining lifecycle hazards

- Lifecycle spans stores and legacy containers without one transaction. An
  exception can expose a partly completed remove, replacement, or configure.
- Node add publishes the node and callbacks before its layout attaches.
  `node:added` can read graph/store ownership but cannot assume geometry exists.
- Widget state is root-scoped and normal node removal does not clear all of its
  widget IDs. Reuse and replacement rely on keyed registration; stale entries
  can live until explicit widget deletion or root clear.
- Replacement has bespoke transfer semantics and no general rollback. It also
  invokes extension callbacks inside the critical ownership sequence.
- Root clear changes the graph ID after clearing stores. References retaining
  the old ID become detached by design, but consumers must not cache scope.
- Reroute removal rewires many reactive objects one at a time. Readers can see
  intermediate chains; only the final derived membership is authoritative.
- `configure(keep_old)` detaches layout attachments and reuses legacy state.
  It is not an append transaction and has weaker cleanup guarantees than clear.
- Extension callbacks remain reentrant and can mutate graph structure. The
  weak-set guard covers repeated node removal only, not arbitrary cross-entity
  mutation or callback compensation.
- Unknown-node `last_serialization` is a full class-owned persistence shadow,
  not a component-store record, and has no explicit replacement transfer or
  ID-remapping contract outside load/import code.
- Execution order is derived from topology but also restored and persisted;
  the bridge does not prevent callers from treating it as durable mutable state.

## Implementation and test references

- `src/lib/litegraph/src/LGraph.ts`: `add`, `remove`, `removeNode`, `clear`,
  `teardownOwnedGraphs`, `configure`, `asSerialisable`, `_addLink`,
  `_removeLink`, `_addReroute`, `_removeReroute`, `setReroute`, `removeReroute`
- `src/lib/litegraph/src/LGraphNode.ts`: `configure`, `serialize`,
  `registerNodeState`, `unregisterNodeState`, `transferReplacementOwnership`
- `src/lib/litegraph/src/LLink.ts`: `applyEndpointPatch`,
  `registerLinkTopology`, `unregisterAllLinkTopologies`
- `src/lib/litegraph/src/Reroute.ts`: chain and position accessors,
  `unregisterAllRerouteChains`
- `src/lib/litegraph/src/widgets/BaseWidget.ts`: `setNodeId`, `value`
- `src/renderer/core/layout/operations/graphLayoutAttachment.ts`: all entity
  attach, transfer, detach, and bulk-detach operations
- `src/platform/nodeReplacement/useNodeReplacement.ts`: `replaceWithMapping`
- Tests: `LGraph.test.ts`, `LGraphNode.nodeState.test.ts`, `LLink.store.test.ts`,
  `Reroute.store.test.ts`, `widgetValueStore.test.ts`, and
  `layoutStore.test.ts`
