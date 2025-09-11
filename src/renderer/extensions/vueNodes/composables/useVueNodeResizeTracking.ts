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
import { getCurrentInstance, onMounted, onUnmounted } from 'vue'

import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import type { Bounds, NodeId } from '@/renderer/core/layout/types'

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
  // Group updates by element type
  const updatesByType = new Map<string, ElementBoundsUpdate[]>()

  for (const entry of entries) {
    if (!(entry.target instanceof HTMLElement)) continue
    const element = entry.target

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

    const { inlineSize: width, blockSize: height } = entry.contentBoxSize[0]
    const rect = element.getBoundingClientRect()

    const bounds: Bounds = {
      x: rect.left,
      y: rect.top,
      width,
      height: height
    }

    if (!updatesByType.has(elementType)) {
      updatesByType.set(elementType, [])
    }
    const updates = updatesByType.get(elementType)
    if (updates) {
      updates.push({ id: elementId, bounds })
    }
  }

  // Process updates by type
  for (const [type, updates] of updatesByType) {
    const config = trackingConfigs.get(type)
    if (config && updates.length > 0) {
      config.updateHandler(updates)
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
  onMounted(() => {
    const element = getCurrentInstance()?.proxy?.$el
    if (!(element instanceof HTMLElement) || !appIdentifier) return

    const config = trackingConfigs.get(trackingType)
    if (config) {
      // Set the appropriate data attribute
      element.dataset[config.dataAttribute] = appIdentifier
      resizeObserver.observe(element)
    }
  })

  onUnmounted(() => {
    const element = getCurrentInstance()?.proxy?.$el
    if (!(element instanceof HTMLElement)) return

    const config = trackingConfigs.get(trackingType)
    if (config) {
      // Remove the data attribute
      delete element.dataset[config.dataAttribute]
      resizeObserver.unobserve(element)
    }
  })
}
