import type { Point2D as Point } from '@comfyorg/shared-frontend-utils/geometry'
/**
 * Composable for managing transform state synchronized with LiteGraph canvas
 *
 * This composable is a critical part of the hybrid rendering architecture that
 * allows Vue components to render in perfect alignment with LiteGraph's canvas.
 *
 * ## Core Concept
 *
 * LiteGraph uses a canvas for rendering connections, grid, and handling interactions.
 * Vue components need to render nodes on top of this canvas. The challenge is
 * synchronizing the coordinate systems:
 *
 * - LiteGraph: Uses canvas coordinates with its own transform matrix
 * - Vue/DOM: Uses screen coordinates with CSS transforms
 *
 * ## Solution: Transform Container Pattern
 *
 * Instead of transforming individual nodes (O(n) complexity), we:
 * 1. Mirror LiteGraph's transform matrix to a single CSS container
 * 2. Place all Vue nodes as children with simple absolute positioning
 * 3. Achieve O(1) transform updates regardless of node count
 *
 * ## Coordinate Systems
 *
 * - **Canvas coordinates**: LiteGraph's internal coordinate system
 * - **Screen coordinates**: Browser's viewport coordinate system
 * - **Transform sync**: camera.x/y/z mirrors canvas.ds.offset/scale
 *
 * ## Performance Benefits
 *
 * - GPU acceleration via CSS transforms
 * - No layout thrashing (only transform changes)
 * - Efficient viewport culling calculations
 * - Scales to 1000+ nodes while maintaining 60 FPS
 *
 * @example
 * ```typescript
 * const { camera, transformStyle, screenToCanvas } = useTransformState()
 *
 * // In template
 * <div :style="transformStyle">
 *   <NodeComponent
 *     v-for="node in nodes"
 *     :style="{ left: node.x + 'px', top: node.y + 'px' }"
 *   />
 * </div>
 *
 * // Convert coordinates
 * const canvasPos = screenToCanvas({ x: clientX, y: clientY })
 * ```
 */
import { computed, reactive, readonly } from 'vue'

import type { LGraphCanvas } from '@/lib/litegraph/src/litegraph'
import { createSharedComposable } from '@vueuse/core'

interface Camera extends Point {
  z: number
}

function useTransformStateIndividual() {
  const camera = reactive<Camera>({
    x: 0,
    y: 0,
    z: 1
  })

  const transformStyle = computed(() => ({
    translate: `${camera.x * camera.z}px ${camera.y * camera.z}px`,
    scale: `${camera.z} ${camera.z} ${camera.z}`,
    transformOrigin: '0 0'
  }))

  function syncWithCanvas(canvas: LGraphCanvas) {
    camera.x = canvas.ds.offset[0]
    camera.y = canvas.ds.offset[1]
    camera.z = canvas.ds.scale || 1
  }

  const screenToCanvas = (point: Point): Point => {
    return {
      x: point.x / camera.z - camera.x,
      y: point.y / camera.z - camera.y
    }
  }

  return {
    camera: readonly(camera),
    transformStyle,
    syncWithCanvas,
    screenToCanvas
  }
}

export const useTransformState = createSharedComposable(
  useTransformStateIndividual
)
