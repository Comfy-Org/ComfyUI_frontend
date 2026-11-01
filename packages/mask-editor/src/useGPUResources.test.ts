import { useMaskEditorStore } from './maskEditorStore'
import { fromPartial } from '@total-typescript/shoehorn'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, reactive } from 'vue'
import type { EffectScope } from 'vue'

vi.mock<unknown>(import('typegpu'), () => ({
  tgpu: {
    init: vi.fn().mockRejectedValue(new Error('WebGPU not supported'))
  }
}))

const mockRenderer = vi.hoisted(() => ({
  blitToCanvas: vi.fn(),
  clearPreview: vi.fn(),
  compositeStroke: vi.fn(),
  destroy: vi.fn(),
  prepareStroke: vi.fn(),
  renderStrokeToAccumulator: vi.fn()
}))

vi.mock<unknown>(import('./gpu/GPUBrushRenderer'), () => ({
  GPUBrushRenderer: vi.fn(
    class MockGPUBrushRenderer {
      constructor() {
        return mockRenderer
      }
    }
  )
}))

let mockStore: ReturnType<typeof useMaskEditorStore>

import { resetDirtyRect } from './brushDrawingUtils'
import { useGPUResources } from './useGPUResources'
import { useCanvasHistory } from './useCanvasHistory'

let scope: EffectScope | null = null

function setup() {
  scope = effectScope()
  return scope.run(() => useGPUResources())!
}

async function initializeGPU() {
  vi.stubGlobal('GPUTextureUsage', {
    COPY_DST: 2,
    COPY_SRC: 1,
    RENDER_ATTACHMENT: 16,
    STORAGE_BINDING: 8,
    TEXTURE_BINDING: 4
  })
  vi.stubGlobal('GPUBufferUsage', {
    COPY_DST: 8,
    COPY_SRC: 4,
    STORAGE: 128,
    MAP_READ: 1
  })
  vi.stubGlobal('ImageBitmap', class {})
  vi.stubGlobal('navigator', {
    gpu: { getPreferredCanvasFormat: () => 'rgba8unorm' }
  })
  const context = fromPartial<CanvasRenderingContext2D>({
    getImageData: vi.fn(
      (_x: number, _y: number, width: number, height: number) =>
        fromPartial<ImageData>({
          width,
          height,
          data: new Uint8ClampedArray(width * height * 4).fill(255)
        })
    ),
    putImageData: vi.fn()
  })
  const gpuDevice = {
    createTexture: vi.fn(({ size }: GPUTextureDescriptor) => {
      const [width, height] =
        'width' in size ? [size.width, size.height ?? 1] : [...size]
      return fromPartial<GPUTexture>({ width, height, destroy: vi.fn() })
    }),
    createBuffer: vi.fn(() => fromPartial<GPUBuffer>({ destroy: vi.fn() })),
    queue: { writeTexture: vi.fn<GPUQueue['writeTexture']>() }
  }
  mockStore.tgpuRoot = fromPartial<NonNullable<typeof mockStore.tgpuRoot>>({
    device: gpuDevice
  })
  mockStore.maskCanvas = fromPartial<HTMLCanvasElement>({
    width: 4,
    height: 3,
    getContext: vi.fn(() => context)
  })
  mockStore.rgbCanvas = fromPartial<HTMLCanvasElement>({
    width: 4,
    height: 3,
    getContext: vi.fn(() => context)
  })
  mockStore.imgCanvas = fromPartial<HTMLCanvasElement>({
    width: 4,
    height: 3,
    getContext: vi.fn(() => context)
  })
  mockStore.maskCtx = context
  mockStore.rgbCtx = context
  mockStore.imgCtx = context
  mockStore.canvasHistory = reactive(useCanvasHistory(mockStore, 2))
  const resources = setup()
  await resources.initGPUResources()
  return { resources, gpuDevice }
}

beforeEach(() => {
  mockStore = useMaskEditorStore()
  mockStore.tgpuRoot = null
  mockStore.maskCanvas = null
  mockStore.rgbCanvas = null
  mockStore.maskCtx = null
  mockStore.rgbCtx = null
  mockStore.clearTrigger = 0
  mockStore.canvasHistory.revision = 0
  mockStore.gpuTexturesNeedRecreation = false
})

afterEach(() => {
  scope?.stop()
  scope = null
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

  it.for([
    { saving: false, uploads: 2 },
    { saving: true, uploads: 0 }
  ])(
    'uploads $uploads layers for a full-history save when saving=$saving',
    async ({ saving, uploads }) => {
      const { resources, gpuDevice } = await initializeGPU()
      mockStore.canvasHistory.saveInitialState()
      mockStore.canvasHistory.saveState()
      await nextTick()
      expect(mockStore.canvasHistory.currentStateIndex).toBe(1)
      gpuDevice.queue.writeTexture.mockClear()
      gpuDevice.createTexture.mockClear()
      resources.isSavingHistory.value = saving

      mockStore.canvasHistory.saveState()
      await nextTick()

      expect(mockStore.canvasHistory.currentStateIndex).toBe(1)
      expect(gpuDevice.queue.writeTexture).toHaveBeenCalledTimes(uploads)
      expect(gpuDevice.createTexture).not.toHaveBeenCalled()
    }
  )

  it('keeps uploaded texture dimensions aligned with rotation, undo, and redo', async () => {
    const { gpuDevice } = await initializeGPU()
    mockStore.canvasHistory.saveInitialState()
    await nextTick()
    mockStore.maskCanvas!.width = 3
    mockStore.maskCanvas!.height = 4
    mockStore.rgbCanvas!.width = 3
    mockStore.rgbCanvas!.height = 4
    mockStore.imgCanvas!.width = 3
    mockStore.imgCanvas!.height = 4
    gpuDevice.queue.writeTexture.mockClear()

    mockStore.canvasHistory.saveState()
    await nextTick()

    expect(
      gpuDevice.queue.writeTexture.mock.calls.map(([target, , , extent]) => [
        target.texture.width,
        target.texture.height,
        extent
      ])
    ).toEqual([
      [3, 4, { width: 3, height: 4 }],
      [3, 4, { width: 3, height: 4 }]
    ])
    gpuDevice.queue.writeTexture.mockClear()

    mockStore.canvasHistory.undo()
    await nextTick()

    expect(
      gpuDevice.queue.writeTexture.mock.calls.map(([target, , , extent]) => [
        target.texture.width,
        target.texture.height,
        extent
      ])
    ).toEqual([
      [4, 3, { width: 4, height: 3 }],
      [4, 3, { width: 4, height: 3 }]
    ])
    gpuDevice.queue.writeTexture.mockClear()

    mockStore.canvasHistory.redo()
    await nextTick()

    expect(
      gpuDevice.queue.writeTexture.mock.calls.map(([target, , , extent]) => [
        target.texture.width,
        target.texture.height,
        extent
      ])
    ).toEqual([
      [3, 4, { width: 3, height: 4 }],
      [3, 4, { width: 3, height: 4 }]
    ])
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
    mockStore.tgpuRoot = fromPartial<NonNullable<typeof mockStore.tgpuRoot>>({
      device: {}
    })
    await initGPUResources()
    expect(hasRenderer.value).toBe(false)
  })
})

describe('initPreviewCanvas', () => {
  it('returns early when device is not initialised', () => {
    const { initPreviewCanvas } = setup()
    const canvas = document.createElement('canvas')
    expect(() => initPreviewCanvas(canvas)).not.toThrow()
  })
})

describe('gpuRender', () => {
  it('uses full coverage for GPU stroke paths', async () => {
    const { resources } = await initializeGPU()
    resources.gpuRender([{ x: 2, y: 2 }])

    expect(mockRenderer.renderStrokeToAccumulator).toHaveBeenCalledWith(
      expect.any(Array),
      expect.objectContaining({ coverage: 1 })
    )
  })
})
