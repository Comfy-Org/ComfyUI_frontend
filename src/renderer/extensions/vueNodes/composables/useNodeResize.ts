/**
 * Composable for node resizing functionality
 *
 * Provides resize handle interaction that integrates with the layout system.
 * Handles pointer capture, coordinate calculations, and size constraints.
 */
import { ref } from 'vue'

interface TransformState {
  screenToCanvas: (point: { x: number; y: number }) => { x: number; y: number }
  camera: { z: number }
}

interface UseNodeResizeOptions {
  /** Minimum width constraint */
  minWidth?: number
  /** Minimum height constraint */
  minHeight?: number
  /** Maximum width constraint */
  maxWidth?: number
  /** Maximum height constraint */
  maxHeight?: number
  /** Transform state for coordinate conversion */
  transformState?: TransformState
  /** Called when resize starts */
  onStart?: () => void
  /** Called when resize ends */
  onEnd?: () => void
}

export function useNodeResize(
  resizeCallback: (size: { width: number; height: number }) => void,
  options: UseNodeResizeOptions = {}
) {
  const {
    minWidth = 200,
    minHeight = 100,
    maxWidth = 800,
    maxHeight = 600,
    transformState,
    onStart,
    onEnd
  } = options

  // Resize state
  const isResizing = ref(false)
  const resizeStartPos = ref<{ x: number; y: number } | null>(null)
  const resizeStartSize = ref<{ width: number; height: number } | null>(null)

  const startResize = (event: PointerEvent) => {
    event.preventDefault()
    isResizing.value = true
    resizeStartPos.value = { x: event.clientX, y: event.clientY }

    // Call onStart callback (to pause tracking)
    onStart?.()

    // Get the current element dimensions
    const element = (event.target as HTMLElement).closest(
      '.lg-node'
    ) as HTMLElement
    if (!element) return
    const rect = element.getBoundingClientRect()

    let startWidth = rect.width
    let startHeight = rect.height

    // If we have transform state, convert screen size to canvas size
    if (transformState?.screenToCanvas && transformState?.camera) {
      // Scale the size by the inverse of the zoom factor to get canvas units
      const scale = transformState.camera.z
      startWidth = rect.width / scale
      startHeight = rect.height / scale
    }

    resizeStartSize.value = {
      width: startWidth,
      height: startHeight
    }

    // Capture pointer
    const target = event.target as HTMLElement
    target.setPointerCapture(event.pointerId)

    // Add global listeners
    document.addEventListener('pointermove', handleResize)
    document.addEventListener('pointerup', endResize)
  }

  const handleResize = (event: PointerEvent) => {
    if (!isResizing.value || !resizeStartPos.value || !resizeStartSize.value)
      return

    let deltaX = event.clientX - resizeStartPos.value.x
    let deltaY = event.clientY - resizeStartPos.value.y

    // Convert screen deltas to canvas coordinates if transform state is available
    if (transformState?.screenToCanvas) {
      const mouseDelta = { x: deltaX, y: deltaY }
      const canvasOrigin = transformState.screenToCanvas({ x: 0, y: 0 })
      const canvasWithDelta = transformState.screenToCanvas(mouseDelta)

      deltaX = canvasWithDelta.x - canvasOrigin.x
      deltaY = canvasWithDelta.y - canvasOrigin.y
    }

    const newWidth = Math.max(
      minWidth,
      Math.min(maxWidth, resizeStartSize.value.width + deltaX)
    )
    const newHeight = Math.max(
      minHeight,
      Math.min(maxHeight, resizeStartSize.value.height + deltaY)
    )

    // Call the provided resize callback
    resizeCallback({ width: newWidth, height: newHeight })
  }

  const endResize = (event: PointerEvent) => {
    if (!isResizing.value) return

    // Call onEnd callback (to resume tracking)
    onEnd?.()

    isResizing.value = false
    resizeStartPos.value = null
    resizeStartSize.value = null

    // Release pointer
    const target = event.target as HTMLElement
    target.releasePointerCapture(event.pointerId)

    // Remove global listeners
    document.removeEventListener('pointermove', handleResize)
    document.removeEventListener('pointerup', endResize)
  }

  return {
    isResizing,
    startResize
  }
}
