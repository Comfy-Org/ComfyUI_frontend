import { createSharedComposable } from '@vueuse/core'
import { watch } from 'vue'

import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { reportError } from '@/platform/telemetry/reportError'

interface CanvasOperationBase {
  element?: HTMLCanvasElement
  run: () => void
}

export type CanvasOperation =
  | (CanvasOperationBase & { key?: never; isCurrent?: never })
  | (CanvasOperationBase & { key: string; isCurrent: () => boolean })

export interface CanvasScheduler {
  /** Run an op now when its canvas is visible, otherwise queue it. */
  schedule(operation: CanvasOperation): void
  /** Execute all queued ops synchronously (if canvas is ready). */
  flush(): void
  /** Discard the pending operation with this key. */
  cancel(key: string): void
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
      flushQueued()
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
      flushQueued()
    }
  }

  function flush(): void {
    flushQueued()
  }

  function executeOperation(
    operation: CanvasOperation,
    remainingInBatch: number
  ): 'complete' | 'pending' {
    if (operation.isCurrent?.() === false) return 'complete'
    if (
      operation.element &&
      operation.element !== canvasStore.canvas?.canvas &&
      !operation.element.isConnected
    ) {
      return 'complete'
    }
    if (!isElementReady(operation.element ?? canvasStore.canvas?.canvas)) {
      return 'pending'
    }
    try {
      operation.run()
    } catch (err) {
      reportError(err, {
        errorType: 'canvas_scheduled_operation_failed',
        surface: 'graph',
        context: {
          remainingInBatch,
          pendingQueue: queue.length,
          canvasReady: isCanvasReady()
        }
      })
    }
    return 'complete'
  }

  function flushQueued(): void {
    const operations = queue.splice(0)
    for (const [index, operation] of operations.entries()) {
      if (
        executeOperation(operation, operations.length - index - 1) === 'pending'
      ) {
        queue.push(operation)
      }
    }
  }

  function cancel(key: string): void {
    const index = queue.findIndex((operation) => operation.key === key)
    if (index !== -1) queue.splice(index, 1)
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

  return { schedule, flush, cancel, isCanvasReady }
}

export const useCanvasScheduler = createSharedComposable(createCanvasScheduler)
