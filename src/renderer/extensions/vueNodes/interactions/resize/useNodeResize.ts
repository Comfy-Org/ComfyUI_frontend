import { useEventListener } from '@vueuse/core'
import { ref } from 'vue'

import type { TransformState } from '@/renderer/core/layout/injectionKeys'
import type { Point, Size } from '@/renderer/core/layout/types'
import { useNodeSnap } from '@/renderer/extensions/vueNodes/composables/useNodeSnap'
import { useShiftKeySync } from '@/renderer/extensions/vueNodes/composables/useShiftKeySync'

import type { ResizeHandleDirection } from './resizeMath'
import { createResizeSession, toCanvasDelta } from './resizeMath'

interface UseNodeResizeOptions {
  /** Transform state for coordinate conversion */
  transformState: TransformState
}

interface ResizeCallbackPayload {
  size: Size
  position: Point
}

/**
 * Composable for node resizing functionality
 *
 * Provides resize handle interaction that integrates with the layout system.
 * Handles pointer capture, coordinate calculations, and size constraints.
 */
export function useNodeResize(
  resizeCallback: (
    payload: ResizeCallbackPayload,
    element: HTMLElement
  ) => void,
  options: UseNodeResizeOptions
) {
  const { transformState } = options

  const isResizing = ref(false)
  const resizeStartPointer = ref<Point | null>(null)
  const resizeSession = ref<
    | ((
        delta: Point,
        snapFn?: (size: Size) => Size
      ) => {
        size: Size
        position: Point
      })
    | null
  >(null)

  // Snap-to-grid functionality
  const { shouldSnap, applySnapToSize } = useNodeSnap()

  // Shift key sync for LiteGraph canvas preview
  const { trackShiftKey } = useShiftKeySync()

  const startResize = (
    event: PointerEvent,
    handle: ResizeHandleDirection,
    startPosition: Point
  ) => {
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

    isResizing.value = true
    resizeStartPointer.value = { x: event.clientX, y: event.clientY }
    resizeSession.value = createResizeSession({
      startSize,
      startPosition: { ...startPosition },
      handle
    })

    const handlePointerMove = (moveEvent: PointerEvent) => {
      if (
        !isResizing.value ||
        !resizeStartPointer.value ||
        !resizeSession.value
      )
        return

      const startPointer = resizeStartPointer.value
      const session = resizeSession.value

      const delta = toCanvasDelta(
        startPointer,
        { x: moveEvent.clientX, y: moveEvent.clientY },
        transformState.camera.z
      )

      const nodeElement = target.closest('[data-node-id]')
      if (nodeElement instanceof HTMLElement) {
        const outcome = session(
          delta,
          shouldSnap(moveEvent) ? applySnapToSize : undefined
        )

        resizeCallback(outcome, nodeElement)
      }
    }

    const handlePointerUp = (upEvent: PointerEvent) => {
      if (isResizing.value) {
        isResizing.value = false
        resizeStartPointer.value = null
        resizeSession.value = null

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
