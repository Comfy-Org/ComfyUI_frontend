import { isMiddleForPointerEvent } from '@/base/pointerUtils'
import { app } from '@/scripts/app'

/**
 * Wires pointerdown / pointermove / pointerup on a DOM widget's input element
 * so middle-button gestures pass through to the LGraph canvas instead of being
 * swallowed by the widget surface. Consolidates the three-listener trio that
 * useStringWidget and useMarkdownWidget would otherwise duplicate.
 *
 * Each listener routes through {@link isMiddleForPointerEvent} so pointerdown
 * gets strict semantics, pointermove survives chorded buttons via the held
 * bitmask, and pointerup uses the `button` field after release.
 *
 * No explicit cleanup is returned: the three listeners are attached directly
 * to the widget-owned input element and only capture `app.canvas` (a
 * singleton). When the widget's DOM element is detached and GC'd, the
 * listeners go with it. If a future widget lifecycle ever rebinds the same
 * element across instances, this will need to grow a disposer — for now,
 * simpler is better.
 */
export function forwardMiddleButtonToCanvas(inputEl: HTMLElement): void {
  inputEl.addEventListener('pointerdown', (event: PointerEvent) => {
    if (isMiddleForPointerEvent(event)) {
      app.canvas.processMouseDown(event)
    }
  })

  inputEl.addEventListener('pointermove', (event: PointerEvent) => {
    if (isMiddleForPointerEvent(event)) {
      app.canvas.processMouseMove(event)
    }
  })

  inputEl.addEventListener('pointerup', (event: PointerEvent) => {
    if (isMiddleForPointerEvent(event)) {
      app.canvas.processMouseUp(event)
    }
  })
}
