import type { InjectionKey } from 'vue'

import type { Point } from '@/renderer/core/layout/types'

/**
 * Lightweight, injectable transform state used by layout-aware components.
 *
 * Consumers use this interface to convert coordinates between LiteGraph's
 * canvas space and the DOM's screen space, access the current pan/zoom
 * (camera), and perform basic viewport culling checks.
 *
 * Coordinate mapping:
 * - screen = (canvas + offset) * scale
 * - canvas = screen / scale - offset
 *
 * The full implementation and additional helpers live in
 * `useTransformState()`. This interface deliberately exposes only the
 * minimal surface needed outside that composable.
 *
 * @example
 * const state = inject(TransformStateKey)!
 * const screen = state.canvasToScreen({ x: 100, y: 50 })
 */
interface TransformState {
  /** Convert a screen-space point (CSS pixels) to canvas space. */
  screenToCanvas: (p: Point) => Point
  /** Convert a canvas-space point to screen space (CSS pixels). */
  canvasToScreen: (p: Point) => Point
  /** Current pan/zoom; `x`/`y` are offsets, `z` is scale. */
  camera?: { x: number; y: number; z: number }
  /**
   * Test whether a node's rectangle intersects the (expanded) viewport.
   * Handy for viewport culling and lazy work.
   *
   * @param nodePos Top-left in canvas space `[x, y]`
   * @param nodeSize Size in canvas units `[width, height]`
   * @param viewport Screen-space viewport `{ width, height }`
   * @param margin Optional fractional margin (e.g. `0.2` = 20%)
   */
  isNodeInViewport?: (
    nodePos: ArrayLike<number>,
    nodeSize: ArrayLike<number>,
    viewport: { width: number; height: number },
    margin?: number
  ) => boolean
}

export const TransformStateKey: InjectionKey<TransformState> =
  Symbol('transformState')
