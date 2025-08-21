/**
 * Composable for syncing LiteGraph with the Layout system
 *
 * Implements one-way sync from Layout Store to LiteGraph.
 * The layout store is the single source of truth.
 */
import { onUnmounted } from 'vue'

import { layoutStore } from '@/renderer/core/layout/store/LayoutStore'

/**
 * Composable for syncing LiteGraph with the Layout system
 * This replaces the bidirectional sync with a one-way sync
 */
export function useLayoutSync() {
  let unsubscribe: (() => void) | null = null

  /**
   * Start syncing from Layout system to LiteGraph
   * This is one-way: Layout → LiteGraph only
   */
  function startSync(canvas: any) {
    if (!canvas?.graph) return

    // Subscribe to layout changes
    unsubscribe = layoutStore.onChange((change) => {
      // Apply changes to LiteGraph regardless of source
      // The layout store is the single source of truth
      for (const nodeId of change.nodeIds) {
        const layout = layoutStore.getNodeLayoutRef(nodeId).value
        if (!layout) continue

        const liteNode = canvas.graph.getNodeById(parseInt(nodeId))
        if (!liteNode) continue

        // Update position if changed
        if (
          liteNode.pos[0] !== layout.position.x ||
          liteNode.pos[1] !== layout.position.y
        ) {
          liteNode.pos[0] = layout.position.x
          liteNode.pos[1] = layout.position.y
        }

        // Update size if changed
        if (
          liteNode.size[0] !== layout.size.width ||
          liteNode.size[1] !== layout.size.height
        ) {
          liteNode.size[0] = layout.size.width
          liteNode.size[1] = layout.size.height
        }

        // Update slot layouts for all changed nodes
        layoutStore.updateNodeSlotLayouts(nodeId)
      }

      // Trigger single redraw for all changes
      canvas.setDirty(true, true)
    })
  }

  /**
   * Stop syncing
   */
  function stopSync() {
    if (unsubscribe) {
      unsubscribe()
      unsubscribe = null
    }
  }

  // Auto-cleanup on unmount
  onUnmounted(() => {
    stopSync()
  })

  return {
    startSync,
    stopSync
  }
}
