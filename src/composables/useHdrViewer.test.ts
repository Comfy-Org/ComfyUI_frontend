import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp, defineComponent, nextTick } from 'vue'
import type { App } from 'vue'

const mockStats = {
  min: 0,
  max: 4,
  mean: 1,
  stdDev: 0.5,
  nanCount: 0,
  infCount: 0
}
const mockHistograms = {
  r: new Uint32Array([1]),
  g: new Uint32Array([2]),
  b: new Uint32Array([3]),
  a: new Uint32Array([4]),
  luminance: new Uint32Array([5])
}

interface MockTexture {
  type: string
  image: {
    width: number
    height: number
    data: ArrayLike<number>
  }
  colorSpace?: string
  minFilter?: string
  magFilter?: string
  needsUpdate?: boolean
  dispose: ReturnType<typeof vi.fn>
}

const mocks = vi.hoisted(() => ({
  exrLoad: vi.fn(),
  exrSetDataType: vi.fn(),
  rgbeLoad: vi.fn(),
  render: vi.fn(),
  setPixelRatio: vi.fn(),
  setClearColor: vi.fn(),
  setSize: vi.fn(),
  updateProjectionMatrix: vi.fn(),
  positionSet: vi.fn(),
  scaleSet: vi.fn(),
  sceneAdd: vi.fn(),
  materialDispose: vi.fn(),
  geometryDispose: vi.fn(),
  viewportObserveResize: vi.fn(),
  viewportDisposeRenderer: vi.fn(),
  textureDispose: vi.fn(),
  raycasterSetFromCamera: vi.fn(),
  intersectObject: vi.fn(),
  fromHalfFloat: vi.fn((value: number) => value + 0.5),
  matrixSet: vi.fn(),
  detectGamutFromChromaticities: vi.fn(() => 'Display P3'),
  gamutToSrgbMatrix: vi.fn(() => [1, 0, 0, 0, 1, 0, 0, 0, 1]),
  computeImageStats: vi.fn(() => mockStats),
  computeChannelHistograms: vi.fn(() => mockHistograms),
  lastCanvas: undefined as HTMLCanvasElement | undefined
}))

vi.mock('three', () => {
  class WebGLRenderer {
    domElement: HTMLCanvasElement
    outputColorSpace?: string

    constructor() {
      const canvas = document.createElement('canvas')
      canvas.getBoundingClientRect = () =>
        ({
          left: 0,
          top: 0,
          width: 100,
          height: 100,
          right: 100,
          bottom: 100,
          x: 0,
          y: 0,
          toJSON: () => ({})
        }) satisfies DOMRect
      this.domElement = canvas
      mocks.lastCanvas = canvas
    }

    setPixelRatio(value: number) {
      mocks.setPixelRatio(value)
    }

    setClearColor(color: number, alpha: number) {
      mocks.setClearColor(color, alpha)
    }

    setSize(width: number, height: number, updateStyle: boolean) {
      mocks.setSize(width, height, updateStyle)
    }

    render(scene: unknown, camera: unknown) {
      mocks.render(scene, camera)
    }
  }

  class Scene {
    add(mesh: unknown) {
      mocks.sceneAdd(mesh)
    }
  }

  class OrthographicCamera {
    left = -1
    right = 1
    top = 1
    bottom = -1
    zoom = 1
    position = {
      x: 0,
      y: 0,
      z: 1,
      set: (x: number, y: number, z: number) => {
        this.position.x = x
        this.position.y = y
        this.position.z = z
        mocks.positionSet(x, y, z)
      }
    }

    updateProjectionMatrix() {
      mocks.updateProjectionMatrix()
    }
  }

  class Matrix3 {
    set(...values: number[]) {
      mocks.matrixSet(values)
    }
  }

  class ShaderMaterial {
    uniforms: Record<string, { value: unknown }>

    constructor(options: { uniforms: Record<string, { value: unknown }> }) {
      this.uniforms = options.uniforms
    }

    dispose() {
      mocks.materialDispose()
    }
  }

  class Mesh {
    scale = { set: mocks.scaleSet }
    geometry = { dispose: mocks.geometryDispose }

    constructor(
      readonly geometryInput: unknown,
      readonly materialInput: unknown
    ) {}
  }

  class PlaneGeometry {
    constructor(
      readonly width: number,
      readonly height: number
    ) {}
  }

  class Raycaster {
    setFromCamera(pointer: unknown, camera: unknown) {
      mocks.raycasterSetFromCamera(pointer, camera)
    }

    intersectObject(mesh: unknown) {
      return mocks.intersectObject(mesh)
    }
  }

  class Vector2 {
    constructor(
      public x = 0,
      public y = 0
    ) {}
  }

  return {
    WebGLRenderer,
    Scene,
    OrthographicCamera,
    Matrix3,
    ShaderMaterial,
    Mesh,
    PlaneGeometry,
    Raycaster,
    Vector2,
    DataUtils: { fromHalfFloat: mocks.fromHalfFloat },
    MathUtils: {
      clamp: (value: number, min: number, max: number) =>
        Math.min(max, Math.max(min, value))
    },
    FloatType: 'FloatType',
    HalfFloatType: 'HalfFloatType',
    LinearSRGBColorSpace: 'LinearSRGBColorSpace',
    LinearFilter: 'LinearFilter',
    GLSL3: 'GLSL3'
  }
})

vi.mock('three/examples/jsm/loaders/EXRLoader', () => ({
  EXRLoader: class {
    setDataType(type: string) {
      mocks.exrSetDataType(type)
    }

    load(
      url: string,
      onLoad: (texture: MockTexture, textureData?: unknown) => void,
      onProgress: unknown,
      onError: (error: unknown) => void
    ) {
      mocks.exrLoad(url, onLoad, onProgress, onError)
    }
  }
}))

vi.mock('three/examples/jsm/loaders/RGBELoader', () => ({
  RGBELoader: class {
    load(
      url: string,
      onLoad: (texture: MockTexture, textureData?: unknown) => void,
      onProgress: unknown,
      onError: (error: unknown) => void
    ) {
      mocks.rgbeLoad(url, onLoad, onProgress, onError)
    }
  }
}))

vi.mock('@/renderer/three/WebGLViewport', () => ({
  WebGLViewport: class {
    constructor(readonly renderer: unknown) {}

    observeResize(container: HTMLElement, resize: () => void) {
      mocks.viewportObserveResize(container, resize)
    }

    disposeRenderer() {
      mocks.viewportDisposeRenderer()
    }
  }
}))

vi.mock('@/renderer/hdr/colorGamut', () => ({
  detectGamutFromChromaticities: mocks.detectGamutFromChromaticities,
  gamutToSrgbMatrix: mocks.gamutToSrgbMatrix
}))

vi.mock('@/renderer/hdr/hdrStats', () => ({
  computeImageStats: mocks.computeImageStats,
  computeChannelHistograms: mocks.computeChannelHistograms
}))

import { CHANNEL_MODES, useHdrViewer } from './useHdrViewer'

type HdrViewer = ReturnType<typeof useHdrViewer>

let mountedApps: App[] = []

function createViewer(): HdrViewer {
  let viewer: HdrViewer | undefined
  const app = createApp(
    defineComponent({
      setup() {
        viewer = useHdrViewer()
        return () => null
      }
    })
  )
  app.mount(document.createElement('div'))
  mountedApps.push(app)
  if (!viewer) throw new Error('Expected useHdrViewer to initialize')
  return viewer
}

function makeTexture(
  data: ArrayLike<number> = [0, 0.25, 0.5, 1, 1, 2, 3, 4],
  width = 2,
  height = 1,
  type = 'FloatType'
): MockTexture {
  return {
    type,
    image: { width, height, data },
    dispose: mocks.textureDispose
  }
}

function makeContainer(): HTMLElement {
  const container = document.createElement('div')
  Object.defineProperty(container, 'clientWidth', { value: 200 })
  Object.defineProperty(container, 'clientHeight', { value: 100 })
  return container
}

describe('useHdrViewer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0)
      return 1
    })
    mocks.lastCanvas = undefined
    mocks.exrLoad.mockImplementation(
      (
        _url: string,
        onLoad: (texture: MockTexture, textureData?: unknown) => void
      ) => onLoad(makeTexture())
    )
    mocks.rgbeLoad.mockImplementation(
      (
        _url: string,
        onLoad: (texture: MockTexture, textureData?: unknown) => void
      ) => onLoad(makeTexture(), { header: { chromaticities: {} } })
    )
    mocks.intersectObject.mockReturnValue([])
  })

  afterEach(() => {
    for (const app of mountedApps) app.unmount()
    mountedApps = []
    vi.unstubAllGlobals()
  })

  it('exposes all channel modes', () => {
    expect(CHANNEL_MODES).toEqual(['rgb', 'r', 'g', 'b', 'a', 'luminance'])
  })

  it('mounts hdr textures through the RGBE loader and exposes image metadata', async () => {
    const viewer = createViewer()
    const container = makeContainer()

    await viewer.mount(container, '/api/view?filename=scene.hdr')

    expect(mocks.rgbeLoad).toHaveBeenCalledWith(
      '/api/view?filename=scene.hdr',
      expect.any(Function),
      undefined,
      expect.any(Function)
    )
    expect(mocks.exrSetDataType).not.toHaveBeenCalled()
    expect(viewer.loading.value).toBe(false)
    expect(viewer.error.value).toBeNull()
    expect(viewer.gamut.value).toBe('Display P3')
    expect(viewer.dimensions.value).toBe('2 x 1')
    expect(viewer.stats.value).toEqual(mockStats)
    expect(viewer.histogram.value).toBe(mockHistograms.luminance)
    viewer.channel.value = 'g'
    await nextTick()
    expect(viewer.histogram.value).toBe(mockHistograms.g)
    expect(container.contains(mocks.lastCanvas!)).toBe(true)
  })

  it('selects histograms for every channel mode', async () => {
    const viewer = createViewer()

    await viewer.mount(makeContainer(), '/api/view?filename=scene.hdr')

    for (const [mode, histogram] of [
      ['r', mockHistograms.r],
      ['g', mockHistograms.g],
      ['b', mockHistograms.b],
      ['a', mockHistograms.a],
      ['rgb', mockHistograms.luminance],
      ['luminance', mockHistograms.luminance]
    ] as const) {
      viewer.channel.value = mode
      await nextTick()
      expect(viewer.histogram.value).toBe(histogram)
    }
  })

  it('loads exr textures with float data and reads hovered pixels', async () => {
    const data = [0, 1, 2, 3, 4, 5, 6, 7]
    mocks.exrLoad.mockImplementation(
      (
        _url: string,
        onLoad: (texture: MockTexture, textureData?: unknown) => void
      ) => onLoad(makeTexture(data, 2, 1, 'HalfFloatType'))
    )
    mocks.intersectObject.mockReturnValue([{ uv: { x: 0.75, y: 0.25 } }])
    const viewer = createViewer()

    await viewer.mount(makeContainer(), '/api/view?filename=scene.exr')
    mocks.lastCanvas!.dispatchEvent(
      new PointerEvent('pointermove', { clientX: 75, clientY: 75 })
    )

    expect(mocks.exrSetDataType).toHaveBeenCalledWith('FloatType')
    expect(mocks.fromHalfFloat).toHaveBeenCalled()
    expect(viewer.pixel.value).toEqual({
      x: 1,
      y: 0,
      r: 4.5,
      g: 5.5,
      b: 6.5,
      a: 7.5
    })
  })

  it('reads three-channel pixels without alpha', async () => {
    mocks.exrLoad.mockImplementation(
      (
        _url: string,
        onLoad: (texture: MockTexture, textureData?: unknown) => void
      ) => onLoad(makeTexture([0, 1, 2, 3, 4, 5], 2, 1))
    )
    mocks.intersectObject.mockReturnValue([{ uv: { x: 0.75, y: 0.25 } }])
    const viewer = createViewer()

    await viewer.mount(makeContainer(), '/api/view?filename=scene.exr')
    mocks.lastCanvas!.dispatchEvent(
      new PointerEvent('pointermove', { clientX: 75, clientY: 75 })
    )

    expect(viewer.pixel.value).toEqual({
      x: 1,
      y: 0,
      r: 3,
      g: 4,
      b: 5,
      a: null
    })
  })

  it('clears the hovered pixel when the pointer leaves or misses the mesh', async () => {
    mocks.intersectObject.mockReturnValueOnce([{ uv: { x: 0, y: 0 } }])
    const viewer = createViewer()

    await viewer.mount(makeContainer(), '/api/view?filename=scene.exr')
    mocks.lastCanvas!.dispatchEvent(new PointerEvent('pointermove'))
    expect(viewer.pixel.value).not.toBeNull()

    mocks.lastCanvas!.dispatchEvent(new PointerEvent('pointerleave'))
    expect(viewer.pixel.value).toBeNull()

    mocks.lastCanvas!.dispatchEvent(new PointerEvent('pointermove'))
    expect(viewer.pixel.value).toBeNull()
  })

  it('normalizes exposure and disposes renderer resources', async () => {
    const viewer = createViewer()

    await viewer.mount(makeContainer(), '/api/view?filename=scene.exr')
    viewer.normalizeExposure()
    viewer.dispose()

    expect(viewer.exposureStops.value).toBe(-2)
    expect(mocks.viewportDisposeRenderer).toHaveBeenCalled()
    expect(mocks.textureDispose).toHaveBeenCalled()
    expect(mocks.materialDispose).toHaveBeenCalled()
    expect(mocks.geometryDispose).toHaveBeenCalled()
  })

  it('handles no-op viewer actions before mounting', () => {
    const viewer = createViewer()

    viewer.fitView()
    viewer.normalizeExposure()
    viewer.dispose()

    expect(viewer.exposureStops.value).toBe(0)
    expect(mocks.viewportDisposeRenderer).not.toHaveBeenCalled()
  })

  it('leaves sample-derived state empty when texture data is missing', async () => {
    const noData: unknown = undefined
    mocks.exrLoad.mockImplementation(
      (
        _url: string,
        onLoad: (texture: MockTexture, textureData?: unknown) => void
      ) =>
        onLoad({
          ...makeTexture(),
          image: {
            width: 2,
            height: 1,
            data: noData as ArrayLike<number>
          }
        })
    )
    const viewer = createViewer()

    await viewer.mount(makeContainer(), '/api/view?filename=scene.exr')
    viewer.normalizeExposure()

    expect(viewer.dimensions.value).toBe('2 x 1')
    expect(viewer.stats.value).toBeNull()
    expect(viewer.histogram.value).toBeNull()
    expect(viewer.exposureStops.value).toBe(0)
  })

  it('disposes textures that finish loading after viewer disposal', async () => {
    let resolveLoad: (
      texture: MockTexture,
      textureData?: unknown
    ) => void = () => {}
    mocks.exrLoad.mockImplementation(
      (
        _url: string,
        onLoad: (texture: MockTexture, textureData?: unknown) => void
      ) => {
        resolveLoad = onLoad
      }
    )
    const viewer = createViewer()
    const mounting = viewer.mount(
      makeContainer(),
      '/api/view?filename=scene.exr'
    )

    viewer.dispose()
    resolveLoad(makeTexture())
    await mounting

    expect(mocks.textureDispose).toHaveBeenCalled()
  })

  it('reports loader errors and clears loading state', async () => {
    mocks.exrLoad.mockImplementation(
      (
        _url: string,
        _onLoad: (texture: MockTexture, textureData?: unknown) => void,
        _onProgress: unknown,
        onError: (error: unknown) => void
      ) => onError(new Error('load failed'))
    )
    const viewer = createViewer()

    await viewer.mount(makeContainer(), '/api/view?filename=broken.exr')

    expect(viewer.error.value).toBe('load failed')
    expect(viewer.loading.value).toBe(false)
    expect(mocks.viewportDisposeRenderer).toHaveBeenCalled()
  })

  it('reports string loader errors', async () => {
    mocks.exrLoad.mockImplementation(
      (
        _url: string,
        _onLoad: (texture: MockTexture, textureData?: unknown) => void,
        _onProgress: unknown,
        onError: (error: unknown) => void
      ) => onError('load failed')
    )
    const viewer = createViewer()

    await viewer.mount(makeContainer(), '/api/view?filename=broken.exr')

    expect(viewer.error.value).toBe('load failed')
  })

  it('zooms with the wheel and pans while dragging', async () => {
    const viewer = createViewer()
    await viewer.mount(makeContainer(), '/api/view?filename=scene.exr')

    mocks.lastCanvas!.dispatchEvent(new WheelEvent('wheel', { deltaY: -1000 }))
    mocks.lastCanvas!.dispatchEvent(
      new PointerEvent('pointerdown', { clientX: 10, clientY: 10 })
    )
    window.dispatchEvent(
      new PointerEvent('pointermove', { clientX: 20, clientY: 30 })
    )
    window.dispatchEvent(new PointerEvent('pointerup'))

    expect(mocks.updateProjectionMatrix).toHaveBeenCalled()
    expect(mocks.render).toHaveBeenCalled()
  })

  it('ignores hover sampling while dragging', async () => {
    const viewer = createViewer()
    await viewer.mount(makeContainer(), '/api/view?filename=scene.exr')

    mocks.lastCanvas!.dispatchEvent(
      new PointerEvent('pointerdown', { clientX: 10, clientY: 10 })
    )
    mocks.raycasterSetFromCamera.mockClear()
    mocks.lastCanvas!.dispatchEvent(
      new PointerEvent('pointermove', { clientX: 20, clientY: 20 })
    )
    window.dispatchEvent(new PointerEvent('pointerup'))

    expect(mocks.raycasterSetFromCamera).not.toHaveBeenCalled()
  })
})
