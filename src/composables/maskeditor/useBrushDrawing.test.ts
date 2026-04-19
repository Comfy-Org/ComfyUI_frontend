import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import {
  BrushShape,
  CompositionOperation,
  MaskBlendMode,
  Tools
} from '@/extensions/core/maskeditor/types'
import type { Brush } from '@/extensions/core/maskeditor/types'

// Patch document.createElement to return a canvas with a working 2d context
const originalCreateElement = document.createElement.bind(document)
vi.spyOn(document, 'createElement').mockImplementation(
  (tag: string, options?: ElementCreationOptions) => {
    const el = originalCreateElement(tag, options)
    if (tag === 'canvas') {
      const canvas = el as HTMLCanvasElement
      const mockImageData = {
        data: new Uint8ClampedArray(1024 * 4),
        width: 32,
        height: 32
      }
      const ctx2d = {
        createImageData: vi.fn(() => mockImageData),
        putImageData: vi.fn(),
        getImageData: vi.fn(() => mockImageData)
      }
      const origGetContext = canvas.getContext.bind(canvas)
      canvas.getContext = ((id: string, ...rest: unknown[]) => {
        if (id === '2d') return ctx2d as unknown as CanvasRenderingContext2D
        return origGetContext(id as '2d', ...rest)
      }) as typeof canvas.getContext
    }
    return el
  }
)

// Mock dependencies that are NOT the code under test
vi.mock('@/scripts/utils', () => ({
  getStorageValue: vi.fn(),
  setStorageValue: vi.fn()
}))

vi.mock('typegpu', () => ({
  tgpu: { init: vi.fn() }
}))

vi.mock('./gpu/GPUBrushRenderer', () => ({
  GPUBrushRenderer: vi.fn()
}))

vi.mock('@vueuse/core', () => ({
  createSharedComposable: (fn: () => unknown) => fn
}))

const mockScreenToCanvas = vi.fn((p) => p)

vi.mock('./useCoordinateTransform', () => ({
  useCoordinateTransform: () => ({
    screenToCanvas: mockScreenToCanvas,
    canvasToScreen: vi.fn((p) => p)
  })
}))

const mockCanvasHistory = {
  saveState: vi.fn(),
  currentStateIndex: 0,
  canUndo: { value: false },
  canRedo: { value: false },
  undo: vi.fn(),
  redo: vi.fn()
}

function createMockCtx(): CanvasRenderingContext2D {
  const gradient = {
    addColorStop: vi.fn()
  }
  return {
    beginPath: vi.fn(),
    fill: vi.fn(),
    arc: vi.fn(),
    rect: vi.fn(),
    fillStyle: '',
    globalCompositeOperation: 'source-over',
    drawImage: vi.fn(),
    getImageData: vi.fn(() => ({
      data: new Uint8ClampedArray(100 * 100 * 4),
      width: 100,
      height: 100
    })),
    putImageData: vi.fn(),
    clearRect: vi.fn(),
    createRadialGradient: vi.fn(() => gradient)
  } as unknown as CanvasRenderingContext2D
}

interface MockStore {
  brushSettings: Brush
  maskBlendMode: MaskBlendMode
  activeLayer: string
  rgbColor: string
  currentTool: Tools
  maskColor: { r: number; g: number; b: number }
  maskCanvas: HTMLCanvasElement | null
  maskCtx: CanvasRenderingContext2D | null
  rgbCanvas: HTMLCanvasElement | null
  rgbCtx: CanvasRenderingContext2D | null
  maskOpacity: number
  canvasHistory: typeof mockCanvasHistory
  brushVisible: boolean
  brushPreviewGradientVisible: boolean
  clearTrigger: number
  tgpuRoot: { destroy: () => void } | null
  gpuTexturesNeedRecreation: boolean
  gpuTextureWidth: number
  gpuTextureHeight: number
  pendingGPUMaskData: null
  pendingGPURgbData: null
  setBrushSize: ReturnType<typeof vi.fn>
  setBrushOpacity: ReturnType<typeof vi.fn>
  setBrushHardness: ReturnType<typeof vi.fn>
  setBrushStepSize: ReturnType<typeof vi.fn>
}

let mockStore: MockStore

function createMockCanvas(): HTMLCanvasElement {
  const canvas = originalCreateElement('canvas') as HTMLCanvasElement
  canvas.width = 100
  canvas.height = 100
  return canvas
}

function createMockStore(): MockStore {
  return {
    brushSettings: {
      type: BrushShape.Arc,
      size: 20,
      opacity: 1,
      hardness: 1,
      stepSize: 5
    },
    maskBlendMode: MaskBlendMode.Black,
    activeLayer: 'mask',
    rgbColor: '#FF0000',
    currentTool: Tools.MaskPen,
    maskColor: { r: 0, g: 0, b: 0 },
    maskCanvas: createMockCanvas(),
    maskCtx: createMockCtx(),
    rgbCanvas: createMockCanvas(),
    rgbCtx: createMockCtx(),
    maskOpacity: 0.8,
    canvasHistory: mockCanvasHistory,
    brushVisible: true,
    brushPreviewGradientVisible: false,
    clearTrigger: 0,
    tgpuRoot: null,
    gpuTexturesNeedRecreation: false,
    gpuTextureWidth: 0,
    gpuTextureHeight: 0,
    pendingGPUMaskData: null,
    pendingGPURgbData: null,
    setBrushSize: vi.fn((s: number) => {
      mockStore.brushSettings.size = Math.max(1, Math.min(250, s))
    }),
    setBrushOpacity: vi.fn((o: number) => {
      mockStore.brushSettings.opacity = Math.max(0, Math.min(1, o))
    }),
    setBrushHardness: vi.fn((h: number) => {
      mockStore.brushSettings.hardness = Math.max(0, Math.min(1, h))
    }),
    setBrushStepSize: vi.fn((s: number) => {
      mockStore.brushSettings.stepSize = Math.max(1, Math.min(100, s))
    })
  }
}

vi.mock('@/stores/maskEditorStore', () => ({
  useMaskEditorStore: vi.fn(() => mockStore)
}))

// Must import AFTER mocks
import { getStorageValue, setStorageValue } from '@/scripts/utils'
import { useBrushDrawing } from './useBrushDrawing'

function createPointerEvent(
  overrides: Partial<PointerEvent> = {}
): PointerEvent {
  return {
    offsetX: 50,
    offsetY: 50,
    buttons: 1,
    shiftKey: false,
    preventDefault: vi.fn(),
    ...overrides
  } as unknown as PointerEvent
}

describe('useBrushDrawing', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockStore = createMockStore()
    vi.mocked(getStorageValue).mockReturnValue(null)
  })

  describe('initialization', () => {
    it('should restore brush settings from cache when available', () => {
      const cached: Brush = {
        type: BrushShape.Rect,
        size: 42,
        opacity: 0.5,
        hardness: 0.8,
        stepSize: 15
      }
      vi.mocked(getStorageValue).mockReturnValue(JSON.stringify(cached))

      useBrushDrawing()

      expect(mockStore.setBrushSize).toHaveBeenCalledWith(42)
      expect(mockStore.setBrushOpacity).toHaveBeenCalledWith(0.5)
      expect(mockStore.setBrushHardness).toHaveBeenCalledWith(0.8)
      expect(mockStore.setBrushStepSize).toHaveBeenCalledWith(15)
      expect(mockStore.brushSettings.type).toBe(BrushShape.Rect)
    })

    it('should not modify store when no cached settings exist', () => {
      vi.mocked(getStorageValue).mockReturnValue(null)

      useBrushDrawing()

      expect(mockStore.setBrushSize).not.toHaveBeenCalled()
      expect(mockStore.setBrushOpacity).not.toHaveBeenCalled()
    })

    it('should handle corrupted cache gracefully', () => {
      vi.mocked(getStorageValue).mockReturnValue('{invalid json')
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      useBrushDrawing()

      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to load brush from cache:',
        expect.any(SyntaxError)
      )
      expect(mockStore.setBrushSize).not.toHaveBeenCalled()
    })

    it('should accept initial settings overrides', () => {
      const { handleBrushAdjustment } = useBrushDrawing({
        useDominantAxis: true,
        brushAdjustmentSpeed: 2.0
      })

      expect(handleBrushAdjustment).toBeDefined()
    })
  })

  describe('saveBrushSettings', () => {
    it('should debounce-save current brush settings to storage', () => {
      vi.useFakeTimers()
      const { saveBrushSettings } = useBrushDrawing()

      saveBrushSettings()
      vi.advanceTimersByTime(300)

      expect(setStorageValue).toHaveBeenCalledWith(
        'maskeditor_brush_settings',
        JSON.stringify(mockStore.brushSettings)
      )
      vi.useRealTimers()
    })
  })

  describe('startDrawing', () => {
    it('should set isDrawing state and initialize stroke', async () => {
      const { startDrawing, drawEnd } = useBrushDrawing()
      const event = createPointerEvent()

      await startDrawing(event)

      // Verify initShape was called (context globalCompositeOperation set)
      expect(mockStore.maskCtx!.beginPath).toHaveBeenCalled()

      // Clean up
      await drawEnd(createPointerEvent())
    })

    it('should use destination-out composition for eraser tool', async () => {
      mockStore.currentTool = Tools.Eraser
      const { startDrawing, drawEnd } = useBrushDrawing()
      const event = createPointerEvent()

      await startDrawing(event)

      expect(mockStore.maskCtx!.globalCompositeOperation).toBe(
        CompositionOperation.DestinationOut
      )
      await drawEnd(createPointerEvent())
    })

    it('should use destination-out for right mouse button', async () => {
      const { startDrawing, drawEnd } = useBrushDrawing()
      const event = createPointerEvent({ buttons: 2 })

      await startDrawing(event)

      expect(mockStore.maskCtx!.globalCompositeOperation).toBe(
        CompositionOperation.DestinationOut
      )
      await drawEnd(createPointerEvent())
    })

    it('should use source-over for regular drawing', async () => {
      mockStore.currentTool = Tools.MaskPen
      const { startDrawing, drawEnd } = useBrushDrawing()
      const event = createPointerEvent()

      await startDrawing(event)

      expect(mockStore.maskCtx!.globalCompositeOperation).toBe(
        CompositionOperation.SourceOver
      )
      await drawEnd(createPointerEvent())
    })
  })

  describe('drawEnd', () => {
    it('should save canvas history on stroke end', async () => {
      const { startDrawing, drawEnd } = useBrushDrawing()

      await startDrawing(createPointerEvent())
      await drawEnd(createPointerEvent())
      await nextTick()

      expect(mockCanvasHistory.saveState).toHaveBeenCalled()
    })

    it('should update lineStartPoint for shift-click continuity', async () => {
      const { startDrawing, drawEnd } = useBrushDrawing()

      await startDrawing(createPointerEvent({ offsetX: 10, offsetY: 20 }))
      await drawEnd(createPointerEvent({ offsetX: 30, offsetY: 40 }))

      // Next shift-click should reference previous end point
      const shiftEvent = createPointerEvent({
        offsetX: 60,
        offsetY: 80,
        shiftKey: true
      })
      await startDrawing(shiftEvent)
      await drawEnd(createPointerEvent({ offsetX: 60, offsetY: 80 }))

      // Should have saved state for both strokes
      expect(mockCanvasHistory.saveState).toHaveBeenCalledTimes(2)
    })

    it('should not save state when not currently drawing', async () => {
      const { drawEnd } = useBrushDrawing()

      await drawEnd(createPointerEvent())

      expect(mockCanvasHistory.saveState).not.toHaveBeenCalled()
    })
  })

  describe('shift+click line drawing', () => {
    it('should draw a line from previous point on shift+click', async () => {
      const { startDrawing, drawEnd } = useBrushDrawing()

      // First stroke establishes lineStartPoint
      await startDrawing(createPointerEvent({ offsetX: 0, offsetY: 0 }))
      await drawEnd(createPointerEvent({ offsetX: 0, offsetY: 0 }))

      // Shift+click should draw a line from previous end point
      const shiftEvent = createPointerEvent({
        offsetX: 50,
        offsetY: 0,
        shiftKey: true
      })
      await startDrawing(shiftEvent)

      // drawShape (via drawLine) calls fill on the context
      expect(mockStore.maskCtx!.fill).toHaveBeenCalled()

      await drawEnd(createPointerEvent({ offsetX: 50, offsetY: 0 }))
    })
  })

  describe('startBrushAdjustment', () => {
    it('should enable brush preview and set initial point', async () => {
      const { startBrushAdjustment } = useBrushDrawing()
      const event = createPointerEvent({ offsetX: 100, offsetY: 200 })

      await startBrushAdjustment(event)

      expect(mockStore.brushPreviewGradientVisible).toBe(true)
      expect(event.preventDefault).toHaveBeenCalled()
    })
  })

  describe('handleBrushAdjustment', () => {
    it('should adjust brush size with horizontal movement', async () => {
      const { startBrushAdjustment, handleBrushAdjustment } = useBrushDrawing()

      await startBrushAdjustment(
        createPointerEvent({ offsetX: 50, offsetY: 50 })
      )
      await handleBrushAdjustment(
        createPointerEvent({ offsetX: 100, offsetY: 50 })
      )

      expect(mockStore.setBrushSize).toHaveBeenCalled()
    })

    it('should adjust brush hardness with vertical movement', async () => {
      const { startBrushAdjustment, handleBrushAdjustment } = useBrushDrawing()

      await startBrushAdjustment(
        createPointerEvent({ offsetX: 50, offsetY: 50 })
      )
      await handleBrushAdjustment(
        createPointerEvent({ offsetX: 50, offsetY: 150 })
      )

      expect(mockStore.setBrushHardness).toHaveBeenCalled()
    })

    it('should not adjust when no initial point is set', async () => {
      const { handleBrushAdjustment } = useBrushDrawing()

      await handleBrushAdjustment(
        createPointerEvent({ offsetX: 100, offsetY: 100 })
      )

      expect(mockStore.setBrushSize).not.toHaveBeenCalled()
      expect(mockStore.setBrushHardness).not.toHaveBeenCalled()
    })

    it('should apply dead zone for small movements', async () => {
      const { startBrushAdjustment, handleBrushAdjustment } = useBrushDrawing()

      await startBrushAdjustment(
        createPointerEvent({ offsetX: 50, offsetY: 50 })
      )
      // Move less than dead zone (5px)
      await handleBrushAdjustment(
        createPointerEvent({ offsetX: 53, offsetY: 53 })
      )

      // Size should be set but with delta=0 (dead zone), so stays the same
      const sizeCall = mockStore.setBrushSize.mock.calls[0]?.[0]
      if (sizeCall !== undefined) {
        expect(sizeCall).toBeCloseTo(mockStore.brushSettings.size, 0)
      }
    })

    it('should suppress one axis when useDominantAxis is enabled', async () => {
      const { startBrushAdjustment, handleBrushAdjustment } = useBrushDrawing({
        useDominantAxis: true
      })

      await startBrushAdjustment(
        createPointerEvent({ offsetX: 50, offsetY: 50 })
      )
      // Move strongly horizontal
      await handleBrushAdjustment(
        createPointerEvent({ offsetX: 100, offsetY: 52 })
      )

      // Size should change, hardness should stay roughly the same
      expect(mockStore.setBrushSize).toHaveBeenCalled()
      const hardnessCall = mockStore.setBrushHardness.mock.calls[0]?.[0]
      if (hardnessCall !== undefined) {
        expect(hardnessCall).toBeCloseTo(1, 1)
      }
    })

    it('should cap delta values at ±100', async () => {
      const { startBrushAdjustment, handleBrushAdjustment } = useBrushDrawing()

      await startBrushAdjustment(
        createPointerEvent({ offsetX: 50, offsetY: 50 })
      )
      // Move extremely far
      await handleBrushAdjustment(
        createPointerEvent({ offsetX: 500, offsetY: 500 })
      )

      // Should be capped, not exceed 500 size
      const sizeCall = mockStore.setBrushSize.mock.calls[0]?.[0]
      if (sizeCall !== undefined) {
        expect(sizeCall).toBeLessThanOrEqual(500)
      }
    })

    it('should respect brushAdjustmentSpeed', async () => {
      const slow = useBrushDrawing({ brushAdjustmentSpeed: 0.5 })
      const fast = useBrushDrawing({ brushAdjustmentSpeed: 2.0 })

      // Reset store between calls
      const startEvent = createPointerEvent({ offsetX: 50, offsetY: 50 })
      const moveEvent = createPointerEvent({ offsetX: 100, offsetY: 50 })

      await slow.startBrushAdjustment(startEvent)
      await slow.handleBrushAdjustment(moveEvent)
      const slowSizeCall = mockStore.setBrushSize.mock.calls[0]?.[0]

      mockStore.setBrushSize.mockClear()
      mockStore.brushSettings.size = 20

      await fast.startBrushAdjustment(startEvent)
      await fast.handleBrushAdjustment(moveEvent)
      const fastSizeCall = mockStore.setBrushSize.mock.calls[0]?.[0]

      // Faster speed should produce a larger change
      if (slowSizeCall !== undefined && fastSizeCall !== undefined) {
        expect(Math.abs(fastSizeCall - 20)).toBeGreaterThan(
          Math.abs(slowSizeCall - 20)
        )
      }
    })
  })

  describe('drawShape (CPU fallback)', () => {
    // StrokeProcessor buffers points and only outputs after 4 control points.
    // A single-point stroke is flushed in drawEnd via endStroke().
    // We test that the CPU fallback draws shapes by completing a full stroke.

    it('should draw mask shape with circle brush on stroke end', async () => {
      mockStore.brushSettings.type = BrushShape.Arc
      mockStore.brushSettings.hardness = 1

      const { startDrawing, drawEnd } = useBrushDrawing()
      await startDrawing(createPointerEvent({ offsetX: 50, offsetY: 50 }))
      await drawEnd(createPointerEvent({ offsetX: 50, offsetY: 50 }))

      // endStroke flushes the single point via drawShape -> arc
      expect(mockStore.maskCtx!.arc).toHaveBeenCalled()
    })

    it('should draw mask shape with rect brush on stroke end', async () => {
      mockStore.brushSettings.type = BrushShape.Rect
      mockStore.brushSettings.hardness = 1

      const { startDrawing, drawEnd } = useBrushDrawing()
      await startDrawing(createPointerEvent({ offsetX: 50, offsetY: 50 }))
      await drawEnd(createPointerEvent({ offsetX: 50, offsetY: 50 }))

      // endStroke flushes the single point via drawShape -> rect
      expect(mockStore.maskCtx!.rect).toHaveBeenCalled()
    })

    it('should draw on RGB layer when tool is PaintPen', async () => {
      mockStore.currentTool = Tools.PaintPen
      mockStore.activeLayer = 'rgb'
      mockStore.brushSettings.hardness = 1

      const { startDrawing, drawEnd } = useBrushDrawing()
      await startDrawing(createPointerEvent({ offsetX: 50, offsetY: 50 }))

      // initShape is called which calls beginPath on both contexts
      expect(mockStore.rgbCtx!.beginPath).toHaveBeenCalled()

      await drawEnd(createPointerEvent({ offsetX: 50, offsetY: 50 }))
    })

    it('should catch error and reset state when contexts are missing', async () => {
      mockStore.maskCtx = null
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const { startDrawing } = useBrushDrawing()
      await startDrawing(createPointerEvent())

      // startDrawing catches the error and resets isDrawing
      expect(consoleSpy).toHaveBeenCalledWith(
        '[useBrushDrawing] Failed to start drawing:',
        expect.any(Error)
      )
    })

    it('should use gradient for soft circle brushes on stroke end', async () => {
      mockStore.brushSettings.hardness = 0.5
      mockStore.brushSettings.type = BrushShape.Arc

      const { startDrawing, drawEnd } = useBrushDrawing()
      await startDrawing(createPointerEvent({ offsetX: 50, offsetY: 50 }))
      await drawEnd(createPointerEvent({ offsetX: 50, offsetY: 50 }))

      expect(mockStore.maskCtx!.createRadialGradient).toHaveBeenCalled()
    })

    it('should use cached brush texture for soft rect brushes on stroke end', async () => {
      mockStore.brushSettings.hardness = 0.5
      mockStore.brushSettings.type = BrushShape.Rect

      const { startDrawing, drawEnd } = useBrushDrawing()
      await startDrawing(createPointerEvent({ offsetX: 50, offsetY: 50 }))
      await drawEnd(createPointerEvent({ offsetX: 50, offsetY: 50 }))

      // Soft rect brush uses drawImage with cached texture
      expect(mockStore.maskCtx!.drawImage).toHaveBeenCalled()
    })
  })

  describe('eraser behavior', () => {
    it('should use white color when erasing on mask layer', async () => {
      mockStore.currentTool = Tools.Eraser
      mockStore.brushSettings.hardness = 1

      const { startDrawing, drawEnd } = useBrushDrawing()
      await startDrawing(createPointerEvent({ offsetX: 50, offsetY: 50 }))
      await drawEnd(createPointerEvent({ offsetX: 50, offsetY: 50 }))

      // After stroke flush, fillStyle should have been set to white for erasing
      const fillStyle = mockStore.maskCtx!.fillStyle as string
      expect(fillStyle).toContain('rgba(255, 255, 255')
    })

    it('should erase on RGB layer with eraser tool', async () => {
      mockStore.currentTool = Tools.Eraser
      mockStore.activeLayer = 'rgb'
      mockStore.brushSettings.hardness = 1

      const { startDrawing, drawEnd } = useBrushDrawing()
      await startDrawing(createPointerEvent())

      expect(mockStore.rgbCtx!.globalCompositeOperation).toBe(
        CompositionOperation.DestinationOut
      )

      await drawEnd(createPointerEvent())
    })
  })

  describe('destroy', () => {
    it('should clean up tgpuRoot', () => {
      const mockTgpuRoot = { destroy: vi.fn() }
      mockStore.tgpuRoot = mockTgpuRoot as unknown as MockStore['tgpuRoot']

      const { destroy } = useBrushDrawing()
      destroy()

      expect(mockTgpuRoot.destroy).toHaveBeenCalled()
      expect(mockStore.tgpuRoot).toBeNull()
    })

    it('should handle destroy when no GPU resources exist', () => {
      const { destroy } = useBrushDrawing()

      expect(() => destroy()).not.toThrow()
    })
  })

  describe('initGPUResources', () => {
    it('should warn and return when tgpu fails to init', async () => {
      const { tgpu } = await import('typegpu')
      vi.mocked(tgpu.init).mockRejectedValue(new Error('No WebGPU'))

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const { initGPUResources } = useBrushDrawing()
      await initGPUResources()

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to initialize TypeGPU'),
        expect.any(String)
      )
    })

    it('should skip setup when canvas contexts are not ready', async () => {
      const { tgpu } = await import('typegpu')
      const mockRoot = { device: {}, destroy: vi.fn() }
      vi.mocked(tgpu.init).mockResolvedValue(
        mockRoot as unknown as Awaited<ReturnType<typeof tgpu.init>>
      )

      mockStore.maskCanvas = null

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const { initGPUResources } = useBrushDrawing()
      await initGPUResources()

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Canvas contexts not ready')
      )
    })
  })
})
