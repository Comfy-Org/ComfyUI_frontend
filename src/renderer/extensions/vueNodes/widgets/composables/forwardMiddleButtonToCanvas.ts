import {
  isMiddleButtonEvent,
  isMiddleButtonHeld,
  isMiddlePointerInput
} from '@/base/pointerUtils'
import { app } from '@/scripts/app'

/**
 * Wires pointerdown / pointermove / pointerup on a DOM widget's inputEl so
 * middle-button gestures pass through to the LGraph canvas instead of being
 * swallowed by the widget surface. Consolidates the three-listener trio that
 * useStringWidget and useMarkdownWidget would otherwise duplicate.
 *
 * The three event types each use the right helper:
 * - pointerdown → isMiddlePointerInput (strict so chorded left-click with
 *   middle incidentally held is not misclassified as middle input).
 * - pointermove → isMiddleButtonHeld (bitmask so chorded interactions keep
 *   forwarding mid-drag).
 * - pointerup → isMiddleButtonEvent (button field, since the released button
 *   is no longer in `buttons`).
 */
export function forwardMiddleButtonToCanvas(inputEl: HTMLElement): void {
  inputEl.addEventListener('pointerdown', (event: PointerEvent) => {
    if (isMiddlePointerInput(event)) {
      app.canvas.processMouseDown(event)
    }
  })

  inputEl.addEventListener('pointermove', (event: PointerEvent) => {
    if (isMiddleButtonHeld(event)) {
      app.canvas.processMouseMove(event)
    }
  })

  inputEl.addEventListener('pointerup', (event: PointerEvent) => {
    if (isMiddleButtonEvent(event)) {
      app.canvas.processMouseUp(event)
    }
  })
}
