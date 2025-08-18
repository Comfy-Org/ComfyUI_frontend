/**
 * Main composable for accessing the layout system
 *
 * Provides unified access to the layout store and mutation API.
 */
import { layoutMutations } from '@/renderer/core/layout/operations/LayoutMutations'
import { layoutStore } from '@/renderer/core/layout/store/LayoutStore'
import type { Bounds, NodeId, Point } from '@/renderer/core/layout/types'

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
