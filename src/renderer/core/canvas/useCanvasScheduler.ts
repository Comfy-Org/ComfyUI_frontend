import { createSharedComposable } from '@vueuse/core'
import { watch } from 'vue'

import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { reportError } from '@/platform/telemetry/reportError'

export interface CanvasOperation {
  key?: string
  element?: HTMLCanvasElement
  isCurrent?: () => boolean
  run: () => void
}

export interface CanvasScheduler {
  /** Queue an op that runs in the next RAF when canvas is visible. */
  schedule(operation: CanvasOperation): void
  /** Execute all queued ops synchronously (if canvas is ready). */
  flush(): void
  /** Discard all pending ops and cancel any scheduled RAF. */
  clear(): void
  /** Number of queued ops. */
  pending(): number
  /** Whether the canvas element is visible and properly sized. */
  isCanvasReady(): boolean
}

export function createCanvasScheduler(): CanvasScheduler {
  const canvasStore = useCanvasStore()
  const queue: CanvasOperation[] = []
  let rafId: number | null = null

  function isElementReady(element?: HTMLCanvasElement): boolean {
    try {
      if (element == null || element.offsetParent === null) return false
      return element.offsetWidth > 0 && element.offsetHeight > 0
    } catch {
      return false
    }
  }

  function isCanvasReady(): boolean {
    return isElementReady(canvasStore.canvas?.canvas)
  }

  function requestFlush(): void {
    if (rafId != null || queue.length === 0) return
    rafId = requestAnimationFrame(() => {
      rafId = null
      flushQueued(true)
    })
  }

  function schedule(operation: CanvasOperation): void {
    if (operation.isCurrent?.() === false) return

    const existingIndex = operation.key
      ? queue.findIndex(({ key }) => key === operation.key)
      : -1
    if (existingIndex === -1) queue.push(operation)
    else queue[existingIndex] = operation

    if (isElementReady(operation.element ?? canvasStore.canvas?.canvas)) {
      requestFlush()
    }
  }

  function flush(): void {
    flushQueued(false)
  }

  function flushQueued(retryIfNotReady: boolean): void {
    const operations = queue.splice(0)
    for (const [index, operation] of operations.entries()) {
      if (operation.isCurrent?.() === false) continue
      if (!isElementReady(operation.element ?? canvasStore.canvas?.canvas)) {
        queue.push(operation)
        continue
      }
      try {
        operation.run()
      } catch (err) {
        reportError(err, {
          errorType: 'canvas_scheduled_operation_failed',
          context: {
            remainingInBatch: operations.length - index - 1,
            pendingQueue: queue.length,
            canvasReady: isCanvasReady()
          }
        })
      }
    }
    if (retryIfNotReady && queue.length > 0) requestFlush()
  }

  function clear(): void {
    queue.length = 0
    if (rafId != null) {
      cancelAnimationFrame(rafId)
      rafId = null
    }
  }

  function pending(): number {
    return queue.length
  }

  watch(
    () => canvasStore.linearMode,
    (isLinear, wasLinear) => {
      const canvasBecameVisible = wasLinear && !isLinear
      if (canvasBecameVisible && queue.length > 0) {
        requestFlush()
      }
    }
  )

  return { schedule, flush, clear, pending, isCanvasReady }
}

export const useCanvasScheduler = createSharedComposable(createCanvasScheduler)
