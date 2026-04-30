import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, ref, computed } from 'vue'
import type { EffectScope } from 'vue'

// vi.hoisted runs before imports — only vi.fn() is safe here (no Vue)
const saveStateSpy = vi.hoisted(() => vi.fn())

const mockStoreDef = vi.hoisted(() => ({
  brushSettings: {
    size: 20,
    hardness: 0.9,
    opacity: 1,
    stepSize: 5,
    type: 'arc' as string
  },
  currentTool: 'pen' as string,
  activeLayer: 'mask' as string,
  maskCanvas: null as HTMLCanvasElement | null,
  maskCtx: null as CanvasRenderingContext2D | null,
  rgbCanvas: null as HTMLCanvasElement | null,
  rgbCtx: null as CanvasRenderingContext2D | null,
  maskBlendMode: 'black',
  maskOpacity: 0.8,
  maskColor: { r: 0, g: 0, b: 0 },
  rgbColor: '#FF0000',
  canvasHistory: { saveState: saveStateSpy }
}))

// vi.mock factory runs after hoisting — ref/computed from Vue are available
vi.mock('./useGPUResources', () => {
  // Singletons shared across all calls to useGPUResources() in this test file
  const isSavingHistory = ref(false)
  const dirtyRect = ref({
    minX: Infinity,
    minY: Infinity,
    maxX: -Infinity,
    maxY: -Infinity
  })
  const hasRenderer = computed(() => false)
  const previewCanvas = ref<HTMLCanvasElement | null>(null)
  const prepareStroke = vi.fn()
  const clearPreview = vi.fn()
  const compositeStroke = vi.fn()
  const copyGpuToCanvas = vi
    .fn()
    .mockResolvedValue({ maskData: undefined, rgbData: undefined })
  return {
    useGPUResources: () => ({
      isSavingHistory,
      dirtyRect,
      hasRenderer,
      previewCanvas,
      prepareStroke,
      clearPreview,
      compositeStroke,
      copyGpuToCanvas,
      gpuRender: vi.fn(),
      gpuDrawPoint: vi.fn(),
      clearGPU: vi.fn(),
      destroy: vi.fn(),
      initGPUResources: vi.fn().mockResolvedValue(undefined),
      initPreviewCanvas: vi.fn()
    })
  }
})

vi.mock('./useCoordinateTransform', () => ({
  useCoordinateTransform: () => ({
    screenToCanvas: vi.fn(({ x, y }: { x: number; y: number }) => ({ x, y }))
  })
}))

vi.mock('./useBrushPersistence', () => ({
  useBrushPersistence: () => ({ loadAndApply: vi.fn(), save: vi.fn() })
}))

vi.mock('./useBrushAdjustment', () => ({
  useBrushAdjustment: () => ({
    startBrushAdjustment: vi.fn(),
    handleBrushAdjustment: vi.fn()
  })
}))

vi.mock('@/stores/maskEditorStore', () => ({
  useMaskEditorStore: vi.fn(() => mockStoreDef)
}))

vi.mock('@/scripts/app', () => ({
  app: { registerExtension: vi.fn() }
}))

import { useGPUResources } from './useGPUResources'
import { useBrushDrawing } from './useBrushDrawing'

function makePointerEvent(
  x: number,
  y: number,
  opts: { buttons?: number; shiftKey?: boolean } = {}
): PointerEvent {
  return {
    offsetX: x,
    offsetY: y,
    buttons: opts.buttons ?? 1,
    shiftKey: opts.shiftKey ?? false,
    preventDefault: vi.fn()
  } as unknown as PointerEvent
}

function makeMockCtx(): CanvasRenderingContext2D {
  const gradient = { addColorStop: vi.fn() }
  return {
    beginPath: vi.fn(),
    fill: vi.fn(),
    rect: vi.fn(),
    arc: vi.fn(),
    fillStyle: '',
    drawImage: vi.fn(),
    createRadialGradient: vi.fn(() => gradient),
    globalCompositeOperation: 'source-over'
  } as unknown as CanvasRenderingContext2D
}

let scope: EffectScope | null = null

function setup() {
  scope = effectScope()
  return scope.run(() => useBrushDrawing())!
}

beforeEach(() => {
  vi.clearAllMocks()

  const mockCtx = makeMockCtx()
  const mockCanvas = {
    width: 200,
    height: 200,
    style: { opacity: '' }
  } as unknown as HTMLCanvasElement

  mockStoreDef.maskCanvas = mockCanvas
  mockStoreDef.maskCtx = mockCtx
  mockStoreDef.rgbCanvas = mockCanvas
  mockStoreDef.rgbCtx = mockCtx
  mockStoreDef.currentTool = 'pen'

  const gpu = useGPUResources()
  gpu.isSavingHistory.value = false
  gpu.dirtyRect.value = {
    minX: Infinity,
    minY: Infinity,
    maxX: -Infinity,
    maxY: -Infinity
  }
})

afterEach(() => {
  scope?.stop()
  scope = null
})

describe('startDrawing', () => {
  it('calls prepareStroke on the GPU resources', async () => {
    const { startDrawing } = setup()
    await startDrawing(makePointerEvent(50, 50))
    expect(useGPUResources().prepareStroke).toHaveBeenCalledOnce()
  })

  it('sets DestinationOut composition when tool is eraser', async () => {
    mockStoreDef.currentTool = 'eraser'
    const { startDrawing } = setup()
    await startDrawing(makePointerEvent(50, 50))
    expect(mockStoreDef.maskCtx!.globalCompositeOperation).toBe(
      'destination-out'
    )
  })

  it('sets SourceOver composition when tool is mask pen', async () => {
    const { startDrawing } = setup()
    await startDrawing(makePointerEvent(50, 50))
    expect(mockStoreDef.maskCtx!.globalCompositeOperation).toBe('source-over')
  })

  it('sets DestinationOut composition when right mouse button is used', async () => {
    const { startDrawing } = setup()
    await startDrawing(makePointerEvent(50, 50, { buttons: 2 }))
    expect(mockStoreDef.maskCtx!.globalCompositeOperation).toBe(
      'destination-out'
    )
  })
})

describe('drawEnd', () => {
  it('calls compositeStroke indicating the active layer and erasing state', async () => {
    const { startDrawing, drawEnd } = setup()
    await startDrawing(makePointerEvent(50, 50))
    await drawEnd(makePointerEvent(60, 60))
    expect(useGPUResources().compositeStroke).toHaveBeenCalledOnce()
    expect(useGPUResources().compositeStroke).toHaveBeenCalledWith(false, false)
  })

  it('calls clearPreview to clean up the GPU overlay', async () => {
    const { startDrawing, drawEnd } = setup()
    await startDrawing(makePointerEvent(50, 50))
    await drawEnd(makePointerEvent(60, 60))
    expect(useGPUResources().clearPreview).toHaveBeenCalledOnce()
  })

  it('saves canvas history on stroke completion', async () => {
    const { startDrawing, drawEnd } = setup()
    await startDrawing(makePointerEvent(50, 50))
    await drawEnd(makePointerEvent(60, 60))
    expect(saveStateSpy).toHaveBeenCalledOnce()
  })

  it('is a no-op when drawing was never started', async () => {
    const { drawEnd } = setup()
    await drawEnd(makePointerEvent(60, 60))
    expect(useGPUResources().compositeStroke).not.toHaveBeenCalled()
    expect(saveStateSpy).not.toHaveBeenCalled()
  })
})
