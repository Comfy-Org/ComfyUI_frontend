/**
 * qa-59 bridge: gives agent-added nodes a live `LGraphNode` adapter.
 *
 * `graphMutations.ts` (the pure, litegraph-free op layer — see CRDT KEEP-ALIVE
 * #3) only ever writes `useNodeDataStore`/`useWidgetValueStore`/the layout
 * port for a remote `add_node`. It never constructs an `LGraphNode` or calls
 * `LGraph.add()`, because it cannot import either without breaking the
 * op-layer's DOM/litegraph-free purity guarantee. The result: an agent-added
 * node renders (the canvas is store-driven) but has no entry in
 * `LGraph._nodes`, so every `serialize()` hits the adapter/state mismatch
 * branch in `serialiseStoredNodes()` and silently drops the node — see
 * `LGraph.test.ts` "drops an agent-added node from serialize() ... (qa-59)".
 *
 * This module is the FE-only, app-context-aware seam that closes the gap. It
 * intentionally lives next to `useAgentCrdtFollower.ts` (already Vue/app-layer
 * code, already owns the `EcsFollowerAdapter` instance) rather than inside the
 * op layer.
 *
 * Approach: rather than trying to make `LGraphNode` adopt the *existing*
 * store `NodeState` in place (risky — `LGraphNode`'s constructor builds a
 * fresh `_state` and its input/output slot views are bound to that object's
 * `inputs`/`outputs` arrays by reference, so swapping `_state` post-
 * construction risks desyncing those views), this deletes the store-only
 * record for the id and lets the normal `node.configure()` +
 * `attachNodeToStores` + `graph.add()` path recreate it from
 * `NodeState.lastSerialization` — which IS the semantic payload that produced
 * the current store state, so the recreated record is equivalent. That keeps
 * every write on a single, already-tested code path instead of adding a
 * second one, and reuses `attachNodeLayout`'s existing "layout already
 * exists → adopt, don't recreate" branch (`graphLayoutAttachment.ts`) instead
 * of duplicating that logic here.
 *
 * Ordering is rollback-safe: `node.configure()` (which runs node-class /
 * extension code and can throw) happens BEFORE the store record is deleted;
 * the store record is only cleared once `configure()` has already succeeded,
 * immediately ahead of `graph.add()` (whose own failure, e.g.
 * `MAX_NUMBER_OF_NODES`, is caught and the record restored). A throw from
 * either fallible step leaves the authoritative store state exactly as it
 * was, so the node is never dropped from both the live graph and the store
 * at once — it just stays store-only and is retried on the next frame.
 */
import { LiteGraph } from '@/lib/litegraph/src/litegraph'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import { useNodeDataStore } from '@/stores/nodeDataStore'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import { graphScopeOf } from '@/types/graphScopeId'
import { parseNodeId } from '@/types/nodeId'

/** The graph surface this module needs — mirrors `MintableGraph` in
 * `mintPortWiring.ts` so the two DI shapes stay compatible for callers that
 * already hold a `getGraph()` closure. */
export interface MaterializableGraph {
  id: string
  rootGraph: { id: string }
  getNodeById(id: ReturnType<typeof parseNodeId>): LGraphNode | null
  add(node: LGraphNode): LGraphNode | null | undefined
}

/**
 * For every id in `nodeIds` that the ECS store knows about but `graph` does
 * not yet have a live adapter for, constructs one and attaches it. Ids that
 * already have a live adapter, or that the store no longer has (e.g. deleted
 * by a later frame in the same batch), are skipped silently — this runs
 * after every applied frame, so a node that legitimately isn't there yet
 * will be picked up on its own frame.
 *
 * Returns the ids actually materialized, for callers that want to log/test.
 */
export function materializeMissingAdapters(
  graph: MaterializableGraph,
  nodeIds: Iterable<string>
): string[] {
  const scope = graphScopeOf(graph)
  const nodeDataStore = useNodeDataStore()
  const widgetValueStore = useWidgetValueStore()
  const materialized: string[] = []

  for (const rawId of nodeIds) {
    const nodeId = parseNodeId(rawId)
    if (nodeId === null) continue
    // `LGraph.getNodeById` indexes `_nodes_by_id` directly and returns
    // `undefined` for an absent id despite its `LGraphNode | null` type, so
    // this must be a falsiness check, not `!== null` (which is always true
    // for `undefined` and made this whole function a no-op in production).
    if (graph.getNodeById(nodeId)) continue // already has a live adapter

    const state = nodeDataStore.getNode(scope.rootGraphId, nodeId)
    if (!state) continue // store no longer has it (deleted later in the batch)
    if (state.graphId !== scope.owningGraphId) continue // lives in a different (sub)graph

    const serialised = state.lastSerialization
    if (!serialised) continue

    const node = LiteGraph.createNode(state.type, state.title)
    if (!node) continue // unregistered node type — nothing to materialize

    // `configure()` runs extension/node-class code (`onConfigure`, and
    // `graph.add()` below can trigger `onConnectionsChange`) and can throw —
    // do this BEFORE touching the store so a throw here leaves the
    // authoritative record untouched.
    try {
      node.configure(serialised)
    } catch {
      continue // leaves the store-only record in place; retried next frame
    }
    node.id = nodeId

    // The store record this node is about to recreate is the ONLY thing
    // standing in the way of `attachNodeToStores`'s registration succeeding
    // with the CRDT-assigned id (`registerNode` sees an incumbent at this id
    // and returns undefined, which would otherwise force a mint-a-new-id
    // retry — wrong here, since this isn't a real collision, it's the same
    // node already having store state). Clear it only once `configure()`
    // above has already succeeded, and restore it if `graph.add()` (the
    // other fallible step, e.g. `MAX_NUMBER_OF_NODES`) throws or declines,
    // so a failure here never drops the node from the store and the save.
    nodeDataStore.deleteNode(scope, state)
    // Keyed by rootGraphId, matching every other clearNode call site in
    // graphMutations.ts's commit() (e.g. the reconcileNode-replace and
    // deleteNode branches) — widget records are bucketed per root graph,
    // not per owning (sub)graph.
    widgetValueStore.clearNode(scope.rootGraphId, nodeId)

    let added: LGraphNode | null | undefined
    try {
      added = graph.add(node)
    } catch {
      added = undefined
    }
    if (added) {
      materialized.push(rawId)
    } else {
      // Restore the authoritative record so the node isn't lost from the
      // store/save; `registerNode` accepts the same state object back
      // (`toRaw(incumbent) === toRaw(state)` in nodeDataStore.registerNode).
      nodeDataStore.registerNode(scope, state)
    }
  }

  return materialized
}
