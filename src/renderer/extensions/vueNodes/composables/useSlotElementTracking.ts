/**
 * Centralized Slot Element Tracking
 *
 * Registers slot connector DOM elements per node, measures their canvas-space
 * positions in a single batched pass, and caches offsets so that node moves
 * update slot positions without DOM reads.
 */
import { type Ref, onMounted, onUnmounted, watch } from 'vue'

import { useSharedCanvasPositionConversion } from '@/composables/element/useCanvasPositionConversion'
import { LiteGraph } from '@/lib/litegraph/src/litegraph'
import { getSlotKey } from '@/renderer/core/layout/slots/slotIdentifier'
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import type { SlotLayout } from '@/renderer/core/layout/types'

type SlotEntry = {
  el: HTMLElement
  index: number
  type: 'input' | 'output'
  cachedOffset?: { x: number; y: number }
}

type NodeEntry = {
  nodeId: string
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
  const conv = useSharedCanvasPositionConversion()
  for (const nodeId of Array.from(pendingNodes)) {
    pendingNodes.delete(nodeId)
    syncNodeSlotLayoutsFromDOM(nodeId, conv)
  }
}

function syncNodeSlotLayoutsFromDOM(
  nodeId: string,
  conv?: ReturnType<typeof useSharedCanvasPositionConversion>
) {
  const node = nodeRegistry.get(nodeId)
  if (!node) return
  const nodeLayout = layoutStore.getNodeLayoutRef(nodeId).value
  if (!nodeLayout) return

  const batch: Array<{ key: string; layout: SlotLayout }> = []

  for (const [slotKey, entry] of node.slots) {
    const rect = entry.el.getBoundingClientRect()
    const screenCenter: [number, number] = [
      rect.left + rect.width / 2,
      rect.top + rect.height / 2
    ]
    const [x, y] = (
      conv ?? useSharedCanvasPositionConversion()
    ).clientPosToCanvasPos(screenCenter)
    const centerCanvas = { x, y }

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

  onMounted(() => {
    if (!nodeId) return
    const stop = watch(
      element,
      (el) => {
        if (!el) return

        // Ensure node entry
        let node = nodeRegistry.get(nodeId)
        if (!node) {
          const entry: NodeEntry = {
            nodeId,
            slots: new Map()
          }
          nodeRegistry.set(nodeId, entry)

          const unsubscribe = layoutStore.onChange((change) => {
            const op = change.operation
            if (
              op &&
              op.entity === 'node' &&
              op.nodeId === nodeId &&
              op.type === 'moveNode'
            ) {
              updateNodeSlotsFromCache(nodeId)
            }
          })
          entry.stopWatch = () => unsubscribe()
          node = entry
        }

        // Register slot
        const slotKey = getSlotKey(nodeId, index, type === 'input')
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
    const node = nodeRegistry.get(nodeId)
    if (!node) return

    // Remove this slot from registry and layout
    const slotKey = getSlotKey(nodeId, index, type === 'input')
    node.slots.delete(slotKey)
    layoutStore.deleteSlotLayout(slotKey)

    // If node has no more slots, clean up
    if (node.slots.size === 0) {
      // Stop the node-level watcher when the last slot is gone
      if (node.stopWatch) node.stopWatch()
      nodeRegistry.delete(nodeId)
    }
  })

  return {
    requestSlotLayoutSync: () => scheduleSlotLayoutSync(nodeId)
  }
}

export function syncNodeSlotLayoutsNow(nodeId: string) {
  syncNodeSlotLayoutsFromDOM(nodeId)
}
