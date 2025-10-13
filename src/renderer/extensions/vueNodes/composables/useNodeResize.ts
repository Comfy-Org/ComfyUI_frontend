import { useEventListener } from '@vueuse/core'
import { ref } from 'vue'

import type { TransformState } from '@/renderer/core/layout/injectionKeys'
import { useNodeSnap } from '@/renderer/extensions/vueNodes/composables/useNodeSnap'
import { useShiftKeySync } from '@/renderer/extensions/vueNodes/composables/useShiftKeySync'
import { calculateIntrinsicSize } from '@/renderer/extensions/vueNodes/utils/calculateIntrinsicSize'

interface Size {
  width: number
  height: number
}

interface Position {
  x: number
  y: number
}

interface UseNodeResizeOptions {
  /** Transform state for coordinate conversion */
  transformState: TransformState
}

/**
 * Composable for node resizing functionality
 *
 * Provides resize handle interaction that integrates with the layout system.
 * Handles pointer capture, coordinate calculations, and size constraints.
 */
export function useNodeResize(
  resizeCallback: (size: Size, element: HTMLElement) => void,
  options: UseNodeResizeOptions
) {
  const { transformState } = options

  const isResizing = ref(false)
  const resizeStartPos = ref<Position | null>(null)
  const resizeStartSize = ref<Size | null>(null)
  const intrinsicMinSize = ref<Size | null>(null)

  // Snap-to-grid functionality
  const { shouldSnap, applySnapToSize } = useNodeSnap()

  // Shift key sync for LiteGraph canvas preview
  const { trackShiftKey } = useShiftKeySync()

  const startResize = (event: PointerEvent) => {
    event.preventDefault()
    event.stopPropagation()

    const target = event.currentTarget
    if (!(target instanceof HTMLElement)) return

    // Track shift key state and sync to canvas for snap preview
    const stopShiftSync = trackShiftKey(event)

    // Capture pointer to ensure we get all move/up events
    target.setPointerCapture(event.pointerId)

    isResizing.value = true
    resizeStartPos.value = { x: event.clientX, y: event.clientY }

    // Get current node size from the DOM and calculate intrinsic min size
    const nodeElement = target.closest('[data-node-id]')
    if (!(nodeElement instanceof HTMLElement)) return

    const rect = nodeElement.getBoundingClientRect()
    const scale = transformState.camera.z

    // Calculate current size in canvas coordinates
    resizeStartSize.value = {
      width: rect.width / scale,
      height: rect.height / scale
    }

    // Calculate intrinsic content size (minimum based on content)
    intrinsicMinSize.value = calculateIntrinsicSize(nodeElement, scale)

    const handlePointerMove = (moveEvent: PointerEvent) => {
      if (
        !isResizing.value ||
        !resizeStartPos.value ||
        !resizeStartSize.value ||
        !intrinsicMinSize.value
      )
        return

      const dx = moveEvent.clientX - resizeStartPos.value.x
      const dy = moveEvent.clientY - resizeStartPos.value.y

      // Apply scale factor from transform state
      const scale = transformState.camera.z
      const scaledDx = dx / scale
      const scaledDy = dy / scale

      // Apply constraints: only minimum size based on content, no maximum
      const constrainedSize = {
        width: Math.max(
          intrinsicMinSize.value.width,
          resizeStartSize.value.width + scaledDx
        ),
        height: Math.max(
          intrinsicMinSize.value.height,
          resizeStartSize.value.height + scaledDy
        )
      }

      // Apply snap-to-grid if shift is held or always snap is enabled
      const finalSize = shouldSnap(moveEvent)
        ? applySnapToSize(constrainedSize)
        : constrainedSize

      // Get the node element to apply size directly
      const nodeElement = target.closest('[data-node-id]')
      if (nodeElement instanceof HTMLElement) {
        resizeCallback(finalSize, nodeElement)
      }
    }

    const handlePointerUp = (upEvent: PointerEvent) => {
      if (isResizing.value) {
        isResizing.value = false
        resizeStartPos.value = null
        resizeStartSize.value = null
        intrinsicMinSize.value = null

        // Stop tracking shift key state
        stopShiftSync()

        target.releasePointerCapture(upEvent.pointerId)
        stopMoveListen()
        stopUpListen()
      }
    }

    const stopMoveListen = useEventListener('pointermove', handlePointerMove)
    const stopUpListen = useEventListener('pointerup', handlePointerUp)
  }

  return {
    startResize,
    isResizing
  }
}
