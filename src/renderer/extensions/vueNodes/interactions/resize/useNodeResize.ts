import { useEventListener } from '@vueuse/core'
import { ref } from 'vue'

import type { CompassCorners } from '@/lib/litegraph/src/interfaces'
import type { Point, Size } from '@/renderer/core/layout/types'
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import { MIN_NODE_WIDTH } from '@/renderer/core/layout/transform/graphRenderTransform'
import { useNodeSnap } from '@/renderer/extensions/vueNodes/composables/useNodeSnap'
import { useShiftKeySync } from '@/renderer/extensions/vueNodes/composables/useShiftKeySync'
import { useTransformState } from '@/renderer/core/layout/transform/useTransformState'
import {
  hasNorthEdge,
  hasWestEdge
} from '@/renderer/extensions/vueNodes/interactions/resize/resizeHandleConfig'

export interface ResizeCallbackPayload {
  size: Size
  position?: Point
}

/**
 * Composable for node resizing functionality from any corner.
 *
 * Provides resize handle interaction that integrates with the layout system.
 * Handles pointer capture, coordinate calculations, size constraints,
 * and position adjustments for non-SE corners.
 */
export function useNodeResize(
  resizeCallback: (payload: ResizeCallbackPayload, element: HTMLElement) => void
) {
  const transformState = useTransformState()

  const isResizing = ref(false)
  const resizeStartPointer = ref<Point | null>(null)
  const resizeStartSize = ref<Size | null>(null)
  const resizeStartPosition = ref<Point | null>(null)
  const resizeCorner = ref<CompassCorners>('SE')

  // Snap-to-grid functionality
  const { shouldSnap, applySnapToPosition, applySnapToSize } = useNodeSnap()

  // Shift key sync for LiteGraph canvas preview
  const { trackShiftKey } = useShiftKeySync()

  const startResize = (event: PointerEvent, corner: CompassCorners = 'SE') => {
    event.preventDefault()
    event.stopPropagation()

    const target = event.currentTarget
    if (!(target instanceof HTMLElement)) return

    const nodeElement = target.closest('[data-node-id]')
    if (!(nodeElement instanceof HTMLElement)) return

    const nodeId = nodeElement.dataset.nodeId
    if (!nodeId) return

    const rect = nodeElement.getBoundingClientRect()
    const scale = transformState.camera.z

    const startSize: Size = {
      width: rect.width / scale,
      height: rect.height / scale
    }

    const savedNodeHeight = nodeElement.style.getPropertyValue('--node-height')
    nodeElement.style.setProperty('--node-height', '0px')
    const minContentHeight = nodeElement.getBoundingClientRect().height / scale
    nodeElement.style.setProperty('--node-height', savedNodeHeight || '')

    const nodeLayout = layoutStore.getNodeLayoutRef(nodeId).value
    const startPosition: Point = nodeLayout
      ? { ...nodeLayout.position }
      : { x: 0, y: 0 }

    // Track shift key state and sync to canvas for snap preview
    const stopShiftSync = trackShiftKey(event)

    // Capture pointer to ensure we get all move/up events
    target.setPointerCapture(event.pointerId)

    // Mark as resizing to prevent drag from activating
    layoutStore.isResizingVueNodes.value = true
    isResizing.value = true
    resizeStartPointer.value = { x: event.clientX, y: event.clientY }
    resizeStartSize.value = startSize
    resizeStartPosition.value = startPosition
    resizeCorner.value = corner

    const handlePointerMove = (moveEvent: PointerEvent) => {
      if (
        !isResizing.value ||
        !resizeStartPointer.value ||
        !resizeStartSize.value ||
        !resizeStartPosition.value
      ) {
        return
      }

      const scale = transformState.camera.z
      const deltaX =
        (moveEvent.clientX - resizeStartPointer.value.x) / (scale || 1)
      const deltaY =
        (moveEvent.clientY - resizeStartPointer.value.y) / (scale || 1)

      const activeCorner = resizeCorner.value
      let newWidth: number
      let newHeight: number
      let newX = resizeStartPosition.value.x
      let newY = resizeStartPosition.value.y

      switch (activeCorner) {
        case 'NE':
          newY = resizeStartPosition.value.y + deltaY
          newWidth = resizeStartSize.value.width + deltaX
          newHeight = resizeStartSize.value.height - deltaY
          break
        case 'SW':
          newX = resizeStartPosition.value.x + deltaX
          newWidth = resizeStartSize.value.width - deltaX
          newHeight = resizeStartSize.value.height + deltaY
          break
        case 'NW':
          newX = resizeStartPosition.value.x + deltaX
          newY = resizeStartPosition.value.y + deltaY
          newWidth = resizeStartSize.value.width - deltaX
          newHeight = resizeStartSize.value.height - deltaY
          break
        default: // SE
          newWidth = resizeStartSize.value.width + deltaX
          newHeight = resizeStartSize.value.height + deltaY
          break
      }

      const isWestCorner = hasWestEdge(activeCorner)
      const isNorthCorner = hasNorthEdge(activeCorner)

      // Apply snap-to-grid
      if (shouldSnap(moveEvent)) {
        // Snap position first for N/W corners, then compensate size
        if (isNorthCorner || isWestCorner) {
          const originalX = newX
          const originalY = newY
          const snapped = applySnapToPosition({ x: newX, y: newY })
          newX = snapped.x
          newY = snapped.y

          if (isNorthCorner) {
            newHeight += originalY - newY
          }
          if (isWestCorner) {
            newWidth += originalX - newX
          }
        }

        const snappedSize = applySnapToSize({
          width: newWidth,
          height: newHeight
        })
        newWidth = snappedSize.width
        newHeight = snappedSize.height
      }

      // Enforce minimum size with position compensation (matching litegraph)
      const minWidth =
        parseFloat(nodeElement.style.getPropertyValue('min-width') || '0') ||
        MIN_NODE_WIDTH
      if (newWidth < minWidth) {
        if (isWestCorner) {
          newX =
            resizeStartPosition.value.x + resizeStartSize.value.width - minWidth
        }
        newWidth = minWidth
      }
      if (newHeight < minContentHeight) {
        if (isNorthCorner) {
          newY =
            resizeStartPosition.value.y +
            resizeStartSize.value.height -
            minContentHeight
        }
        newHeight = minContentHeight
      }

      const payload: ResizeCallbackPayload = {
        size: { width: newWidth, height: newHeight }
      }

      // Only include position for non-SE corners
      if (activeCorner !== 'SE') {
        payload.position = { x: newX, y: newY }
      }

      const targetNodeElement = target.closest('[data-node-id]')
      if (targetNodeElement instanceof HTMLElement) {
        resizeCallback(payload, targetNodeElement)
      }
    }

    const cleanup = () => {
      if (!isResizing.value) return
      isResizing.value = false
      layoutStore.isResizingVueNodes.value = false
      resizeStartPointer.value = null
      resizeStartSize.value = null
      resizeStartPosition.value = null

      // Stop tracking shift key state
      stopShiftSync()

      stopMoveListen()
      stopUpListen()
      stopCancelListen()
    }

    const handlePointerUp = (upEvent: PointerEvent) => {
      if (isResizing.value) {
        try {
          target.releasePointerCapture(upEvent.pointerId)
        } catch {
          // Pointer capture may already be released
        }
        cleanup()
      }
    }

    const stopMoveListen = useEventListener('pointermove', handlePointerMove)
    const stopUpListen = useEventListener('pointerup', handlePointerUp)
    const stopCancelListen = useEventListener('pointercancel', cleanup)
  }

  return {
    startResize,
    isResizing
  }
}
