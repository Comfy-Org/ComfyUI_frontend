import {
  isMiddleButtonEvent,
  isMiddleButtonHeld,
  isMiddlePointerInput
} from '@/base/pointerUtils'
import { app } from '@/scripts/app'

export function forwardMiddleButtonToCanvas(
  inputEl: HTMLElement,
  signal: AbortSignal
): void {
  inputEl.addEventListener(
    'pointerdown',
    (event) => {
      if (isMiddlePointerInput(event)) app.canvas.processMouseDown(event)
    },
    { signal }
  )

  inputEl.addEventListener(
    'pointermove',
    (event) => {
      if (isMiddleButtonHeld(event)) app.canvas.processMouseMove(event)
    },
    { signal }
  )

  inputEl.addEventListener(
    'pointerup',
    (event) => {
      if (isMiddleButtonEvent(event)) app.canvas.processMouseUp(event)
    },
    { signal }
  )
}
