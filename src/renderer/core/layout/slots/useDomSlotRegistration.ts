/**
 * DOM-based slot registration with performance optimization
 *
 * Measures the actual DOM position of a Vue slot connector and registers it
 * into the LayoutStore so hit-testing and link rendering use the true position.
 *
 * Performance strategy:
 * - Cache slot offset relative to node (avoids DOM reads during drag)
 * - No measurements during pan/zoom (camera transforms don't change canvas coords)
 * - Batch DOM reads via requestAnimationFrame
 * - Only remeasure on structural changes (resize, collapse, LOD)
 */
import {
  type Ref,
  type WatchStopHandle,
  nextTick,
  onMounted,
  onUnmounted,
  ref,
  watch
} from 'vue'

import { LiteGraph } from '@/lib/litegraph/src/litegraph'
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import type { Point as LayoutPoint } from '@/renderer/core/layout/types'

import { getSlotKey } from './slotIdentifier'

export type TransformState = {
  screenToCanvas: (p: LayoutPoint) => LayoutPoint
}

// Shared RAF queue for batching measurements
const measureQueue = new Set<() => void>()
let rafId: number | null = null
// Track mounted components to prevent execution on unmounted ones
const mountedComponents = new WeakSet<object>()

function scheduleMeasurement(fn: () => void) {
  measureQueue.add(fn)
  if (rafId === null) {
    rafId = requestAnimationFrame(() => {
      rafId = null
      const batch = Array.from(measureQueue)
      measureQueue.clear()
      batch.forEach((measure) => measure())
    })
  }
}

const cleanupFunctions = new WeakMap<
  Ref<HTMLElement | null>,
  {
    stopWatcher?: WatchStopHandle
    handleResize?: () => void
  }
>()

interface SlotRegistrationOptions {
  nodeId: string
  slotIndex: number
  isInput: boolean
  element: Ref<HTMLElement | null>
  transform?: TransformState
}

export function useDomSlotRegistration(options: SlotRegistrationOptions) {
  const { nodeId, slotIndex, isInput, element: elRef, transform } = options

  // Early return if no nodeId
  if (!nodeId || nodeId === '') {
    return {
      remeasure: () => {}
    }
  }
  const slotKey = getSlotKey(nodeId, slotIndex, isInput)
  // Track if this component is mounted
  const componentToken = {}

  // Cached offset from node position (avoids DOM reads during drag)
  const cachedOffset = ref<LayoutPoint | null>(null)
  const lastMeasuredBounds = ref<DOMRect | null>(null)

  // Measure DOM and cache offset (expensive, minimize calls)
  const measureAndCacheOffset = () => {
    // Skip if component was unmounted
    if (!mountedComponents.has(componentToken)) {
      return
    }

    const el = elRef.value
    if (!el || !transform?.screenToCanvas) {
      return
    }

    const rect = el.getBoundingClientRect()

    // Skip if bounds haven't changed significantly (within 0.5px)
    if (lastMeasuredBounds.value) {
      const prev = lastMeasuredBounds.value
      if (
        Math.abs(rect.left - prev.left) < 0.5 &&
        Math.abs(rect.top - prev.top) < 0.5 &&
        Math.abs(rect.width - prev.width) < 0.5 &&
        Math.abs(rect.height - prev.height) < 0.5
      ) {
        return // No significant change - skip update
      }
    }

    lastMeasuredBounds.value = rect

    // Center of the visual connector (dot) in screen coords
    const centerScreen = {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2
    }
    const centerCanvas = transform.screenToCanvas(centerScreen)

    // Cache offset from node position for fast updates during drag
    const nodeLayout = layoutStore.getNodeLayoutRef(nodeId).value
    if (nodeLayout) {
      cachedOffset.value = {
        x: centerCanvas.x - nodeLayout.position.x,
        y: centerCanvas.y - nodeLayout.position.y
      }
    }

    updateSlotPosition(centerCanvas)
  }

  // Fast update using cached offset (no DOM read)
  const updateFromCachedOffset = () => {
    if (!cachedOffset.value) {
      // No cached offset yet, need to measure
      scheduleMeasurement(measureAndCacheOffset)
      return
    }

    const nodeLayout = layoutStore.getNodeLayoutRef(nodeId).value
    if (!nodeLayout) {
      return
    }

    // Calculate absolute position from node position + cached offset
    const centerCanvas = {
      x: nodeLayout.position.x + cachedOffset.value.x,
      y: nodeLayout.position.y + cachedOffset.value.y
    }

    updateSlotPosition(centerCanvas)
  }

  // Update slot position in layout store
  const updateSlotPosition = (centerCanvas: LayoutPoint) => {
    const size = LiteGraph.NODE_SLOT_HEIGHT
    const half = size / 2

    layoutStore.updateSlotLayout(slotKey, {
      nodeId,
      index: slotIndex,
      type: isInput ? 'input' : 'output',
      position: { x: centerCanvas.x, y: centerCanvas.y },
      bounds: {
        x: centerCanvas.x - half,
        y: centerCanvas.y - half,
        width: size,
        height: size
      }
    })
  }

  onMounted(async () => {
    // Mark component as mounted
    mountedComponents.add(componentToken)

    // Initial measure after mount
    await nextTick()
    measureAndCacheOffset()

    // Subscribe to node position changes for fast cached updates
    const nodeRef = layoutStore.getNodeLayoutRef(nodeId)

    const stopWatcher = watch(
      nodeRef,
      (newLayout) => {
        if (newLayout) {
          // Node moved/resized - update using cached offset
          updateFromCachedOffset()
        }
      },
      { immediate: false }
    )

    // Store cleanup functions without type assertions
    const cleanup = cleanupFunctions.get(elRef) || {}
    cleanup.stopWatcher = stopWatcher

    // Window resize - remeasure as viewport changed
    const handleResize = () => {
      scheduleMeasurement(measureAndCacheOffset)
    }
    window.addEventListener('resize', handleResize, { passive: true })
    cleanup.handleResize = handleResize
    cleanupFunctions.set(elRef, cleanup)
  })

  onUnmounted(() => {
    // Mark component as unmounted
    mountedComponents.delete(componentToken)

    // Clean up watchers and listeners
    const cleanup = cleanupFunctions.get(elRef)
    if (cleanup) {
      if (cleanup.stopWatcher) cleanup.stopWatcher()
      if (cleanup.handleResize) {
        window.removeEventListener('resize', cleanup.handleResize)
      }
      cleanupFunctions.delete(elRef)
    }

    // Remove from layout store
    layoutStore.deleteSlotLayout(slotKey)

    // Remove from measurement queue if pending
    measureQueue.delete(measureAndCacheOffset)
  })

  return {
    // Expose for forced remeasure on structural changes
    remeasure: () => scheduleMeasurement(measureAndCacheOffset)
  }
}
