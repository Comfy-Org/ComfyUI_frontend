import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import {
  BrushShape,
  ColorComparisonMethod,
  MaskBlendMode,
  Tools
} from '@/extensions/core/maskeditor/types'

import { useMaskEditorStore } from '@/stores/maskEditorStore'

const mockHistory = vi.hoisted(() => ({
  canUndo: { value: false },
  canRedo: { value: false }
}))

vi.mock('@/composables/maskeditor/useCanvasHistory', () => ({
  useCanvasHistory: vi.fn(() => mockHistory)
}))

const makeCanvas = (): HTMLCanvasElement => {
  const canvas = document.createElement('canvas')
  canvas.getContext = vi
    .fn()
    .mockReturnValue({ fake: true }) as HTMLCanvasElement['getContext']
  return canvas
}

describe('maskEditorStore', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    mockHistory.canUndo.value = false
    mockHistory.canRedo.value = false
  })

  describe('brush setters', () => {
    it('should clamp brush size between 1 and 250', () => {
      const store = useMaskEditorStore()

      store.setBrushSize(0)
      expect(store.brushSettings.size).toBe(1)

      store.setBrushSize(500)
      expect(store.brushSettings.size).toBe(250)

      store.setBrushSize(42)
      expect(store.brushSettings.size).toBe(42)
    })

    it('should clamp brush opacity between 0 and 1', () => {
      const store = useMaskEditorStore()

      store.setBrushOpacity(-0.5)
      expect(store.brushSettings.opacity).toBe(0)

      store.setBrushOpacity(2)
      expect(store.brushSettings.opacity).toBe(1)

      store.setBrushOpacity(0.3)
      expect(store.brushSettings.opacity).toBe(0.3)
    })

    it('should clamp brush hardness between 0 and 1', () => {
      const store = useMaskEditorStore()

      store.setBrushHardness(-1)
      expect(store.brushSettings.hardness).toBe(0)

      store.setBrushHardness(5)
      expect(store.brushSettings.hardness).toBe(1)
    })

    it('should clamp brush step size between 1 and 100', () => {
      const store = useMaskEditorStore()

      store.setBrushStepSize(0)
      expect(store.brushSettings.stepSize).toBe(1)

      store.setBrushStepSize(500)
      expect(store.brushSettings.stepSize).toBe(100)
    })
  })

  describe('resetBrushToDefault', () => {
    it('should restore the documented default brush', () => {
      const store = useMaskEditorStore()
      store.setBrushSize(123)
      store.setBrushOpacity(0.1)

      store.resetBrushToDefault()

      expect(store.brushSettings).toEqual({
        type: BrushShape.Arc,
        size: 20,
        opacity: 1,
        hardness: 1,
        stepSize: 5
      })
    })
  })

  describe('numeric setters with clamping', () => {
    it('should clamp paintBucket tolerance between 0 and 255', () => {
      const store = useMaskEditorStore()
      store.setPaintBucketTolerance(-1)
      expect(store.paintBucketTolerance).toBe(0)
      store.setPaintBucketTolerance(999)
      expect(store.paintBucketTolerance).toBe(255)
    })

    it('should clamp fill opacity between 0 and 100', () => {
      const store = useMaskEditorStore()
      store.setFillOpacity(-10)
      expect(store.fillOpacity).toBe(0)
      store.setFillOpacity(200)
      expect(store.fillOpacity).toBe(100)
    })

    it('should clamp colorSelectTolerance between 0 and 255', () => {
      const store = useMaskEditorStore()
      store.setColorSelectTolerance(-5)
      expect(store.colorSelectTolerance).toBe(0)
      store.setColorSelectTolerance(999)
      expect(store.colorSelectTolerance).toBe(255)
    })

    it('should clamp maskTolerance between 0 and 255', () => {
      const store = useMaskEditorStore()
      store.setMaskTolerance(-1)
      expect(store.maskTolerance).toBe(0)
      store.setMaskTolerance(500)
      expect(store.maskTolerance).toBe(255)
    })

    it('should clamp selectionOpacity between 0 and 100', () => {
      const store = useMaskEditorStore()
      store.setSelectionOpacity(-1)
      expect(store.selectionOpacity).toBe(0)
      store.setSelectionOpacity(500)
      expect(store.selectionOpacity).toBe(100)
    })

    it('should clamp maskOpacity between 0 and 1', () => {
      const store = useMaskEditorStore()
      store.setMaskOpacity(-0.5)
      expect(store.maskOpacity).toBe(0)
      store.setMaskOpacity(2)
      expect(store.maskOpacity).toBe(1)
    })

    it('should clamp zoomRatio between 0.1 and 10', () => {
      const store = useMaskEditorStore()
      store.setZoomRatio(0.001)
      expect(store.zoomRatio).toBe(0.1)
      store.setZoomRatio(100)
      expect(store.zoomRatio).toBe(10)
      store.setZoomRatio(2.5)
      expect(store.zoomRatio).toBe(2.5)
    })
  })

  describe('setPanOffset / setCursorPoint', () => {
    it('should copy pan offset by value, not by reference', () => {
      const store = useMaskEditorStore()
      const offset = { x: 10, y: 20 }

      store.setPanOffset(offset)
      offset.x = 999

      expect(store.panOffset.x).toBe(10)
    })

    it('should copy cursor point by value, not by reference', () => {
      const store = useMaskEditorStore()
      const point = { x: 5, y: 7 }

      store.setCursorPoint(point)
      point.y = 999

      expect(store.cursorPoint.y).toBe(7)
    })
  })

  describe('triggers', () => {
    it('should bump resetZoomTrigger each time resetZoom is called', () => {
      const store = useMaskEditorStore()
      const start = store.resetZoomTrigger

      store.resetZoom()
      store.resetZoom()

      expect(store.resetZoomTrigger).toBe(start + 2)
    })

    it('should bump clearTrigger each time triggerClear is called', () => {
      const store = useMaskEditorStore()
      const start = store.clearTrigger

      store.triggerClear()
      store.triggerClear()
      store.triggerClear()

      expect(store.clearTrigger).toBe(start + 3)
    })
  })

  describe('maskColor computed', () => {
    it('should be black for MaskBlendMode.Black', () => {
      const store = useMaskEditorStore()
      store.maskBlendMode = MaskBlendMode.Black

      expect(store.maskColor).toEqual({ r: 0, g: 0, b: 0 })
    })

    it('should be white for MaskBlendMode.White', () => {
      const store = useMaskEditorStore()
      store.maskBlendMode = MaskBlendMode.White

      expect(store.maskColor).toEqual({ r: 255, g: 255, b: 255 })
    })

    it('should be white for MaskBlendMode.Negative', () => {
      const store = useMaskEditorStore()
      store.maskBlendMode = MaskBlendMode.Negative

      expect(store.maskColor).toEqual({ r: 255, g: 255, b: 255 })
    })

    it('should fall back to black for an unknown blend mode', () => {
      const store = useMaskEditorStore()
      store.maskBlendMode = 'unrecognized' as MaskBlendMode

      expect(store.maskColor).toEqual({ r: 0, g: 0, b: 0 })
    })
  })

  describe('canUndo / canRedo proxies', () => {
    it('should reflect canvasHistory.canUndo when it flips', () => {
      const store = useMaskEditorStore()

      mockHistory.canUndo.value = true

      expect(store.canUndo).toBe(true)
    })

    it('should reflect canvasHistory.canRedo when it flips', () => {
      const store = useMaskEditorStore()

      mockHistory.canRedo.value = true

      expect(store.canRedo).toBe(true)
    })
  })

  describe('canvas → ctx watchers', () => {
    it.each([
      ['maskCanvas', 'maskCtx'],
      ['rgbCanvas', 'rgbCtx'],
      ['imgCanvas', 'imgCtx']
    ] as const)(
      'should derive %s using getContext with willReadFrequently',
      async (canvasKey, ctxKey) => {
        const store = useMaskEditorStore()
        const canvas = makeCanvas()

        store[canvasKey] = canvas
        await nextTick()

        expect(canvas.getContext).toHaveBeenCalledWith('2d', {
          willReadFrequently: true
        })
        expect(store[ctxKey]).not.toBeNull()
      }
    )

    it.each([
      ['maskCanvas', 'maskCtx'],
      ['rgbCanvas', 'rgbCtx'],
      ['imgCanvas', 'imgCtx']
    ] as const)(
      'should leave existing %s ctx untouched when canvas is cleared',
      async (canvasKey, ctxKey) => {
        const store = useMaskEditorStore()
        const canvas = makeCanvas()
        store[canvasKey] = canvas
        await nextTick()
        const ctx = store[ctxKey]

        store[canvasKey] = null
        await nextTick()

        expect(store[ctxKey]).toBe(ctx)
      }
    )
  })

  describe('resetState', () => {
    it('should restore non-DOM state to documented defaults', () => {
      const store = useMaskEditorStore()
      store.setBrushSize(200)
      store.maskBlendMode = MaskBlendMode.White
      store.activeLayer = 'rgb'
      store.rgbColor = '#00FF00'
      store.currentTool = Tools.PaintPen
      store.isAdjustingBrush = true
      store.setPaintBucketTolerance(50)
      store.setFillOpacity(20)
      store.setColorSelectTolerance(80)
      store.colorSelectLivePreview = true
      store.colorComparisonMethod = ColorComparisonMethod.LAB
      store.applyWholeImage = true
      store.maskBoundary = true
      store.setMaskTolerance(30)
      store.setSelectionOpacity(50)
      store.setZoomRatio(3)
      store.setPanOffset({ x: 10, y: 20 })
      store.setCursorPoint({ x: 5, y: 5 })
      store.setMaskOpacity(0.2)
      store.gpuTexturesNeedRecreation = true
      store.gpuTextureWidth = 100
      store.gpuTextureHeight = 200

      store.resetState()

      expect(store.brushSettings).toEqual({
        type: BrushShape.Arc,
        size: 10,
        opacity: 0.7,
        hardness: 1,
        stepSize: 5
      })
      expect(store.maskBlendMode).toBe(MaskBlendMode.Black)
      expect(store.activeLayer).toBe('mask')
      expect(store.rgbColor).toBe('#FF0000')
      expect(store.currentTool).toBe(Tools.MaskPen)
      expect(store.isAdjustingBrush).toBe(false)
      expect(store.paintBucketTolerance).toBe(5)
      expect(store.fillOpacity).toBe(100)
      expect(store.colorSelectTolerance).toBe(20)
      expect(store.colorSelectLivePreview).toBe(false)
      expect(store.colorComparisonMethod).toBe(ColorComparisonMethod.Simple)
      expect(store.applyWholeImage).toBe(false)
      expect(store.maskBoundary).toBe(false)
      expect(store.maskTolerance).toBe(0)
      expect(store.selectionOpacity).toBe(100)
      expect(store.zoomRatio).toBe(1)
      expect(store.panOffset).toEqual({ x: 0, y: 0 })
      expect(store.cursorPoint).toEqual({ x: 0, y: 0 })
      expect(store.maskOpacity).toBe(0.8)
      expect(store.gpuTexturesNeedRecreation).toBe(false)
      expect(store.gpuTextureWidth).toBe(0)
      expect(store.gpuTextureHeight).toBe(0)
      expect(store.pendingGPUMaskData).toBeNull()
      expect(store.pendingGPURgbData).toBeNull()
    })

    it('should not clear DOM refs (canvases / pointerZone / image)', () => {
      const store = useMaskEditorStore()
      const canvas = document.createElement('canvas')
      const zone = document.createElement('div')
      const img = document.createElement('img')
      store.maskCanvas = canvas
      store.pointerZone = zone
      store.image = img

      store.resetState()

      expect(store.maskCanvas).toBe(canvas)
      expect(store.pointerZone).toBe(zone)
      expect(store.image).toBe(img)
    })
  })
})
