/**
 * Centralized Slot Element Tracking
 *
 * Registers slot connector DOM elements per node, measures their canvas-space
 * positions in a single batched pass, and caches offsets so that node moves
 * update slot positions without DOM reads.
 */
import { onMounted, onUnmounted, watch } from 'vue'
import type { Ref } from 'vue'

import { LiteGraph } from '@/lib/litegraph/src/litegraph'
import { getSlotKey } from '@/renderer/core/layout/slots/slotIdentifier'
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import { app } from '@/scripts/app'
import type { SlotLayout } from '@/renderer/core/layout/types'
import {
  isPointEqual,
  isSizeEqual
} from '@/renderer/core/layout/utils/geometry'
import { useNodeSlotRegistryStore } from '@/renderer/extensions/vueNodes/stores/nodeSlotRegistryStore'
import { createRafBatch } from '@/utils/rafBatch'

// RAF batching
const pendingNodes = new Set<string>()
const raf = createRafBatch(() => {
  flushScheduledSlotLayoutSync()
})

function scheduleSlotLayoutSync(nodeId: string) {
  pendingNodes.add(nodeId)
  raf.schedule()
}

export function flushScheduledSlotLayoutSync() {
  if (pendingNodes.size === 0) {
    // No pending nodes - check if we should wait for Vue components to mount
    const graph = app.canvas?.graph
    const hasNodes = graph && graph._nodes && graph._nodes.length > 0
    if (hasNodes && !layoutStore.hasSlotLayouts) {
      // Graph has nodes but no slot layouts yet - Vue hasn't mounted.
      // Keep flag set so late mounts can re-assert via scheduleSlotLayoutSync()
      return
    }
    // Either no nodes (nothing to wait for) or slot layouts already exist
    // (undo/redo preserved them). Clear the flag so links can render.
    layoutStore.setPendingSlotSync(false)
    app.canvas?.setDirty(true, true)
    return
  }
  for (const nodeId of Array.from(pendingNodes)) {
    pendingNodes.delete(nodeId)
    syncNodeSlotLayoutsFromDOM(nodeId)
  }
  // Clear the pending sync flag - slots are now synced
  layoutStore.setPendingSlotSync(false)
  // Trigger canvas redraw now that links can render with correct positions
  app.canvas?.setDirty(true, true)
}

export function syncNodeSlotLayoutsFromDOM(nodeId: string) {
  const nodeSlotRegistryStore = useNodeSlotRegistryStore()
  const node = nodeSlotRegistryStore.getNode(nodeId)
  if (!node) return
  const nodeLayout = layoutStore.getNodeLayoutRef(nodeId).value
  if (!nodeLayout) return

  // Find the node's DOM element for relative offset measurement.
  // Using DOM-relative measurement avoids the transform desync issue where
  // lgCanvas.ds (used by clientPosToCanvasPos) can diverge from the
  // TransformPane's CSS transform during workflow loading (e.g., after
  // fitView or ensureCorrectLayoutScale). Both the slot and node elements
  // share the same DOM transform, so their pixel difference divided by the
  // effective scale yields a correct canvas-space offset regardless of
  // whether the TransformPane has flushed its latest transform to the DOM.
  const nodeEl = node.slots.values().next().value?.el.closest(
    '[data-node-id]'
  ) as HTMLElement | null
  const nodeRect = nodeEl?.getBoundingClientRect()
  const effectiveScale =
    nodeRect && nodeLayout.size.width > 0
      ? nodeRect.width / nodeLayout.size.width
      : 0

  const batch: Array<{ key: string; layout: SlotLayout }> = []

  for (const [slotKey, entry] of node.slots) {
    const rect = entry.el.getBoundingClientRect()
    const screenCenter: [number, number] = [
      rect.left + rect.width / 2,
      rect.top + rect.height / 2
    ]

    if (!nodeRect || effectiveScale <= 0) continue

    // DOM-relative measurement: compute offset from the node element's
    // top-left corner in canvas units. The node element is rendered at
    // (position.x, position.y - NODE_TITLE_HEIGHT), so the Y offset
    // must subtract NODE_TITLE_HEIGHT to be relative to position.y.
    entry.cachedOffset = {
      x: (screenCenter[0] - nodeRect.left) / effectiveScale,
      y:
        (screenCenter[1] - nodeRect.top) / effectiveScale -
        LiteGraph.NODE_TITLE_HEIGHT
    }

    const centerCanvas = {
      x: nodeLayout.position.x + entry.cachedOffset.x,
      y: nodeLayout.position.y + entry.cachedOffset.y
    }

    // Persist layout in canvas coordinates
    const size = LiteGraph.NODE_SLOT_HEIGHT
    const half = size / 2
    batch.push({
      key: slotKey,
      layout: {
        nodeId,
        index: entry.index,
        type: entry.type,
        position: { x: centerCanvas.x, y: centerCanvas.y },
        bounds: {
          x: centerCanvas.x - half,
          y: centerCanvas.y - half,
          width: size,
          height: size
        }
      }
    })
  }
  if (batch.length) layoutStore.batchUpdateSlotLayouts(batch)
}

function updateNodeSlotsFromCache(nodeId: string) {
  const nodeSlotRegistryStore = useNodeSlotRegistryStore()
  const node = nodeSlotRegistryStore.getNode(nodeId)
  if (!node) return
  const nodeLayout = layoutStore.getNodeLayoutRef(nodeId).value
  if (!nodeLayout) return

  const batch: Array<{ key: string; layout: SlotLayout }> = []

  for (const [slotKey, entry] of node.slots) {
    if (!entry.cachedOffset) {
      // schedule a sync to seed offset
      scheduleSlotLayoutSync(nodeId)
      continue
    }

    const centerCanvas = {
      x: nodeLayout.position.x + entry.cachedOffset.x,
      y: nodeLayout.position.y + entry.cachedOffset.y
    }
    const size = LiteGraph.NODE_SLOT_HEIGHT
    const half = size / 2
    batch.push({
      key: slotKey,
      layout: {
        nodeId,
        index: entry.index,
        type: entry.type,
        position: { x: centerCanvas.x, y: centerCanvas.y },
        bounds: {
          x: centerCanvas.x - half,
          y: centerCanvas.y - half,
          width: size,
          height: size
        }
      }
    })
  }

  if (batch.length) layoutStore.batchUpdateSlotLayouts(batch)
}

export function useSlotElementTracking(options: {
  nodeId: string
  index: number
  type: 'input' | 'output'
  element: Ref<HTMLElement | null>
}) {
  const { nodeId, index, type, element } = options
  const nodeSlotRegistryStore = useNodeSlotRegistryStore()

  onMounted(() => {
    if (!nodeId) return
    const stop = watch(
      element,
      (el) => {
        if (!el) return

        const node = nodeSlotRegistryStore.ensureNode(nodeId)

        if (!node.stopWatch) {
          const layoutRef = layoutStore.getNodeLayoutRef(nodeId)

          const stopPositionWatch = watch(
            () => layoutRef.value?.position,
            (newPosition, oldPosition) => {
              if (!newPosition) return
              if (!oldPosition || !isPointEqual(newPosition, oldPosition)) {
                updateNodeSlotsFromCache(nodeId)
              }
            }
          )

          const stopSizeWatch = watch(
            () => layoutRef.value?.size,
            (newSize, oldSize) => {
              if (!newSize) return
              if (!oldSize || !isSizeEqual(newSize, oldSize)) {
                scheduleSlotLayoutSync(nodeId)
              }
            }
          )

          node.stopWatch = () => {
            stopPositionWatch()
            stopSizeWatch()
          }
        }

        // Register slot
        const slotKey = getSlotKey(nodeId, index, type === 'input')

        // Defensive cleanup: remove stale entry if it exists with different element
        // This handles edge cases where Vue component reuse prevents proper unmount
        const existingEntry = node.slots.get(slotKey)
        if (existingEntry && existingEntry.el !== el) {
          delete existingEntry.el.dataset.slotKey
          layoutStore.deleteSlotLayout(slotKey)
        }

        el.dataset.slotKey = slotKey
        node.slots.set(slotKey, { el, index, type })

        // Seed initial sync from DOM
        scheduleSlotLayoutSync(nodeId)

        // Stop watching once registered
        stop()
      },
      { immediate: true, flush: 'post' }
    )
  })

  onUnmounted(() => {
    if (!nodeId) return
    const node = nodeSlotRegistryStore.getNode(nodeId)
    if (!node) return

    // Remove this slot from registry and layout
    const slotKey = getSlotKey(nodeId, index, type === 'input')
    const entry = node.slots.get(slotKey)
    if (entry) {
      delete entry.el.dataset.slotKey
      node.slots.delete(slotKey)
    }
    layoutStore.deleteSlotLayout(slotKey)

    // If node has no more slots, clean up
    if (node.slots.size === 0) {
      if (node.stopWatch) node.stopWatch()
      nodeSlotRegistryStore.deleteNode(nodeId)
    }
  })

  return {
    requestSlotLayoutSync: () => scheduleSlotLayoutSync(nodeId)
  }
}
