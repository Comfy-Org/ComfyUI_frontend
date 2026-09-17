import { LGraphCanvas, LiteGraph } from '@/lib/litegraph/src/litegraph'

import { app } from '@/scripts/app'

let touchZooming = false
let touchCount = 0

app.registerExtension({
  name: 'Comfy.SimpleTouchSupport',
  setup() {
    let touchDist: number | null = null
    let touchTime: Date | null = null
    let lastTouch: { clientX: number; clientY: number } | null = null
    let lastScale: number | null = null
    function getMultiTouchPos(touches: Touch[]) {
      return Math.hypot(
        touches[0].clientX - touches[1].clientX,
        touches[0].clientY - touches[1].clientY
      )
    }

    function getMultiTouchCenter(touches: Touch[]) {
      return {
        clientX: (touches[0].clientX + touches[1].clientX) / 2,
        clientY: (touches[0].clientY + touches[1].clientY) / 2
      }
    }

    /**
     * The live contacts this extension owns. Reading them per event instead of
     * accumulating deltas is what stops the count drifting. `e.touches` spans
     * the whole document, so a finger on a toast or a body-level menu is
     * filtered out here, as is one whose target has detached - the case whose
     * `touchend` never reaches this listener.
     */
    function canvasTouches(e: TouchEvent) {
      const root = app.canvasEl.parentElement
      return Array.from(e.touches).filter(
        (touch) => touch.target instanceof Node && root?.contains(touch.target)
      )
    }

    app.canvasEl.parentElement?.addEventListener(
      'touchstart',
      (e: TouchEvent) => {
        const touches = canvasTouches(e)
        touchCount = touches.length

        lastTouch = null
        lastScale = null
        if (touches.length === 1) {
          touchZooming = false
          // Store start time for press+hold for context menu
          touchTime = new Date()
          lastTouch = touches[0]
        } else {
          touchTime = null
          if (touches.length === 2) {
            // Store center pos for zoom
            lastScale = app.canvas.ds.scale
            lastTouch = getMultiTouchCenter(touches)

            touchDist = getMultiTouchPos(touches)
            app.canvas.pointer.isDown = false
          }
        }
      },
      true
    )

    app.canvasEl.parentElement?.addEventListener(
      'touchend',
      (e: TouchEvent) => {
        const touches = canvasTouches(e)
        touchCount = touches.length

        if (touches.length !== 1) touchZooming = false
        if (touchTime && !touches.length) {
          if (new Date().getTime() - touchTime.getTime() > 600) {
            if (e.target === app.canvasEl) {
              const touch = {
                button: 2, // Right click
                clientX: e.changedTouches[0].clientX,
                clientY: e.changedTouches[0].clientY,
                pointerId: 1, // changedTouches' id is 0, set it to any number
                isPrimary: true // changedTouches' isPrimary is false, so set it to true
              }
              // context menu info set in 'pointerdown' event
              app.canvasEl.dispatchEvent(new PointerEvent('pointerdown', touch))
              // then, context menu open after 'pointerup' event
              setTimeout(() => {
                app.canvasEl.dispatchEvent(new PointerEvent('pointerup', touch))
              })
              e.preventDefault()
            }
          }
          touchTime = null
        }
      },
      true
    )

    const clearGestureState = () => {
      touchZooming = false
      touchTime = null
      lastTouch = null
      lastScale = null
      touchDist = null
    }

    // Reset touch state when page loses visibility (e.g., switching apps on iPad)
    // This prevents touchCount from getting stuck when touchend events are missed
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        touchCount = 0
        clearGestureState()
      }
    })

    // A cancel abandons the gesture, but iOS cancels touches individually, so
    // the fingers left in `e.touches` are still down and still have to count.
    app.canvasEl.parentElement?.addEventListener(
      'touchcancel',
      (e: TouchEvent) => {
        touchCount = canvasTouches(e).length
        clearGestureState()
      },
      true
    )

    // make a threshold for touchmove to prevent clear touchTime for long press
    function cancelLongPressOnDrift(touches: Touch[]) {
      if (!touchTime || !lastTouch || touches.length !== 1) return

      const onlyTouch = touches[0]
      const deltaX = onlyTouch.clientX - lastTouch.clientX
      const deltaY = onlyTouch.clientY - lastTouch.clientY
      if (deltaX * deltaX + deltaY * deltaY > 30) {
        touchTime = null
      }
    }

    function applyPinchZoom(e: TouchEvent, touches: Touch[]) {
      e.preventDefault() // Prevent browser from zooming when two textareas are touched
      app.canvas.pointer.isDown = false

      if (!touchZooming) {
        LiteGraph.closeAllContextMenus(window)
        app.canvas.search_box?.close()
      }
      touchZooming = true

      const newTouchDist = getMultiTouchPos(touches)

      const center = getMultiTouchCenter(touches)

      const anchor = lastTouch
      if (lastScale === null || touchDist === null || anchor === null) return
      let scale = (lastScale * newTouchDist) / touchDist

      const newX = (center.clientX - anchor.clientX) / scale
      const newY = (center.clientY - anchor.clientY) / scale

      // Code from LiteGraph
      if (scale < app.canvas.ds.min_scale) {
        scale = app.canvas.ds.min_scale
      } else if (scale > app.canvas.ds.max_scale) {
        scale = app.canvas.ds.max_scale
      }

      const oldScale = app.canvas.ds.scale

      app.canvas.ds.scale = scale

      // Code from LiteGraph
      if (Math.abs(app.canvas.ds.scale - 1) < 0.01) {
        app.canvas.ds.scale = 1
      }

      const newScale = app.canvas.ds.scale

      const convertScaleToOffset = (scale: number) => [
        center.clientX / scale - app.canvas.ds.offset[0],
        center.clientY / scale - app.canvas.ds.offset[1]
      ]
      const oldCenter = convertScaleToOffset(oldScale)
      const newCenter = convertScaleToOffset(newScale)

      app.canvas.ds.offset[0] += newX + newCenter[0] - oldCenter[0]
      app.canvas.ds.offset[1] += newY + newCenter[1] - oldCenter[1]

      anchor.clientX = center.clientX
      anchor.clientY = center.clientY

      app.canvas.setDirty(true, true)
    }

    app.canvasEl.parentElement?.addEventListener(
      'touchmove',
      (e) => {
        const touches = canvasTouches(e)
        touchCount = touches.length

        cancelLongPressOnDrift(touches)

        if (touches.length === 2 && lastTouch && !e.ctrlKey && !e.shiftKey) {
          applyPinchZoom(e, touches)
        }
      },
      true
    )
  }
})

/**
 * Only ever called on `pointerdown`. A touch pointer is primary only when no
 * other touch pointer was active as it went down, so it starts a fresh
 * sequence and anything still set belongs to a gesture whose `touchend` never
 * arrived. Mouse and pen carry their own primary flag regardless of how many
 * fingers are down, so they must not clear state a live gesture still owns.
 */
function discardStaleTouchState(e: PointerEvent) {
  if (e.pointerType !== 'touch' || !e.isPrimary) return
  touchCount = 0
  touchZooming = false
}

const processMouseDown = LGraphCanvas.prototype.processMouseDown
LGraphCanvas.prototype.processMouseDown = function (e: PointerEvent) {
  discardStaleTouchState(e)
  if (touchZooming || touchCount) {
    return
  }
  app.canvas.pointer.isDown = false // Prevent context menu from opening on second tap
  return processMouseDown.apply(this, [e])
}

const processMouseMove = LGraphCanvas.prototype.processMouseMove
LGraphCanvas.prototype.processMouseMove = function (e: PointerEvent) {
  if (touchZooming || touchCount > 1) {
    return
  }
  return processMouseMove.apply(this, [e])
}
