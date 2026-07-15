import * as THREE from 'three'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { Load3dDeps } from '@/extensions/core/load3d/Load3d'
import Load3d from '@/extensions/core/load3d/Load3d'
import type {
  CameraState,
  GizmoMode
} from '@/extensions/core/load3d/interfaces'
import type { PointerNdcSource } from '@/extensions/core/load3d/load3dViewport'

const {
  cloneSkinnedMock,
  exportGLBMock,
  exportOBJMock,
  exportSTLMock,
  exportFBXMock,
  exportDirectMock,
  detectFormatFromURLMock
} = vi.hoisted(() => ({
  cloneSkinnedMock: vi.fn(),
  exportGLBMock: vi.fn(),
  exportOBJMock: vi.fn(),
  exportSTLMock: vi.fn(),
  exportFBXMock: vi.fn(),
  exportDirectMock: vi.fn(),
  detectFormatFromURLMock: vi.fn()
}))

vi.mock('three/examples/jsm/utils/SkeletonUtils.js', () => ({
  clone: cloneSkinnedMock
}))

vi.mock('@/extensions/core/load3d/ModelExporter', () => ({
  ModelExporter: {
    exportGLB: exportGLBMock,
    exportOBJ: exportOBJMock,
    exportSTL: exportSTLMock,
    exportFBX: exportFBXMock,
    exportDirect: exportDirectMock,
    detectFormatFromURL: detectFormatFromURLMock
  }
}))

type GizmoStub = {
  setEnabled: ReturnType<typeof vi.fn>
  setMode: ReturnType<typeof vi.fn>
  reset: ReturnType<typeof vi.fn>
  applyTransform: ReturnType<typeof vi.fn>
  applyModelTransform: ReturnType<typeof vi.fn>
  getTransform: ReturnType<typeof vi.fn>
  setupForModel: ReturnType<typeof vi.fn>
  updateCamera: ReturnType<typeof vi.fn>
  detach: ReturnType<typeof vi.fn>
  dispose: ReturnType<typeof vi.fn>
  removeFromScene: ReturnType<typeof vi.fn>
  ensureHelperInScene: ReturnType<typeof vi.fn>
  isEnabled: ReturnType<typeof vi.fn>
  getMode: ReturnType<typeof vi.fn>
}

type ModelManagerStub = {
  fitToViewer: ReturnType<typeof vi.fn>
  clearModel: ReturnType<typeof vi.fn>
}

type CameraManagerStub = {
  toggleCamera: ReturnType<typeof vi.fn>
  setupForModel: ReturnType<typeof vi.fn>
  reset: ReturnType<typeof vi.fn>
  activeCamera: THREE.Camera
}

type SceneManagerStub = {
  captureScene: ReturnType<typeof vi.fn>
  dispose: ReturnType<typeof vi.fn>
}

function makeGizmoStub(): GizmoStub {
  return {
    setEnabled: vi.fn(),
    setMode: vi.fn(),
    reset: vi.fn(),
    applyTransform: vi.fn(),
    applyModelTransform: vi.fn(),
    getTransform: vi.fn(() => ({
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 }
    })),
    setupForModel: vi.fn(),
    updateCamera: vi.fn(),
    detach: vi.fn(),
    dispose: vi.fn(),
    removeFromScene: vi.fn(),
    ensureHelperInScene: vi.fn(),
    isEnabled: vi.fn(() => false),
    getMode: vi.fn(() => 'translate')
  }
}

function makeInstance() {
  const gizmo = makeGizmoStub()
  const modelManager: ModelManagerStub = {
    fitToViewer: vi.fn(),
    clearModel: vi.fn()
  }
  const cameraManager: CameraManagerStub = {
    toggleCamera: vi.fn(),
    setupForModel: vi.fn(),
    reset: vi.fn(),
    activeCamera: new THREE.PerspectiveCamera()
  }
  const sceneManager: SceneManagerStub = {
    captureScene: vi.fn(),
    dispose: vi.fn()
  }
  const controlsManager = { updateCamera: vi.fn() }
  const viewHelperManager = { recreateViewHelper: vi.fn() }
  const animationManager = { dispose: vi.fn() }

  // Load3d's constructor instantiates THREE.WebGLRenderer, ResizeObserver
  // and ViewHelper, none of which are available in happy-dom. Skip it and
  // inject stubs directly onto the prototype instance so delegation methods
  // can be exercised in isolation.
  const eventManager = { emitEvent: vi.fn() }
  const load3d = Object.create(Load3d.prototype) as Load3d
  Object.assign(load3d, {
    gizmoManager: gizmo,
    modelManager,
    cameraManager,
    sceneManager,
    controlsManager,
    viewHelperManager,
    animationManager,
    eventManager,
    adapterRef: { current: null },
    forceRender: vi.fn(),
    handleResize: vi.fn()
  })

  return {
    load3d,
    gizmo,
    modelManager,
    cameraManager,
    sceneManager,
    controlsManager,
    viewHelperManager,
    animationManager,
    eventManager,
    forceRender: load3d.forceRender as ReturnType<typeof vi.fn>
  }
}

describe('Load3d', () => {
  let ctx: ReturnType<typeof makeInstance>

  beforeEach(() => {
    ctx = makeInstance()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('gizmo delegation', () => {
    it('getGizmoManager returns the underlying manager', () => {
      expect(ctx.load3d.getGizmoManager()).toBe(ctx.gizmo)
    })

    it('setGizmoEnabled delegates to gizmoManager.setEnabled and forces a render', () => {
      ctx.load3d.setGizmoEnabled(true)

      expect(ctx.gizmo.setEnabled).toHaveBeenCalledWith(true)
      expect(ctx.forceRender).toHaveBeenCalledOnce()
    })

    it.for(['translate', 'rotate', 'scale'] as const)(
      'setGizmoMode delegates "%s" and forces a render',
      (mode: GizmoMode) => {
        ctx.load3d.setGizmoMode(mode)

        expect(ctx.gizmo.setMode).toHaveBeenCalledWith(mode)
        expect(ctx.forceRender).toHaveBeenCalledOnce()
      }
    )

    it('resetGizmoTransform delegates to gizmoManager.reset and forces a render', () => {
      ctx.load3d.resetGizmoTransform()

      expect(ctx.gizmo.reset).toHaveBeenCalledOnce()
      expect(ctx.forceRender).toHaveBeenCalledOnce()
    })

    it('applyGizmoTransform forwards position, rotation and scale', () => {
      const pos = { x: 1, y: 2, z: 3 }
      const rot = { x: 0.1, y: 0.2, z: 0.3 }
      const scale = { x: 2, y: 2, z: 2 }

      ctx.load3d.applyGizmoTransform(pos, rot, scale)

      expect(ctx.gizmo.applyTransform).toHaveBeenCalledWith(pos, rot, scale)
      expect(ctx.forceRender).toHaveBeenCalledOnce()
    })

    it('applyGizmoTransform forwards undefined scale when not provided', () => {
      const pos = { x: 0, y: 0, z: 0 }
      const rot = { x: 0, y: 0, z: 0 }

      ctx.load3d.applyGizmoTransform(pos, rot)

      expect(ctx.gizmo.applyTransform).toHaveBeenCalledWith(pos, rot, undefined)
    })

    it('applyModelTransform forwards the full position/quaternion/scale payload', () => {
      const transform = {
        position: { x: 1, y: 2, z: 3 },
        quaternion: { x: 0.1, y: 0.2, z: 0.3, w: 0.4 },
        scale: { x: 2, y: 2, z: 2 }
      }

      ctx.load3d.applyModelTransform(transform)

      expect(ctx.gizmo.applyModelTransform).toHaveBeenCalledWith(transform)
      expect(ctx.forceRender).toHaveBeenCalledOnce()
    })

    it('getGizmoTransform returns the gizmoManager transform', () => {
      const transform = {
        position: { x: 5, y: 6, z: 7 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 }
      }
      ctx.gizmo.getTransform.mockReturnValue(transform)

      expect(ctx.load3d.getGizmoTransform()).toEqual(transform)
    })

    it('fitToViewer delegates to modelManager and forces a render', () => {
      ctx.load3d.fitToViewer()

      expect(ctx.modelManager.fitToViewer).toHaveBeenCalledOnce()
      expect(ctx.forceRender).toHaveBeenCalledOnce()
    })
  })

  describe('lifecycle interactions', () => {
    it('clearModel detaches the gizmo before clearing the model', () => {
      const order: string[] = []
      ctx.animationManager.dispose.mockImplementation(() =>
        order.push('animation')
      )
      ctx.gizmo.detach.mockImplementation(() => order.push('detach'))
      ctx.modelManager.clearModel.mockImplementation(() => order.push('clear'))

      ctx.load3d.clearModel()

      expect(order).toEqual(['animation', 'detach', 'clear'])
      expect(ctx.forceRender).toHaveBeenCalledOnce()
    })

    it('clearModel nulls adapterRef.current so capability queries fall back to defaults', () => {
      Object.assign(ctx.load3d, {
        adapterRef: { current: { kind: 'splat' } }
      })
      let adapterDuringModelManagerClear:
        | { kind: string; current?: unknown }
        | null
        | undefined
      ctx.modelManager.clearModel.mockImplementation(() => {
        adapterDuringModelManagerClear = (
          ctx.load3d as unknown as { adapterRef: { current: unknown } }
        ).adapterRef.current as { kind: string } | null
      })

      ctx.load3d.clearModel()

      expect(adapterDuringModelManagerClear).toEqual({ kind: 'splat' })
      expect(
        (ctx.load3d as unknown as { adapterRef: { current: unknown } })
          .adapterRef.current
      ).toBeNull()
    })

    it('toggleCamera updates both controls and gizmo with the active camera', () => {
      ctx.load3d.toggleCamera('orthographic')

      expect(ctx.cameraManager.toggleCamera).toHaveBeenCalledWith(
        'orthographic'
      )
      expect(ctx.controlsManager.updateCamera).toHaveBeenCalledWith(
        ctx.cameraManager.activeCamera
      )
      expect(ctx.gizmo.updateCamera).toHaveBeenCalledWith(
        ctx.cameraManager.activeCamera
      )
      expect(ctx.viewHelperManager.recreateViewHelper).toHaveBeenCalledOnce()
    })
  })

  describe('viewport wiring', () => {
    it('isActive ORs the activity flags through isLoad3dActive', () => {
      Object.assign(ctx.load3d, {
        STATUS_MOUSE_ON_NODE: false,
        STATUS_MOUSE_ON_SCENE: false,
        STATUS_MOUSE_ON_VIEWER: false,
        INITIAL_RENDER_DONE: true,
        animationManager: { isAnimationPlaying: false, dispose: vi.fn() },
        recordingManager: { getIsRecording: vi.fn(() => false) }
      })

      expect(ctx.load3d.isActive()).toBe(false)
      ;(ctx.load3d as { STATUS_MOUSE_ON_NODE: boolean }).STATUS_MOUSE_ON_NODE =
        true
      expect(ctx.load3d.isActive()).toBe(true)
    })

    it('handleResize letterboxes the renderer when a target aspect ratio is set', () => {
      delete (ctx.load3d as { handleResize?: unknown }).handleResize

      const parent = document.createElement('div')
      Object.defineProperty(parent, 'clientWidth', {
        value: 800,
        configurable: true
      })
      Object.defineProperty(parent, 'clientHeight', {
        value: 600,
        configurable: true
      })
      const canvas = document.createElement('canvas')
      parent.appendChild(canvas)

      const setSize = vi.fn()
      const cameraResize = vi.fn()
      const sceneResize = vi.fn()

      Object.assign(ctx.load3d, {
        view: { canvas, setSize },
        targetWidth: 400,
        targetHeight: 200,
        targetAspectRatio: 2,
        isViewerMode: false,
        cameraManager: { ...ctx.cameraManager, handleResize: cameraResize },
        sceneManager: { ...ctx.sceneManager, handleResize: sceneResize }
      })

      ctx.load3d.handleResize()

      // Container 800x600, target aspect 2:1 → letterboxed render area 800x400
      expect(setSize).toHaveBeenCalledWith(800, 600)
      expect(cameraResize).toHaveBeenCalledWith(800, 400)
      expect(sceneResize).toHaveBeenCalledWith(800, 400)
    })

    it('renderMainScene applies the letterboxed viewport and feeds aspect to the camera', () => {
      const setViewport = vi.fn()
      const setScissor = vi.fn()
      const setScissorTest = vi.fn()
      const setClearColor = vi.fn()
      const clear = vi.fn()
      const render = vi.fn()
      const updateAspectRatio = vi.fn()
      const renderBackground = vi.fn()

      const scene = {} as THREE.Scene

      Object.assign(ctx.load3d, {
        view: {
          width: 800,
          height: 600,
          state: { clearColor: new THREE.Color(0x000000), clearAlpha: 0 },
          renderer: {
            setViewport,
            setScissor,
            setScissorTest,
            setClearColor,
            clear,
            render
          }
        },
        targetWidth: 400,
        targetHeight: 200,
        targetAspectRatio: 2,
        isViewerMode: false,
        cameraManager: { ...ctx.cameraManager, updateAspectRatio },
        sceneManager: { ...ctx.sceneManager, renderBackground, scene }
      })

      ctx.load3d.renderMainScene()

      expect(setViewport).toHaveBeenNthCalledWith(1, 0, 0, 800, 600)
      expect(setScissor).toHaveBeenNthCalledWith(1, 0, 0, 800, 600)
      expect(setViewport).toHaveBeenNthCalledWith(2, 0, 100, 800, 400)
      expect(setScissor).toHaveBeenNthCalledWith(2, 0, 100, 800, 400)
      expect(updateAspectRatio).toHaveBeenCalledWith(2)
      expect(setScissorTest).toHaveBeenCalledWith(true)
      expect(render).toHaveBeenCalledWith(scene, ctx.cameraManager.activeCamera)
    })

    it('setBackgroundImage updates background size with letterbox dimensions when a texture is loaded', async () => {
      const updateBackgroundSize = vi.fn()
      const setBackgroundImage = vi.fn().mockResolvedValue(undefined)
      const canvas = document.createElement('canvas')
      Object.defineProperty(canvas, 'clientWidth', {
        value: 800,
        configurable: true
      })
      Object.defineProperty(canvas, 'clientHeight', {
        value: 600,
        configurable: true
      })

      Object.assign(ctx.load3d, {
        view: { canvas },
        targetWidth: 400,
        targetHeight: 200,
        targetAspectRatio: 2,
        isViewerMode: false,
        sceneManager: {
          ...ctx.sceneManager,
          setBackgroundImage,
          updateBackgroundSize,
          backgroundTexture: {},
          backgroundMesh: {}
        }
      })

      await ctx.load3d.setBackgroundImage('test.png')

      expect(setBackgroundImage).toHaveBeenCalledWith('test.png')
      // Container 800x600, target aspect 2:1 → letterbox render area 800x400
      const args = updateBackgroundSize.mock.calls[0]
      expect(args[2]).toBe(800)
      expect(args[3]).toBe(400)
    })

    it('handleResize scales the view size by getZoomScaleCallback', () => {
      delete (ctx.load3d as { handleResize?: unknown }).handleResize

      const parent = document.createElement('div')
      Object.defineProperty(parent, 'clientWidth', {
        value: 400,
        configurable: true
      })
      Object.defineProperty(parent, 'clientHeight', {
        value: 400,
        configurable: true
      })
      const canvas = document.createElement('canvas')
      parent.appendChild(canvas)

      const setSize = vi.fn()

      Object.assign(ctx.load3d, {
        view: { canvas, setSize },
        getZoomScaleCallback: () => 2.5,
        targetWidth: 0,
        targetHeight: 0,
        isViewerMode: false,
        cameraManager: { ...ctx.cameraManager, handleResize: vi.fn() },
        sceneManager: { ...ctx.sceneManager, handleResize: vi.fn() }
      })

      ctx.load3d.handleResize()

      expect(setSize).toHaveBeenCalledWith(1000, 1000)
    })

    it('handleResize caps the zoom scale at 3', () => {
      delete (ctx.load3d as { handleResize?: unknown }).handleResize

      const parent = document.createElement('div')
      Object.defineProperty(parent, 'clientWidth', {
        value: 400,
        configurable: true
      })
      Object.defineProperty(parent, 'clientHeight', {
        value: 400,
        configurable: true
      })
      const canvas = document.createElement('canvas')
      parent.appendChild(canvas)

      const setSize = vi.fn()

      Object.assign(ctx.load3d, {
        view: { canvas, setSize },
        getZoomScaleCallback: () => 10,
        targetWidth: 0,
        targetHeight: 0,
        isViewerMode: false,
        cameraManager: { ...ctx.cameraManager, handleResize: vi.fn() },
        sceneManager: { ...ctx.sceneManager, handleResize: vi.fn() }
      })

      ctx.load3d.handleResize()

      expect(setSize).toHaveBeenCalledWith(1200, 1200)
    })

    it('handleResize defaults to scale 1 when no getZoomScaleCallback is provided', () => {
      delete (ctx.load3d as { handleResize?: unknown }).handleResize

      const parent = document.createElement('div')
      Object.defineProperty(parent, 'clientWidth', {
        value: 400,
        configurable: true
      })
      Object.defineProperty(parent, 'clientHeight', {
        value: 400,
        configurable: true
      })
      const canvas = document.createElement('canvas')
      parent.appendChild(canvas)

      const setSize = vi.fn()

      Object.assign(ctx.load3d, {
        view: { canvas, setSize },
        getZoomScaleCallback: undefined,
        targetWidth: 0,
        targetHeight: 0,
        isViewerMode: false,
        cameraManager: { ...ctx.cameraManager, handleResize: vi.fn() },
        sceneManager: { ...ctx.sceneManager, handleResize: vi.fn() }
      })

      ctx.load3d.handleResize()

      expect(setSize).toHaveBeenCalledWith(400, 400)
    })
  })

  describe('render loop wiring', () => {
    it('startAnimation registers a render loop whose tick body runs the per-frame managers when active', () => {
      const animationUpdate = vi.fn()
      const viewHelperUpdate = vi.fn()
      const viewHelperRender = vi.fn()
      const controlsUpdate = vi.fn()
      const renderMainScene = vi.fn()
      const beginRender = vi.fn()
      const blit = vi.fn()

      Object.assign(ctx.load3d, {
        STATUS_MOUSE_ON_NODE: true,
        STATUS_MOUSE_ON_SCENE: false,
        STATUS_MOUSE_ON_VIEWER: false,
        INITIAL_RENDER_DONE: false,
        clock: new THREE.Clock(),
        animationManager: {
          update: animationUpdate,
          isAnimationPlaying: false,
          dispose: vi.fn()
        },
        viewHelperManager: {
          update: viewHelperUpdate,
          render: viewHelperRender
        },
        controlsManager: { update: controlsUpdate },
        recordingManager: { getIsRecording: vi.fn(() => false) },
        renderMainScene,
        view: {
          beginRender,
          blit,
          renderer: { setScissorTest: vi.fn() }
        }
      })

      ;(ctx.load3d as unknown as { startAnimation(): void }).startAnimation()

      const loop = (ctx.load3d as unknown as { renderLoop: { stop(): void } })
        .renderLoop
      expect(loop).not.toBeNull()
      expect(typeof loop.stop).toBe('function')

      // The first loop() ran synchronously; isActive() returned true
      // (STATUS_MOUSE_ON_NODE), so the tick body executed once.
      expect(animationUpdate).toHaveBeenCalledOnce()
      expect(viewHelperUpdate).toHaveBeenCalledOnce()
      expect(controlsUpdate).toHaveBeenCalledOnce()
      expect(beginRender).toHaveBeenCalledOnce()
      expect(renderMainScene).toHaveBeenCalledOnce()
      expect(viewHelperRender).toHaveBeenCalledOnce()
      expect(blit).toHaveBeenCalledOnce()

      // Cancel the queued rAF so the test doesn't leak frames.
      loop.stop()
    })

    it('remove() stops the active render loop and clears the handle', () => {
      const stop = vi.fn()
      const canvas = document.createElement('canvas')

      Object.assign(ctx.load3d, {
        renderLoop: { stop },
        contextMenuAbortController: null,
        view: {
          canvas,
          dispose: vi.fn()
        },
        sceneManager: { ...ctx.sceneManager, dispose: vi.fn() },
        cameraManager: { ...ctx.cameraManager, dispose: vi.fn() },
        controlsManager: { ...ctx.controlsManager, dispose: vi.fn() },
        lightingManager: { dispose: vi.fn() },
        hdriManager: { dispose: vi.fn() },
        viewHelperManager: { dispose: vi.fn() },
        loaderManager: { dispose: vi.fn() },
        modelManager: { ...ctx.modelManager, dispose: vi.fn() },
        recordingManager: { dispose: vi.fn() },
        animationManager: { ...ctx.animationManager, dispose: vi.fn() },
        gizmoManager: { ...ctx.gizmo, dispose: vi.fn() }
      })

      ctx.load3d.remove()

      expect(stop).toHaveBeenCalledOnce()
      expect(
        (ctx.load3d as unknown as { renderLoop: unknown }).renderLoop
      ).toBeNull()
    })
  })

  describe('adapter-driven kind queries', () => {
    function makeWithAdapter(kind: 'mesh' | 'pointCloud' | 'splat' | null) {
      const adapter = kind === null ? null : { kind }
      Object.assign(ctx.load3d, {
        adapterRef: { current: adapter }
      })
    }

    it('isSplatModel is true only when the current adapter kind is "splat"', () => {
      makeWithAdapter('splat')
      expect(ctx.load3d.isSplatModel()).toBe(true)
      makeWithAdapter('mesh')
      expect(ctx.load3d.isSplatModel()).toBe(false)
      makeWithAdapter(null)
      expect(ctx.load3d.isSplatModel()).toBe(false)
    })

    it('isPlyModel is true only when the current adapter kind is "pointCloud"', () => {
      makeWithAdapter('pointCloud')
      expect(ctx.load3d.isPlyModel()).toBe(true)
      makeWithAdapter('mesh')
      expect(ctx.load3d.isPlyModel()).toBe(false)
    })
  })

  describe('setCameraFromMatrices', () => {
    it('derives the camera pose from extrinsics+intrinsics and applies it via setCameraState + setFOV', () => {
      const setCameraState = vi.fn()
      const setFOVImpl = vi.fn()
      const getCameraState = vi.fn(() => ({
        position: new THREE.Vector3(0, 0, 0),
        target: new THREE.Vector3(0, 0, 0),
        zoom: 1.5,
        cameraType: 'orthographic' as const
      }))

      Object.assign(ctx.load3d, {
        setCameraState,
        setFOV: setFOVImpl,
        cameraManager: { ...ctx.cameraManager, getCameraState }
      })

      // Identity rotation, zero translation, fy=cy=1 → fovY = 2*atan(1) = 90°.
      // OpenCV → three.js flips Y/Z, so position (0,0,0) stays at origin
      // and forward (0,0,1) → target (0,0,-1).
      const extrinsics = [
        [1, 0, 0, 0],
        [0, 1, 0, 0],
        [0, 0, 1, 0],
        [0, 0, 0, 1]
      ]
      const intrinsics = [
        [1, 0, 0],
        [0, 1, 1],
        [0, 0, 1]
      ]

      ctx.load3d.setCameraFromMatrices(extrinsics, intrinsics)

      expect(setCameraState).toHaveBeenCalledOnce()
      const stateArg = setCameraState.mock.calls[0][0] as {
        position: THREE.Vector3
        target: THREE.Vector3
        zoom: number
        cameraType: string
      }
      expect(stateArg.position.x).toBeCloseTo(0)
      expect(stateArg.position.y).toBeCloseTo(0)
      expect(stateArg.position.z).toBeCloseTo(0)
      expect(stateArg.target.x).toBeCloseTo(0)
      expect(stateArg.target.y).toBeCloseTo(0)
      expect(stateArg.target.z).toBeCloseTo(-1)
      // Zoom and cameraType must be preserved from the current state.
      expect(stateArg.zoom).toBe(1.5)
      expect(stateArg.cameraType).toBe('orthographic')

      expect(setFOVImpl).toHaveBeenCalledOnce()
      expect(setFOVImpl.mock.calls[0][0]).toBeCloseTo(90)
    })
  })

  describe('whenLoadIdle', () => {
    it('resolves immediately when no load is in flight', async () => {
      Object.assign(ctx.load3d, { loadingPromise: null })
      await expect(ctx.load3d.whenLoadIdle()).resolves.toBeUndefined()
    })

    it('waits for the current loadingPromise to settle', async () => {
      let resolveLoad!: () => void
      const p = new Promise<void>((resolve) => {
        resolveLoad = resolve
      })
      Object.assign(ctx.load3d, { loadingPromise: p })

      const idle = ctx.load3d.whenLoadIdle()
      let settled = false
      void idle.then(() => {
        settled = true
      })

      await Promise.resolve()
      expect(settled).toBe(false)

      resolveLoad()

      Object.assign(ctx.load3d, { loadingPromise: null })
      await idle
      expect(settled).toBe(true)
    })

    it('drains a chained sequence of loads before resolving', async () => {
      let resolveFirst!: () => void
      const first = new Promise<void>((resolve) => {
        resolveFirst = resolve
      })
      let resolveSecond!: () => void
      const second = new Promise<void>((resolve) => {
        resolveSecond = resolve
      })

      Object.assign(ctx.load3d, { loadingPromise: first })
      void first.then(() => {
        Object.assign(ctx.load3d, { loadingPromise: second })
      })

      const idle = ctx.load3d.whenLoadIdle()
      let settled = false
      void idle.then(() => {
        settled = true
      })

      resolveFirst()
      await new Promise((r) => setTimeout(r, 0))
      expect(settled).toBe(false)

      resolveSecond()
      Object.assign(ctx.load3d, { loadingPromise: null })
      await idle
      expect(settled).toBe(true)
    })

    it('swallows a rejected loadingPromise and continues draining', async () => {
      const failing = Promise.reject(new Error('boom'))
      failing.catch(() => {})
      Object.assign(ctx.load3d, { loadingPromise: failing })

      const idle = ctx.load3d.whenLoadIdle()
      Object.assign(ctx.load3d, { loadingPromise: null })

      await expect(idle).resolves.toBeUndefined()
    })
  })

  describe('currentLoadGeneration', () => {
    it('starts at 0', () => {
      const fresh = Object.create(Load3d.prototype) as Load3d
      Object.assign(fresh, {
        _loadGeneration: 0
      })
      expect(fresh.currentLoadGeneration).toBe(0)
    })

    it('ticks synchronously on every loadModel call, before any await', async () => {
      const internal = vi.fn().mockResolvedValue(undefined)
      Object.assign(ctx.load3d, {
        _loadGeneration: 0,
        loadingPromise: null,
        _loadModelInternal: internal
      })

      const baseline = ctx.load3d.currentLoadGeneration

      const p1 = ctx.load3d.loadModel('api/view?filename=a.glb')
      expect(ctx.load3d.currentLoadGeneration).toBe(baseline + 1)
      const p2 = ctx.load3d.loadModel('api/view?filename=b.glb')
      expect(ctx.load3d.currentLoadGeneration).toBe(baseline + 2)

      await Promise.all([p1, p2])
    })

    it('lets a chained whenLoadIdle continuation skip when a newer load was queued in between', async () => {
      const internal = vi.fn().mockResolvedValue(undefined)
      Object.assign(ctx.load3d, {
        _loadGeneration: 0,
        loadingPromise: null,
        _loadModelInternal: internal
      })

      const aGeneration = ctx.load3d.currentLoadGeneration
      const aPromise = ctx.load3d.loadModel('api/view?filename=a.glb')
      const aTarget = ctx.load3d.currentLoadGeneration
      expect(aTarget).toBe(aGeneration + 1)

      const bPromise = ctx.load3d.loadModel('api/view?filename=b.glb')
      expect(ctx.load3d.currentLoadGeneration).toBe(aGeneration + 2)

      await Promise.all([aPromise, bPromise])

      const apply = vi.fn()
      if (ctx.load3d.currentLoadGeneration === aTarget) apply()
      expect(apply).not.toHaveBeenCalled()
    })
  })

  describe('camera framing across reloads', () => {
    function setupLoadInternal() {
      const getCameraState = vi.fn<() => CameraState>(() => ({
        position: new THREE.Vector3(1, 2, 3),
        target: new THREE.Vector3(),
        zoom: 1,
        cameraType: 'perspective'
      }))
      const setCameraState = vi.fn()
      const getCurrentCameraType = vi.fn(() => 'perspective' as const)
      const loaderLoadModel = vi.fn().mockResolvedValue(undefined)
      Object.assign(ctx.load3d, {
        cameraManager: {
          ...ctx.cameraManager,
          getCameraState,
          setCameraState,
          getCurrentCameraType
        },
        controlsManager: { ...ctx.controlsManager, reset: vi.fn() },
        loaderManager: { loadModel: loaderLoadModel },
        modelManager: {
          ...ctx.modelManager,
          currentModel: new THREE.Group(),
          originalModel: null
        },
        animationManager: {
          ...ctx.animationManager,
          setupModelAnimations: vi.fn()
        },
        handleResize: vi.fn(),
        hasLoadedModel: false
      })
      return { getCameraState, setCameraState, getCurrentCameraType }
    }

    it('first load uses default framing', async () => {
      const mocks = setupLoadInternal()

      await ctx.load3d.loadModel('a.glb')

      expect(ctx.cameraManager.reset).toHaveBeenCalledOnce()
      expect(mocks.getCameraState).not.toHaveBeenCalled()
      expect(mocks.setCameraState).not.toHaveBeenCalled()
    })

    it('subsequent load preserves the user-adjusted camera framing', async () => {
      const mocks = setupLoadInternal()

      await ctx.load3d.loadModel('a.glb')
      ;(ctx.cameraManager.reset as ReturnType<typeof vi.fn>).mockClear()
      mocks.getCameraState.mockClear()
      mocks.setCameraState.mockClear()

      await ctx.load3d.loadModel('b.glb')

      expect(ctx.cameraManager.reset).not.toHaveBeenCalled()
      expect(mocks.getCameraState).toHaveBeenCalledOnce()
      expect(mocks.setCameraState).toHaveBeenCalledOnce()
    })

    it('toggles to the saved camera type before restoring state when types differ', async () => {
      const mocks = setupLoadInternal()
      mocks.getCameraState.mockImplementation(() => ({
        position: new THREE.Vector3(0, 0, 5),
        target: new THREE.Vector3(),
        zoom: 1,
        cameraType: 'orthographic'
      }))
      // First load (active type stays perspective per the default mock).
      await ctx.load3d.loadModel('a.glb')
      ;(ctx.cameraManager.toggleCamera as ReturnType<typeof vi.fn>).mockClear()

      await ctx.load3d.loadModel('b.glb')

      expect(ctx.cameraManager.toggleCamera).toHaveBeenCalledWith(
        'orthographic'
      )
      expect(mocks.setCameraState).toHaveBeenCalledOnce()
    })

    it('resets hasLoadedModel on clearModel so the next load uses default framing', async () => {
      const mocks = setupLoadInternal()
      await ctx.load3d.loadModel('a.glb')
      ctx.load3d.clearModel()
      ;(ctx.cameraManager.reset as ReturnType<typeof vi.fn>).mockClear()
      mocks.getCameraState.mockClear()

      await ctx.load3d.loadModel('b.glb')

      expect(ctx.cameraManager.reset).toHaveBeenCalledOnce()
      expect(mocks.getCameraState).not.toHaveBeenCalled()
    })
  })

  describe('captureScene', () => {
    it('hides the gizmo helper during capture and restores it after success', async () => {
      const captureResult = { scene: 'a', mask: 'b', normal: 'c' }
      ctx.sceneManager.captureScene.mockResolvedValue(captureResult)

      const result = await ctx.load3d.captureScene(100, 200)

      expect(ctx.gizmo.removeFromScene).toHaveBeenCalledBefore(
        ctx.sceneManager.captureScene
      )
      expect(ctx.sceneManager.captureScene).toHaveBeenCalledWith(100, 200)
      expect(ctx.gizmo.ensureHelperInScene).toHaveBeenCalledOnce()
      expect(result).toBe(captureResult)
    })

    it('restores the gizmo helper even when capture fails', async () => {
      const err = new Error('capture failed')
      ctx.sceneManager.captureScene.mockRejectedValue(err)

      await expect(ctx.load3d.captureScene(100, 200)).rejects.toBe(err)

      expect(ctx.gizmo.removeFromScene).toHaveBeenCalledOnce()
      expect(ctx.gizmo.ensureHelperInScene).toHaveBeenCalledOnce()
    })
  })

  describe('emitModelReady', () => {
    it('emits a modelReady event on the eventManager', () => {
      ctx.load3d.emitModelReady()
      expect(ctx.eventManager.emitEvent).toHaveBeenCalledWith(
        'modelReady',
        null
      )
    })
  })

  describe('captureThumbnail', () => {
    function setupForCapture() {
      const cameraStub = {
        toggleCamera: vi.fn(),
        getCurrentCameraType: vi.fn().mockReturnValue('perspective'),
        getCameraState: vi.fn().mockReturnValue({
          position: { x: 1, y: 2, z: 3 },
          target: { x: 0, y: 0, z: 0 },
          zoom: 1,
          cameraType: 'perspective'
        }),
        setCameraState: vi.fn(),
        perspectiveCamera: new THREE.PerspectiveCamera()
      }
      const controlsStub = {
        controls: { target: { copy: vi.fn() }, update: vi.fn() }
      }
      const sceneCaptureMock = vi.fn().mockResolvedValue({
        scene: 'data:image/png;base64,scene',
        mask: 'm',
        normal: 'n'
      })
      const modelGroup = new THREE.Group()
      modelGroup.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1)))
      Object.assign(ctx.load3d, {
        cameraManager: cameraStub,
        controlsManager: controlsStub,
        sceneManager: {
          ...ctx.sceneManager,
          gridHelper: { visible: true },
          captureScene: sceneCaptureMock
        },
        modelManager: {
          ...ctx.modelManager,
          currentModel: modelGroup
        }
      })
      return { cameraStub, sceneCaptureMock }
    }

    it('throws when no model is loaded', async () => {
      Object.assign(ctx.load3d, {
        modelManager: { ...ctx.modelManager, currentModel: null }
      })

      await expect(ctx.load3d.captureThumbnail()).rejects.toThrow(
        'No model loaded for thumbnail capture'
      )
    })

    it('forces a render after restoring camera state so the visible canvas reflects the live scene, not the offscreen capture', async () => {
      const { cameraStub } = setupForCapture()

      const result = await ctx.load3d.captureThumbnail(64, 64)

      expect(result).toBe('data:image/png;base64,scene')
      expect(cameraStub.setCameraState).toHaveBeenCalled()
      // forceRender must be called AFTER the live state has been restored.
      const setCameraOrder = cameraStub.setCameraState.mock.invocationCallOrder
      const forceRenderOrder = ctx.forceRender.mock.invocationCallOrder
      expect(forceRenderOrder.at(-1)).toBeGreaterThan(setCameraOrder.at(-1)!)
    })

    it('still forces a render in finally when captureScene rejects', async () => {
      const { sceneCaptureMock } = setupForCapture()
      sceneCaptureMock.mockRejectedValueOnce(new Error('boom'))

      await expect(ctx.load3d.captureThumbnail(64, 64)).rejects.toThrow('boom')
      expect(ctx.forceRender).toHaveBeenCalled()
    })
  })

  describe('exportModel', () => {
    beforeEach(() => {
      cloneSkinnedMock.mockReset()
      exportGLBMock.mockReset()
      exportOBJMock.mockReset()
      exportSTLMock.mockReset()
      exportFBXMock.mockReset()
    })

    function setupForExport(overrides: {
      currentModel: THREE.Object3D | null
      originalModel?: THREE.Object3D | null
      originalFileName?: string | null
      originalURL?: string | null
    }) {
      Object.assign(ctx.load3d, {
        modelManager: {
          ...ctx.modelManager,
          currentModel: overrides.currentModel,
          originalModel: overrides.originalModel ?? null,
          originalFileName: overrides.originalFileName ?? 'cube',
          originalURL: overrides.originalURL ?? null
        }
      })
    }

    it('throws when no model is loaded', async () => {
      setupForExport({ currentModel: null })

      await expect(ctx.load3d.exportModel('fbx')).rejects.toThrow(
        'No model to export'
      )
    })

    it('zeroes the source transform during export, then restores it', async () => {
      const model = new THREE.Object3D()
      model.position.set(5, 6, 7)
      model.rotation.set(0.1, 0.2, 0.3)
      model.scale.set(2, 3, 4)

      let transformDuringExport: {
        position: THREE.Vector3
        rotation: THREE.Euler
        scale: THREE.Vector3
      } | null = null
      exportGLBMock.mockImplementation(async () => {
        transformDuringExport = {
          position: model.position.clone(),
          rotation: model.rotation.clone(),
          scale: model.scale.clone()
        }
      })

      setupForExport({ currentModel: model })

      await ctx.load3d.exportModel('glb')

      expect(transformDuringExport!.position.x).toBe(0)
      expect(transformDuringExport!.position.y).toBe(0)
      expect(transformDuringExport!.position.z).toBe(0)
      expect(transformDuringExport!.rotation.x).toBe(0)
      expect(transformDuringExport!.scale.x).toBe(1)
      expect(transformDuringExport!.scale.y).toBe(1)
      expect(transformDuringExport!.scale.z).toBe(1)

      expect(model.position.x).toBe(5)
      expect(model.position.y).toBe(6)
      expect(model.position.z).toBe(7)
      expect(model.rotation.x).toBeCloseTo(0.1)
      expect(model.scale.x).toBe(2)
      expect(model.scale.z).toBe(4)
    })

    it('restores the source transform even when the exporter throws', async () => {
      const model = new THREE.Object3D()
      model.position.set(3, 4, 5)
      model.scale.set(7, 7, 7)
      exportGLBMock.mockRejectedValueOnce(new Error('boom'))

      setupForExport({ currentModel: model })
      vi.spyOn(console, 'error').mockImplementation(() => {})

      await expect(ctx.load3d.exportModel('glb')).rejects.toThrow('boom')

      expect(model.position.x).toBe(3)
      expect(model.scale.x).toBe(7)
    })

    it('routes fbx through SkeletonUtils.clone and attaches the source animations', async () => {
      const model = new THREE.Object3D()
      const clip = { name: 'walk' } as unknown as THREE.AnimationClip
      model.animations = [clip]
      const cloned = new THREE.Object3D()
      cloneSkinnedMock.mockReturnValueOnce(cloned)

      setupForExport({
        currentModel: model,
        originalFileName: 'rig',
        originalURL: 'http://example.com/api/view?filename=rig.fbx'
      })

      await ctx.load3d.exportModel('fbx')

      expect(cloneSkinnedMock).toHaveBeenCalledWith(model)
      expect(exportFBXMock).toHaveBeenCalledOnce()
      const [exportedModel, filename, originalURL] = exportFBXMock.mock
        .calls[0] as [
        THREE.Object3D & { animations: THREE.AnimationClip[] },
        string,
        string | null
      ]
      expect(exportedModel).toBe(cloned)
      expect(exportedModel.animations).toEqual([clip])
      expect(filename).toBe('rig.fbx')
      expect(originalURL).toBe('http://example.com/api/view?filename=rig.fbx')
    })

    it('falls back to originalModel.animations when the working model has none (fbx)', async () => {
      const model = new THREE.Object3D()
      const original = new THREE.Object3D()
      const clip = { name: 'idle' } as unknown as THREE.AnimationClip
      original.animations = [clip]
      const cloned = new THREE.Object3D()
      cloneSkinnedMock.mockReturnValueOnce(cloned)

      setupForExport({ currentModel: model, originalModel: original })

      await ctx.load3d.exportModel('fbx')

      const [exportedModel] = exportFBXMock.mock.calls[0] as [
        THREE.Object3D & { animations: THREE.AnimationClip[] }
      ]
      expect(exportedModel.animations).toEqual([clip])
    })

    it('uses Object3D.clone (not SkeletonUtils) for non-fbx formats', async () => {
      const model = new THREE.Object3D()
      const cloneSpy = vi.spyOn(model, 'clone')

      setupForExport({
        currentModel: model,
        originalFileName: 'cube',
        originalURL: null
      })

      await ctx.load3d.exportModel('glb')

      expect(cloneSpy).toHaveBeenCalled()
      expect(cloneSkinnedMock).not.toHaveBeenCalled()
      expect(exportGLBMock).toHaveBeenCalledOnce()
      const [, filename] = exportGLBMock.mock.calls[0] as [
        unknown,
        string,
        unknown
      ]
      expect(filename).toBe('cube.glb')
    })

    it('emits exportLoadingStart and exportLoadingEnd around the export', async () => {
      const model = new THREE.Object3D()
      setupForExport({ currentModel: model })

      await ctx.load3d.exportModel('glb')

      expect(ctx.eventManager.emitEvent).toHaveBeenCalledWith(
        'exportLoadingStart',
        'Exporting as GLB...'
      )
      expect(ctx.eventManager.emitEvent).toHaveBeenCalledWith(
        'exportLoadingEnd',
        null
      )
    })

    it('throws on unsupported format', async () => {
      const model = new THREE.Object3D()
      setupForExport({ currentModel: model })
      vi.spyOn(console, 'error').mockImplementation(() => {})

      await expect(ctx.load3d.exportModel('xyz')).rejects.toThrow(
        'Unsupported export format: xyz'
      )
    })

    it('downloads the source file directly for direct-export formats', async () => {
      exportDirectMock.mockReset()
      detectFormatFromURLMock.mockReturnValue('ply')
      const model = new THREE.Object3D()
      setupForExport({
        currentModel: model,
        originalFileName: 'cloud',
        originalURL: 'http://example.com/api/view?filename=cloud.ply'
      })

      await ctx.load3d.exportModel('ply')

      expect(exportDirectMock).toHaveBeenCalledWith(
        'http://example.com/api/view?filename=cloud.ply',
        'cloud.ply',
        'ply'
      )
      expect(exportGLBMock).not.toHaveBeenCalled()
      expect(exportOBJMock).not.toHaveBeenCalled()
      expect(cloneSkinnedMock).not.toHaveBeenCalled()
    })

    it('refuses a direct export when the requested format differs from the source', async () => {
      exportDirectMock.mockReset()
      detectFormatFromURLMock.mockReturnValue('spz')
      vi.spyOn(console, 'error').mockImplementation(() => {})
      setupForExport({
        currentModel: new THREE.Object3D(),
        originalFileName: 'scene',
        originalURL: 'http://example.com/api/view?filename=scene.spz'
      })

      await expect(ctx.load3d.exportModel('ply')).rejects.toThrow(
        'Cannot export ply without converting from the loaded spz source'
      )
      expect(exportDirectMock).not.toHaveBeenCalled()
    })

    it('getSourceFormat derives the extension from the original URL', () => {
      detectFormatFromURLMock.mockReturnValue('spz')
      setupForExport({
        currentModel: new THREE.Object3D(),
        originalURL: 'http://example.com/api/view?filename=scene.spz'
      })

      expect(ctx.load3d.getSourceFormat()).toBe('spz')
      expect(detectFormatFromURLMock).toHaveBeenCalledWith(
        'http://example.com/api/view?filename=scene.spz'
      )
    })
  })

  describe('constructor wiring', () => {
    function makeConstructorDeps() {
      const container = document.createElement('div')
      const canvas = document.createElement('canvas')
      container.appendChild(canvas)

      const view = {
        canvas,
        renderer: {
          setViewport: vi.fn(),
          setScissor: vi.fn(),
          setScissorTest: vi.fn(),
          setClearColor: vi.fn(),
          clear: vi.fn(),
          render: vi.fn()
        },
        width: 800,
        height: 600,
        state: { clearColor: new THREE.Color(0x000000), clearAlpha: 0 },
        observeResize: vi.fn(),
        beginRender: vi.fn(),
        blit: vi.fn(),
        setSize: vi.fn(),
        dispose: vi.fn()
      }
      const gizmoManager = {
        setPointerNdcSource: vi.fn(),
        init: vi.fn(),
        dispose: vi.fn()
      }
      const deps = {
        view,
        eventManager: {
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          emitEvent: vi.fn()
        },
        sceneManager: {
          init: vi.fn(),
          scene: new THREE.Scene(),
          renderBackground: vi.fn(),
          handleResize: vi.fn(),
          dispose: vi.fn()
        },
        cameraManager: {
          init: vi.fn(),
          activeCamera: new THREE.PerspectiveCamera(),
          handleResize: vi.fn(),
          dispose: vi.fn()
        },
        controlsManager: { init: vi.fn(), update: vi.fn(), dispose: vi.fn() },
        lightingManager: { init: vi.fn(), dispose: vi.fn() },
        viewHelperManager: {
          createViewHelper: vi.fn(),
          init: vi.fn(),
          update: vi.fn(),
          render: vi.fn(),
          dispose: vi.fn()
        },
        hdriManager: { dispose: vi.fn() },
        loaderManager: { init: vi.fn(), dispose: vi.fn() },
        modelManager: { dispose: vi.fn() },
        recordingManager: {
          getIsRecording: vi.fn(() => false),
          dispose: vi.fn()
        },
        animationManager: {
          init: vi.fn(),
          update: vi.fn(),
          isAnimationPlaying: false,
          dispose: vi.fn()
        },
        gizmoManager,
        adapterRef: { current: null, capabilities: null }
      }
      return { container, deps: deps as unknown as Load3dDeps, gizmoManager }
    }

    it('wires the gizmo pointer NDC source to clientPointToNdc on every construction path', () => {
      const { container, deps, gizmoManager } = makeConstructorDeps()
      const load3d = new Load3d(container, deps)

      expect(gizmoManager.setPointerNdcSource).toHaveBeenCalledOnce()

      const ndc = { x: 0.25, y: -0.5, inside: true }
      const clientPointToNdc = vi
        .spyOn(load3d, 'clientPointToNdc')
        .mockReturnValue(ndc)
      const source = gizmoManager.setPointerNdcSource.mock
        .calls[0][0] as PointerNdcSource

      expect(source(12, 34)).toBe(ndc)
      expect(clientPointToNdc).toHaveBeenCalledWith(12, 34)

      load3d.remove()
    })
  })
})
