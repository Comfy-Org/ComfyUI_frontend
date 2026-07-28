import { defineStore } from 'pinia'
import { reactive, ref } from 'vue'

import type { NodeState } from '@/types/nodeState'
import type { UUID } from '@/utils/uuid'

/**
 * Node shell-state store. Holds one plain {@link NodeState} per node in
 * root-graph-scoped buckets; the {@link LGraphNode} adopts the returned reactive
 * proxy as its `_state`. Membership is by state identity, not by node id, so a
 * node that is renumbered while registered cannot strand its entry.
 * See docs/architecture/node-data-store.md.
 */
export const useNodeDataStore = defineStore('nodeData', () => {
  const graphNodeStates = ref(new Map<UUID, Set<NodeState>>())

  function getGraphNodes(rootGraphId: UUID): Set<NodeState> {
    const existing = graphNodeStates.value.get(rootGraphId)
    if (existing) return existing

    const created = reactive(new Set<NodeState>())
    graphNodeStates.value.set(rootGraphId, created)
    return created
  }

  function registerNode(rootGraphId: UUID, state: NodeState): void {
    getGraphNodes(rootGraphId).add(state)
  }

  function getGraphNodesFor(
    rootGraphId: UUID,
    owningGraphId: UUID
  ): NodeState[] {
    const bucket = graphNodeStates.value.get(rootGraphId)
    if (!bucket) return []
    return [...bucket].filter((state) => state.graphId === owningGraphId)
  }

  function deleteNode(rootGraphId: UUID, state: NodeState): boolean {
    return graphNodeStates.value.get(rootGraphId)?.delete(state) ?? false
  }

  function clearGraph(rootGraphId: UUID): void {
    graphNodeStates.value.delete(rootGraphId)
  }

  return {
    registerNode,
    getGraphNodesFor,
    deleteNode,
    clearGraph
  }
})
