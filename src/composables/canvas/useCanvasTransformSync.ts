import { onUnmounted, ref } from 'vue'

export interface TransformSyncOptions {
  onStart?: () => void
  onStop?: () => void
}

interface CanvasTransform {
  scale: number
  offsetX: number
  offsetY: number
}

/**
 * Composable for syncing canvas transform changes with RAF
 * Only calls the sync function when the canvas state transform actually changes
 */
export function useCanvasTransformSync<
  T extends { ds: { scale: number; offset: [number, number] } }
>(
  getCanvas: () => T | null,
  syncFn: (canvas: T) => void,
  options: TransformSyncOptions = {}
) {
  const { onStart, onStop } = options

  const isActive = ref(false)
  let rafId: number | null = null
  let lastTransform: CanvasTransform = {
    scale: 0,
    offsetX: 0,
    offsetY: 0
  }

  const hasTransformChanged = (canvas: T): boolean => {
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
    if (!canvas) {
      rafId = requestAnimationFrame(sync)
      return
    }

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

  return {
    isActive,
    startSync,
    stopSync
  }
}
