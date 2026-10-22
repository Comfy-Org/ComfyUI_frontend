import { LiteGraph } from '@/lib/litegraph/src/litegraph'
import type { LGraphCanvas } from '@/lib/litegraph/src/litegraph'

import { app } from '@/scripts/app'

import { canvasOrReport } from './touchCanvasAccess'
import { touchGesture } from './touchPointerGuards'
import type { ComfyExtension } from '@/types/comfy'

type TouchPoint = { clientX: number; clientY: number }

function zoomCanvasAroundPinch(
  canvas: LGraphCanvas,
  requestedScale: number,
  center: TouchPoint,
  lastTouch: TouchPoint
) {
  let scale = requestedScale
  const newX = (center.clientX - lastTouch.clientX) / requestedScale
  const newY = (center.clientY - lastTouch.clientY) / requestedScale

  if (scale < canvas.ds.min_scale) {
    scale = canvas.ds.min_scale
  } else if (scale > canvas.ds.max_scale) {
    scale = canvas.ds.max_scale
  }

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

    app.canvasEl.parentElement?.addEventListener(
      'touchstart',
      (e: TouchEvent) => {
        touchGesture.count += e.changedTouches.length

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
            canvas.pointer.isDown = false
          }
        }
      },
      true
    )

    app.canvasEl.parentElement?.addEventListener(
      'touchend',
      (e: TouchEvent) => {
        touchGesture.count -= e.changedTouches.length

        if (e.touches.length !== 1) touchGesture.zooming = false
        if (touchTime && !e.touches.length) {
          if (new Date().getTime() - touchTime.getTime() > 600) {
            if (e.target === app.canvasEl) {
              const touch = {
                button: 2,
                clientX: e.changedTouches[0].clientX,
                clientY: e.changedTouches[0].clientY,
                pointerId: 1,
                isPrimary: true
              }
              app.canvasEl.dispatchEvent(new PointerEvent('pointerdown', touch))
              setTimeout(() => {
                app.canvasEl.dispatchEvent(new PointerEvent('pointerup', touch))
              })
              e.preventDefault()
            }
          }
          touchTime = null
        }
      }
    )

    const resetTouchState = () => {
      touchGesture.count = 0
      touchGesture.zooming = false
      touchTime = null
      lastTouch = null
      lastScale = null
      touchDist = null
    }

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        resetTouchState()
      }
    })

    app.canvasEl.parentElement?.addEventListener('touchcancel', resetTouchState)

    app.canvasEl.parentElement?.addEventListener(
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
        if (e.touches.length === 2 && lastTouch && !e.ctrlKey && !e.shiftKey) {
          const canvas = canvasOrReport('touchmove', e)
          if (!canvas) return
          e.preventDefault()
          canvas.pointer.isDown = false
          touchGesture.zooming = true

          LiteGraph.closeAllContextMenus(window)
          canvas.search_box?.close()
          const newTouchDist = getMultiTouchPos(e)

          const center = getMultiTouchCenter(e)

          if (lastScale === null || touchDist === null) return
          const scale = (lastScale * newTouchDist) / touchDist

          zoomCanvasAroundPinch(canvas, scale, center, lastTouch)
        }
      },
      true
    )
  }
}
