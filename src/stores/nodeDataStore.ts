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
    byId: Map<NodeId, NodeState>
    idsByOwner: Map<OwningGraphId, Set<NodeId>>
  }

  const roots = reactive(new Map<RootGraphId, RootNodeBucket>())

  function rootBucket(rootGraphId: RootGraphId): RootNodeBucket {
    const existing = roots.get(rootGraphId)
    if (existing) return existing
    const created = reactive<RootNodeBucket>({
      byId: new Map(),
      idsByOwner: new Map()
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
    const incumbent = existingBucket?.byId.get(state.id)
    if (
      incumbent &&
      toRaw(incumbent) === toRaw(state) &&
      incumbent.graphId === graphScope.owningGraphId
    )
      return incumbent
    if (incumbent) return undefined
    const bucket = existingBucket ?? rootBucket(graphScope.rootGraphId)
    const registered: NodeState = reactive(
      Object.assign(state, { graphId: graphScope.owningGraphId })
    )
    bucket.byId.set(registered.id, registered)
    const ownerIds = bucket.idsByOwner.get(graphScope.owningGraphId)
    if (ownerIds) ownerIds.add(registered.id)
    else
      bucket.idsByOwner.set(
        graphScope.owningGraphId,
        reactive(new Set([registered.id]))
      )
    return registered
  }

  function getGraphNodesFor(
    rootGraphId: UUID,
    owningGraphId: UUID
  ): NodeState[] {
    const graphScope = scope(rootGraphId, owningGraphId)
    const bucket = roots.get(graphScope.rootGraphId)
    const ids = bucket?.idsByOwner.get(graphScope.owningGraphId)
    if (!bucket || !ids) return []
    return [...ids].flatMap((id) => {
      const state = bucket.byId.get(id)
      return state ? [state] : []
    })
  }

  function ownsNode(graphScope: GraphScope, state: NodeState): boolean {
    const registered = roots.get(graphScope.rootGraphId)?.byId.get(state.id)
    return (
      registered?.graphId === graphScope.owningGraphId &&
      toRaw(registered) === toRaw(state)
    )
  }

  function deleteNode(graphScope: GraphScope, state: NodeState): boolean {
    const bucket = roots.get(graphScope.rootGraphId)
    const registered = bucket?.byId.get(state.id)
    if (
      !bucket ||
      registered?.graphId !== graphScope.owningGraphId ||
      toRaw(registered) !== toRaw(state)
    )
      return false
    bucket.byId.delete(state.id)
    const ownerIds = bucket.idsByOwner.get(graphScope.owningGraphId)
    ownerIds?.delete(state.id)
    if (ownerIds?.size === 0) bucket.idsByOwner.delete(graphScope.owningGraphId)
    if (bucket.byId.size === 0) roots.delete(graphScope.rootGraphId)
    return true
  }

  function clearGraph(rootGraphId: UUID): void {
    roots.delete(toRootGraphId(rootGraphId))
  }

  function clearOwner(graphScope: GraphScope): void {
    const bucket = roots.get(graphScope.rootGraphId)
    const ids = bucket?.idsByOwner.get(graphScope.owningGraphId)
    if (!bucket || !ids) return
    for (const id of ids) bucket.byId.delete(id)
    bucket.idsByOwner.delete(graphScope.owningGraphId)
    if (bucket.byId.size === 0) roots.delete(graphScope.rootGraphId)
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
