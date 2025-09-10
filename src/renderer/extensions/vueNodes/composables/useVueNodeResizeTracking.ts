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
import { getCurrentInstance, inject, onMounted, onUnmounted } from 'vue'

import { LiteGraph } from '@/lib/litegraph/src/litegraph'
import { TransformStateKey } from '@/renderer/core/layout/injectionKeys'
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import type { Point } from '@/renderer/core/layout/types'
import type { Bounds, NodeId } from '@/renderer/core/layout/types'

import { remeasureNodeSlotsNow } from './useSlotElementTracking'

// Per-element conversion context
const elementConversion = new WeakMap<
  HTMLElement,
  { screenToCanvas?: (p: Point) => Point }
>()

/**
 * Generic update item for element bounds tracking
 */
interface ElementBoundsUpdate {
  /** Element identifier (could be nodeId, widgetId, slotId, etc.) */
  id: string
  /** Updated bounds */
  bounds: Bounds
}

/**
 * Configuration for different types of tracked elements
 */
interface ElementTrackingConfig {
  /** Data attribute name (e.g., 'nodeId') */
  dataAttribute: string
  /** Handler for processing bounds updates */
  updateHandler: (updates: ElementBoundsUpdate[]) => void
}

/**
 * Registry of tracking configurations by element type
 */
const trackingConfigs: Map<string, ElementTrackingConfig> = new Map([
  [
    'node',
    {
      dataAttribute: 'nodeId',
      updateHandler: (updates) => {
        const nodeUpdates = updates.map(({ id, bounds }) => ({
          nodeId: id as NodeId,
          bounds
        }))
        layoutStore.batchUpdateNodeBounds(nodeUpdates)
      }
    }
  ]
])

// Single ResizeObserver instance for all Vue elements
const resizeObserver = new ResizeObserver((entries) => {
  // Group updates by type, then flush via each config's handler
  const updatesByType = new Map<string, ElementBoundsUpdate[]>()
  // Track nodes whose slots should be remeasured after node size changes
  const nodesNeedingSlotRemeasure = new Set<string>()

  // Read container origin once per batch to avoid repeated layout reads
  const container = document.getElementById('graph-canvas-container')
  const originRect = container?.getBoundingClientRect()
  const originLeft = originRect?.left ?? 0
  const originTop = originRect?.top ?? 0

  for (const entry of entries) {
    if (!(entry.target instanceof HTMLElement)) continue
    const element = entry.target

    // Identify type + id via config dataAttribute
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

    // Use contentBoxSize when available; fall back to contentRect for older engines/tests
    const contentBox = Array.isArray(entry.contentBoxSize)
      ? entry.contentBoxSize[0]
      : {
          inlineSize: entry.contentRect.width,
          blockSize: entry.contentRect.height
        }
    const width = contentBox.inlineSize
    const height = contentBox.blockSize

    // Screen-space rect
    const rect = element.getBoundingClientRect()
    let bounds: Bounds = { x: rect.left, y: rect.top, width, height }

    // Convert position to canvas space (top-left), leave size as-is
    // Note: ResizeObserver sizes are pre-transform; they already represent canvas units.
    const ctx = elementConversion.get(element)
    if (ctx?.screenToCanvas) {
      const topLeftCanvas = ctx.screenToCanvas({
        x: bounds.x - originLeft,
        y: bounds.y - originTop
      })
      bounds = {
        x: topLeftCanvas.x,
        y: topLeftCanvas.y + LiteGraph.NODE_TITLE_HEIGHT,
        width: Math.max(0, width),
        height: Math.max(0, height - LiteGraph.NODE_TITLE_HEIGHT)
      }
    }

    let updates = updatesByType.get(elementType)
    if (!updates) {
      updates = []
      updatesByType.set(elementType, updates)
    }
    updates.push({ id: elementId, bounds })

    // If this entry is a node, mark it for slot remeasure
    if (elementType === 'node' && elementId) {
      nodesNeedingSlotRemeasure.add(elementId)
    }
  }

  // Flush per-type
  for (const [type, updates] of updatesByType) {
    const config = trackingConfigs.get(type)
    if (config && updates.length) config.updateHandler(updates)
  }

  // After node bounds are updated, refresh slot cached offsets and layouts
  if (nodesNeedingSlotRemeasure.size > 0) {
    for (const nodeId of nodesNeedingSlotRemeasure) {
      remeasureNodeSlotsNow(nodeId, { left: originLeft, top: originTop })
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
  // For canvas-space conversion: provided by TransformPane
  const transformState = inject(TransformStateKey)

  onMounted(() => {
    const element = getCurrentInstance()?.proxy?.$el
    if (!(element instanceof HTMLElement) || !appIdentifier) return

    const config = trackingConfigs.get(trackingType)
    if (!config) return // Set the data attribute expected by the RO pipeline for this type
    element.dataset[config.dataAttribute] = appIdentifier
    // Remember transformer for this element
    if (transformState?.screenToCanvas) {
      elementConversion.set(element, {
        screenToCanvas: transformState.screenToCanvas
      })
    }
    resizeObserver.observe(element)
  })

  onUnmounted(() => {
    const element = getCurrentInstance()?.proxy?.$el
    if (!(element instanceof HTMLElement)) return

    const config = trackingConfigs.get(trackingType)
    if (!config) return

    // Remove the data attribute and observer
    delete element.dataset[config.dataAttribute]
    resizeObserver.unobserve(element)
    elementConversion.delete(element)
  })
}
