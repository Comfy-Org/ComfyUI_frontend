import { defineStore } from 'pinia'
import { reactive, toRaw } from 'vue'

import { toOwningGraphId, toRootGraphId } from '@/types/graphScopeId'
import type {
  GraphScope,
  OwningGraphId,
  RootGraphId
} from '@/types/graphScopeId'
import type { NodeState } from '@/types/nodeState'
import type { NodeId } from '@/types/nodeId'
import type { UUID } from '@/utils/uuid'

/**
 * One {@link NodeState} per node in a root-flat, owner-indexed bucket.
 * See docs/architecture/node-data-store.md.
 */
export const useNodeDataStore = defineStore('nodeData', () => {
  interface RootNodeBucket {
    byOwner: Map<OwningGraphId, Map<NodeId, NodeState>>
  }

  const roots = reactive(new Map<RootGraphId, RootNodeBucket>())

  function rootBucket(rootGraphId: RootGraphId): RootNodeBucket {
    const existing = roots.get(rootGraphId)
    if (existing) return existing
    const created = reactive<RootNodeBucket>({
      byOwner: new Map()
    })
    roots.set(rootGraphId, created)
    return created
  }

  function scope(rootGraphId: UUID, owningGraphId: UUID) {
    return {
      rootGraphId: toRootGraphId(rootGraphId),
      owningGraphId: toOwningGraphId(owningGraphId)
    }
  }

  function registerNode(
    graphScope: GraphScope,
    state: NodeState
  ): NodeState | undefined {
    const existingBucket = roots.get(graphScope.rootGraphId)
    const ownerNodes = existingBucket?.byOwner.get(graphScope.owningGraphId)
    const incumbent = ownerNodes?.get(state.id)
    if (incumbent && toRaw(incumbent) === toRaw(state)) return incumbent
    if (incumbent) return undefined
    for (const nodes of existingBucket?.byOwner.values() ?? []) {
      for (const registered of nodes.values()) {
        if (toRaw(registered) === toRaw(state)) return undefined
      }
    }
    const bucket = existingBucket ?? rootBucket(graphScope.rootGraphId)
    const registered: NodeState = reactive(
      Object.assign(state, { graphId: graphScope.owningGraphId })
    )
    const nodes = ownerNodes ?? reactive(new Map<NodeId, NodeState>())
    nodes.set(registered.id, registered)
    if (!ownerNodes) bucket.byOwner.set(graphScope.owningGraphId, nodes)
    return registered
  }

  function getGraphNodesFor(
    rootGraphId: UUID,
    owningGraphId: UUID
  ): NodeState[] {
    const graphScope = scope(rootGraphId, owningGraphId)
    const bucket = roots.get(graphScope.rootGraphId)
    const nodes = bucket?.byOwner.get(graphScope.owningGraphId)
    return nodes ? [...nodes.values()] : []
  }

  function ownsNode(graphScope: GraphScope, state: NodeState): boolean {
    const registered = roots
      .get(graphScope.rootGraphId)
      ?.byOwner.get(graphScope.owningGraphId)
      ?.get(state.id)
    return toRaw(registered) === toRaw(state)
  }

  function deleteNode(graphScope: GraphScope, state: NodeState): boolean {
    const bucket = roots.get(graphScope.rootGraphId)
    const nodes = bucket?.byOwner.get(graphScope.owningGraphId)
    const registered = nodes?.get(state.id)
    if (!bucket || !nodes || toRaw(registered) !== toRaw(state)) return false
    nodes.delete(state.id)
    if (nodes.size === 0) bucket.byOwner.delete(graphScope.owningGraphId)
    if (bucket.byOwner.size === 0) roots.delete(graphScope.rootGraphId)
    return true
  }

  function clearGraph(rootGraphId: UUID): void {
    roots.delete(toRootGraphId(rootGraphId))
  }

  function clearOwner(graphScope: GraphScope): void {
    const bucket = roots.get(graphScope.rootGraphId)
    if (!bucket) return
    bucket.byOwner.delete(graphScope.owningGraphId)
    if (bucket.byOwner.size === 0) roots.delete(graphScope.rootGraphId)
  }

  return {
    clearOwner,
    clearGraph,
    deleteNode,
    getGraphNodesFor,
    ownsNode,
    registerNode
  }
})
