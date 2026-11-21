import { LGraphCanvas } from '@/lib/litegraph/src/litegraph'

import { canvasOrReport } from './touchCanvasAccess'

/** Touch gesture state shared by the canvas pointer guards and the touch listeners. */
export const touchGesture = { count: 0, zooming: false }

let installed = false

/**
 * Wraps `LGraphCanvas.prototype.processMouseDown` and `processMouseMove` so
 * canvas pointer handling yields to touch gestures. Later calls are no-ops.
 */
export function installTouchPointerGuards() {
  if (installed) return
  installed = true

  const processMouseDown = LGraphCanvas.prototype.processMouseDown
  LGraphCanvas.prototype.processMouseDown = function (e: PointerEvent) {
    const startsFreshTouch = e.pointerType === 'touch' && e.isPrimary
    if (startsFreshTouch) {
      touchGesture.count = 0
      touchGesture.zooming = false
    }

    if (touchGesture.zooming || touchGesture.count) {
      return
    }
    canvasOrReport('processMouseDown', e)
    this.pointer.isDown = false
    return processMouseDown.apply(this, [e])
  }

  const processMouseMove = LGraphCanvas.prototype.processMouseMove
  LGraphCanvas.prototype.processMouseMove = function (e: PointerEvent) {
    if (touchGesture.zooming || touchGesture.count > 1) {
      return
    }
    return processMouseMove.apply(this, [e])
  }
}
