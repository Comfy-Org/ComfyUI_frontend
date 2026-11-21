import { LiteGraph } from '@/lib/litegraph/src/litegraph'
import type { LGraphCanvas } from '@/lib/litegraph/src/litegraph'

import { useApp } from '@/scripts/appInstance'

import { canvasOrReport } from './touchCanvasAccess'
import { touchGesture } from './touchPointerGuards'
import type { ComfyExtension } from '@/types/comfy'

type TouchPoint = { clientX: number; clientY: number }

const MIN_PINCH_DISTANCE = 8

let listeners: AbortController | undefined

function touchesInside(e: TouchEvent): number {
  const root = e.currentTarget
  if (!(root instanceof Node)) return e.touches.length
  return Array.from(e.touches).filter(
    (touch) => !(touch.target instanceof Node) || root.contains(touch.target)
  ).length
}

/** Ends the single-finger pointer operation that a pinch takes over. */
function cancelPointerOperation(canvas: LGraphCanvas) {
  if (canvas.pointer.isDown) canvas.pointer.reset()
}

function zoomCanvasAroundPinch(
  canvas: LGraphCanvas,
  requestedScale: number,
  center: TouchPoint,
  lastTouch: TouchPoint
) {
  let scale = requestedScale

  if (scale < canvas.ds.min_scale) {
    scale = canvas.ds.min_scale
  } else if (scale > canvas.ds.max_scale) {
    scale = canvas.ds.max_scale
  }

  const newX = (center.clientX - lastTouch.clientX) / scale
  const newY = (center.clientY - lastTouch.clientY) / scale
  const oldScale = canvas.ds.scale

  canvas.ds.scale = scale

  if (Math.abs(canvas.ds.scale - 1) < 0.01) {
    canvas.ds.scale = 1
  }

  const newScale = canvas.ds.scale

  const convertScaleToOffset = (scale: number) => [
    center.clientX / scale - canvas.ds.offset[0],
    center.clientY / scale - canvas.ds.offset[1]
  ]
  const oldCenter = convertScaleToOffset(oldScale)
  const newCenter = convertScaleToOffset(newScale)

  canvas.ds.offset[0] += newX + newCenter[0] - oldCenter[0]
  canvas.ds.offset[1] += newY + newCenter[1] - oldCenter[1]

  lastTouch.clientX = center.clientX
  lastTouch.clientY = center.clientY

  canvas.setDirty(true, true)
}

export const simpleTouchSupportExtension: ComfyExtension = {
  name: 'Comfy.SimpleTouchSupport',
  setup() {
    listeners?.abort()
    listeners = new AbortController()
    const { signal } = listeners
    touchGesture.count = 0
    touchGesture.zooming = false

    let touchDist: number | null = null
    let touchTime: Date | null = null
    let lastTouch: { clientX: number; clientY: number } | null = null
    let lastScale: number | null = null
    function getMultiTouchPos(e: TouchEvent) {
      return Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      )
    }

    function getMultiTouchCenter(e: TouchEvent) {
      return {
        clientX: (e.touches[0].clientX + e.touches[1].clientX) / 2,
        clientY: (e.touches[0].clientY + e.touches[1].clientY) / 2
      }
    }

    useApp().canvasEl.parentElement?.addEventListener(
      'touchstart',
      (e: TouchEvent) => {
        touchGesture.count = touchesInside(e)

        lastTouch = null
        lastScale = null
        if (e.touches.length === 1) {
          touchTime = new Date()
          lastTouch = e.touches[0]
        } else {
          touchTime = null
          if (e.touches.length === 2) {
            const canvas = canvasOrReport('touchstart', e)
            if (!canvas) return
            lastScale = canvas.ds.scale
            lastTouch = getMultiTouchCenter(e)

            touchDist = getMultiTouchPos(e)
            cancelPointerOperation(canvas)
          }
        }
      },
      { capture: true, signal }
    )

    useApp().canvasEl.parentElement?.addEventListener(
      'touchend',
      (e: TouchEvent) => {
        touchGesture.count = touchesInside(e)

        if (e.touches.length !== 1) touchGesture.zooming = false
        if (touchTime && !e.touches.length) {
          if (new Date().getTime() - touchTime.getTime() > 600) {
            if (e.target === useApp().canvasEl) {
              const touch = {
                button: 2,
                clientX: e.changedTouches[0].clientX,
                clientY: e.changedTouches[0].clientY,
                pointerId: 1,
                isPrimary: true
              }
              useApp().canvasEl.dispatchEvent(
                new PointerEvent('pointerdown', touch)
              )
              setTimeout(() => {
                useApp().canvasEl.dispatchEvent(
                  new PointerEvent('pointerup', touch)
                )
              })
              e.preventDefault()
            }
          }
          touchTime = null
        }
      },
      { signal }
    )

    const resetTouchState = () => {
      touchGesture.count = 0
      touchGesture.zooming = false
      touchTime = null
      lastTouch = null
      lastScale = null
      touchDist = null
    }

    document.addEventListener(
      'visibilitychange',
      () => {
        if (document.hidden) {
          resetTouchState()
        }
      },
      { signal }
    )

    useApp().canvasEl.parentElement?.addEventListener(
      'touchcancel',
      resetTouchState,
      { signal }
    )

    function handlePinchMove(e: TouchEvent) {
      if (!lastTouch) return
      const canvas = canvasOrReport('touchmove', e)
      if (!canvas) return
      e.preventDefault()
      cancelPointerOperation(canvas)
      touchGesture.zooming = true

      LiteGraph.closeAllContextMenus(window)
      canvas.search_box?.close()
      const newTouchDist = getMultiTouchPos(e)
      const center = getMultiTouchCenter(e)

      if (lastScale === null || touchDist === null) return
      if (touchDist < MIN_PINCH_DISTANCE) {
        touchDist = newTouchDist
        lastScale = canvas.ds.scale
        lastTouch = center
        return
      }
      const scale = (lastScale * newTouchDist) / touchDist
      if (!Number.isFinite(scale) || scale <= 0) return

      zoomCanvasAroundPinch(canvas, scale, center, lastTouch)
    }

    useApp().canvasEl.parentElement?.addEventListener(
      'touchmove',
      (e) => {
        if (touchTime && lastTouch && e.touches.length === 1) {
          const onlyTouch = e.touches[0]
          const deltaX = onlyTouch.clientX - lastTouch.clientX
          const deltaY = onlyTouch.clientY - lastTouch.clientY
          if (deltaX * deltaX + deltaY * deltaY > 30) {
            touchTime = null
          }
        }
        if (e.touches.length === 2 && !e.ctrlKey && !e.shiftKey) {
          handlePinchMove(e)
        }
      },
      { capture: true, signal }
    )
  }
}
