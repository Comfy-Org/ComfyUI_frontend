import { useEventListener } from '@vueuse/core'
import { ref } from 'vue'
import type { Ref } from 'vue'

import type { Point2D } from '@comfyorg/shared-frontend-utils/geometry'
import { resizeAxes } from '@/renderer/extensions/vueNodes/interactions/resize/resizeDirection'
import type { ResizeDirection } from '@/renderer/extensions/vueNodes/interactions/resize/resizeDirection'

import { resizePanel, roomInViewport } from './resizePanel'
import type { PanelSide, PanelSize } from './resizePanel'

type PanelMeasure = {
  start: PanelSize
  startOffset: number
  max: PanelSize
}

/**
 * Resizes the trigger-aligned popover panel that holds the resize handles,
 * keeping it on its current side of the trigger while it is resized.
 */
export function usePanelResize({
  size,
  alignOffset,
  side,
  anchor
}: {
  size: Ref<PanelSize | undefined>
  alignOffset: Ref<number>
  side: Ref<PanelSide | undefined>
  anchor: () => HTMLElement | undefined
}) {
  const isResizing = ref(false)
  let activePointerId: number | undefined

  function beginResize(
    handle: EventTarget | null,
    direction: ResizeDirection
  ): PanelMeasure | undefined {
    const panel = handle instanceof HTMLElement && handle.parentElement
    if (!panel) return
    const rect = panel.getBoundingClientRect()
    const style = getComputedStyle(panel)
    const room = roomInViewport(
      rect,
      { width: window.innerWidth, height: window.innerHeight },
      direction
    )
    side.value = panel.dataset.side === 'top' ? 'top' : 'bottom'
    const anchorElement = anchor()
    return {
      start: { width: rect.width, height: rect.height },
      startOffset: anchorElement
        ? anchorElement.getBoundingClientRect().right - rect.right
        : alignOffset.value,
      max: {
        width: Math.min(parseFloat(style.maxWidth) || Infinity, room.width),
        height: Math.min(parseFloat(style.maxHeight) || Infinity, room.height)
      }
    }
  }

  function resizeFrom(
    panel: PanelMeasure,
    direction: ResizeDirection,
    pointer: Point2D
  ) {
    const next = resizePanel(panel.start, pointer, {
      direction,
      max: panel.max
    })
    size.value = next
    alignOffset.value =
      resizeAxes(direction).x === 1
        ? panel.startOffset - (next.width - panel.start.width)
        : panel.startOffset
  }

  function startResize(event: PointerEvent, direction: ResizeDirection) {
    const handle = event.currentTarget
    if (activePointerId !== undefined || !(handle instanceof HTMLElement))
      return
    const panel = beginResize(handle, direction)
    if (!panel) return
    const { pointerId } = event
    activePointerId = pointerId
    isResizing.value = true
    handle.setPointerCapture(pointerId)

    const end = (endEvent: PointerEvent) => {
      if (endEvent.pointerId !== pointerId) return
      activePointerId = undefined
      isResizing.value = false
      stopMove()
      stopUp()
      stopCancel()
    }
    const stopMove = useEventListener(handle, 'pointermove', (moveEvent) => {
      if (moveEvent.pointerId !== pointerId) return
      resizeFrom(panel, direction, {
        x: moveEvent.clientX - event.clientX,
        y: moveEvent.clientY - event.clientY
      })
    })
    const stopUp = useEventListener(handle, 'pointerup', end)
    const stopCancel = useEventListener(handle, 'pointercancel', end)
  }

  function nudge(
    event: KeyboardEvent,
    direction: ResizeDirection,
    delta: Point2D
  ) {
    const panel = beginResize(event.currentTarget, direction)
    if (panel) resizeFrom(panel, direction, delta)
  }

  function reset() {
    size.value = undefined
    alignOffset.value = 0
    side.value = undefined
  }

  return { isResizing, startResize, nudge, reset }
}
