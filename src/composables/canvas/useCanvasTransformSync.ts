import { onUnmounted, ref } from 'vue'

import { LGraphCanvas } from '@/lib/litegraph/src/litegraph'
import { useCanvasStore } from '@/stores/graphStore'

interface CanvasTransformSyncOptions {
  /**
   * Whether to automatically start syncing when canvas is available
   * @default true
   */
  autoStart?: boolean
  /**
   * Called when sync starts
   */
  onStart?: () => void
  /**
   * Called when sync stops
   */
  onStop?: () => void
}

interface CanvasTransform {
  scale: number
  offsetX: number
  offsetY: number
}

/**
 * Manages requestAnimationFrame-based synchronization with LiteGraph canvas transforms.
 *
 * This composable provides a clean way to sync Vue transform state with LiteGraph canvas
 * on every frame. It handles RAF lifecycle management, and ensures proper cleanup.
 *
 * The sync function typically reads canvas.ds properties like offset and scale to keep
 * Vue components aligned with the canvas coordinate system.
 *
 * @example
 * ```ts
 * const syncWithCanvas = (canvas: LGraphCanvas) => {
 *   canvas.ds.scale
 *   canvas.ds.offset
 * }
 *
 * const { isActive, startSync, stopSync } = useCanvasTransformSync(
 *   syncWithCanvas,
 *   {
 *     autoStart: false,
 *     onStart: () => emit('rafStatusChange', true),
 *     onStop: () => emit('rafStatusChange', false)
 *   }
 * )
 * ```
 */
export function useCanvasTransformSync(
  syncFn: (canvas: LGraphCanvas) => void,
  options: CanvasTransformSyncOptions = {}
) {
  const { onStart, onStop, autoStart = true } = options
  const { getCanvas } = useCanvasStore()

  const isActive = ref(false)
  let rafId: number | null = null
  let lastTransform: CanvasTransform = {
    scale: 0,
    offsetX: 0,
    offsetY: 0
  }

  const hasTransformChanged = (canvas: LGraphCanvas): boolean => {
    const ds = canvas.ds
    return (
      ds.scale !== lastTransform.scale ||
      ds.offset[0] !== lastTransform.offsetX ||
      ds.offset[1] !== lastTransform.offsetY
    )
  }

  const sync = () => {
    if (!isActive.value) return

    const canvas = getCanvas()
    if (!canvas) return

    try {
      // Only run sync if transform actually changed
      if (hasTransformChanged(canvas)) {
        lastTransform = {
          scale: canvas.ds.scale,
          offsetX: canvas.ds.offset[0],
          offsetY: canvas.ds.offset[1]
        }

        syncFn(canvas)
      }
    } catch (error) {
      console.error('Canvas transform sync error:', error)
    }

    rafId = requestAnimationFrame(sync)
  }

  const startSync = () => {
    if (isActive.value) return

    isActive.value = true
    onStart?.()

    // Reset last transform to force initial sync
    lastTransform = { scale: 0, offsetX: 0, offsetY: 0 }

    sync()
  }

  const stopSync = () => {
    isActive.value = false

    if (rafId !== null) {
      cancelAnimationFrame(rafId)
      rafId = null
    }

    onStop?.()
  }

  onUnmounted(stopSync)

  if (autoStart) {
    startSync()
  }

  return {
    isActive,
    startSync,
    stopSync
  }
}
