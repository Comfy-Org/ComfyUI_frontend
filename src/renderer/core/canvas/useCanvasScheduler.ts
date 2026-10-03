import { createSharedComposable } from '@vueuse/core'

import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { reportError } from '@/platform/telemetry/reportError'

interface CanvasOperationBase {
  element?: HTMLCanvasElement
  run: () => void
}

type CanvasOperation =
  | (CanvasOperationBase & { key?: never; isCurrent?: never })
  | (CanvasOperationBase & { key: string; isCurrent: () => boolean })

export interface CanvasScheduler {
  /** Run an op now when its canvas is visible, otherwise queue it. */
  schedule(operation: CanvasOperation): void
  /** Run every queued op whose canvas is now visible; keep the rest queued. */
  flush(): void
  /** Discard the pending operation with this key. */
  cancel(key: string): void
}

export function createCanvasScheduler(): CanvasScheduler {
  const canvasStore = useCanvasStore()
  const queue: CanvasOperation[] = []
  let isFlushing = false

  function targetOf(operation: CanvasOperation): HTMLCanvasElement | undefined {
    return operation.element ?? canvasStore.canvas?.canvas
  }

  function isVisible(element: HTMLCanvasElement | undefined): boolean {
    return (
      element?.isConnected === true &&
      element.offsetWidth > 0 &&
      element.offsetHeight > 0
    )
  }

  function isStale(operation: CanvasOperation): boolean {
    if (operation.isCurrent?.() === false) return true
    const { element } = operation
    return Boolean(
      element && element !== canvasStore.canvas?.canvas && !element.isConnected
    )
  }

  function run(operation: CanvasOperation): void {
    try {
      operation.run()
    } catch (error) {
      reportError(error, {
        errorType: 'canvas_scheduled_operation_failed'
      })
    }
  }

  function flush(): void {
    if (isFlushing) return

    isFlushing = true
    try {
      for (let index = 0; index < queue.length;) {
        const operation = queue[index]
        if (isStale(operation)) {
          queue.splice(index, 1)
        } else if (isVisible(targetOf(operation))) {
          queue.splice(index, 1)
          run(operation)
        } else {
          index++
        }
      }
    } finally {
      isFlushing = false
    }
  }

  function schedule(operation: CanvasOperation): void {
    if (operation.isCurrent?.() === false) return

    const existingIndex = operation.key
      ? queue.findIndex(({ key }) => key === operation.key)
      : -1
    if (existingIndex === -1) queue.push(operation)
    else queue[existingIndex] = operation

    if (isVisible(targetOf(operation))) flush()
  }

  function cancel(key: string): void {
    const index = queue.findIndex((operation) => operation.key === key)
    if (index !== -1) queue.splice(index, 1)
  }

  return { schedule, flush, cancel }
}

export const useCanvasScheduler = createSharedComposable(createCanvasScheduler)
