/**
 * Generic Vue Element Tracking System
 *
 * Automatically tracks DOM size and position changes for Vue-rendered elements
 * and syncs them to the layout store. Uses a single shared ResizeObserver for
 * performance, with elements identified by configurable data attributes.
 *
 * Supports different element types (nodes, slots, widgets, etc.) with
 * customizable data attributes and update handlers.
 */
import {
  getCurrentInstance,
  onActivated,
  onDeactivated,
  onMounted,
  onUnmounted,
  watch
} from 'vue'

import { useDocumentVisibility } from '@vueuse/core'

import { useSharedCanvasPositionConversion } from '@/composables/element/useCanvasPositionConversion'
import { LiteGraph } from '@/lib/litegraph/src/litegraph'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import { syncSlotOffsets } from '@/renderer/core/layout/slots/syncSlotOffsets'
import type { Bounds, NodeId } from '@/renderer/core/layout/types'
import { toNodeId } from '@/types/nodeId'
import {
  isBoundsEqual,
  isSizeEqual
} from '@/renderer/core/layout/utils/geometry'
import { removeNodeTitleHeight } from '@/renderer/core/layout/utils/nodeSizeUtil'

/**
 * Generic update item for element bounds tracking
 */
interface ElementBoundsUpdate {
  id: NodeId
  /** Updated bounds */
  bounds: Bounds
}

interface CachedNodeMeasurement {
  nodeId: NodeId
  bounds: Bounds
}

/**
 * Configuration for different types of tracked elements
 */
interface ElementTrackingConfig {
  /** Data attribute name (e.g., 'nodeId') */
  dataAttribute: string
  syncSlots?: boolean
  /** Handler for processing bounds updates. Omit for signal-only entries. */
  updateHandler?: (updates: ElementBoundsUpdate[]) => void
}

/**
 * Registry of tracking configurations by element type
 */
const trackingConfigs = new Map<string, ElementTrackingConfig>([
  [
    'node',
    {
      dataAttribute: 'nodeId',
      updateHandler: (updates) => {
        const { rootGraphId } = useCanvasStore()
        if (!rootGraphId) return

        for (const { id, bounds } of updates) {
          layoutStore.reportContentSize(rootGraphId, id, {
            width: bounds.width,
            height: removeNodeTitleHeight(bounds.height)
          })
        }
      }
    }
  ],
  ['widgets-grid', { dataAttribute: 'widgetsGridNodeId', syncSlots: true }]
])

// Elements whose ResizeObserver fired while the tab was hidden
const deferredElements = new Set<HTMLElement>()
const elementsNeedingFreshMeasurement = new WeakSet<HTMLElement>()
const cachedNodeMeasurements = new WeakMap<HTMLElement, CachedNodeMeasurement>()
const visibility = useDocumentVisibility()

function markElementForFreshMeasurement(element: HTMLElement) {
  elementsNeedingFreshMeasurement.add(element)
  cachedNodeMeasurements.delete(element)
}

watch(visibility, (state) => {
  if (state !== 'visible' || deferredElements.size === 0) return

  // Re-observe deferred elements to trigger fresh measurements
  for (const element of deferredElements) {
    if (element.isConnected) {
      markElementForFreshMeasurement(element)
      resizeObserver.observe(element)
    }
  }
  deferredElements.clear()
})

// Single ResizeObserver instance for all Vue elements
const resizeObserver = new ResizeObserver((entries) => {
  const { linearMode, rootGraphId } = useCanvasStore()
  if (linearMode) return

  // Skip measurements when tab is hidden — bounding rects are unreliable
  if (visibility.value === 'hidden') {
    for (const entry of entries) {
      if (entry.target instanceof HTMLElement) {
        deferredElements.add(entry.target)
        markElementForFreshMeasurement(entry.target)
        resizeObserver.unobserve(entry.target)
      }
    }
    return
  }

  // Canvas is ready when this code runs; no defensive guards needed.
  const conv = useSharedCanvasPositionConversion()
  // Group updates by type, then flush via each config's handler
  const updatesByType = new Map<string, ElementBoundsUpdate[]>()
  const slotSyncElements = new Map<NodeId, HTMLElement>()
  for (const entry of entries) {
    if (!(entry.target instanceof HTMLElement)) continue
    const element = entry.target

    if (!element.isConnected) {
      markElementForFreshMeasurement(element)
      continue
    }
    // Find which type this element belongs to
    let elementType: string | undefined
    let elementId: string | undefined

    for (const [type, config] of trackingConfigs) {
      const id = element.dataset[config.dataAttribute]
      if (id) {
        elementType = type
        elementId = id
        break
      }
    }

    if (!elementType || !elementId) continue
    const config = trackingConfigs.get(elementType)
    const nodeId = toNodeId(elementId)
    if (config?.syncSlots) {
      slotSyncElements.set(nodeId, element)
      continue
    }

    // Use borderBoxSize when available; fall back to contentRect for older engines/tests
    // Border box is the border included FULL wxh DOM value.
    const borderBox = Array.isArray(entry.borderBoxSize)
      ? entry.borderBoxSize[0]
      : {
          inlineSize: entry.contentRect.width,
          blockSize: entry.contentRect.height
        }
    const width = Math.max(0, borderBox.inlineSize)
    const height = Math.max(0, borderBox.blockSize)

    const nodeLayout =
      nodeId && rootGraphId
        ? layoutStore.getNodeLayout(rootGraphId, nodeId)
        : null
    const normalizedHeight = removeNodeTitleHeight(height)
    const previousMeasurement = cachedNodeMeasurements.get(element)
    const hasFreshMeasurementPending =
      elementsNeedingFreshMeasurement.has(element)
    const hasMatchingCachedNodeMeasurement =
      previousMeasurement != null &&
      previousMeasurement.nodeId === nodeId &&
      nodeLayout != null &&
      isBoundsEqual(previousMeasurement.bounds, nodeLayout.bounds)

    // ResizeObserver emits entries where nothing changed (e.g. initial observe).
    // Skip expensive DOM reads when this exact element/node already measured at
    // the same normalized bounds and size.
    if (
      nodeLayout &&
      !hasFreshMeasurementPending &&
      isSizeEqual(nodeLayout.size, {
        width,
        height: normalizedHeight
      }) &&
      hasMatchingCachedNodeMeasurement
    ) {
      continue
    }
    if (rootGraphId) {
      slotSyncElements.set(nodeId, element)
    }

    // Use existing position from layout store (source of truth) rather than
    // converting screen-space getBoundingClientRect() back to canvas coords.
    // The DOM→canvas conversion depends on the current canvas scale/offset,
    // which can be stale during graph transitions (e.g. entering a subgraph
    // before fitView runs), producing corrupted positions.
    const existingPos = nodeLayout?.position
    let posX: number
    let posY: number
    if (existingPos) {
      posX = existingPos.x
      posY = existingPos.y
    } else {
      const rect = element.getBoundingClientRect()
      const [cx, cy] = conv.clientPosToCanvasPos([rect.left, rect.top])
      posX = cx
      posY = cy + LiteGraph.NODE_TITLE_HEIGHT
    }
    const bounds: Bounds = {
      x: posX,
      y: posY,
      width,
      height
    }
    const normalizedBounds: Bounds = {
      ...bounds,
      height: normalizedHeight
    }

    elementsNeedingFreshMeasurement.delete(element)
    if (nodeId) {
      cachedNodeMeasurements.set(element, {
        nodeId,
        bounds: normalizedBounds
      })
    }

    let updates = updatesByType.get(elementType)
    if (!updates) {
      updates = []
      updatesByType.set(elementType, updates)
    }
    updates.push({ id: nodeId, bounds })
  }

  for (const [type, updates] of updatesByType) {
    const config = trackingConfigs.get(type)
    if (config?.updateHandler && updates.length) config.updateHandler(updates)
  }
  if (rootGraphId) {
    for (const [nodeId, element] of slotSyncElements) {
      syncSlotOffsets(element, rootGraphId, nodeId)
    }
  }
})

/**
 * Tracks DOM element size/position changes for a Vue component and syncs to layout store
 *
 * Sets up automatic ResizeObserver tracking when the component mounts and cleans up
 * when unmounted. The tracked element is identified by a data attribute set on the
 * component's root DOM element.
 *
 * @param appIdentifier - Application-level identifier for this tracked element (not a DOM ID)
 *                       Example: node ID like 'node-123', widget ID like 'widget-456'
 * @param trackingType - Type of element being tracked, determines which tracking config to use
 *                      Example: 'node' for Vue nodes, 'widget' for UI widgets
 *
 * @example
 * ```ts
 * // Track a Vue node component with ID 'my-node-123'
 * useVueElementTracking('my-node-123', 'node')
 *
 * // Would set data-node-id="my-node-123" on the component's root element
 * // and sync size changes to layoutStore.batchUpdateNodeBounds()
 * ```
 */
export function useVueElementTracking(
  appIdentifier: string,
  trackingType: string
) {
  const instance = getCurrentInstance()
  let trackedElement: HTMLElement | null = null
  let dataAttribute: string | null = null
  let isDeactivated = false

  onMounted(() => {
    const element = instance?.proxy?.$el
    if (!(element instanceof HTMLElement) || !appIdentifier) return

    const config = trackingConfigs.get(trackingType)
    if (!config) return

    trackedElement = element
    dataAttribute = config.dataAttribute
    // Set the data attribute expected by the RO pipeline for this type
    element.dataset[config.dataAttribute] = appIdentifier
    markElementForFreshMeasurement(element)
    resizeObserver.observe(element)
  })

  onDeactivated(() => {
    if (!trackedElement) return
    isDeactivated = true
    markElementForFreshMeasurement(trackedElement)
    deferredElements.delete(trackedElement)
    resizeObserver.unobserve(trackedElement)
  })

  onActivated(() => {
    if (!trackedElement || !isDeactivated) return
    isDeactivated = false
    markElementForFreshMeasurement(trackedElement)
    resizeObserver.observe(trackedElement)
  })

  onUnmounted(() => {
    if (!trackedElement || !dataAttribute) return

    // Remove the data attribute and observer
    delete trackedElement.dataset[dataAttribute]
    cachedNodeMeasurements.delete(trackedElement)
    elementsNeedingFreshMeasurement.delete(trackedElement)
    deferredElements.delete(trackedElement)
    resizeObserver.unobserve(trackedElement)
  })
}
