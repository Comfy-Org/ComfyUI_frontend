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
// Slot keys migrated to identity attributes
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
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

function flushScheduledSlotLayoutSync() {
  if (pendingNodes.size === 0) return
  const conv = useSharedCanvasPositionConversion()
  for (const nodeId of Array.from(pendingNodes)) {
    pendingNodes.delete(nodeId)
    syncNodeSlotLayoutsFromDOM(nodeId, conv)
  }
}

export function syncNodeSlotLayoutsFromDOM(
  nodeId: string,
  conv?: ReturnType<typeof useSharedCanvasPositionConversion>
) {
  const nodeSlotRegistryStore = useNodeSlotRegistryStore()
  const node = nodeSlotRegistryStore.getNode(nodeId)
  if (!node) return
  const nodeLayout = layoutStore.getNodeLayoutRef(nodeId).value
  if (!nodeLayout) return

  const batch: Array<{
    nodeId: string
    type: 'input' | 'output'
    index: number
    layout: SlotLayout
  }> = []

  for (const [index, entry] of node.slots.input) {
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
      nodeId,
      type: 'input',
      index,
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
  for (const [index, entry] of node.slots.output) {
    const rect = entry.el.getBoundingClientRect()
    const screenCenter: [number, number] = [
      rect.left + rect.width / 2,
      rect.top + rect.height / 2
    ]
    const [x, y] = (
      conv ?? useSharedCanvasPositionConversion()
    ).clientPosToCanvasPos(screenCenter)
    const centerCanvas = { x, y }

    entry.cachedOffset = {
      x: centerCanvas.x - nodeLayout.position.x,
      y: centerCanvas.y - nodeLayout.position.y
    }

    const size = LiteGraph.NODE_SLOT_HEIGHT
    const half = size / 2
    batch.push({
      nodeId,
      type: 'output',
      index,
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
  if (batch.length) layoutStore.batchUpdateSlotLayoutsBy(batch)
}

function updateNodeSlotsFromCache(nodeId: string) {
  const nodeSlotRegistryStore = useNodeSlotRegistryStore()
  const node = nodeSlotRegistryStore.getNode(nodeId)
  if (!node) return
  const nodeLayout = layoutStore.getNodeLayoutRef(nodeId).value
  if (!nodeLayout) return

  const batch: Array<{
    nodeId: string
    type: 'input' | 'output'
    index: number
    layout: SlotLayout
  }> = []

  for (const [index, entry] of node.slots.input) {
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
      nodeId,
      type: 'input',
      index,
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
  for (const [index, entry] of node.slots.output) {
    if (!entry.cachedOffset) {
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
      nodeId,
      type: 'output',
      index,
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

  if (batch.length) layoutStore.batchUpdateSlotLayoutsBy(batch)
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

        el.dataset.nodeId = nodeId
        el.dataset.slotType = type
        el.dataset.slotIndex = String(index)
        if (type === 'input') {
          node.slots.input.set(index, { el, index, type })
        } else {
          node.slots.output.set(index, { el, index, type })
        }

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

    const collection = type === 'input' ? node.slots.input : node.slots.output
    const entry = collection.get(index)
    if (entry) {
      delete entry.el.dataset.nodeId
      delete entry.el.dataset.slotType
      delete entry.el.dataset.slotIndex
      collection.delete(index)
    }
    layoutStore.deleteSlotLayoutBy(nodeId, type, index)

    // If node has no more slots, clean up
    if (node.slots.input.size === 0 && node.slots.output.size === 0) {
      if (node.stopWatch) node.stopWatch()
      nodeSlotRegistryStore.deleteNode(nodeId)
    }
  })

  return {
    requestSlotLayoutSync: () => scheduleSlotLayoutSync(nodeId)
  }
}
