import { beforeEach, describe, expect, it, vi } from 'vitest'

// Stub every manager class so buildLoad3dDeps can exercise its wiring without
// pulling in Three.js scene construction or WebGL. The stubs capture their
// constructor args so the test can assert on how callbacks are wired.

type RecordArgs = (...args: unknown[]) => void
const managerConstructors: Record<
  string,
  ReturnType<typeof vi.fn<RecordArgs>>
> = {
  EventManager: vi.fn<RecordArgs>(),
  SceneManager: vi.fn<RecordArgs>(),
  CameraManager: vi.fn<RecordArgs>(),
  ControlsManager: vi.fn<RecordArgs>(),
  LightingManager: vi.fn<RecordArgs>(),
  HDRIManager: vi.fn<RecordArgs>(),
  ViewHelperManager: vi.fn<RecordArgs>(),
  SceneModelManager: vi.fn<RecordArgs>(),
  LoaderManager: vi.fn<RecordArgs>(),
  RecordingManager: vi.fn<RecordArgs>(),
  AnimationManager: vi.fn<RecordArgs>(),
  GizmoManager: vi.fn<RecordArgs>()
}

vi.mock('./EventManager', () => ({
  EventManager: class {
    constructor(...args: unknown[]) {
      managerConstructors.EventManager(...args)
    }
    emitEvent = vi.fn()
  }
}))

vi.mock('./SceneManager', () => ({
  SceneManager: class {
    scene = { name: 'scene' }
    constructor(...args: unknown[]) {
      managerConstructors.SceneManager(...args)
    }
  }
}))

vi.mock('./CameraManager', () => ({
  CameraManager: class {
    activeCamera = { name: 'active-camera' }
    constructor(...args: unknown[]) {
      managerConstructors.CameraManager(...args)
    }
    setControls = vi.fn()
    setupForModel = vi.fn()
  }
}))

vi.mock('./ControlsManager', () => ({
  ControlsManager: class {
    controls = { name: 'controls' }
    constructor(...args: unknown[]) {
      managerConstructors.ControlsManager(...args)
    }
  }
}))

vi.mock('./LightingManager', () => ({
  LightingManager: class {
    constructor(...args: unknown[]) {
      managerConstructors.LightingManager(...args)
    }
  }
}))

vi.mock('./HDRIManager', () => ({
  HDRIManager: class {
    constructor(...args: unknown[]) {
      managerConstructors.HDRIManager(...args)
    }
  }
}))

vi.mock('./ViewHelperManager', () => ({
  ViewHelperManager: class {
    constructor(...args: unknown[]) {
      managerConstructors.ViewHelperManager(...args)
    }
  }
}))

let capturedGetCurrentCapabilities: (() => { fitToViewer: boolean }) | undefined

vi.mock('./SceneModelManager', () => ({
  SceneModelManager: class {
    constructor(...args: unknown[]) {
      managerConstructors.SceneModelManager(...args)
      capturedGetCurrentCapabilities =
        args[6] as typeof capturedGetCurrentCapabilities
    }
    setupForModel = vi.fn()
  }
}))

let capturedLoaderAdapter: { capabilities: unknown } | null = null
vi.mock('./LoaderManager', () => ({
  LoaderManager: class {
    constructor(...args: unknown[]) {
      managerConstructors.LoaderManager(...args)
    }
    getCurrentAdapter = () => capturedLoaderAdapter
  }
}))

vi.mock('./RecordingManager', () => ({
  RecordingManager: class {
    constructor(...args: unknown[]) {
      managerConstructors.RecordingManager(...args)
    }
  }
}))

vi.mock('./AnimationManager', () => ({
  AnimationManager: class {
    constructor(...args: unknown[]) {
      managerConstructors.AnimationManager(...args)
    }
  }
}))

let capturedGizmoTransformCallback: (() => void) | undefined
vi.mock('./GizmoManager', () => ({
  GizmoManager: class {
    constructor(...args: unknown[]) {
      managerConstructors.GizmoManager(...args)
      capturedGizmoTransformCallback =
        args[4] as typeof capturedGizmoTransformCallback
    }
    getTransform = vi.fn(() => ({
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 }
    }))
    isEnabled = vi.fn(() => false)
    getMode = vi.fn(() => 'translate')
    setupForModel = vi.fn()
  }
}))

vi.mock('three', () => ({
  WebGLRenderer: class {
    domElement = Object.assign(document.createElement('canvas'), {
      classList: { add: vi.fn() }
    })
    setSize = vi.fn()
    setClearColor = vi.fn()
    autoClear = false
    outputColorSpace = ''
  },
  SRGBColorSpace: 'srgb'
}))

// Load3d itself is tested separately; stub its constructor to capture the
// deps argument.
const load3dCtor = vi.fn()
vi.mock('./Load3d', () => ({
  default: class {
    constructor(
      container: Element | HTMLElement,
      deps: Record<string, unknown>,
      options?: Record<string, unknown>
    ) {
      load3dCtor(container, deps, options)
    }
  }
}))

import { buildLoad3dDeps, createLoad3d } from './createLoad3d'
import { DEFAULT_MODEL_CAPABILITIES } from './ModelAdapter'

function makeContainer(): HTMLElement {
  return document.createElement('div')
}

describe('buildLoad3dDeps', () => {
  beforeEach(() => {
    for (const fn of Object.values(managerConstructors)) fn.mockClear()
    capturedGetCurrentCapabilities = undefined
    capturedGizmoTransformCallback = undefined
    capturedLoaderAdapter = null
    load3dCtor.mockClear()
  })

  it('wires every manager in the graph', () => {
    const deps = buildLoad3dDeps(makeContainer())

    expect(deps.renderer).toBeDefined()
    expect(deps.eventManager).toBeDefined()
    expect(deps.sceneManager).toBeDefined()
    expect(deps.cameraManager).toBeDefined()
    expect(deps.controlsManager).toBeDefined()
    expect(deps.lightingManager).toBeDefined()
    expect(deps.hdriManager).toBeDefined()
    expect(deps.viewHelperManager).toBeDefined()
    expect(deps.modelManager).toBeDefined()
    expect(deps.loaderManager).toBeDefined()
    expect(deps.recordingManager).toBeDefined()
    expect(deps.animationManager).toBeDefined()
    expect(deps.gizmoManager).toBeDefined()

    // Each manager constructor is invoked exactly once.
    for (const [name, ctor] of Object.entries(managerConstructors)) {
      expect(ctor, `${name} ctor`).toHaveBeenCalledTimes(1)
    }
  })

  it('appends the renderer canvas to the container', () => {
    const container = makeContainer()
    buildLoad3dDeps(container)
    expect(container.querySelector('canvas')).not.toBeNull()
  })

  it('returns the default capabilities when no model has loaded yet', () => {
    buildLoad3dDeps(makeContainer())
    expect(capturedGetCurrentCapabilities).toBeDefined()
    expect(capturedGetCurrentCapabilities?.()).toEqual(
      DEFAULT_MODEL_CAPABILITIES
    )
  })

  it('proxies the current adapter capabilities after a model loads', () => {
    buildLoad3dDeps(makeContainer())
    const customCapabilities = {
      fitToViewer: false,
      requiresMaterialRebuild: false,
      gizmoTransform: false,
      lighting: false,
      exportable: false,
      materialModes: []
    }
    capturedLoaderAdapter = { capabilities: customCapabilities }
    expect(capturedGetCurrentCapabilities?.()).toEqual(customCapabilities)
  })

  it('emits a gizmoTransformChange event carrying the current gizmo state', () => {
    const deps = buildLoad3dDeps(makeContainer())
    const emit = vi.mocked(
      (deps.eventManager as { emitEvent: unknown }).emitEvent as never
    )

    capturedGizmoTransformCallback?.()

    expect(emit).toHaveBeenCalledWith(
      'gizmoTransformChange',
      expect.objectContaining({
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 },
        enabled: false,
        mode: 'translate'
      })
    )
  })
})

describe('createLoad3d', () => {
  beforeEach(() => {
    for (const fn of Object.values(managerConstructors)) fn.mockClear()
    load3dCtor.mockClear()
  })

  it('builds deps and forwards them to the Load3d constructor', () => {
    const container = makeContainer()
    const options = { width: 512, height: 512 }

    createLoad3d(container, options)

    expect(load3dCtor).toHaveBeenCalledTimes(1)
    const [passedContainer, passedDeps, passedOptions] =
      load3dCtor.mock.calls[0]
    expect(passedContainer).toBe(container)
    expect(passedOptions).toBe(options)
    expect(passedDeps).toMatchObject({
      renderer: expect.any(Object),
      sceneManager: expect.any(Object),
      cameraManager: expect.any(Object),
      gizmoManager: expect.any(Object)
    })
  })

  it('works without options', () => {
    createLoad3d(makeContainer())
    expect(load3dCtor).toHaveBeenCalledTimes(1)
    expect(load3dCtor.mock.calls[0][2]).toBeUndefined()
  })
})
