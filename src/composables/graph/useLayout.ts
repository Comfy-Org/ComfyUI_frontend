/**
 * Main composable for accessing the layout system
 *
 * Provides unified access to the layout store and mutation API.
 */
import { layoutMutations } from '@/services/layoutMutations'
import { layoutStore } from '@/stores/layoutStore'
import type { Bounds, NodeId, Point } from '@/types/layoutTypes'

/**
 * Main composable for accessing the layout system
 */
export function useLayout() {
  return {
    // Store access
    store: layoutStore,

    // Mutation API
    mutations: layoutMutations,

    // Reactive accessors
    getNodeLayoutRef: (nodeId: NodeId) => layoutStore.getNodeLayoutRef(nodeId),
    getAllNodes: () => layoutStore.getAllNodes(),
    getNodesInBounds: (bounds: Bounds) => layoutStore.getNodesInBounds(bounds),

    // Non-reactive queries (for performance)
    queryNodeAtPoint: (point: Point) => layoutStore.queryNodeAtPoint(point),
    queryNodesInBounds: (bounds: Bounds) =>
      layoutStore.queryNodesInBounds(bounds)
  }
}
