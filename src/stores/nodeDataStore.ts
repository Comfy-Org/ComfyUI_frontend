import { defineStore } from 'pinia'
import { reactive, ref, toRaw } from 'vue'

import type { NodeId } from '@/types/nodeId'
import type { NodeState } from '@/types/nodeState'
import type { UUID } from '@/utils/uuid'

/**
 * Node shell-state store. Holds one plain {@link NodeState} per node in
 * root-graph-scoped buckets keyed by {@link NodeId}; the {@link LGraphNode}
 * adopts the returned reactive proxy as its `_state`. Node-id uniqueness across
 * sibling subgraph definitions is guaranteed by the load-time dedup pass, so a
 * single root-graph bucket is safe. See docs/architecture/node-data-store.md.
 */
export const useNodeDataStore = defineStore('nodeData', () => {
  const graphNodeStates = ref(new Map<UUID, Map<NodeId, NodeState>>())

  function getGraphNodes(rootGraphId: UUID): Map<NodeId, NodeState> {
    const existing = graphNodeStates.value.get(rootGraphId)
    if (existing) return existing

    const next = reactive(new Map<NodeId, NodeState>())
    graphNodeStates.value.set(rootGraphId, next)
    return next
  }

  /**
   * Registers a node's shell state.
   *
   * Refuses to overwrite a registration held by a different node: silent
   * last-wins would let a throwaway node hijack a live node's entry, leaving
   * the live owner unable to update or vacate it. The refused caller keeps its
   * own (untracked) state. To hand an id to another node, the registered owner
   * must vacate first via {@link deleteNode}.
   *
   * @returns The store-held reactive state — callers keep it as their live
   * state object so later field writes are tracked — or `state` unchanged when
   * registration was refused.
   */
  function registerNode(rootGraphId: UUID, state: NodeState): NodeState {
    const bucket = getGraphNodes(rootGraphId)
    const existing = bucket.get(state.id)
    if (existing && toRaw(existing) !== toRaw(state)) {
      console.warn(
        `[nodeDataStore] Node ${state.id} is already registered in graph ${rootGraphId}; refusing to overwrite the live registration.`
      )
      return state
    }
    bucket.set(state.id, state)
    return bucket.get(state.id)!
  }

  function getNode(rootGraphId: UUID, nodeId: NodeId): NodeState | undefined {
    return graphNodeStates.value.get(rootGraphId)?.get(nodeId)
  }

  /** Node states of a single owning (sub)graph within a root bucket. */
  function getGraphNodesFor(
    rootGraphId: UUID,
    owningGraphId: UUID
  ): NodeState[] {
    const bucket = graphNodeStates.value.get(rootGraphId)
    if (!bucket) return []
    const result: NodeState[] = []
    for (const state of bucket.values()) {
      if (state.graphId === owningGraphId) result.push(state)
    }
    return result
  }

  /** Removes a node's registration; only the registered state may vacate it. */
  function deleteNode(rootGraphId: UUID, state: NodeState): boolean {
    const bucket = graphNodeStates.value.get(rootGraphId)
    if (!bucket) return false
    if (toRaw(bucket.get(state.id)) !== toRaw(state)) return false
    return bucket.delete(state.id)
  }

  function clearGraph(rootGraphId: UUID): void {
    graphNodeStates.value.delete(rootGraphId)
  }

  return {
    registerNode,
    getNode,
    getGraphNodesFor,
    deleteNode,
    clearGraph
  }
})
