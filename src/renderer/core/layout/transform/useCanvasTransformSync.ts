import { onUnmounted, ref } from 'vue'

import type { LGraphCanvas } from '@/lib/litegraph/src/litegraph'

interface CanvasTransformSyncOptions {
  /**
   * Whether to automatically start syncing when canvas is available
   * @default true
   */
  autoStart?: boolean
}

interface CanvasTransformSyncCallbacks {
  /**
   * Called when sync starts
   */
  onStart?: () => void
  /**
   * Called after each sync update with timing information
   */
  onUpdate?: (duration: number) => void
  /**
   * Called when sync stops
   */
  onStop?: () => void
}

/**
 * Manages requestAnimationFrame-based synchronization with LiteGraph canvas transforms.
 *
 * This composable provides a clean way to sync Vue transform state with LiteGraph canvas
 * on every frame. It handles RAF lifecycle management, provides performance timing,
 * and ensures proper cleanup.
 *
 * The sync function typically reads canvas.ds (draw state) properties like offset and scale
 * to keep Vue components aligned with the canvas coordinate system.
 *
 * @example
 * ```ts
 * const { isActive, startSync, stopSync } = useCanvasTransformSync(
 *   canvas,
 *   (canvas) => syncWithCanvas(canvas),
 *   {
 *     onStart: () => emit('rafStatusChange', true),
 *     onUpdate: (time) => emit('transformUpdate', time),
 *     onStop: () => emit('rafStatusChange', false)
 *   }
 * )
 * ```
 */
export function useCanvasTransformSync(
  canvas: LGraphCanvas | undefined | null,
  syncFn: (canvas: LGraphCanvas) => void,
  callbacks: CanvasTransformSyncCallbacks = {},
  options: CanvasTransformSyncOptions = {}
) {
  const { autoStart = true } = options
  const { onStart, onUpdate, onStop } = callbacks

  const isActive = ref(false)
  let rafId: number | null = null

  const startSync = () => {
    if (isActive.value || !canvas) return

    isActive.value = true
    onStart?.()

    const sync = () => {
      if (!isActive.value || !canvas) return

      try {
        const startTime = performance.now()
        syncFn(canvas)
        const endTime = performance.now()

        onUpdate?.(endTime - startTime)
      } catch (error) {
        console.warn('Canvas transform sync error:', error)
      }

      rafId = requestAnimationFrame(sync)
    }

    sync()
  }

  const stopSync = () => {
    if (!isActive.value) return

    if (rafId !== null) {
      cancelAnimationFrame(rafId)
      rafId = null
    }

    isActive.value = false
    onStop?.()
  }

  // Auto-start if canvas is available and autoStart is enabled
  if (autoStart && canvas) {
    startSync()
  }

  // Clean up on unmount
  onUnmounted(() => {
    stopSync()
  })

  return {
    isActive,
    startSync,
    stopSync
  }
}
