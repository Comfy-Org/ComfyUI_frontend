/**
 * Composable for syncing LiteGraph with the Layout system
 *
 * Implements one-way sync from Layout Store to LiteGraph.
 * The layout store is the single source of truth.
 */
import { onUnmounted, ref } from 'vue'

import type { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'

/**
 * Composable for syncing LiteGraph with the Layout system
 * This replaces the bidirectional sync with a one-way sync
 */
export function useLayoutSync() {
  const unsubscribe = ref<() => void>()

  /**
   * Start syncing from Layout → LiteGraph
   */
  function startSync(canvas: ReturnType<typeof useCanvasStore>['canvas']) {
    if (!canvas?.graph) return

    // Cancel last subscription
    stopSync()
    // Subscribe to layout changes
    unsubscribe.value = layoutStore.onChange((change) => {
      const graph = canvas.graph
      if (!graph) return

      // Apply changes to LiteGraph regardless of source.
      // The layout store is the single source of truth;
      // this is a one-way projection: store → LiteGraph.
      for (const nodeId of change.nodeIds) {
        const layout = layoutStore.getNodeLayoutRef(nodeId).value
        if (!layout) continue

        const liteNode = graph.getNodeById(parseInt(nodeId))
        if (!liteNode) continue

        // Use applyStoreProjection to write directly to backing arrays
        // without triggering pos/size setters (which would write back
        // to the store and create a feedback loop).
        liteNode.applyStoreProjection(layout.position, layout.size)
      }

      // Sync render order when z-index changes
      if (change.operation.type === 'setNodeZIndex') {
        const zIndexMap = new Map(
          graph._nodes.map((n) => [
            n.id,
            layoutStore.getNodeLayoutRef(String(n.id)).value?.zIndex ?? 0
          ])
        )
        graph._nodes.sort(
          (a, b) => (zIndexMap.get(a.id) ?? 0) - (zIndexMap.get(b.id) ?? 0)
        )
      }

      // Trigger single redraw for all changes
      canvas.setDirty(true, true)
    })
  }

  function stopSync() {
    unsubscribe.value?.()
    unsubscribe.value = undefined
  }

  onUnmounted(stopSync)

  return {
    startSync,
    stopSync
  }
}
