// @ts-strict-ignore
import { app } from '../../scripts/app'
import { LGraphCanvas, LiteGraph } from '@comfyorg/litegraph'

let touchZooming
let touchCount = 0

app.registerExtension({
  name: 'Comfy.SimpleTouchSupport',
  setup() {
    let touchDist
    let touchTime
    let lastTouch
    let lastScale
    function getMultiTouchPos(e) {
      return Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      )
    }

    function getMultiTouchCenter(e) {
      return {
        clientX: (e.touches[0].clientX + e.touches[1].clientX) / 2,
        clientY: (e.touches[0].clientY + e.touches[1].clientY) / 2
      }
    }

    app.canvasEl.addEventListener(
      'touchstart',
      (e: TouchEvent) => {
        touchCount++
        lastTouch = null
        lastScale = null
        if (e.touches?.length === 1) {
          // Store start time for press+hold for context menu
          touchTime = new Date()
          lastTouch = e.touches[0]
        } else {
          touchTime = null
          if (e.touches?.length === 2) {
            // Store center pos for zoom
            lastScale = app.canvas.ds.scale
            lastTouch = getMultiTouchCenter(e)

            touchDist = getMultiTouchPos(e)
            app.canvas.pointer_is_down = false
          }
        }
      },
      true
    )

    app.canvasEl.addEventListener('touchend', (e: TouchEvent) => {
      touchCount = e.touches?.length ?? touchCount - 1

      if (e.touches?.length !== 1) touchZooming = false
      if (touchTime && !e.touches?.length) {
        if (new Date().getTime() - touchTime > 600) {
          try {
            // hack to get litegraph to use this event
            e.constructor = CustomEvent
          } catch (error) {}
          // @ts-expect-error
          e.clientX = lastTouch.clientX
          // @ts-expect-error
          e.clientY = lastTouch.clientY

          app.canvas.pointer_is_down = true
          // @ts-expect-error
          app.canvas._mousedown_callback(e)
        }
        touchTime = null
      }
    })

    app.canvasEl.addEventListener(
      'touchmove',
      (e) => {
        touchTime = null
        if (e.touches?.length === 2) {
          app.canvas.pointer_is_down = false
          touchZooming = true
          // @ts-expect-error
          LiteGraph.closeAllContextMenus()
          // @ts-expect-error
          app.canvas.search_box?.close()
          const newTouchDist = getMultiTouchPos(e)

          const center = getMultiTouchCenter(e)

          let scale = app.canvas.ds.scale

          scale = (lastScale * newTouchDist) / touchDist

          const newX = (center.clientX - lastTouch.clientX) / scale
          const newY = (center.clientY - lastTouch.clientY) / scale

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

          const convertScaleToOffset = (scale) => [
            center.clientX / scale - app.canvas.ds.offset[0],
            center.clientY / scale - app.canvas.ds.offset[1]
          ]
          var oldCenter = convertScaleToOffset(oldScale)
          var newCenter = convertScaleToOffset(newScale)

          app.canvas.ds.offset[0] += newX + newCenter[0] - oldCenter[0]
          app.canvas.ds.offset[1] += newY + newCenter[1] - oldCenter[1]

          lastTouch.clientX = center.clientX
          lastTouch.clientY = center.clientY

          app.canvas.setDirty(true, true)
        }
      },
      true
    )
  }
})

const processMouseDown = LGraphCanvas.prototype.processMouseDown
LGraphCanvas.prototype.processMouseDown = function (e) {
  if (touchZooming || touchCount) {
    return
  }
  return processMouseDown.apply(this, arguments)
}

const processMouseMove = LGraphCanvas.prototype.processMouseMove
LGraphCanvas.prototype.processMouseMove = function (e) {
  if (touchZooming || touchCount > 1) {
    return
  }
  return processMouseMove.apply(this, arguments)
}
