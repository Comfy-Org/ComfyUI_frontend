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
 * const { camera, transformStyle, canvasToScreen } = useTransformState()
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
 * const screenPos = canvasToScreen({ x: nodeX, y: nodeY })
 * ```
 */
import { computed, reactive, readonly } from 'vue'

import type { LGraphCanvas } from '@/lib/litegraph/src/litegraph'
import { createSharedComposable } from '@vueuse/core'

interface Point {
  x: number
  y: number
}

interface Camera {
  x: number
  y: number
  z: number // scale/zoom
}

function useTransformStateIndividual() {
  // Reactive state mirroring LiteGraph's canvas transform
  const camera = reactive<Camera>({
    x: 0,
    y: 0,
    z: 1
  })

  // Computed transform string for CSS
  const transformStyle = computed(() => ({
    // Match LiteGraph DragAndScale.toCanvasContext():
    // ctx.scale(scale); ctx.translate(offset)
    // CSS applies right-to-left, so "scale() translate()" -> translate first, then scale
    // Effective mapping: screen = (canvas + offset) * scale
    // Using the 3D versions of scale and translate can provide a smoother experience
    // when dealing with a large number of nodes.
    transform: `scale3d(${camera.z}, ${camera.z}, ${camera.z}) translate3d(${camera.x}px, ${camera.y}px, 0)`,
    transformOrigin: '0 0'
  }))

  /**
   * Synchronizes Vue's reactive camera state with LiteGraph's canvas transform
   *
   * Called every frame via RAF to ensure Vue components stay aligned with canvas.
   * This is the heart of the hybrid rendering system - it bridges the gap between
   * LiteGraph's canvas transforms and Vue's reactive system.
   *
   * @param canvas - LiteGraph canvas instance with DragAndScale (ds) transform state
   */
  function syncWithCanvas(canvas: LGraphCanvas) {
    if (!canvas || !canvas.ds) return

    // Mirror LiteGraph's transform state to Vue's reactive state
    // ds.offset = pan offset, ds.scale = zoom level
    camera.x = canvas.ds.offset[0]
    camera.y = canvas.ds.offset[1]
    camera.z = canvas.ds.scale || 1
  }

  /**
   * Converts screen coordinates to canvas coordinates
   *
   * Inverse of canvasToScreen. Useful for hit testing and converting
   * mouse events back to canvas space.
   *
   * Formula: canvas = screen / scale - offset
   *
   * @param point - Point in screen coordinate system
   * @returns Point in canvas coordinate system
   */
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
