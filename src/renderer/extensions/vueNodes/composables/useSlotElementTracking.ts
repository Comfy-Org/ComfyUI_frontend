/**
 * Centralized Slot Element Tracking
 *
 * Registers slot connector DOM elements per node, measures their canvas-space
 * positions in a single batched pass, and caches offsets so that node moves
 * update slot positions without DOM reads.
 */
import { onMounted, onUnmounted, watch } from 'vue'
import type { Ref } from 'vue'

import { useSharedCanvasPositionConversion } from '@/composables/element/useCanvasPositionConversion'
import { LiteGraph } from '@/lib/litegraph/src/litegraph'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { getSlotKey } from '@/renderer/core/layout/slots/slotIdentifier'
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import { app } from '@/scripts/app'
import type { SlotLayout } from '@/renderer/core/layout/types'
import type { NodeId } from '@/types/nodeId'
import type { SlotId } from '@/types/slotId'
import {
  isBoundsEqual,
  isPointEqual
} from '@/renderer/core/layout/utils/geometry'
import { useNodeSlotRegistryStore } from '@/renderer/extensions/vueNodes/stores/nodeSlotRegistryStore'
import { createRafBatch } from '@/utils/rafBatch'

import { isNodeViewportVirtualized } from './viewportVirtualizationState'

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

function shouldWaitForSlotLayouts(): boolean {
  const graph = app.canvas?.graph
  const hasNodes = Boolean(graph && graph._nodes && graph._nodes.length > 0)
  return hasNodes && !layoutStore.hasSlotLayouts
}

function completePendingSlotSync(): void {
  layoutStore.setPendingSlotSync(false)
  app.canvas?.setDirty(true, true)
}

function getSlotElementRect(el: HTMLElement | undefined): DOMRect | null {
  if (!el) return null
  if (!el.isConnected) return null

  const rect = el.getBoundingClientRect()
  if (rect.width <= 0 || rect.height <= 0) return null
  return rect
}

export function requestSlotLayoutSyncForAllNodes(): void {
  const nodeSlotRegistryStore = useNodeSlotRegistryStore()
  for (const nodeId of nodeSlotRegistryStore.getNodeIds()) {
    scheduleSlotLayoutSync(nodeId)
  }

  // If no slots are currently registered, run the completion check immediately
  // so pendingSlotSync can be cleared when the graph has no nodes.
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
    // No pending nodes - check if we should wait for Vue components to mount
    if (shouldWaitForSlotLayouts()) {
      // Graph has nodes but no slot layouts yet - Vue hasn't mounted.
      // Keep flag set so late mounts can re-assert via scheduleSlotLayoutSync()
      return
    }
    // Either no nodes (nothing to wait for) or slot layouts already exist
    // (undo/redo preserved them). Clear the flag so links can render.
    completePendingSlotSync()
    return
  }
  for (const nodeId of Array.from(pendingNodes)) {
    pendingNodes.delete(nodeId)
    syncNodeSlotLayoutsFromDOM(nodeId)
  }

  // Keep pending sync active until at least one measurable slot layout has
  // been captured for the current graph.
  if (shouldWaitForSlotLayouts()) return

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
  let nodeEl: HTMLElement | null = null
  for (const entry of node.slots.values()) {
    if (!entry.el?.isConnected) continue
    const closestNode = entry.el.closest('[data-node-id]')
    if (
      closestNode instanceof HTMLElement &&
      closestNode.dataset.nodeId === String(nodeId)
    ) {
      nodeEl = closestNode
      break
    }
  }
  const nodeRect = nodeEl?.getBoundingClientRect()

  // Collapsed nodes preserve expanded size in layoutStore, so DOM-relative
  // scale derivation breaks. Fall back to clientPosToCanvasPos instead.
  const isCollapsed = nodeEl?.dataset.collapsed != null
  const effectiveScale =
    !isCollapsed && nodeRect && nodeLayout.size.width > 0
      ? nodeRect.width / nodeLayout.size.width
      : 0

  const canvasStore = useCanvasStore()
  const conv =
    isCollapsed && canvasStore.canvas
      ? useSharedCanvasPositionConversion()
      : null

  if (isCollapsed && !conv) {
    scheduleSlotLayoutSync(nodeId)
    return
  }

  const batch: Array<{ key: SlotId; layout: SlotLayout }> = []

  for (const [slotKey, entry] of Array.from(node.slots)) {
    if (!entry.el?.isConnected) {
      if (isNodeViewportVirtualized(nodeId)) continue
      node.slots.delete(slotKey)
      layoutStore.deleteSlotLayout(slotKey)
      continue
    }
    if (!nodeEl || entry.el.closest('[data-node-id]') !== nodeEl) {
      layoutStore.deleteSlotLayout(slotKey)
      continue
    }
    const rect = getSlotElementRect(entry.el)
    if (!rect) {
      // Drop stale layout values while the slot is hidden so we don't render
      // links with off-screen coordinates from a previous graph/tab state.
      layoutStore.deleteSlotLayout(slotKey)
      continue
    }

    const screenCenter: [number, number] = [
      rect.left + rect.width / 2,
      rect.top + rect.height / 2
    ]

    let centerCanvas: { x: number; y: number }

    if (conv) {
      const [cx, cy] = conv.clientPosToCanvasPos(screenCenter)
      centerCanvas = { x: cx, y: cy }
      entry.cachedOffset = {
        x: centerCanvas.x - nodeLayout.position.x,
        y: centerCanvas.y - nodeLayout.position.y
      }
    } else {
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

      centerCanvas = {
        x: nodeLayout.position.x + entry.cachedOffset.x,
        y: nodeLayout.position.y + entry.cachedOffset.y
      }
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
    if (!entry.el && !isNodeViewportVirtualized(nodeId)) {
      node.slots.delete(slotKey)
      layoutStore.deleteSlotLayout(slotKey)
      continue
    }
    if (!entry.cachedOffset) {
      layoutStore.deleteSlotLayout(slotKey)
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

  if (batch.length) layoutStore.batchUpdateSlotLayouts(batch)
  if (node.slots.size === 0) {
    node.stopLayoutSubscription?.()
    nodeSlotRegistryStore.deleteNode(nodeId)
  }
}

function subscribeToNodeLayoutChanges(nodeId: NodeId): () => void {
  const initialLayout = layoutStore.getNodeLayoutRef(nodeId).value
  let previousX = initialLayout?.position.x
  let previousY = initialLayout?.position.y
  let previousWidth = initialLayout?.size.width
  let previousHeight = initialLayout?.size.height

  return layoutStore.onNodeChange(nodeId, () => {
    const node = useNodeSlotRegistryStore().getNode(nodeId)
    if (!node) return

    const currentLayout = layoutStore.getNodeLayoutRef(nodeId).value
    if (!currentLayout) return

    const sizeChanged =
      previousWidth === undefined ||
      previousHeight === undefined ||
      currentLayout.size.width !== previousWidth ||
      currentLayout.size.height !== previousHeight
    const positionChanged =
      previousX === undefined ||
      previousY === undefined ||
      currentLayout.position.x !== previousX ||
      currentLayout.position.y !== previousY
    previousX = currentLayout.position.x
    previousY = currentLayout.position.y
    previousWidth = currentLayout.size.width
    previousHeight = currentLayout.size.height

    if (sizeChanged) {
      if (isNodeViewportVirtualized(nodeId)) {
        updateNodeSlotsFromCache(nodeId)
        return
      }
      for (const [slotKey, entry] of node.slots) {
        entry.cachedOffset = undefined
        layoutStore.deleteSlotLayout(slotKey)
      }
      scheduleSlotLayoutSync(nodeId)
      return
    }

    if (positionChanged) updateNodeSlotsFromCache(nodeId)
  })
}

export function useSlotElementTracking(options: {
  nodeId?: NodeId
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

        if (!node.stopLayoutSubscription) {
          node.stopLayoutSubscription = subscribeToNodeLayoutChanges(nodeId)
        }

        // Register slot
        const slotKey = getSlotKey(nodeId, index, type === 'input')

        // Defensive cleanup: remove stale entry if it exists with different element
        // This handles edge cases where Vue component reuse prevents proper unmount
        const existingEntry = node.slots.get(slotKey)
        if (existingEntry?.el && existingEntry.el !== el)
          delete existingEntry.el.dataset.slotKey

        el.dataset.slotKey = String(slotKey)
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

    // Remove this slot from registry and layout
    const slotKey = getSlotKey(nodeId, index, type === 'input')
    const entry = node.slots.get(slotKey)
    if (entry) {
      if (entry.el) delete entry.el.dataset.slotKey
      if (isNodeViewportVirtualized(nodeId)) {
        entry.el = undefined
        return
      }
      node.slots.delete(slotKey)
    }
    layoutStore.deleteSlotLayout(slotKey)

    // If node has no more slots, clean up
    if (node.slots.size === 0) {
      node.stopLayoutSubscription?.()
      nodeSlotRegistryStore.deleteNode(nodeId)
    }
  })

  return {
    requestSlotLayoutSync: () => {
      if (nodeId) scheduleSlotLayoutSync(nodeId)
    }
  }
}

export function deleteTrackedNodeSlotLayouts(nodeId: NodeId): void {
  pendingNodes.delete(nodeId)
  const nodeSlotRegistryStore = useNodeSlotRegistryStore()
  const node = nodeSlotRegistryStore.getNode(nodeId)
  if (!node) return

  for (const [slotKey, entry] of node.slots) {
    if (entry.el) delete entry.el.dataset.slotKey
    layoutStore.deleteSlotLayout(slotKey)
  }
  node.stopLayoutSubscription?.()
  nodeSlotRegistryStore.deleteNode(nodeId)
}

export function clearTrackedNodeSlotLayouts(): void {
  const nodeSlotRegistryStore = useNodeSlotRegistryStore()
  for (const nodeId of nodeSlotRegistryStore.getNodeIds()) {
    deleteTrackedNodeSlotLayouts(nodeId)
  }
}
