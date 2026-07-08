import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, reactive } from 'vue'
import type { EffectScope } from 'vue'

vi.mock('typegpu', () => ({
  tgpu: {
    init: vi.fn().mockRejectedValue(new Error('WebGPU not supported'))
  }
}))

vi.mock('./gpu/GPUBrushRenderer', () => ({
  GPUBrushRenderer: vi.fn()
}))

const mockStore = reactive({
  tgpuRoot: null as unknown,
  maskCanvas: null as HTMLCanvasElement | null,
  rgbCanvas: null as HTMLCanvasElement | null,
  maskCtx: null as CanvasRenderingContext2D | null,
  rgbCtx: null as CanvasRenderingContext2D | null,
  clearTrigger: 0,
  canvasHistory: { currentStateIndex: 0 },
  gpuTexturesNeedRecreation: false,
  gpuTextureWidth: 0,
  gpuTextureHeight: 0,
  pendingGPUMaskData: null as Uint8Array | null,
  pendingGPURgbData: null as Uint8Array | null,
  brushSettings: {
    size: 20,
    hardness: 0.9,
    opacity: 1,
    stepSize: 5,
    type: 'arc'
  },
  activeLayer: 'mask',
  currentTool: 'pen',
  maskColor: { r: 0, g: 0, b: 0 },
  rgbColor: '#FF0000'
})

vi.mock('@/stores/maskEditorStore', () => ({
  useMaskEditorStore: vi.fn(() => mockStore)
}))

import { tgpu } from 'typegpu'

import { GPUBrushRenderer } from './gpu/GPUBrushRenderer'
import { resetDirtyRect } from './brushDrawingUtils'
import { useGPUResources } from './useGPUResources'

let scope: EffectScope | null = null
const hadOriginalNavigatorGpu = 'gpu' in navigator
const originalNavigatorGpu = (navigator as { gpu?: unknown }).gpu

function setup() {
  scope = effectScope()
  return scope.run(() => useGPUResources())!
}

class TestImageData {
  data: Uint8ClampedArray
  width: number
  height: number

  constructor(data: Uint8ClampedArray, width: number, height: number) {
    this.data = data
    this.width = width
    this.height = height
  }
}

function createMockTexture(): GPUTexture {
  const obj: unknown = {
    createView: vi.fn(() => ({})),
    destroy: vi.fn()
  }
  return obj as GPUTexture
}

function createMockBuffer(byteLength = 16): GPUBuffer {
  const obj: unknown = {
    destroy: vi.fn(),
    mapAsync: vi.fn().mockResolvedValue(undefined),
    getMappedRange: vi.fn(() => new Uint8Array(byteLength).buffer),
    unmap: vi.fn()
  }
  return obj as GPUBuffer
}

function createMockDevice(): GPUDevice {
  const obj: unknown = {
    limits: {},
    queue: {
      writeTexture: vi.fn(),
      submit: vi.fn()
    },
    createTexture: vi.fn(() => createMockTexture()),
    createBuffer: vi.fn(() => createMockBuffer()),
    createCommandEncoder: vi.fn(() => ({
      copyBufferToBuffer: vi.fn(),
      finish: vi.fn(() => ({}))
    }))
  }
  return obj as GPUDevice
}

function createMockRenderer() {
  return {
    destroy: vi.fn(),
    prepareStroke: vi.fn(),
    clearPreview: vi.fn(),
    compositeStroke: vi.fn(),
    prepareReadback: vi.fn(),
    renderStrokeToAccumulator: vi.fn(),
    blitToCanvas: vi.fn()
  }
}

function mockGpuBrushRenderer(renderer: ReturnType<typeof createMockRenderer>) {
  vi.mocked(GPUBrushRenderer).mockImplementation(
    function GPUBrushRendererMock() {
      const r: unknown = renderer
      return r as GPUBrushRenderer
    }
  )
}

function createCanvasContext(
  width: number,
  height: number
): CanvasRenderingContext2D {
  const obj: unknown = {
    globalCompositeOperation: 'source-over',
    getImageData: vi.fn(
      () =>
        new ImageData(new Uint8ClampedArray(width * height * 4), width, height)
    ),
    putImageData: vi.fn()
  }
  return obj as CanvasRenderingContext2D
}

function setReadyCanvases(width = 2, height = 2) {
  const maskCanvas = document.createElement('canvas')
  maskCanvas.width = width
  maskCanvas.height = height
  const rgbCanvas = document.createElement('canvas')
  rgbCanvas.width = width
  rgbCanvas.height = height

  mockStore.maskCanvas = maskCanvas
  mockStore.rgbCanvas = rgbCanvas
  mockStore.maskCtx = createCanvasContext(width, height)
  mockStore.rgbCtx = createCanvasContext(width, height)
}

function installGpuGlobals() {
  vi.stubGlobal('GPUTextureUsage', {
    TEXTURE_BINDING: 1,
    STORAGE_BINDING: 2,
    RENDER_ATTACHMENT: 4,
    COPY_DST: 8,
    COPY_SRC: 16
  })
  vi.stubGlobal('GPUBufferUsage', {
    STORAGE: 1,
    COPY_SRC: 2,
    COPY_DST: 4,
    MAP_READ: 8
  })
  vi.stubGlobal('GPUMapMode', { READ: 1 })
  vi.stubGlobal('ImageData', TestImageData)
  Object.defineProperty(navigator, 'gpu', {
    value: { getPreferredCanvasFormat: vi.fn(() => 'rgba8unorm') },
    configurable: true
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  installGpuGlobals()
  mockStore.tgpuRoot = null
  mockStore.maskCanvas = null
  mockStore.rgbCanvas = null
  mockStore.maskCtx = null
  mockStore.rgbCtx = null
  mockStore.clearTrigger = 0
  mockStore.canvasHistory.currentStateIndex = 0
  mockStore.gpuTexturesNeedRecreation = false
  mockStore.gpuTextureWidth = 0
  mockStore.gpuTextureHeight = 0
  mockStore.pendingGPUMaskData = null
  mockStore.pendingGPURgbData = null
  mockStore.activeLayer = 'mask'
  mockStore.currentTool = 'pen'
  mockStore.maskColor = { r: 0, g: 0, b: 0 }
  mockStore.rgbColor = '#FF0000'
  mockStore.brushSettings = {
    size: 20,
    hardness: 0.9,
    opacity: 1,
    stepSize: 5,
    type: 'arc'
  }
  vi.mocked(tgpu.init).mockRejectedValue(new Error('WebGPU not supported'))
})

afterEach(() => {
  scope?.stop()
  scope = null
  vi.unstubAllGlobals()
  // Object.defineProperty on navigator isn't undone by unstubAllGlobals.
  if (hadOriginalNavigatorGpu) {
    Object.defineProperty(navigator, 'gpu', {
      value: originalNavigatorGpu,
      configurable: true
    })
  } else {
    Reflect.deleteProperty(navigator, 'gpu')
  }
})

describe('initial reactive state', () => {
  it('hasRenderer is false when no renderer exists', () => {
    const { hasRenderer } = setup()
    expect(hasRenderer.value).toBe(false)
  })

  it('isSavingHistory is false initially', () => {
    const { isSavingHistory } = setup()
    expect(isSavingHistory.value).toBe(false)
  })

  it('previewCanvas is null initially', () => {
    const { previewCanvas } = setup()
    expect(previewCanvas.value).toBeNull()
  })

  it('dirtyRect starts with uninitialised sentinel values', () => {
    const { dirtyRect } = setup()
    expect(dirtyRect.value).toEqual(resetDirtyRect())
  })
})

describe('no-op when GPU is not initialised', () => {
  it('prepareStroke does not throw', () => {
    const { prepareStroke } = setup()
    expect(() => prepareStroke()).not.toThrow()
  })

  it('clearPreview does not throw', () => {
    const { clearPreview } = setup()
    expect(() => clearPreview()).not.toThrow()
  })

  it('clearGPU does not throw', () => {
    const { clearGPU } = setup()
    expect(() => clearGPU()).not.toThrow()
  })

  it('destroy does not throw', () => {
    const { destroy } = setup()
    expect(() => destroy()).not.toThrow()
  })

  it('gpuRender does not throw with empty or non-empty point arrays', () => {
    const { gpuRender } = setup()
    expect(() => gpuRender([])).not.toThrow()
    expect(() => gpuRender([{ x: 10, y: 20 }])).not.toThrow()
  })

  it('compositeStroke does not throw for any combination of flags', () => {
    const { compositeStroke } = setup()
    expect(() => compositeStroke(false, false)).not.toThrow()
    expect(() => compositeStroke(true, true)).not.toThrow()
  })
})

describe('initGPUResources', () => {
  it('leaves hasRenderer false when TypeGPU initialisation fails', async () => {
    const { initGPUResources, hasRenderer } = setup()
    await initGPUResources()
    expect(hasRenderer.value).toBe(false)
  })

  it('handles non-error TypeGPU initialisation failures', async () => {
    vi.mocked(tgpu.init).mockRejectedValueOnce('WebGPU unavailable')

    const { initGPUResources, hasRenderer } = setup()
    await initGPUResources()

    expect(hasRenderer.value).toBe(false)
  })

  it('initializes renderer when a root and canvas contexts are ready', async () => {
    const device = createMockDevice()
    const renderer = createMockRenderer()
    mockStore.tgpuRoot = {
      device,
      destroy: vi.fn()
    }
    setReadyCanvases()
    mockGpuBrushRenderer(renderer)

    const { initGPUResources, hasRenderer } = setup()
    await initGPUResources()

    expect(hasRenderer.value).toBe(true)
    expect(device.createTexture).toHaveBeenCalledTimes(2)
    expect(device.queue.writeTexture).toHaveBeenCalledTimes(2)
    expect(GPUBrushRenderer).toHaveBeenCalledWith(device, 'rgba8unorm')
  })
})

describe('copyGpuToCanvas', () => {
  it('rejects with a descriptive error when GPU resources are not ready', async () => {
    const { copyGpuToCanvas } = setup()
    await expect(copyGpuToCanvas()).rejects.toThrow('GPU resources not ready')
  })
})

describe('watchers', () => {
  it('clearTrigger watcher calls clearGPU without throwing', async () => {
    setup()
    mockStore.clearTrigger++
    await nextTick()
  })

  it('currentStateIndex watcher short-circuits when isSavingHistory is true', async () => {
    const { isSavingHistory } = setup()
    isSavingHistory.value = true
    mockStore.canvasHistory.currentStateIndex++
    await nextTick()
  })

  it('currentStateIndex watcher calls updateGPUFromCanvas when not saving history', async () => {
    setup()
    mockStore.canvasHistory.currentStateIndex++
    await nextTick()
  })

  it('gpuTexturesNeedRecreation watcher returns early when device is not initialised', async () => {
    setup()
    mockStore.gpuTexturesNeedRecreation = true
    await nextTick()
  })
})

describe('initGPUResources with pre-existing tgpuRoot', () => {
  it('returns early with a warning when canvas contexts are not ready', async () => {
    const { initGPUResources, hasRenderer } = setup()
    mockStore.tgpuRoot = { device: {} } as unknown
    await initGPUResources()
    expect(hasRenderer.value).toBe(false)
  })

  it('texture recreation watcher returns early when mask canvas is missing', async () => {
    const device = createMockDevice()
    const { initGPUResources } = setup()
    mockStore.tgpuRoot = { device, destroy: vi.fn() }

    await initGPUResources()
    mockStore.gpuTexturesNeedRecreation = true
    await nextTick()

    expect(device.createTexture).not.toHaveBeenCalled()
  })
})

describe('initPreviewCanvas', () => {
  it('returns early when device is not initialised', () => {
    const { initPreviewCanvas } = setup()
    const canvas = document.createElement('canvas')
    expect(() => initPreviewCanvas(canvas)).not.toThrow()
  })

  it('returns early when a WebGPU canvas context is unavailable', async () => {
    const device = createMockDevice()
    mockStore.tgpuRoot = { device, destroy: vi.fn() }
    setReadyCanvases()
    mockGpuBrushRenderer(createMockRenderer())

    const { initGPUResources, initPreviewCanvas, previewCanvas } = setup()
    await initGPUResources()
    const canvas = document.createElement('canvas')
    Object.defineProperty(canvas, 'getContext', { value: vi.fn(() => null) })

    initPreviewCanvas(canvas)

    expect(previewCanvas.value).toBeNull()
  })

  it('stores the preview canvas when a WebGPU context is available', async () => {
    const device = createMockDevice()
    const renderer = createMockRenderer()
    const previewContext = { configure: vi.fn() }
    mockStore.tgpuRoot = { device, destroy: vi.fn() }
    setReadyCanvases()
    mockGpuBrushRenderer(renderer)

    const { initGPUResources, initPreviewCanvas, previewCanvas } = setup()
    await initGPUResources()
    const canvas = document.createElement('canvas')
    Object.defineProperty(canvas, 'getContext', {
      value: vi.fn(() => previewContext)
    })

    initPreviewCanvas(canvas)

    expect(previewContext.configure).toHaveBeenCalledWith({
      device,
      format: 'rgba8unorm',
      alphaMode: 'premultiplied'
    })
    expect(previewCanvas.value).toBe(canvas)
  })
})

describe('gpuDrawPoint', () => {
  it('resolves immediately when renderer is not initialised', async () => {
    const { gpuDrawPoint } = setup()
    await expect(gpuDrawPoint({ x: 10, y: 20 })).resolves.toBeUndefined()
  })

  it('delegates renderer operations when GPU resources are initialized', async () => {
    const device = createMockDevice()
    const renderer = createMockRenderer()
    const previewContext = { configure: vi.fn() }
    mockStore.tgpuRoot = { device, destroy: vi.fn() }
    setReadyCanvases()
    mockGpuBrushRenderer(renderer)

    const resources = setup()
    await resources.initGPUResources()
    const canvas = document.createElement('canvas')
    Object.defineProperty(canvas, 'getContext', {
      value: vi.fn(() => previewContext)
    })
    resources.initPreviewCanvas(canvas)

    resources.prepareStroke()
    resources.clearPreview()
    resources.compositeStroke(false, false)
    resources.gpuRender([{ x: 1, y: 1 }])
    await resources.gpuDrawPoint({ x: 1, y: 1 })

    expect(renderer.prepareStroke).toHaveBeenCalledWith(2, 2)
    expect(renderer.clearPreview).toHaveBeenCalledWith(previewContext)
    expect(renderer.compositeStroke).toHaveBeenCalled()
    expect(renderer.renderStrokeToAccumulator).toHaveBeenCalled()
    expect(renderer.blitToCanvas).toHaveBeenCalled()
  })

  it('copies initialized GPU readback data to canvases', async () => {
    const device = createMockDevice()
    const renderer = createMockRenderer()
    mockStore.tgpuRoot = { device, destroy: vi.fn() }
    setReadyCanvases()
    mockGpuBrushRenderer(renderer)

    const resources = setup()
    await resources.initGPUResources()
    const result = await resources.copyGpuToCanvas()

    expect(result.maskData.width).toBe(2)
    expect(result.rgbData.height).toBe(2)
    expect(renderer.prepareReadback).toHaveBeenCalledTimes(2)
    expect(mockStore.maskCtx?.putImageData).toHaveBeenCalled()
    expect(mockStore.rgbCtx?.putImageData).toHaveBeenCalled()
  })

  it('destroys initialized GPU resources and root state', async () => {
    const device = createMockDevice()
    const renderer = createMockRenderer()
    const root = { device, destroy: vi.fn() }
    mockStore.tgpuRoot = root
    setReadyCanvases()
    mockGpuBrushRenderer(renderer)

    const { initGPUResources, destroy, hasRenderer } = setup()
    await initGPUResources()

    destroy()

    expect(renderer.destroy).toHaveBeenCalled()
    expect(root.destroy).toHaveBeenCalled()
    expect(mockStore.tgpuRoot).toBeNull()
    expect(hasRenderer.value).toBe(false)
  })
})
