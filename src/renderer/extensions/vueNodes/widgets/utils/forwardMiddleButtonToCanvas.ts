import { isMiddleForPointerEvent } from '@/base/pointerUtils'
import { app } from '@/scripts/app'

export function forwardMiddleButtonToCanvas(
  inputEl: HTMLElement,
  signal?: AbortSignal
): void {
  const options = signal ? { signal } : undefined

  inputEl.addEventListener(
    'pointerdown',
    (event: PointerEvent) => {
      if (isMiddleForPointerEvent(event)) app.canvas.processMouseDown(event)
    },
    options
  )

  inputEl.addEventListener(
    'pointermove',
    (event: PointerEvent) => {
      if (isMiddleForPointerEvent(event)) app.canvas.processMouseMove(event)
    },
    options
  )

  inputEl.addEventListener(
    'pointerup',
    (event: PointerEvent) => {
      if (isMiddleForPointerEvent(event)) app.canvas.processMouseUp(event)
    },
    options
  )
}
