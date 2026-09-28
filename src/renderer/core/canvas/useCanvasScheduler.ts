import { createSharedComposable } from '@vueuse/core'
import { watch } from 'vue'

import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'

export interface CanvasOperation {
  key?: string
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

  function isCanvasReady(): boolean {
    try {
      const el = canvasStore.canvas?.canvas
      if (el == null || el.offsetParent === null) return false
      return el.offsetWidth > 0 && el.offsetHeight > 0
    } catch {
      return false
    }
  }

  function requestFlush(): void {
    if (rafId != null || queue.length === 0) return
    rafId = requestAnimationFrame(() => {
      rafId = null
      flush()
    })
  }

  function schedule(operation: CanvasOperation): void {
    if (operation.isCurrent?.() === false) return

    const existingIndex = operation.key
      ? queue.findIndex(({ key }) => key === operation.key)
      : -1
    if (existingIndex === -1) queue.push(operation)
    else queue[existingIndex] = operation

    if (isCanvasReady()) requestFlush()
  }

  function flush(): void {
    if (!isCanvasReady()) return
    const operations = queue.splice(0)
    for (const [index, operation] of operations.entries()) {
      if (operation.isCurrent?.() === false) continue
      try {
        operation.run()
      } catch (err) {
        console.error(
          '[CanvasScheduler] Scheduled canvas operation failed during flush',
          {
            error: err,
            remainingInBatch: operations.length - index - 1,
            pendingQueue: queue.length,
            canvasReady: isCanvasReady()
          }
        )
      }
    }
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
