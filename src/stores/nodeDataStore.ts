import { defineStore } from 'pinia'
import { reactive } from 'vue'

import { toOwningGraphId, toRootGraphId } from '@/types/graphScopeId'
import type { NodeState } from '@/types/nodeState'
import type { UUID } from '@/utils/uuid'

import { createGraphScopedBuckets } from './graphScopedBuckets'

/**
 * One {@link NodeState} per node in root-and-owner-scoped buckets. Membership
 * is by state identity, so renumbering a registered node cannot strand it.
 * See docs/architecture/node-data-store.md.
 */
export const useNodeDataStore = defineStore('nodeData', () => {
  const buckets = createGraphScopedBuckets({
    createBucket: () => reactive(new Set<NodeState>()),
    isEmpty: (bucket) => bucket.size === 0
  })

  function scope(rootGraphId: UUID, owningGraphId: UUID) {
    return {
      rootGraphId: toRootGraphId(rootGraphId),
      owningGraphId: toOwningGraphId(owningGraphId)
    }
  }

  function registerNode(rootGraphId: UUID, state: NodeState): void {
    buckets.getOrCreate(scope(rootGraphId, state.graphId)).add(state)
  }

  function getGraphNodesFor(
    rootGraphId: UUID,
    owningGraphId: UUID
  ): NodeState[] {
    return [...(buckets.get(scope(rootGraphId, owningGraphId)) ?? [])]
  }

  function deleteNode(rootGraphId: UUID, state: NodeState): boolean {
    const graphScope = scope(rootGraphId, state.graphId)
    const bucket = buckets.get(graphScope)
    if (!bucket?.delete(state)) return false
    buckets.prune(graphScope, bucket)
    return true
  }

  function clearGraph(rootGraphId: UUID): void {
    buckets.clearRoot(toRootGraphId(rootGraphId))
  }

  return {
    clearGraph,
    deleteNode,
    getGraphNodesFor,
    registerNode
  }
})
