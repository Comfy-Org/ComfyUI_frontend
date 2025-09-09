import type { InjectionKey } from 'vue'

import type { Point } from '@/renderer/core/layout/types'

interface TransformState {
  screenToCanvas: (p: Point) => Point
  canvasToScreen: (p: Point) => Point
  camera?: { x: number; y: number; z: number }
  isNodeInViewport?: (
    nodePos: ArrayLike<number>,
    nodeSize: ArrayLike<number>,
    viewport: { width: number; height: number },
    margin?: number
  ) => boolean
}

export const TransformStateKey: InjectionKey<TransformState> =
  Symbol('transformState')
