import { describe, expect, it } from 'vitest'
import { inject, provide } from 'vue'

import {
  TransformStateKey,
  type TransformState
} from '@/renderer/core/layout/injectionKeys'

describe('injectionKeys', () => {
  describe('TransformStateKey', () => {
    it('should be a valid Symbol injection key', () => {
      expect(TransformStateKey).toBeDefined()
      expect(typeof TransformStateKey).toBe('symbol')
      expect(TransformStateKey.toString()).toContain('transformState')
    })

    it('should work with Vue provide/inject', () => {
      const mockTransformState: TransformState = {
        camera: { x: 0, y: 0, z: 1 },
        screenToCanvas: () => ({ x: 0, y: 0 }),
        canvasToScreen: () => ({ x: 0, y: 0 }),
        isNodeInViewport: () => true
      }

      // Simulate provide
      provide(TransformStateKey, mockTransformState)

      // Simulate inject
      const injected = inject(TransformStateKey)
      expect(injected).toBe(mockTransformState)
    })

    it('should enforce correct TransformState interface structure', () => {
      const validState: TransformState = {
        camera: { x: 10, y: 20, z: 1.5 },
        screenToCanvas: (point: { x: number; y: number }) => ({
          x: point.x / 1.5 - 10,
          y: point.y / 1.5 - 20
        }),
        canvasToScreen: (point: { x: number; y: number }) => ({
          x: (point.x + 10) * 1.5,
          y: (point.y + 20) * 1.5
        }),
        isNodeInViewport: (
          nodePos: ArrayLike<number>,
          nodeSize: ArrayLike<number>,
          viewport: { width: number; height: number },
          margin?: number
        ) => {
          return true
        }
      }

      // Type check - should compile without errors
      const _check: TransformState = validState
      expect(_check).toBeDefined()
    })
  })
})