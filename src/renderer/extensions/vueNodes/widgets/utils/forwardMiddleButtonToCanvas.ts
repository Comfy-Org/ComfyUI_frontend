import {
  isMiddleButtonEvent,
  isMiddleButtonHeld,
  isMiddlePointerInput
} from '@/base/pointerUtils'
import { useApp } from '@/scripts/appInstance'

export function forwardMiddleButtonToCanvas(
  inputEl: HTMLElement,
  signal: AbortSignal
): void {
  inputEl.addEventListener(
    'pointerdown',
    (event) => {
      if (isMiddlePointerInput(event)) useApp().canvas.processMouseDown(event)
    },
    { signal }
  )

  inputEl.addEventListener(
    'pointermove',
    (event) => {
      if (isMiddleButtonHeld(event)) useApp().canvas.processMouseMove(event)
    },
    { signal }
  )

  inputEl.addEventListener(
    'pointerup',
    (event) => {
      if (isMiddleButtonEvent(event)) useApp().canvas.processMouseUp(event)
    },
    { signal }
  )
}
