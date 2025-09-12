/**
 * Centralized Slot Element Tracking
 *
 * Registers slot connector DOM elements per node, measures their canvas-space
 * positions in a single batched pass, and caches offsets so that node moves
 * update slot positions without DOM reads.
 */
import { type Ref, inject, nextTick, onMounted, onUnmounted, watch } from 'vue'

import { LiteGraph } from '@/lib/litegraph/src/litegraph'
import { getCanvasClientOrigin } from '@/renderer/core/layout/dom/canvasRectCache'
import { TransformStateKey } from '@/renderer/core/layout/injectionKeys'
import { getSlotKey } from '@/renderer/core/layout/slots/slotIdentifier'
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import type { Point, SlotLayout } from '@/renderer/core/layout/types'

type SlotEntry = {
  el: HTMLElement
  index: number
  isInput: boolean
  cachedOffset?: { x: number; y: number }
}

type NodeEntry = {
  nodeId: string
  screenToCanvas?: (p: Point) => Point
  slots: Map<string, SlotEntry>
  stopWatch?: () => void
}

// Registry of nodes and their slots
const nodeRegistry = new Map<string, NodeEntry>()

// RAF batching
const pendingNodes = new Set<string>()
let rafId: number | null = null

function scheduleSlotLayoutSync(nodeId: string) {
  pendingNodes.add(nodeId)
  if (rafId == null) {
    rafId = requestAnimationFrame(() => {
      rafId = null
      flushScheduledSlotLayoutSync()
    })
  }
}

function flushScheduledSlotLayoutSync() {
  if (pendingNodes.size === 0) return

  // Read container origin once from cache
  const { left: originLeft, top: originTop } = getCanvasClientOrigin()

  for (const nodeId of Array.from(pendingNodes)) {
    pendingNodes.delete(nodeId)
    syncNodeSlotLayoutsFromDOM(nodeId, originLeft, originTop)
  }
}

function syncNodeSlotLayoutsFromDOM(
  nodeId: string,
  originLeft?: number,
  originTop?: number
) {
  const node = nodeRegistry.get(nodeId)
  if (!node) return
  if (!node.screenToCanvas) return
  const nodeLayout = layoutStore.getNodeLayoutRef(nodeId).value
  if (!nodeLayout) return

  // Compute origin lazily if not provided
  let originL = originLeft
  let originT = originTop
  if (originL == null || originT == null) {
    const { left, top } = getCanvasClientOrigin()
    originL = left
    originT = top
  }

  const batch: Array<{ key: string; layout: SlotLayout }> = []

  for (const [slotKey, entry] of node.slots) {
    const rect = entry.el.getBoundingClientRect()
    const centerScreen = {
      x: rect.left + rect.width / 2 - (originL ?? 0),
      y: rect.top + rect.height / 2 - (originT ?? 0)
    }
    const centerCanvas = node.screenToCanvas(centerScreen)

    // Cache offset relative to node position for fast updates later
    entry.cachedOffset = {
      x: centerCanvas.x - nodeLayout.position.x,
      y: centerCanvas.y - nodeLayout.position.y
    }

    // Persist layout in canvas coordinates
    const size = LiteGraph.NODE_SLOT_HEIGHT
    const half = size / 2
    batch.push({
      key: slotKey,
      layout: {
        nodeId,
        index: entry.index,
        type: entry.isInput ? 'input' : 'output',
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
  const node = nodeRegistry.get(nodeId)
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
        type: entry.isInput ? 'input' : 'output',
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
  isInput: boolean
  element: Ref<HTMLElement | null>
}) {
  const { nodeId, index, isInput, element } = options

  // Get transform utilities from TransformPane
  const transformState = inject(TransformStateKey)

  onMounted(async () => {
    if (!nodeId) return
    await nextTick()
    const el = element.value
    if (!el) return

    // Ensure node entry
    let node = nodeRegistry.get(nodeId)
    if (!node) {
      node = {
        nodeId,
        screenToCanvas: transformState?.screenToCanvas,
        slots: new Map()
      }
      nodeRegistry.set(nodeId, node)
      // Subscribe once per node to layout changes for fast cached updates
      const nodeRef = layoutStore.getNodeLayoutRef(nodeId)
      const stop = watch(
        nodeRef,
        (newLayout, oldLayout) => {
          if (newLayout && oldLayout) {
            const moved =
              newLayout.position.x !== oldLayout.position.x ||
              newLayout.position.y !== oldLayout.position.y
            const resized =
              newLayout.size.width !== oldLayout.size.width ||
              newLayout.size.height !== oldLayout.size.height

            // Only update from cache on move-only changes.
            // On resizes (or move+resize), let ResizeObserver resync slots from DOM accurately.
            if (moved && !resized) {
              updateNodeSlotsFromCache(nodeId)
            }
          }
        },
        { flush: 'post' }
      )
      node.stopWatch = () => stop()
    }

    // Register slot
    const slotKey = getSlotKey(nodeId, index, isInput)
    node.slots.set(slotKey, { el, index, isInput })

    // Seed initial sync from DOM
    scheduleSlotLayoutSync(nodeId)
  })

  onUnmounted(() => {
    if (!nodeId) return
    const node = nodeRegistry.get(nodeId)
    if (!node) return

    // Remove this slot from registry and layout
    const slotKey = getSlotKey(nodeId, index, isInput)
    node.slots.delete(slotKey)
    layoutStore.deleteSlotLayout(slotKey)

    // If node has no more slots, clean up
    if (node.slots.size === 0) {
      if (node.stopWatch) node.stopWatch()
      nodeRegistry.delete(nodeId)
    }
  })

  return {
    requestSlotLayoutSync: () => scheduleSlotLayoutSync(nodeId)
  }
}

export function syncNodeSlotLayoutsNow(
  nodeId: string,
  origin?: { left: number; top: number }
) {
  syncNodeSlotLayoutsFromDOM(nodeId, origin?.left, origin?.top)
}

// Optional helper for callers that are not using the composable
export function requestSlotLayoutSync(nodeId: string) {
  scheduleSlotLayoutSync(nodeId)
}
