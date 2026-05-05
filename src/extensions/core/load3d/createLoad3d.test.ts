import { describe, expect, it, vi } from 'vitest'

import { DEFAULT_MODEL_CAPABILITIES } from './ModelAdapter'
import type { ModelAdapter, ModelAdapterCapabilities } from './ModelAdapter'
import { createLoad3d } from './createLoad3d'

const { rendererCtor } = vi.hoisted(() => ({
  rendererCtor: vi.fn()
}))

vi.mock('three', async () => {
  const actual = await vi.importActual<typeof import('three')>('three')
  return {
    ...actual,
    WebGLRenderer: class {
      domElement = document.createElement('canvas')
      autoClear = false
      outputColorSpace = ''
      constructor(opts: unknown) {
        rendererCtor(opts)
      }
      setSize() {}
      setClearColor() {}
    }
  }
})

vi.mock('./SceneManager', () => ({
  SceneManager: class {
    scene = { __scene: true }
  }
}))

vi.mock('./CameraManager', () => ({
  CameraManager: class {
    activeCamera = { __camera: true }
    setControls = vi.fn()
    setupForModel = vi.fn()
  }
}))

vi.mock('./ControlsManager', () => ({
  ControlsManager: class {
    controls = { __controls: true }
  }
}))

vi.mock('./LightingManager', () => ({
  LightingManager: class {}
}))

vi.mock('./HDRIManager', () => ({
  HDRIManager: class {}
}))

vi.mock('./ViewHelperManager', () => ({
  ViewHelperManager: class {}
}))

vi.mock('./SceneModelManager', () => ({
  SceneModelManager: class {
    getCurrentCapabilities: () => unknown
    getBoundsFromAdapter: (model: unknown) => unknown
    disposeModelViaAdapter: (model: unknown) => unknown
    getDefaultCameraPose: () => unknown
    constructor(
      _scene: unknown,
      _renderer: unknown,
      _eventManager: unknown,
      _getActiveCamera: unknown,
      _setupCamera: unknown,
      _setupGizmo: unknown,
      getCurrentCapabilities: () => unknown,
      getBoundsFromAdapter: (model: unknown) => unknown,
      disposeModelViaAdapter: (model: unknown) => unknown,
      getDefaultCameraPose: () => unknown
    ) {
      this.getCurrentCapabilities = getCurrentCapabilities
      this.getBoundsFromAdapter = getBoundsFromAdapter
      this.disposeModelViaAdapter = disposeModelViaAdapter
      this.getDefaultCameraPose = getDefaultCameraPose
    }
  }
}))

vi.mock('./LoaderManager', () => ({
  LoaderManager: class {
    adapterRefArg: unknown
    constructor(
      _modelManager: unknown,
      _eventManager: unknown,
      _adapters: unknown,
      adapterRef: unknown
    ) {
      this.adapterRefArg = adapterRef
    }
  }
}))

vi.mock('./RecordingManager', () => ({
  RecordingManager: class {}
}))

vi.mock('./AnimationManager', () => ({
  AnimationManager: class {}
}))

vi.mock('./GizmoManager', () => ({
  GizmoManager: class {
    setupForModel = vi.fn()
    getTransform = vi.fn(() => ({}))
    isEnabled = vi.fn(() => false)
    getMode = vi.fn(() => 'translate')
  }
}))

vi.mock('./Load3d', () => ({
  default: class {
    deps: unknown
    options: unknown
    constructor(_container: unknown, deps: unknown, options: unknown) {
      this.deps = deps
      this.options = options
    }
  }
}))

type FakeLoaderManager = { adapterRefArg: { current: ModelAdapter | null } }
type FakeSceneModelManager = {
  getCurrentCapabilities: () => unknown
  getBoundsFromAdapter: (model: unknown) => unknown
  disposeModelViaAdapter: (model: unknown) => void
  getDefaultCameraPose: () => unknown
}
type FakeLoad3d = {
  deps: {
    adapterRef: { current: ModelAdapter | null }
    loaderManager: FakeLoaderManager
    modelManager: FakeSceneModelManager
  }
  options: unknown
}

function createContainer(): HTMLElement {
  const container = document.createElement('div')
  // Stub appendChild — we only care that one was called, not what was attached.
  container.appendChild = vi.fn().mockReturnValue(container)
  return container
}

function makeAdapter(overrides: Partial<ModelAdapter> = {}): ModelAdapter {
  return {
    kind: 'mesh',
    extensions: [],
    capabilities: DEFAULT_MODEL_CAPABILITIES,
    load: vi.fn().mockResolvedValue(null),
    ...overrides
  } satisfies ModelAdapter
}

describe('createLoad3d', () => {
  it('constructs the renderer with alpha + antialias and appends it to the container', () => {
    rendererCtor.mockClear()
    const container = createContainer()

    createLoad3d(container)

    expect(rendererCtor).toHaveBeenCalledWith({ alpha: true, antialias: true })
    expect(container.appendChild).toHaveBeenCalledOnce()
  })

  it('forwards Load3DOptions to the Load3d constructor', () => {
    const container = createContainer()
    const options = { width: 640, height: 480, isViewerMode: true }

    const instance = createLoad3d(container, options) as unknown as FakeLoad3d

    expect(instance.options).toEqual(options)
  })

  it('shares one AdapterRef between LoaderManager and SceneModelManager lambdas', () => {
    const container = createContainer()
    const instance = createLoad3d(container) as unknown as FakeLoad3d

    const adapterRef = instance.deps.adapterRef
    expect(adapterRef.current).toBeNull()

    const loaderRef = instance.deps.loaderManager.adapterRefArg
    expect(loaderRef).toBe(adapterRef)
  })

  describe('SceneModelManager capability lambdas (default — no adapter loaded)', () => {
    it('getCurrentCapabilities falls back to DEFAULT_MODEL_CAPABILITIES', () => {
      const instance = createLoad3d(createContainer()) as unknown as FakeLoad3d

      expect(instance.deps.modelManager.getCurrentCapabilities()).toEqual(
        DEFAULT_MODEL_CAPABILITIES
      )
    })

    it('getBoundsFromAdapter returns null', () => {
      const instance = createLoad3d(createContainer()) as unknown as FakeLoad3d
      expect(
        instance.deps.modelManager.getBoundsFromAdapter({} as never)
      ).toBeNull()
    })

    it('disposeModelViaAdapter is a no-op', () => {
      const instance = createLoad3d(createContainer()) as unknown as FakeLoad3d
      expect(() =>
        instance.deps.modelManager.disposeModelViaAdapter({} as never)
      ).not.toThrow()
    })

    it('getDefaultCameraPose returns null', () => {
      const instance = createLoad3d(createContainer()) as unknown as FakeLoad3d
      expect(instance.deps.modelManager.getDefaultCameraPose()).toBeNull()
    })
  })

  describe('SceneModelManager capability lambdas (after adapter is published)', () => {
    function withAdapter(adapter: ModelAdapter) {
      const instance = createLoad3d(createContainer()) as unknown as FakeLoad3d
      instance.deps.adapterRef.current = adapter
      return instance
    }

    it('getCurrentCapabilities reads the published adapter capabilities', () => {
      const caps: ModelAdapterCapabilities = {
        ...DEFAULT_MODEL_CAPABILITIES,
        gizmoTransform: false,
        materialModes: []
      }
      const instance = withAdapter(makeAdapter({ capabilities: caps }))

      expect(instance.deps.modelManager.getCurrentCapabilities()).toBe(caps)
    })

    it('getBoundsFromAdapter delegates to adapter.computeBounds', () => {
      const computeBounds = vi.fn().mockReturnValue('bbox-result')
      const instance = withAdapter(makeAdapter({ computeBounds }))
      const model = { fake: 'model' }

      const result = instance.deps.modelManager.getBoundsFromAdapter(
        model as never
      )

      expect(computeBounds).toHaveBeenCalledWith(model)
      expect(result).toBe('bbox-result')
    })

    it('getBoundsFromAdapter returns null when adapter has no computeBounds', () => {
      const instance = withAdapter(makeAdapter())
      expect(
        instance.deps.modelManager.getBoundsFromAdapter({} as never)
      ).toBeNull()
    })

    it('disposeModelViaAdapter delegates to adapter.disposeModel', () => {
      const disposeModel = vi.fn()
      const instance = withAdapter(makeAdapter({ disposeModel }))
      const model = { fake: 'model' }

      instance.deps.modelManager.disposeModelViaAdapter(model as never)

      expect(disposeModel).toHaveBeenCalledWith(model)
    })

    it('getDefaultCameraPose delegates to adapter.defaultCameraPose', () => {
      const pose = { size: { x: 5 }, center: { x: 0 } }
      const defaultCameraPose = vi.fn().mockReturnValue(pose)
      const instance = withAdapter(makeAdapter({ defaultCameraPose }))

      expect(instance.deps.modelManager.getDefaultCameraPose()).toBe(pose)
      expect(defaultCameraPose).toHaveBeenCalledOnce()
    })
  })
})
