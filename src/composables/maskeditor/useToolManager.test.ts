import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, reactive } from 'vue'
import type { EffectScope } from 'vue'

import { useBrushDrawing } from '@/composables/maskeditor/useBrushDrawing'
import { useToolManager } from '@/composables/maskeditor/useToolManager'
import { Tools } from '@/extensions/core/maskeditor/types'

type MockStore = {
  currentTool: Tools
  activeLayer: 'mask' | 'rgb'
  pointerZone: HTMLElement | null
  brushVisible: boolean
  brushPreviewGradientVisible: boolean
  isAdjustingBrush: boolean
  isPanning: boolean
}

const mockStore: MockStore = reactive({
  currentTool: Tools.MaskPen,
  activeLayer: 'mask',
  pointerZone: null,
  brushVisible: true,
  brushPreviewGradientVisible: false,
  isAdjustingBrush: false,
  isPanning: false
}) as MockStore

const mockBrushDrawing = {
  startDrawing: vi.fn().mockResolvedValue(undefined),
  handleDrawing: vi.fn().mockResolvedValue(undefined),
  drawEnd: vi.fn().mockResolvedValue(undefined),
  startBrushAdjustment: vi.fn().mockResolvedValue(undefined),
  handleBrushAdjustment: vi.fn().mockResolvedValue(undefined)
}

const mockCanvasTools = {
  paintBucketFill: vi.fn(),
  colorSelectFill: vi.fn().mockResolvedValue(undefined),
  clearLastColorSelectPoint: vi.fn()
}

const mockCoordinateTransform = {
  screenToCanvas: vi.fn((p: { x: number; y: number }) => ({
    x: p.x * 2,
    y: p.y * 2
  })),
  canvasToScreen: vi.fn()
}

vi.mock('@/stores/maskEditorStore', () => ({
  useMaskEditorStore: vi.fn(() => mockStore)
}))

vi.mock('@/composables/maskeditor/useBrushDrawing', () => ({
  useBrushDrawing: vi.fn(() => mockBrushDrawing)
}))

vi.mock('@/composables/maskeditor/useCanvasTools', () => ({
  useCanvasTools: vi.fn(() => mockCanvasTools)
}))

vi.mock('@/composables/maskeditor/useCoordinateTransform', () => ({
  useCoordinateTransform: vi.fn(() => mockCoordinateTransform)
}))

vi.mock('@/scripts/app', () => ({
  app: {
    extensionManager: {
      setting: {
        get: vi.fn((key: string) => {
          if (key === 'Comfy.MaskEditor.UseDominantAxis') return false
          if (key === 'Comfy.MaskEditor.BrushAdjustmentSpeed') return 1
          return undefined
        })
      }
    }
  }
}))

const mockKeyboard = {
  isKeyDown: vi.fn().mockReturnValue(false),
  addListeners: vi.fn(),
  removeListeners: vi.fn()
}

const mockPanZoom = {
  initializeCanvasPanZoom: vi.fn(),
  handlePanStart: vi.fn(),
  handlePanMove: vi.fn().mockResolvedValue(undefined),
  handleTouchStart: vi.fn(),
  handleTouchMove: vi.fn(),
  handleTouchEnd: vi.fn(),
  updateCursorPosition: vi.fn(),
  zoom: vi.fn(),
  invalidatePanZoom: vi.fn(),
  addPenPointerId: vi.fn(),
  removePenPointerId: vi.fn()
}

const pointerEvent = (
  init: Partial<PointerEvent> & { pointerType?: string }
): PointerEvent => {
  return {
    preventDefault: vi.fn(),
    pointerId: 1,
    pointerType: 'mouse',
    button: 0,
    buttons: 0,
    clientX: 0,
    clientY: 0,
    offsetX: 0,
    offsetY: 0,
    altKey: false,
    ...init
  } as unknown as PointerEvent
}

let scope: EffectScope | null = null

const setup = (): ReturnType<typeof useToolManager> => {
  scope = effectScope()
  return scope.run(() =>
    useToolManager(
      mockKeyboard as unknown as Parameters<typeof useToolManager>[0],
      mockPanZoom as unknown as Parameters<typeof useToolManager>[1]
    )
  )!
}

describe('useToolManager', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockStore.currentTool = Tools.MaskPen
    mockStore.activeLayer = 'mask'
    mockStore.pointerZone = document.createElement('div')
    mockStore.brushVisible = true
    mockStore.brushPreviewGradientVisible = false
    mockStore.isAdjustingBrush = false
    mockStore.isPanning = false
    mockKeyboard.isKeyDown.mockReturnValue(false)
  })

  afterEach(() => {
    scope?.stop()
    scope = null
  })

  describe('useBrushDrawing factory', () => {
    it('should construct useBrushDrawing with settings from the extension manager', () => {
      setup()

      expect(useBrushDrawing).toHaveBeenCalledWith({
        useDominantAxis: false,
        brushAdjustmentSpeed: 1
      })
    })
  })

  describe('switchTool', () => {
    it('should set the current tool on the store', () => {
      const tm = setup()
      tm.switchTool(Tools.Eraser)
      expect(mockStore.currentTool).toBe(Tools.Eraser)
    })

    it('should update activeLayer to "rgb" when switching to PaintPen', () => {
      const tm = setup()
      tm.switchTool(Tools.PaintPen)
      expect(mockStore.activeLayer).toBe('rgb')
    })

    it('should update activeLayer to "mask" when switching to MaskPen', () => {
      const tm = setup()
      mockStore.activeLayer = 'rgb'
      tm.switchTool(Tools.MaskPen)
      expect(mockStore.activeLayer).toBe('mask')
    })

    it('should set custom cursor and hide brush for MaskBucket', () => {
      const tm = setup()
      tm.switchTool(Tools.MaskBucket)
      expect(mockStore.brushVisible).toBe(false)
      expect(mockStore.pointerZone!.style.cursor).toContain('paintBucket.png')
    })

    it('should reset cursor to "none" and show brush for tools without custom cursor', () => {
      const tm = setup()
      tm.switchTool(Tools.MaskBucket)
      expect(mockStore.brushVisible).toBe(false)

      tm.switchTool(Tools.MaskPen)
      expect(mockStore.brushVisible).toBe(true)
      expect(mockStore.pointerZone!.style.cursor).toBe('none')
    })

    it('should not touch cursor when pointerZone is missing', () => {
      const tm = setup()
      mockStore.pointerZone = null
      expect(() => tm.switchTool(Tools.MaskBucket)).not.toThrow()
    })
  })

  describe('setActiveLayer', () => {
    it('should switch from mask-only tool to PaintPen when activating rgb layer', () => {
      const tm = setup()
      mockStore.currentTool = Tools.MaskBucket

      tm.setActiveLayer('rgb')

      expect(mockStore.activeLayer).toBe('rgb')
      expect(mockStore.currentTool).toBe(Tools.PaintPen)
    })

    it('should switch from PaintPen to MaskPen when activating mask layer', () => {
      const tm = setup()
      mockStore.currentTool = Tools.PaintPen

      tm.setActiveLayer('mask')

      expect(mockStore.activeLayer).toBe('mask')
      expect(mockStore.currentTool).toBe(Tools.MaskPen)
    })

    it('should leave a non-mask-only tool alone when activating rgb', () => {
      const tm = setup()
      mockStore.currentTool = Tools.Eraser

      tm.setActiveLayer('rgb')

      expect(mockStore.currentTool).toBe(Tools.Eraser)
    })
  })

  describe('updateCursor', () => {
    it('should hide brush and set custom cursor for tools that define one', () => {
      const tm = setup()
      mockStore.currentTool = Tools.MaskColorFill

      tm.updateCursor()

      expect(mockStore.brushVisible).toBe(false)
      expect(mockStore.pointerZone!.style.cursor).toContain('colorSelect.png')
      expect(mockStore.brushPreviewGradientVisible).toBe(false)
    })

    it('should show brush and "none" cursor for tools without a custom cursor', () => {
      const tm = setup()
      mockStore.currentTool = Tools.MaskPen

      tm.updateCursor()

      expect(mockStore.brushVisible).toBe(true)
      expect(mockStore.pointerZone!.style.cursor).toBe('none')
    })
  })

  describe('currentTool watcher', () => {
    it('should clear last color-select point when switching away from MaskColorFill', async () => {
      setup()
      mockStore.currentTool = Tools.MaskColorFill
      await nextTick()
      mockCanvasTools.clearLastColorSelectPoint.mockClear()

      mockStore.currentTool = Tools.MaskPen
      await nextTick()

      expect(mockCanvasTools.clearLastColorSelectPoint).toHaveBeenCalledTimes(1)
    })

    it('should not clear color-select point when switching to MaskColorFill', async () => {
      setup()
      mockStore.currentTool = Tools.MaskPen
      await nextTick()
      mockCanvasTools.clearLastColorSelectPoint.mockClear()

      mockStore.currentTool = Tools.MaskColorFill
      await nextTick()

      expect(mockCanvasTools.clearLastColorSelectPoint).not.toHaveBeenCalled()
    })
  })

  describe('handlePointerDown', () => {
    it('should ignore touch pointers entirely', async () => {
      const tm = setup()
      await tm.handlePointerDown(pointerEvent({ pointerType: 'touch' }))

      expect(mockBrushDrawing.startDrawing).not.toHaveBeenCalled()
      expect(mockPanZoom.handlePanStart).not.toHaveBeenCalled()
      expect(mockPanZoom.addPenPointerId).not.toHaveBeenCalled()
    })

    it('should register pen pointer id then continue tool routing', async () => {
      const tm = setup()
      await tm.handlePointerDown(
        pointerEvent({
          pointerType: 'pen',
          button: 0,
          buttons: 1,
          pointerId: 7
        })
      )

      expect(mockPanZoom.addPenPointerId).toHaveBeenCalledWith(7)
    })

    it('should start panning on middle mouse button (buttons===4)', async () => {
      const tm = setup()
      await tm.handlePointerDown(pointerEvent({ buttons: 4 }))

      expect(mockPanZoom.handlePanStart).toHaveBeenCalled()
      expect(mockStore.brushVisible).toBe(false)
      expect(mockBrushDrawing.startDrawing).not.toHaveBeenCalled()
    })

    it('should start panning on left button + space held', async () => {
      const tm = setup()
      mockKeyboard.isKeyDown.mockImplementation((k) => k === ' ')

      await tm.handlePointerDown(pointerEvent({ buttons: 1 }))

      expect(mockPanZoom.handlePanStart).toHaveBeenCalled()
      expect(mockBrushDrawing.startDrawing).not.toHaveBeenCalled()
    })

    it('should start drawing for MaskPen on left button', async () => {
      const tm = setup()
      mockStore.currentTool = Tools.MaskPen

      await tm.handlePointerDown(pointerEvent({ button: 0, buttons: 1 }))

      expect(mockBrushDrawing.startDrawing).toHaveBeenCalledTimes(1)
    })

    it('should start drawing for PaintPen on left button', async () => {
      const tm = setup()
      mockStore.currentTool = Tools.PaintPen

      await tm.handlePointerDown(pointerEvent({ button: 0, buttons: 1 }))

      expect(mockBrushDrawing.startDrawing).toHaveBeenCalledTimes(1)
    })

    it('should continue drawing for PaintPen when a non-left button fires while left is held', async () => {
      const tm = setup()
      mockStore.currentTool = Tools.PaintPen

      await tm.handlePointerDown(pointerEvent({ button: 2, buttons: 1 }))

      expect(mockBrushDrawing.handleDrawing).toHaveBeenCalledTimes(1)
      expect(mockBrushDrawing.startDrawing).not.toHaveBeenCalled()
    })

    it('should call paintBucketFill on MaskBucket left click using transformed coords', async () => {
      const tm = setup()
      mockStore.currentTool = Tools.MaskBucket

      await tm.handlePointerDown(
        pointerEvent({ button: 0, offsetX: 50, offsetY: 25 })
      )

      expect(mockCoordinateTransform.screenToCanvas).toHaveBeenCalledWith({
        x: 50,
        y: 25
      })
      expect(mockCanvasTools.paintBucketFill).toHaveBeenCalledWith({
        x: 100,
        y: 50
      })
    })

    it('should call colorSelectFill on MaskColorFill left click', async () => {
      const tm = setup()
      mockStore.currentTool = Tools.MaskColorFill

      await tm.handlePointerDown(
        pointerEvent({ button: 0, offsetX: 10, offsetY: 20 })
      )

      expect(mockCanvasTools.colorSelectFill).toHaveBeenCalledWith({
        x: 20,
        y: 40
      })
    })

    it('should start brush adjustment on alt + right-click', async () => {
      const tm = setup()

      await tm.handlePointerDown(
        pointerEvent({ altKey: true, button: 2, buttons: 2 })
      )

      expect(mockStore.isAdjustingBrush).toBe(true)
      expect(mockBrushDrawing.startBrushAdjustment).toHaveBeenCalled()
    })

    it('should start drawing on right-click for drawing tools', async () => {
      const tm = setup()
      mockStore.currentTool = Tools.Eraser

      await tm.handlePointerDown(pointerEvent({ button: 2, buttons: 2 }))

      expect(mockBrushDrawing.startDrawing).toHaveBeenCalledTimes(1)
    })

    it('should not start drawing for non-drawing tools', async () => {
      const tm = setup()
      mockStore.currentTool = Tools.MaskBucket

      await tm.handlePointerDown(pointerEvent({ button: 2, buttons: 2 }))

      expect(mockBrushDrawing.startDrawing).not.toHaveBeenCalled()
    })
  })

  describe('handlePointerMove', () => {
    it('should ignore touch pointers', async () => {
      const tm = setup()
      await tm.handlePointerMove(pointerEvent({ pointerType: 'touch' }))

      expect(mockPanZoom.updateCursorPosition).not.toHaveBeenCalled()
    })

    it('should always update cursor position for non-touch pointers', async () => {
      const tm = setup()
      await tm.handlePointerMove(pointerEvent({ clientX: 30, clientY: 40 }))

      expect(mockPanZoom.updateCursorPosition).toHaveBeenCalledWith({
        x: 30,
        y: 40
      })
    })

    it('should pan on middle button drag', async () => {
      const tm = setup()
      await tm.handlePointerMove(pointerEvent({ buttons: 4 }))

      expect(mockPanZoom.handlePanMove).toHaveBeenCalled()
      expect(mockBrushDrawing.handleDrawing).not.toHaveBeenCalled()
    })

    it('should pan on left button + space drag', async () => {
      const tm = setup()
      mockKeyboard.isKeyDown.mockImplementation((k) => k === ' ')

      await tm.handlePointerMove(pointerEvent({ buttons: 1 }))

      expect(mockPanZoom.handlePanMove).toHaveBeenCalled()
    })

    it('should ignore drawing for non-drawing tools', async () => {
      const tm = setup()
      mockStore.currentTool = Tools.MaskBucket

      await tm.handlePointerMove(pointerEvent({ buttons: 1 }))

      expect(mockBrushDrawing.handleDrawing).not.toHaveBeenCalled()
    })

    it('should adjust brush on alt + right-drag while adjusting', async () => {
      const tm = setup()
      mockStore.isAdjustingBrush = true
      mockStore.currentTool = Tools.MaskPen

      await tm.handlePointerMove(pointerEvent({ altKey: true, buttons: 2 }))

      expect(mockBrushDrawing.handleBrushAdjustment).toHaveBeenCalled()
      expect(mockBrushDrawing.handleDrawing).not.toHaveBeenCalled()
    })

    it('should call handleDrawing on left or right drag for drawing tools', async () => {
      const tm = setup()
      mockStore.currentTool = Tools.MaskPen

      await tm.handlePointerMove(pointerEvent({ buttons: 1 }))
      expect(mockBrushDrawing.handleDrawing).toHaveBeenCalledTimes(1)

      await tm.handlePointerMove(pointerEvent({ buttons: 2 }))
      expect(mockBrushDrawing.handleDrawing).toHaveBeenCalledTimes(2)
    })
  })

  describe('handlePointerUp', () => {
    it('should reset panning and brush state', async () => {
      const tm = setup()
      mockStore.isPanning = true
      mockStore.brushVisible = false
      mockStore.isAdjustingBrush = true

      await tm.handlePointerUp(pointerEvent({}))

      expect(mockStore.isPanning).toBe(false)
      expect(mockStore.brushVisible).toBe(true)
      expect(mockStore.isAdjustingBrush).toBe(false)
      expect(mockBrushDrawing.drawEnd).toHaveBeenCalled()
    })

    it('should remove pen pointer id when pointerType is "pen"', async () => {
      const tm = setup()

      await tm.handlePointerUp(
        pointerEvent({ pointerType: 'pen', pointerId: 12 })
      )

      expect(mockPanZoom.removePenPointerId).toHaveBeenCalledWith(12)
    })

    it('should bail out before drawEnd for touch pointers', async () => {
      const tm = setup()

      await tm.handlePointerUp(pointerEvent({ pointerType: 'touch' }))

      expect(mockBrushDrawing.drawEnd).not.toHaveBeenCalled()
    })
  })
})
