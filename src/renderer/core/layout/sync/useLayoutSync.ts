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
  const pendingNodeIds = new Set<string>()
  let rafId: number | null = null

  const flushPendingChanges = (
    canvas: ReturnType<typeof useCanvasStore>['canvas']
  ) => {
    rafId = null
    if (!canvas?.graph || pendingNodeIds.size === 0) return

    for (const nodeId of pendingNodeIds) {
      const layout = layoutStore.getNodeLayoutRef(nodeId).value
      if (!layout) continue

      const liteNode = canvas.graph.getNodeById(Number.parseInt(nodeId, 10))
      if (!liteNode) continue

      if (
        liteNode.pos[0] !== layout.position.x ||
        liteNode.pos[1] !== layout.position.y
      ) {
        liteNode.pos[0] = layout.position.x
        liteNode.pos[1] = layout.position.y
      }

      // Note: layout.size.height is the content height without title.
      // LiteGraph's measure() will add titleHeight to get boundingRect.
      // Do NOT use addNodeTitleHeight here - that would double-count the title.
      if (
        liteNode.size[0] !== layout.size.width ||
        liteNode.size[1] !== layout.size.height
      ) {
        // Update internal size directly (like position above) to avoid
        // the size setter writing back to layoutStore with Canvas source,
        // which would create a feedback loop through handleLayoutChange.
        liteNode.size[0] = layout.size.width
        liteNode.size[1] = layout.size.height
        liteNode.onResize?.(liteNode.size)
      }
    }

    pendingNodeIds.clear()
    canvas.setDirty(true, true)
  }

  /**
   * Start syncing from Layout → LiteGraph
   */
  function startSync(canvas: ReturnType<typeof useCanvasStore>['canvas']) {
    if (!canvas?.graph) return

    // Cancel last subscription
    stopSync()
    // Subscribe to layout changes
    unsubscribe.value = layoutStore.onChange((change) => {
      // Topology-only changes (links, reroutes) don't need LiteGraph
      // node writeback — link rendering reads from the store directly.
      if (change.nodeIds.length === 0) return

      change.nodeIds.forEach((nodeId) => pendingNodeIds.add(nodeId))
      if (rafId !== null) return

      rafId = requestAnimationFrame(() => {
        flushPendingChanges(canvas)
      })
    })
  }

  function stopSync() {
    if (rafId !== null) {
      cancelAnimationFrame(rafId)
      rafId = null
    }
    pendingNodeIds.clear()
    unsubscribe.value?.()
    unsubscribe.value = undefined
  }

  onUnmounted(stopSync)

  return {
    startSync,
    stopSync
  }
}
