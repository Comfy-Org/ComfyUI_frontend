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
 * Returns a cleanup function that removes all three listeners. Callers that
 * outlive the input element (e.g. a widget that may be rewired) should hold
 * onto the return value and invoke it on teardown; when the element is simply
 * garbage-collected the listeners are reclaimed automatically.
 */
export function forwardMiddleButtonToCanvas(inputEl: HTMLElement): () => void {
  const controller = new AbortController()
  const { signal } = controller
  const listenerOptions: AddEventListenerOptions = { signal }

  inputEl.addEventListener(
    'pointerdown',
    (event: PointerEvent) => {
      if (isMiddleForPointerEvent(event)) {
        app.canvas.processMouseDown(event)
      }
    },
    listenerOptions
  )

  inputEl.addEventListener(
    'pointermove',
    (event: PointerEvent) => {
      if (isMiddleForPointerEvent(event)) {
        app.canvas.processMouseMove(event)
      }
    },
    listenerOptions
  )

  inputEl.addEventListener(
    'pointerup',
    (event: PointerEvent) => {
      if (isMiddleForPointerEvent(event)) {
        app.canvas.processMouseUp(event)
      }
    },
    listenerOptions
  )

  return () => controller.abort()
}
