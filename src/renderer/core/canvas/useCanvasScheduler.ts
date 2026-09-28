import { createSharedComposable } from '@vueuse/core'
import { watch } from 'vue'

import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'

type CanvasOp = () => void
interface CameraIntent {
  key: string
  isCurrent: () => boolean
  run: CanvasOp
}
type ScheduledCanvasOp =
  | { type: 'op'; run: CanvasOp }
  | { type: 'camera'; intent: CameraIntent }

interface CanvasScheduler {
  /** Queue an op that runs in the next RAF when canvas is visible. */
  schedule(op: CanvasOp): void
  scheduleCameraIntent(intent: CameraIntent): void
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
    const queue: ScheduledCanvasOp[] = []
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
      queue.push({ type: 'op', run: op })
      if (isCanvasReady()) requestFlush()
    }

    function scheduleCameraIntent(intent: CameraIntent): void {
      if (!intent.isCurrent()) return
      const index = queue.findIndex(
        (entry) => entry.type === 'camera' && entry.intent.key === intent.key
      )
      if (index >= 0) queue.splice(index, 1)
      queue.push({ type: 'camera', intent })
      if (isCanvasReady()) requestFlush()
    }

    function flush(): void {
      if (!isCanvasReady()) return
      const ops = queue.splice(0)
      for (const [index, entry] of ops.entries()) {
        try {
          if (entry.type === 'camera' && !entry.intent.isCurrent()) continue
          if (entry.type === 'camera') entry.intent.run()
          else entry.run()
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
        const canvasBecameVisible = wasLinear && !isLinear
        if (canvasBecameVisible && queue.length > 0) {
          requestFlush()
        }
      }
    )

    return {
      schedule,
      scheduleCameraIntent,
      flush,
      clear,
      pending,
      isCanvasReady
    }
  }
)
