import { ref, watch } from 'vue'
import type { CSSProperties } from 'vue'

import { useCanvasTransformSync } from '@/composables/canvas/useCanvasTransformSync'
import { useTransformSettling } from '@/composables/canvas/useTransformSettling'
import { useCanvasPositionConversion } from '@/composables/element/useCanvasPositionConversion'
import type { LGraphCanvas, Size, Vector2 } from '@/lib/litegraph/src/litegraph'
import { useCanvasStore } from '@/stores/graphStore'
import { useSettingStore } from '@/stores/settingStore'

interface PositionConfig {
  pos: Vector2
  size: Size
}

interface CanvasState {
  scale: number
  offsetX: number
  offsetY: number
}

/**
 * Hybrid positioning composable that uses transform during pan/zoom for performance,
 * then switches back to absolute positioning after movement settles for pixel-perfect rendering.
 */
export function useHybridPositioning() {
  const canvasStore = useCanvasStore()
  const settingStore = useSettingStore()
  const lgCanvas = canvasStore.getCanvas()

  // PERF TEST FLAG - Set to false to use old absolute-only positioning
  const USE_TRANSFORM = true

  // Canvas position conversion utilities
  const { canvasPosToClientPos, update: updateCanvasPosition } =
    useCanvasPositionConversion(lgCanvas.canvas, lgCanvas)

  // Update canvas position when sidebar changes
  watch(
    [
      () => settingStore.get('Comfy.Sidebar.Location'),
      () => settingStore.get('Comfy.Sidebar.Size'),
      () => settingStore.get('Comfy.UseNewMenu')
    ],
    () => updateCanvasPosition(),
    { flush: 'post' }
  )

  // Absolute position state (committed position)
  const absolutePosition = ref<PositionConfig>({
    pos: [0, 0],
    size: [0, 0]
  })

  // Style ref
  const style = ref<CSSProperties>({
    position: 'fixed',
    visibility: 'hidden'
  })

  // EARLY RETURN FOR OLD BEHAVIOR TESTING
  if (!USE_TRANSFORM) {
    const computeAbsoluteStyle = (position: PositionConfig): CSSProperties => {
      const { pos, size } = position
      const [left, top] = canvasPosToClientPos(pos)
      const scale = lgCanvas.ds.scale
      const [width, height] = size

      return {
        position: 'fixed',
        left: `${left}px`,
        top: `${top}px`,
        width: `${width * scale}px`,
        height: `${height * scale}px`,
        transform: 'none',
        willChange: 'auto',
        visibility: 'visible'
      }
    }

    // Set up old-style canvas change listener for continuous updates
    lgCanvas.ds.onChanged = () => {
      if (
        absolutePosition.value.pos[0] !== 0 ||
        absolutePosition.value.pos[1] !== 0
      ) {
        style.value = computeAbsoluteStyle(absolutePosition.value)
      }
    }

    return {
      style,
      updatePosition: (config: PositionConfig) => {
        absolutePosition.value = config
        style.value = computeAbsoluteStyle(config)
      },
      isTransforming: ref(false)
    }
  }

  // Track if position has been initialized
  const isInitialized = ref(false)

  // Canvas state at start of transform
  const startCanvasState = ref<CanvasState>({
    scale: 1,
    offsetX: 0,
    offsetY: 0
  })

  // Current canvas state for transform calculation
  const currentCanvasState = ref<CanvasState>({
    scale: 1,
    offsetX: 0,
    offsetY: 0
  })

  // Track transforming state
  const { isTransforming } = useTransformSettling(lgCanvas.canvas, {
    settleDelay: 200,
    trackPan: true
  })

  // Style computed from current mode - start hidden to prevent flash
  style.value = {
    position: 'fixed',
    visibility: 'hidden'
  }

  /**
   * Compute absolute positioning style
   */
  const computeAbsoluteStyle = (position: PositionConfig): CSSProperties => {
    const { pos, size } = position
    const [left, top] = canvasPosToClientPos(pos)
    const scale = lgCanvas.ds.scale
    const [width, height] = size

    return {
      position: 'fixed',
      left: `${left}px`,
      top: `${top}px`,
      width: `${width * scale}px`,
      height: `${height * scale}px`,
      transform: 'none',
      willChange: 'auto',
      visibility: 'visible'
    }
  }

  /**
   * Compute transform-based style during movement
   * This directly transforms world coordinates to screen coordinates using canvas transform
   * Uses translate for position and actual pixel values for size to avoid scaling artifacts
   */
  const computeTransformStyle = (): CSSProperties => {
    const { pos, size } = absolutePosition.value
    const [width, height] = size

    // Get canvas bounding rect for proper offset
    const canvasRect = lgCanvas.canvas.getBoundingClientRect()

    // Apply current canvas transform to world coordinates
    // Formula from canvasPosToClientPos: (pos + offset) * scale + canvasRect
    // Note: offset in LiteGraph is in world units (divided by scale internally)
    const screenX =
      (pos[0] + currentCanvasState.value.offsetX) *
        currentCanvasState.value.scale +
      canvasRect.left
    const screenY =
      (pos[1] + currentCanvasState.value.offsetY) *
        currentCanvasState.value.scale +
      canvasRect.top

    // Calculate actual pixel size (no scale transform, just pixel values)
    const scaledWidth = width * currentCanvasState.value.scale
    const scaledHeight = height * currentCanvasState.value.scale

    return {
      position: 'fixed',
      left: '0px',
      top: '0px',
      width: `${scaledWidth}px`,
      height: `${scaledHeight}px`,
      transform: `translate(${screenX}px, ${screenY}px)`,
      transformOrigin: '0 0',
      willChange: 'transform',
      visibility: 'visible'
    }
  }

  /**
   * Update canvas transform sync callback
   */
  const updateCanvasTransform = (canvas: LGraphCanvas) => {
    currentCanvasState.value = {
      scale: canvas.ds.scale,
      offsetX: canvas.ds.offset[0],
      offsetY: canvas.ds.offset[1]
    }

    // Update style based on transform mode
    if (isTransforming.value) {
      style.value = computeTransformStyle()
    }
  }

  // Canvas transform sync
  const { startSync, stopSync } = useCanvasTransformSync(
    updateCanvasTransform,
    {
      autoStart: false
    }
  )

  /**
   * Watch for transform state changes
   */
  let wasTransforming = false
  watch(isTransforming, (transforming) => {
    if (transforming && !wasTransforming) {
      // Starting transform - capture initial canvas state
      startCanvasState.value = {
        scale: lgCanvas.ds.scale,
        offsetX: lgCanvas.ds.offset[0],
        offsetY: lgCanvas.ds.offset[1]
      }
      currentCanvasState.value = { ...startCanvasState.value }

      style.value = computeTransformStyle()
      startSync()
    } else if (!transforming && wasTransforming) {
      // Transform settled - commit to absolute position
      stopSync()

      // Update absolute position with current canvas state
      absolutePosition.value = {
        pos: absolutePosition.value.pos,
        size: absolutePosition.value.size
      }

      // Switch back to absolute positioning
      style.value = computeAbsoluteStyle(absolutePosition.value)
    }
    wasTransforming = transforming
  })

  /**
   * Update position (called when selection changes)
   */
  const updatePosition = (config: PositionConfig) => {
    absolutePosition.value = config
    isInitialized.value = true

    // Always update style immediately when position changes
    // This prevents the visual jump from origin
    style.value = computeAbsoluteStyle(config)

    // If we're transforming, the next RAF will update with transform style
    // But we need the immediate update to prevent visual glitches
  }

  // Override for testing - force absolute positioning only
  if (!USE_TRANSFORM) {
    // Set up old-style canvas change listener for continuous updates
    lgCanvas.ds.onChanged = () => {
      if (
        absolutePosition.value.pos[0] !== 0 ||
        absolutePosition.value.pos[1] !== 0
      ) {
        style.value = computeAbsoluteStyle(absolutePosition.value)
      }
    }

    return {
      style,
      updatePosition: (config: PositionConfig) => {
        absolutePosition.value = config
        style.value = computeAbsoluteStyle(config)
      },
      isTransforming: ref(false)
    }
  }

  return {
    style,
    updatePosition,
    isTransforming
  }
}
