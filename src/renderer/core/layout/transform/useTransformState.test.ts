import { beforeEach, describe, expect, it } from 'vitest'

import { useTransformState } from '@/renderer/core/layout/transform/useTransformState'
import type { LGraphCanvas } from '@/lib/litegraph/src/LGraphCanvas'

// Create a mock canvas context for transform testing
function createMockCanvasContext() {
  return {
    canvas: {
      width: 1280,
      height: 720,
      getBoundingClientRect: () => ({
        left: 0,
        top: 0,
        width: 1280,
        height: 720,
        right: 1280,
        bottom: 720,
        x: 0,
        y: 0
      })
    },
    ds: {
      offset: [0, 0],
      scale: 1
    }
  }
}

describe('useTransformState', () => {
  const transformState = useTransformState()

  beforeEach(() => {
    transformState.syncWithCanvas({
      ds: { offset: [0, 0] }
    } as LGraphCanvas)
  })

  describe('initial state', () => {
    it('should initialize with default camera values', () => {
      const { camera } = transformState
      expect(camera.x).toBe(0)
      expect(camera.y).toBe(0)
      expect(camera.z).toBe(1)
    })

    it('should generate correct initial transform style', () => {
      const { transformStyle } = transformState
      expect(transformStyle.value).toEqual({
        transform: 'scale3d(1, 1, 1) translate3d(0px, 0px, 0)',
        transformOrigin: '0 0'
      })
    })
  })

  describe('syncWithCanvas', () => {
    it('should sync camera state with canvas transform', () => {
      const { syncWithCanvas, camera } = transformState
      const mockCanvas = createMockCanvasContext()

      // Set mock canvas transform
      mockCanvas.ds.offset = [100, 50]
      mockCanvas.ds.scale = 2

      syncWithCanvas(mockCanvas as LGraphCanvas)

      expect(camera.x).toBe(100)
      expect(camera.y).toBe(50)
      expect(camera.z).toBe(2)
    })

    it('should handle null canvas gracefully', () => {
      const { syncWithCanvas, camera } = transformState

      syncWithCanvas(null! as LGraphCanvas)

      // Should remain at initial values
      expect(camera.x).toBe(0)
      expect(camera.y).toBe(0)
      expect(camera.z).toBe(1)
    })

    it('should handle canvas without ds property', () => {
      const { syncWithCanvas, camera } = transformState
      const canvasWithoutDs = { canvas: {} }

      syncWithCanvas(canvasWithoutDs as LGraphCanvas)

      // Should remain at initial values
      expect(camera.x).toBe(0)
      expect(camera.y).toBe(0)
      expect(camera.z).toBe(1)
    })

    it('should update transform style after sync', () => {
      const { syncWithCanvas, transformStyle } = transformState
      const mockCanvas = createMockCanvasContext()

      mockCanvas.ds.offset = [150, 75]
      mockCanvas.ds.scale = 0.5

      syncWithCanvas(mockCanvas as LGraphCanvas)

      expect(transformStyle.value).toEqual({
        transform: 'scale3d(0.5, 0.5, 0.5) translate3d(150px, 75px, 0)',
        transformOrigin: '0 0'
      })
    })
  })

  describe('coordinate conversions', () => {
    beforeEach(() => {
      // Set up a known transform state
      const mockCanvas = createMockCanvasContext()
      mockCanvas.ds.offset = [100, 50]
      mockCanvas.ds.scale = 2
      transformState.syncWithCanvas(mockCanvas as LGraphCanvas)
    })

    describe('screenToCanvas', () => {
      it('should convert screen coordinates to canvas coordinates', () => {
        const { screenToCanvas } = transformState

        const screenPoint = { x: 220, y: 140 }
        const canvasPoint = screenToCanvas(screenPoint)

        // canvas = screen / scale - offset
        // x: 220 / 2 - 100 = 10
        // y: 140 / 2 - 50 = 20
        expect(canvasPoint).toEqual({ x: 10, y: 20 })
      })
    })
  })

  describe('edge cases', () => {
    it('should handle zero scale in screenToCanvas', () => {
      const { syncWithCanvas, screenToCanvas } = transformState
      const mockCanvas = createMockCanvasContext()

      // Scale of 0 gets converted to 1 by || operator
      mockCanvas.ds.scale = 0
      syncWithCanvas(mockCanvas as LGraphCanvas)

      // Should use scale of 1 due to camera.z || 1 in implementation
      const result = screenToCanvas({ x: 100, y: 100 })
      expect(result.x).toBe(100) // (100 - 0) / 1
      expect(result.y).toBe(100) // (100 - 0) / 1
    })
  })
})
