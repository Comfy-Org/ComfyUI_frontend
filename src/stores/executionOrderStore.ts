import { defineStore } from 'pinia'

import type {
  GraphScope,
  OwningGraphId,
  RootGraphId
} from '@/types/graphScopeId'
import type { NodeId } from '@/types/nodeId'

export const useExecutionOrderStore = defineStore('executionOrder', () => {
  const orders = new Map<RootGraphId, Map<OwningGraphId, Map<NodeId, number>>>()

  function graphOrders(scope: GraphScope): Map<NodeId, number> {
    let root = orders.get(scope.rootGraphId)
    if (!root) {
      root = new Map()
      orders.set(scope.rootGraphId, root)
    }
    let graph = root.get(scope.owningGraphId)
    if (!graph) {
      graph = new Map()
      root.set(scope.owningGraphId, graph)
    }
    return graph
  }

  function get(scope: GraphScope, nodeId: NodeId): number | undefined {
    return orders.get(scope.rootGraphId)?.get(scope.owningGraphId)?.get(nodeId)
  }

  function set(scope: GraphScope, nodeId: NodeId, order: number): void {
    graphOrders(scope).set(nodeId, order)
  }

  function replace(scope: GraphScope, nodeIds: readonly NodeId[]): void {
    const graph = graphOrders(scope)
    graph.clear()
    nodeIds.forEach((nodeId, order) => graph.set(nodeId, order))
  }

  function remove(scope: GraphScope, nodeId: NodeId): void {
    orders.get(scope.rootGraphId)?.get(scope.owningGraphId)?.delete(nodeId)
  }

  function clearGraph(scope: GraphScope): void {
    orders.get(scope.rootGraphId)?.delete(scope.owningGraphId)
  }

  function clearRoot(rootGraphId: RootGraphId): void {
    orders.delete(rootGraphId)
  }

  return { clearGraph, clearRoot, get, remove, replace, set }
})
