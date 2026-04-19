import { createSharedComposable } from '@vueuse/core'
import { watch } from 'vue'

import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'

type CanvasOp = () => void

interface CanvasScheduler {
  /** Queue an op that runs in the next RAF when canvas is visible. */
  schedule(op: CanvasOp): void
  /** Execute all queued ops synchronously (if canvas is ready). */
  flush(): void
  /** Discard all pending ops and cancel any scheduled RAF. */
  clear(): void
  /** Number of queued ops. */
  pending(): number
  /** Whether the canvas element is visible and properly sized. */
  isCanvasReady(): boolean
}

export const useCanvasScheduler = createSharedComposable(
  (): CanvasScheduler => {
    const canvasStore = useCanvasStore()
    const queue: CanvasOp[] = []
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

    function schedule(op: CanvasOp): void {
      queue.push(op)
      if (isCanvasReady()) requestFlush()
    }

    function flush(): void {
      if (!isCanvasReady()) return
      const ops = queue.splice(0)
      for (const [index, op] of ops.entries()) {
        try {
          op()
        } catch (err) {
          console.error(
            '[CanvasScheduler] Scheduled canvas operation failed during flush',
            {
              error: err,
              remainingInBatch: ops.length - index - 1,
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
        if (wasLinear && !isLinear && queue.length > 0) {
          requestFlush()
        }
      }
    )

    return { schedule, flush, clear, pending, isCanvasReady }
  }
)
