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

    app.canvasEl.parentElement.addEventListener(
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
            app.canvas.pointer.isDown = false
          }
        }
      },
      true
    )

    app.canvasEl.parentElement.addEventListener('touchend', (e: TouchEvent) => {
      touchCount--

      if (e.touches?.length !== 1) touchZooming = false
      if (touchTime && !e.touches?.length) {
        if (new Date().getTime() - touchTime > 600) {
          if (e.target === app.canvasEl) {
            app.canvasEl.dispatchEvent(
              new PointerEvent('pointerdown', {
                button: 2,
                clientX: e.changedTouches[0].clientX,
                clientY: e.changedTouches[0].clientY
              })
            )
            e.preventDefault()
          }
        }
        touchTime = null
      }
    })

    app.canvasEl.parentElement.addEventListener(
      'touchmove',
      (e) => {
        touchTime = null
        if (e.touches?.length === 2 && lastTouch && !e.ctrlKey && !e.shiftKey) {
          e.preventDefault() // Prevent browser from zooming when two textareas are touched
          app.canvas.pointer.isDown = false
          touchZooming = true

          LiteGraph.closeAllContextMenus(window)
          // @ts-expect-error
          app.canvas.search_box?.close()
          const newTouchDist = getMultiTouchPos(e)

          const center = getMultiTouchCenter(e)

          let scale = (lastScale * newTouchDist) / touchDist

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
  app.canvas.pointer.isDown = false // Prevent context menu from opening on second tap
  return processMouseDown.apply(this, arguments)
}

const processMouseMove = LGraphCanvas.prototype.processMouseMove
LGraphCanvas.prototype.processMouseMove = function (e) {
  if (touchZooming || touchCount > 1) {
    return
  }
  return processMouseMove.apply(this, arguments)
}
