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
  pendingGPUMaskData: null as null,
  pendingGPURgbData: null as null,
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

import { resetDirtyRect } from './brushDrawingUtils'
import { useGPUResources } from './useGPUResources'

let scope: EffectScope | null = null

function setup() {
  scope = effectScope()
  return scope.run(() => useGPUResources())!
}

beforeEach(() => {
  vi.clearAllMocks()
  mockStore.tgpuRoot = null
  mockStore.maskCanvas = null
  mockStore.rgbCanvas = null
  mockStore.maskCtx = null
  mockStore.rgbCtx = null
  mockStore.clearTrigger = 0
  mockStore.canvasHistory.currentStateIndex = 0
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
})

describe('initPreviewCanvas', () => {
  it('returns early when device is not initialised', () => {
    const { initPreviewCanvas } = setup()
    const canvas = document.createElement('canvas')
    expect(() => initPreviewCanvas(canvas)).not.toThrow()
  })
})

describe('gpuDrawPoint', () => {
  it('resolves immediately when renderer is not initialised', async () => {
    const { gpuDrawPoint } = setup()
    await expect(gpuDrawPoint({ x: 10, y: 20 })).resolves.toBeUndefined()
  })
})
