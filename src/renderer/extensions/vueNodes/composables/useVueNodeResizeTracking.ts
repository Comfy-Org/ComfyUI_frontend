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
import type { EffectScope, Ref } from 'vue'
import {
  effectScope,
  getCurrentInstance,
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
import type { Bounds, NodeId, Size } from '@/renderer/core/layout/types'
import { toNodeId } from '@/types/nodeId'
import { isSizeEqual } from '@/renderer/core/layout/utils/geometry'
import { removeNodeTitleHeight } from '@/renderer/core/layout/utils/nodeSizeUtil'
import type { UUID } from '@/utils/uuid'

/**
 * Generic update item for element bounds tracking
 */
interface ElementBoundsUpdate {
  id: NodeId
  /** Updated bounds */
  bounds: Bounds
}

interface CachedNodeMeasurement {
  rootGraphId: UUID
  nodeId: NodeId
  size: Size
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

const deferredElements = new Set<HTMLElement>()
const elementsNeedingFreshMeasurement = new WeakSet<HTMLElement>()
const cachedNodeMeasurements = new WeakMap<HTMLElement, CachedNodeMeasurement>()
const trackedElements = new Set<HTMLElement>()

interface ResizeTracking {
  scope: EffectScope
  observer: ResizeObserver
  visibility: Ref<DocumentVisibilityState>
}

let resizeTracking: ResizeTracking | undefined

function markElementForFreshMeasurement(element: HTMLElement) {
  elementsNeedingFreshMeasurement.add(element)
  cachedNodeMeasurements.delete(element)
}

function measureEntries(
  entries: ResizeObserverEntry[],
  { observer, visibility }: ResizeTracking
) {
  const { linearMode, rootGraphId } = useCanvasStore()
  if (linearMode) return

  if (visibility.value === 'hidden') {
    for (const entry of entries) {
      if (entry.target instanceof HTMLElement) {
        deferredElements.add(entry.target)
        observer.unobserve(entry.target)
      }
    }
    return
  }

  const conv = useSharedCanvasPositionConversion()
  const updatesByType = new Map<string, ElementBoundsUpdate[]>()
  const slotSyncElements = new Map<NodeId, HTMLElement>()
  for (const entry of entries) {
    if (!(entry.target instanceof HTMLElement)) continue
    const element = entry.target

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
    const measuredSize = { width, height: normalizedHeight }
    const previousMeasurement = cachedNodeMeasurements.get(element)
    const reportedContentSize =
      nodeId && rootGraphId
        ? layoutStore.contentSizeOf(rootGraphId, nodeId)
        : undefined
    const hasFreshMeasurementPending =
      elementsNeedingFreshMeasurement.has(element)
    const hasMatchingCachedNodeMeasurement =
      previousMeasurement != null &&
      previousMeasurement.rootGraphId === rootGraphId &&
      previousMeasurement.nodeId === nodeId &&
      isSizeEqual(previousMeasurement.size, measuredSize) &&
      reportedContentSize != null &&
      isSizeEqual(reportedContentSize, measuredSize)

    if (!hasFreshMeasurementPending && hasMatchingCachedNodeMeasurement) {
      continue
    }
    if (rootGraphId) {
      slotSyncElements.set(nodeId, element)
    }

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
    elementsNeedingFreshMeasurement.delete(element)
    if (nodeId && rootGraphId) {
      cachedNodeMeasurements.set(element, {
        rootGraphId,
        nodeId,
        size: measuredSize
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
}

function createResizeTracking(scope: EffectScope): ResizeTracking {
  const tracking: ResizeTracking = {
    scope,
    visibility: useDocumentVisibility(),
    observer: new ResizeObserver((entries) => measureEntries(entries, tracking))
  }
  watch(tracking.visibility, (state) => {
    if (state !== 'visible' || deferredElements.size === 0) return

    for (const element of deferredElements) {
      if (element.isConnected) {
        tracking.observer.observe(element)
      }
    }
    deferredElements.clear()
  })
  return tracking
}

function startResizeTracking() {
  const scope = effectScope(true)
  return scope.run(() => createResizeTracking(scope))
}

function stopResizeTracking() {
  resizeTracking?.scope.stop()
  resizeTracking?.observer.disconnect()
  resizeTracking = undefined
  trackedElements.clear()
  deferredElements.clear()
}

function trackElement(element: HTMLElement) {
  trackedElements.add(element)
  resizeTracking ??= startResizeTracking()
  resizeTracking?.observer.observe(element)
}

function untrackElement(element: HTMLElement) {
  if (!trackedElements.delete(element)) return
  resizeTracking?.observer.unobserve(element)
  if (trackedElements.size === 0) stopResizeTracking()
}

import.meta.hot?.dispose(stopResizeTracking)

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
  onMounted(() => {
    const element = getCurrentInstance()?.proxy?.$el
    if (!(element instanceof HTMLElement) || !appIdentifier) return

    const config = trackingConfigs.get(trackingType)
    if (!config) return

    element.dataset[config.dataAttribute] = appIdentifier
    markElementForFreshMeasurement(element)
    trackElement(element)
  })

  onUnmounted(() => {
    const element = getCurrentInstance()?.proxy?.$el
    if (!(element instanceof HTMLElement)) return

    const config = trackingConfigs.get(trackingType)
    if (!config) return

    delete element.dataset[config.dataAttribute]
    cachedNodeMeasurements.delete(element)
    elementsNeedingFreshMeasurement.delete(element)
    deferredElements.delete(element)
    untrackElement(element)
  })
}
