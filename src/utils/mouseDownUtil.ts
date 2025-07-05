import { useEventListener } from '@vueuse/core'

export const whileMouseDown = (
  elementOrEvent: HTMLElement | Event,
  callback: (iteration: number) => void,
  interval: number = 30
) => {
  const element =
    elementOrEvent instanceof HTMLElement
      ? elementOrEvent
      : (elementOrEvent.target as HTMLElement)

  let iteration = 0

  const intervalId = setInterval(() => {
    callback(iteration++)
  }, interval)

  const dispose = useEventListener(element, 'mouseup', () => {
    clearInterval(intervalId)
    dispose()
  })

  return {
    dispose
  }
}
