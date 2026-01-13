import { useEventListener } from '@vueuse/core'
import { ref } from 'vue'

import type { Point, Size } from '@/renderer/core/layout/types'
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import { useNodeSnap } from '@/renderer/extensions/vueNodes/composables/useNodeSnap'
import { useShiftKeySync } from '@/renderer/extensions/vueNodes/composables/useShiftKeySync'
import { useTransformState } from '@/renderer/core/layout/transform/useTransformState'

interface ResizeCallbackPayload {
  size: Size
}

/**
 * Composable for node resizing functionality (bottom-right corner only)
 *
 * Provides resize handle interaction that integrates with the layout system.
 * Handles pointer capture, coordinate calculations, and size constraints.
 */
export function useNodeResize(
  resizeCallback: (payload: ResizeCallbackPayload, element: HTMLElement) => void
) {
  const transformState = useTransformState()

  const isResizing = ref(false)
  const resizeStartPointer = ref<Point | null>(null)
  const resizeStartSize = ref<Size | null>(null)

  // Snap-to-grid functionality
  const { shouldSnap, applySnapToSize } = useNodeSnap()

  // Shift key sync for LiteGraph canvas preview
  const { trackShiftKey } = useShiftKeySync()

  const startResize = (event: PointerEvent) => {
    event.preventDefault()
    event.stopPropagation()

    const target = event.currentTarget
    if (!(target instanceof HTMLElement)) return

    const nodeElement = target.closest('[data-node-id]')
    if (!(nodeElement instanceof HTMLElement)) return

    const rect = nodeElement.getBoundingClientRect()
    const scale = transformState.camera.z

    const startSize: Size = {
      width: rect.width / scale,
      height: rect.height / scale
    }

    // Track shift key state and sync to canvas for snap preview
    const stopShiftSync = trackShiftKey(event)

    // Capture pointer to ensure we get all move/up events
    target.setPointerCapture(event.pointerId)

    // Mark as resizing to prevent drag from activating
    layoutStore.isResizingVueNodes.value = true
    isResizing.value = true
    resizeStartPointer.value = { x: event.clientX, y: event.clientY }
    resizeStartSize.value = startSize

    const handlePointerMove = (moveEvent: PointerEvent) => {
      if (
        !isResizing.value ||
        !resizeStartPointer.value ||
        !resizeStartSize.value
      ) {
        return
      }

      const scale = transformState.camera.z
      const deltaX =
        (moveEvent.clientX - resizeStartPointer.value.x) / (scale || 1)
      const deltaY =
        (moveEvent.clientY - resizeStartPointer.value.y) / (scale || 1)

      let newSize: Size = {
        width: resizeStartSize.value.width + deltaX,
        height: resizeStartSize.value.height + deltaY
      }

      // Apply snap if shift is held
      if (shouldSnap(moveEvent)) {
        newSize = applySnapToSize(newSize)
      }

      const nodeElement = target.closest('[data-node-id]')
      if (nodeElement instanceof HTMLElement) {
        resizeCallback({ size: newSize }, nodeElement)
      }
    }

    const handlePointerUp = (upEvent: PointerEvent) => {
      if (isResizing.value) {
        isResizing.value = false
        layoutStore.isResizingVueNodes.value = false
        resizeStartPointer.value = null
        resizeStartSize.value = null

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
