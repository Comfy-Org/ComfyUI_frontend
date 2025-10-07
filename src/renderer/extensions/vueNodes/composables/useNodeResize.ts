import { useEventListener } from '@vueuse/core'
import { ref } from 'vue'

import type { TransformState } from '@/renderer/core/layout/injectionKeys'

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

  const startResize = (event: PointerEvent) => {
    event.preventDefault()
    event.stopPropagation()

    const target = event.currentTarget
    if (!(target instanceof HTMLElement)) return

    // Capture pointer to ensure we get all move/up events
    target.setPointerCapture(event.pointerId)

    isResizing.value = true
    resizeStartPos.value = { x: event.clientX, y: event.clientY }

    // Get current node size from the DOM and calculate intrinsic min size
    const nodeElement = target.closest('[data-node-id]')
    if (!(nodeElement instanceof HTMLElement)) return

    const rect = nodeElement.getBoundingClientRect()

    // Calculate intrinsic content size once at start
    const originalWidth = nodeElement.style.width
    const originalHeight = nodeElement.style.height
    nodeElement.style.width = 'auto'
    nodeElement.style.height = 'auto'

    const intrinsicRect = nodeElement.getBoundingClientRect()

    // Restore original size
    nodeElement.style.width = originalWidth
    nodeElement.style.height = originalHeight

    // Convert to canvas coordinates using transform state
    const scale = transformState.camera.z
    resizeStartSize.value = {
      width: rect.width / scale,
      height: rect.height / scale
    }
    intrinsicMinSize.value = {
      width: intrinsicRect.width / scale,
      height: intrinsicRect.height / scale
    }

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
      const newWidth = Math.max(
        intrinsicMinSize.value.width,
        resizeStartSize.value.width + scaledDx
      )
      const newHeight = Math.max(
        intrinsicMinSize.value.height,
        resizeStartSize.value.height + scaledDy
      )

      // Get the node element to apply size directly
      const nodeElement = target.closest('[data-node-id]')
      if (nodeElement instanceof HTMLElement) {
        resizeCallback({ width: newWidth, height: newHeight }, nodeElement)
      }
    }

    const handlePointerUp = (upEvent: PointerEvent) => {
      if (isResizing.value) {
        isResizing.value = false
        resizeStartPos.value = null
        resizeStartSize.value = null
        intrinsicMinSize.value = null

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
