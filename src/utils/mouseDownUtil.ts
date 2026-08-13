import { useEventListener } from '@vueuse/core'

export const whileMouseDown = (
  elementOrEvent: HTMLElement | Event,
  callback: (iteration: number) => void,
  interval: number = 30,
  initialDelay: number = interval
) => {
  const element =
    elementOrEvent instanceof HTMLElement
      ? elementOrEvent
      : (elementOrEvent.target as HTMLElement)
  const pointerId =
    !(elementOrEvent instanceof HTMLElement) && 'pointerId' in elementOrEvent
      ? (elementOrEvent as PointerEvent).pointerId
      : undefined

  let iteration = 0
  let disposed = false
  let intervalId: ReturnType<typeof setInterval> | undefined
  const listenerDisposers: Array<() => void> = []

  const delayId = setTimeout(() => {
    if (disposed) return
    callback(iteration++)
    if (!disposed) {
      intervalId = setInterval(() => {
        callback(iteration++)
      }, interval)
    }
  }, initialDelay)

  const dispose = () => {
    if (disposed) return
    disposed = true
    clearTimeout(delayId)
    if (intervalId !== undefined) clearInterval(intervalId)
    for (const disposeListener of listenerDisposers.splice(0)) {
      disposeListener()
    }
  }

  if (pointerId === undefined) {
    listenerDisposers.push(
      useEventListener(document, 'mouseup', dispose),
      useEventListener(element, 'mouseup', dispose)
    )
  } else {
    const disposeForPointer = (event: PointerEvent) => {
      if (event.pointerId === pointerId) dispose()
    }

    listenerDisposers.push(
      useEventListener(document, 'pointerup', disposeForPointer),
      useEventListener(element, 'pointerup', disposeForPointer),
      useEventListener(document, 'pointercancel', disposeForPointer),
      useEventListener(element, 'pointercancel', disposeForPointer)
    )
  }

  return {
    dispose
  }
}
