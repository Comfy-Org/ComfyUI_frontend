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

  let iteration = 0
  let disposed = false
  let intervalId: ReturnType<typeof setInterval> | undefined

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
    disposed = true
    clearTimeout(delayId)
    if (intervalId !== undefined) clearInterval(intervalId)
    disposeGlobal()
    disposeLocal()
  }

  // Listen for mouseup globally to catch cases where user drags out of element
  const disposeGlobal = useEventListener(document, 'mouseup', dispose)
  const disposeLocal = useEventListener(element, 'mouseup', dispose)

  return {
    dispose: dispose
  }
}
