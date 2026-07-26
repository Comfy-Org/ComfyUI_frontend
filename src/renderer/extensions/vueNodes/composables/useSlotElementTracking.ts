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
import type { NodeId } from '@/types/nodeId'
import type { SlotId } from '@/types/slotId'
import {
  isBoundsEqual,
  isPointEqual,
  isSizeEqual
} from '@/renderer/core/layout/utils/geometry'
import { useNodeSlotRegistryStore } from '@/renderer/extensions/vueNodes/stores/nodeSlotRegistryStore'
import { createRafBatch } from '@/utils/rafBatch'

// RAF batching
const pendingNodes = new Set<NodeId>()
const raf = createRafBatch(() => {
  flushScheduledSlotLayoutSync()
})

export function scheduleSlotLayoutSync(nodeId: NodeId) {
  // Drop signals for unregistered nodes (e.g. preview nodes with synthetic
  // ids from LGraphNodePreview) - they'd otherwise pump setDirty per RAF.
  if (!useNodeSlotRegistryStore().getNode(nodeId)) return
  pendingNodes.add(nodeId)
  raf.schedule()
}

function completePendingSlotSync(): void {
  layoutStore.setPendingSlotSync(false)
  app.canvas?.setDirty(true, true)
}

function getSlotElementRect(el?: HTMLElement): DOMRect | null {
  if (!el?.isConnected) return null

  const rect = el.getBoundingClientRect()
  if (rect.width <= 0 || rect.height <= 0) return null
  return rect
}

export function requestSlotLayoutSyncForAllNodes(): void {
  const nodeSlotRegistryStore = useNodeSlotRegistryStore()
  for (const nodeId of nodeSlotRegistryStore.getNodeIds()) {
    const node = nodeSlotRegistryStore.getNode(nodeId)
    if (
      node &&
      Array.from(node.slots.values()).some(({ el }) => el?.isConnected)
    ) {
      scheduleSlotLayoutSync(nodeId)
    }
  }

  // Detached virtualized nodes already have cached or model-based geometry and
  // must not hold link rendering open while waiting for a future remount.
  if (pendingNodes.size === 0) {
    flushScheduledSlotLayoutSync()
  }
}

function createSlotLayout(options: {
  nodeId: NodeId
  index: number
  type: 'input' | 'output'
  centerCanvas: { x: number; y: number }
}): SlotLayout {
  const { nodeId, index, type, centerCanvas } = options
  const size = LiteGraph.NODE_SLOT_HEIGHT
  const half = size / 2

  return {
    nodeId,
    index,
    type,
    position: { x: centerCanvas.x, y: centerCanvas.y },
    bounds: {
      x: centerCanvas.x - half,
      y: centerCanvas.y - half,
      width: size,
      height: size
    }
  }
}

export function flushScheduledSlotLayoutSync() {
  if (pendingNodes.size === 0) {
    completePendingSlotSync()
    return
  }
  for (const nodeId of Array.from(pendingNodes)) {
    pendingNodes.delete(nodeId)
    syncNodeSlotLayoutsFromDOM(nodeId)
  }

  completePendingSlotSync()
}

export function syncNodeSlotLayoutsFromDOM(nodeId: NodeId) {
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
  const connectedEntry = Array.from(node.slots.values()).find(
    (entry) => entry.el?.isConnected
  )
  const closestNode = connectedEntry?.el?.closest('[data-node-id]')
  const nodeEl =
    closestNode instanceof HTMLElement &&
    closestNode.dataset.nodeId === String(nodeId)
      ? closestNode
      : null
  const nodeRect = nodeEl?.getBoundingClientRect()

  const effectiveScale =
    nodeRect && nodeLayout.bounds.width > 0
      ? nodeRect.width / nodeLayout.bounds.width
      : 0

  if (!nodeRect || effectiveScale <= 0) return

  const batch: Array<{ key: SlotId; layout: SlotLayout }> = []

  for (const [slotKey, entry] of node.slots) {
    const rect = getSlotElementRect(entry.el)
    if (!rect) continue

    const screenCenter: [number, number] = [
      rect.left + rect.width / 2,
      rect.top + rect.height / 2
    ]

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

    const nextLayout = createSlotLayout({
      nodeId,
      index: entry.index,
      type: entry.type,
      centerCanvas
    })
    const existingSlotLayout = layoutStore.getSlotLayout(slotKey)
    if (
      existingSlotLayout &&
      isPointEqual(existingSlotLayout.position, nextLayout.position) &&
      isBoundsEqual(existingSlotLayout.bounds, nextLayout.bounds)
    ) {
      continue
    }

    batch.push({
      key: slotKey,
      layout: nextLayout
    })
  }
  if (batch.length) layoutStore.batchUpdateSlotLayouts(batch)
}

function updateNodeSlotsFromCache(nodeId: NodeId) {
  const nodeSlotRegistryStore = useNodeSlotRegistryStore()
  const node = nodeSlotRegistryStore.getNode(nodeId)
  if (!node) return
  const nodeLayout = layoutStore.getNodeLayoutRef(nodeId).value
  if (!nodeLayout) return

  const batch: Array<{ key: SlotId; layout: SlotLayout }> = []

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

    batch.push({
      key: slotKey,
      layout: createSlotLayout({
        nodeId,
        index: entry.index,
        type: entry.type,
        centerCanvas
      })
    })
  }

  if (batch.length) {
    layoutStore.batchUpdateSlotLayouts(batch)
    app.canvas?.setDirty(false, true)
  }
}

export function useSlotElementTracking(options: {
  nodeId?: NodeId
  index: number
  type: 'input' | 'output'
  element: Ref<HTMLElement | null>
}) {
  const { nodeId, index, type, element } = options
  const nodeSlotRegistryStore = useNodeSlotRegistryStore()
  let registeredElement: HTMLElement | undefined

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
        if (existingEntry?.el && existingEntry.el !== el) {
          delete existingEntry.el.dataset.slotKey
        }
        if (existingEntry) {
          existingEntry.cachedOffset = undefined
          layoutStore.deleteSlotLayout(slotKey)
        }

        el.dataset.slotKey = String(slotKey)
        registeredElement = el
        node.slots.set(slotKey, {
          ...existingEntry,
          el,
          index,
          type
        })

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

    // Detach the DOM element while retaining cached geometry. Virtualized
    // nodes continue to participate in link layout and movement updates.
    const slotKey = getSlotKey(nodeId, index, type === 'input')
    const entry = node.slots.get(slotKey)
    if (entry?.el && entry.el === registeredElement) {
      delete entry.el.dataset.slotKey
      entry.el = undefined
    }
  })

  return {
    requestSlotLayoutSync: () => {
      if (nodeId) scheduleSlotLayoutSync(nodeId)
    }
  }
}
