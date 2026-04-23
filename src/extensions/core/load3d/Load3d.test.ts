import * as THREE from 'three'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import Load3d from '@/extensions/core/load3d/Load3d'
import {
  DEFAULT_MODEL_CAPABILITIES,
  type ModelAdapterCapabilities
} from '@/extensions/core/load3d/ModelAdapter'
import { ModelExporter } from '@/extensions/core/load3d/ModelExporter'
import {
  makeAnimationManagerStub,
  makeCameraManagerStub,
  makeControlsManagerStub,
  makeEventManagerStub,
  makeGizmoStub,
  makeHDRIManagerStub,
  makeLightingManagerStub,
  makeLoaderManagerStub,
  makeModelManagerStub,
  makeRecordingManagerStub,
  makeRendererStub,
  makeSceneManagerStub,
  makeViewHelperManagerStub
} from '@/extensions/core/load3d/__test__/managerStubs'
import type { GizmoMode } from '@/extensions/core/load3d/interfaces'

vi.mock('@/extensions/core/load3d/ModelExporter', () => ({
  ModelExporter: {
    exportGLB: vi.fn().mockResolvedValue(undefined),
    exportOBJ: vi.fn().mockResolvedValue(undefined),
    exportSTL: vi.fn().mockResolvedValue(undefined)
  }
}))

type MakeInstanceOptions = {
  capabilities?: ModelAdapterCapabilities | null
  adapterKind?: 'mesh' | 'pointCloud' | 'splat' | null
  stubForceRender?: boolean
  stubHandleResize?: boolean
  targetWidth?: number
  targetHeight?: number
  getDimensionsCallback?: () => { width: number; height: number } | null
}

function makeInstance(opts: MakeInstanceOptions = {}) {
  const {
    capabilities = {
      fitToViewer: true,
      requiresMaterialRebuild: false,
      gizmoTransform: true,
      lighting: true,
      exportable: true,
      materialModes: ['original', 'normal', 'wireframe']
    },
    adapterKind = 'mesh',
    stubForceRender = true,
    stubHandleResize = true,
    targetWidth = 0,
    targetHeight = 0,
    getDimensionsCallback
  } = opts

  const gizmo = makeGizmoStub()
  const sceneManager = makeSceneManagerStub()
  const cameraManager = makeCameraManagerStub()
  const controlsManager = makeControlsManagerStub()
  const lightingManager = makeLightingManagerStub()
  const hdriManager = makeHDRIManagerStub()
  const viewHelperManager = makeViewHelperManagerStub()
  const loaderManager = makeLoaderManagerStub(capabilities, adapterKind)
  const modelManager = makeModelManagerStub()
  const recordingManager = makeRecordingManagerStub()
  const animationManager = makeAnimationManagerStub()
  const eventManager = makeEventManagerStub()
  const renderer = makeRendererStub()

  // Load3d's constructor instantiates THREE.WebGLRenderer, ResizeObserver
  // and ViewHelper, none of which are available in happy-dom. Skip it and
  // inject stubs directly onto the prototype instance so delegation methods
  // can be exercised in isolation.
  const load3d = Object.create(Load3d.prototype) as Load3d
  const forceRender = vi.fn()
  const handleResize = vi.fn()

  Object.assign(load3d, {
    clock: new THREE.Clock(),
    gizmoManager: gizmo,
    modelManager,
    cameraManager,
    sceneManager,
    controlsManager,
    lightingManager,
    hdriManager,
    viewHelperManager,
    loaderManager,
    recordingManager,
    animationManager,
    eventManager,
    renderer,
    STATUS_MOUSE_ON_NODE: false,
    STATUS_MOUSE_ON_SCENE: false,
    STATUS_MOUSE_ON_VIEWER: false,
    INITIAL_RENDER_DONE: false,
    targetWidth,
    targetHeight,
    targetAspectRatio:
      targetWidth && targetHeight ? targetWidth / targetHeight : 1,
    isViewerMode: false,
    loadingPromise: null,
    onContextMenuCallback: undefined,
    getDimensionsCallback,
    resizeObserver: null,
    disposeContextMenuGuard: null,
    renderLoop: null
  })

  if (stubForceRender) {
    Object.assign(load3d, { forceRender })
  }
  if (stubHandleResize) {
    Object.assign(load3d, { handleResize })
  }

  return {
    load3d,
    gizmo,
    modelManager,
    cameraManager,
    sceneManager,
    controlsManager,
    lightingManager,
    hdriManager,
    viewHelperManager,
    loaderManager,
    recordingManager,
    animationManager,
    eventManager,
    renderer,
    forceRender,
    handleResize
  }
}

describe('Load3d', () => {
  let ctx: ReturnType<typeof makeInstance>

  beforeEach(() => {
    vi.clearAllMocks()
    ctx = makeInstance()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('manager getters', () => {
    it('expose injected managers', () => {
      expect(ctx.load3d.getEventManager()).toBe(ctx.eventManager)
      expect(ctx.load3d.getSceneManager()).toBe(ctx.sceneManager)
      expect(ctx.load3d.getCameraManager()).toBe(ctx.cameraManager)
      expect(ctx.load3d.getControlsManager()).toBe(ctx.controlsManager)
      expect(ctx.load3d.getLightingManager()).toBe(ctx.lightingManager)
      expect(ctx.load3d.getViewHelperManager()).toBe(ctx.viewHelperManager)
      expect(ctx.load3d.getLoaderManager()).toBe(ctx.loaderManager)
      expect(ctx.load3d.getModelManager()).toBe(ctx.modelManager)
      expect(ctx.load3d.getRecordingManager()).toBe(ctx.recordingManager)
      expect(ctx.load3d.getGizmoManager()).toBe(ctx.gizmo)
    })

    it('getTargetSize returns the stored target dimensions', () => {
      const localCtx = makeInstance({ targetWidth: 640, targetHeight: 480 })
      expect(localCtx.load3d.getTargetSize()).toEqual({
        width: 640,
        height: 480
      })
    })

    it('getCurrentModel returns the modelManager current model', () => {
      const cube = new THREE.Object3D()
      ctx.modelManager.currentModel = cube
      expect(ctx.load3d.getCurrentModel()).toBe(cube)
    })

    it('getCurrentCameraType delegates to cameraManager', () => {
      ctx.cameraManager.getCurrentCameraType.mockReturnValue('orthographic')
      expect(ctx.load3d.getCurrentCameraType()).toBe('orthographic')
    })

    it('getCameraState delegates to cameraManager', () => {
      const state = {
        position: new THREE.Vector3(1, 2, 3),
        target: new THREE.Vector3(0, 0, 0),
        zoom: 2,
        cameraType: 'perspective' as const
      }
      ctx.cameraManager.getCameraState.mockReturnValue(state)
      expect(ctx.load3d.getCameraState()).toBe(state)
    })
  })

  describe('gizmo delegation', () => {
    it('setGizmoEnabled delegates to gizmoManager.setEnabled and forces a render', () => {
      ctx.load3d.setGizmoEnabled(true)

      expect(ctx.gizmo.setEnabled).toHaveBeenCalledWith(true)
      expect(ctx.forceRender).toHaveBeenCalledOnce()
    })

    it.each(['translate', 'rotate', 'scale'] as const)(
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

  describe('capability gating', () => {
    function makeNoGizmoCtx() {
      return makeInstance({
        capabilities: {
          ...DEFAULT_MODEL_CAPABILITIES,
          gizmoTransform: false
        },
        adapterKind: 'splat'
      })
    }

    it('setGizmoEnabled(true) is a no-op when gizmoTransform capability is false', () => {
      const c = makeNoGizmoCtx()
      c.load3d.setGizmoEnabled(true)

      expect(c.gizmo.setEnabled).not.toHaveBeenCalled()
      expect(c.forceRender).not.toHaveBeenCalled()
    })

    it('setGizmoEnabled(false) still delegates even when capability is false', () => {
      const c = makeNoGizmoCtx()
      c.load3d.setGizmoEnabled(false)

      expect(c.gizmo.setEnabled).toHaveBeenCalledWith(false)
    })

    it('setGizmoMode is a no-op when gizmoTransform capability is false', () => {
      const c = makeNoGizmoCtx()
      c.load3d.setGizmoMode('rotate')

      expect(c.gizmo.setMode).not.toHaveBeenCalled()
    })

    it('resetGizmoTransform is a no-op when gizmoTransform capability is false', () => {
      const c = makeNoGizmoCtx()
      c.load3d.resetGizmoTransform()

      expect(c.gizmo.reset).not.toHaveBeenCalled()
    })

    it('applyGizmoTransform is a no-op when gizmoTransform capability is false', () => {
      const c = makeNoGizmoCtx()
      c.load3d.applyGizmoTransform({ x: 1, y: 0, z: 0 }, { x: 0, y: 0, z: 0 })

      expect(c.gizmo.applyTransform).not.toHaveBeenCalled()
    })

    it('isSplatModel returns true only when current adapter.kind === "splat"', () => {
      expect(makeInstance({ adapterKind: 'splat' }).load3d.isSplatModel()).toBe(
        true
      )
      expect(makeInstance({ adapterKind: 'mesh' }).load3d.isSplatModel()).toBe(
        false
      )
      expect(
        makeInstance({
          adapterKind: null,
          capabilities: null
        }).load3d.isSplatModel()
      ).toBe(false)
    })

    it('isPlyModel returns true only when current adapter.kind === "pointCloud"', () => {
      expect(
        makeInstance({ adapterKind: 'pointCloud' }).load3d.isPlyModel()
      ).toBe(true)
      expect(makeInstance({ adapterKind: 'mesh' }).load3d.isPlyModel()).toBe(
        false
      )
    })

    it('getCurrentModelCapabilities returns adapter capabilities when present', () => {
      const caps = {
        ...DEFAULT_MODEL_CAPABILITIES,
        exportable: false
      }
      const c = makeInstance({ capabilities: caps, adapterKind: 'splat' })
      expect(c.load3d.getCurrentModelCapabilities()).toEqual(caps)
    })

    it('getCurrentModelCapabilities falls back to DEFAULT when no adapter is loaded', () => {
      const c = makeInstance({ capabilities: null, adapterKind: null })
      expect(c.load3d.getCurrentModelCapabilities()).toEqual(
        DEFAULT_MODEL_CAPABILITIES
      )
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
      expect(ctx.handleResize).toHaveBeenCalledOnce()
    })
  })

  describe('scene / background setters', () => {
    it('toggleGrid delegates and forces a render', () => {
      ctx.load3d.toggleGrid(false)
      expect(ctx.sceneManager.toggleGrid).toHaveBeenCalledWith(false)
      expect(ctx.forceRender).toHaveBeenCalledOnce()
    })

    it('setBackgroundColor delegates and forces a render', () => {
      ctx.load3d.setBackgroundColor('#ff0000')
      expect(ctx.sceneManager.setBackgroundColor).toHaveBeenCalledWith(
        '#ff0000'
      )
      expect(ctx.forceRender).toHaveBeenCalledOnce()
    })

    it('setBackgroundRenderMode delegates and forces a render', () => {
      ctx.load3d.setBackgroundRenderMode('panorama')
      expect(ctx.sceneManager.setBackgroundRenderMode).toHaveBeenCalledWith(
        'panorama'
      )
      expect(ctx.forceRender).toHaveBeenCalledOnce()
    })

    it('removeBackgroundImage delegates and forces a render', () => {
      ctx.load3d.removeBackgroundImage()
      expect(ctx.sceneManager.removeBackgroundImage).toHaveBeenCalledOnce()
      expect(ctx.forceRender).toHaveBeenCalledOnce()
    })

    it('setBackgroundImage without existing texture only sets and renders', async () => {
      await ctx.load3d.setBackgroundImage('some/path.png')

      expect(ctx.sceneManager.setBackgroundImage).toHaveBeenCalledWith(
        'some/path.png'
      )
      expect(ctx.sceneManager.updateBackgroundSize).not.toHaveBeenCalled()
      expect(ctx.forceRender).toHaveBeenCalledOnce()
    })

    it('setBackgroundImage updates background size with container dimensions when no aspect ratio is enforced', async () => {
      ctx.sceneManager.backgroundTexture = {}
      ctx.sceneManager.backgroundMesh = {}

      await ctx.load3d.setBackgroundImage('some/path.png')

      expect(ctx.sceneManager.updateBackgroundSize).toHaveBeenCalledWith(
        {},
        {},
        ctx.renderer.domElement.clientWidth,
        ctx.renderer.domElement.clientHeight
      )
    })

    it('setBackgroundImage uses letterboxed dimensions when aspect ratio is enforced', async () => {
      const c = makeInstance({ targetWidth: 400, targetHeight: 400 })
      c.sceneManager.backgroundTexture = {}
      c.sceneManager.backgroundMesh = {}

      await c.load3d.setBackgroundImage('bg.png')

      // 800x600 container, 1:1 target → letterbox is 600x600.
      expect(c.sceneManager.updateBackgroundSize).toHaveBeenCalledWith(
        {},
        {},
        600,
        600
      )
    })
  })

  describe('camera setters', () => {
    it('setCameraState delegates and forces a render', () => {
      const state = {
        position: new THREE.Vector3(5, 5, 5),
        target: new THREE.Vector3(0, 0, 0),
        zoom: 1,
        cameraType: 'perspective' as const
      }
      ctx.load3d.setCameraState(state)

      expect(ctx.cameraManager.setCameraState).toHaveBeenCalledWith(state)
      expect(ctx.forceRender).toHaveBeenCalledOnce()
    })

    it('setFOV delegates and forces a render', () => {
      ctx.load3d.setFOV(42)
      expect(ctx.cameraManager.setFOV).toHaveBeenCalledWith(42)
      expect(ctx.forceRender).toHaveBeenCalledOnce()
    })
  })

  describe('material, up direction and skeleton', () => {
    it('setMaterialMode delegates and forces a render', () => {
      ctx.load3d.setMaterialMode('wireframe')
      expect(ctx.modelManager.setMaterialMode).toHaveBeenCalledWith('wireframe')
      expect(ctx.forceRender).toHaveBeenCalledOnce()
    })

    it('setUpDirection delegates and forces a render', () => {
      ctx.load3d.setUpDirection('-z')
      expect(ctx.modelManager.setUpDirection).toHaveBeenCalledWith('-z')
      expect(ctx.forceRender).toHaveBeenCalledOnce()
    })

    it('setShowSkeleton delegates and forces a render', () => {
      ctx.load3d.setShowSkeleton(true)
      expect(ctx.modelManager.setShowSkeleton).toHaveBeenCalledWith(true)
      expect(ctx.forceRender).toHaveBeenCalledOnce()
    })

    it('getShowSkeleton reflects modelManager.showSkeleton', () => {
      ctx.modelManager.showSkeleton = true
      expect(ctx.load3d.getShowSkeleton()).toBe(true)
    })

    it('hasSkeleton delegates to modelManager.hasSkeleton', () => {
      ctx.modelManager.hasSkeleton.mockReturnValue(true)
      expect(ctx.load3d.hasSkeleton()).toBe(true)
      expect(ctx.modelManager.hasSkeleton).toHaveBeenCalled()
    })
  })

  describe('light and HDRI', () => {
    it('setLightIntensity delegates and forces a render', () => {
      ctx.load3d.setLightIntensity(3)
      expect(ctx.lightingManager.setLightIntensity).toHaveBeenCalledWith(3)
      expect(ctx.forceRender).toHaveBeenCalledOnce()
    })

    it('loadHDRI awaits hdriManager and forces a render', async () => {
      await ctx.load3d.loadHDRI('http://example.com/hdr.hdr')
      expect(ctx.hdriManager.loadHDRI).toHaveBeenCalledWith(
        'http://example.com/hdr.hdr'
      )
      expect(ctx.forceRender).toHaveBeenCalledOnce()
    })

    it('setHDRIEnabled toggles hdriManager AND lightingManager hdri mode', () => {
      ctx.load3d.setHDRIEnabled(true)

      expect(ctx.hdriManager.setEnabled).toHaveBeenCalledWith(true)
      expect(ctx.lightingManager.setHDRIMode).toHaveBeenCalledWith(true)
      expect(ctx.forceRender).toHaveBeenCalledOnce()
    })

    it('setHDRIAsBackground delegates and forces a render', () => {
      ctx.load3d.setHDRIAsBackground(true)
      expect(ctx.hdriManager.setShowAsBackground).toHaveBeenCalledWith(true)
      expect(ctx.forceRender).toHaveBeenCalledOnce()
    })

    it('setHDRIIntensity delegates and forces a render', () => {
      ctx.load3d.setHDRIIntensity(0.5)
      expect(ctx.hdriManager.setIntensity).toHaveBeenCalledWith(0.5)
      expect(ctx.forceRender).toHaveBeenCalledOnce()
    })

    it('clearHDRI clears hdri and disables lightingManager hdri mode', () => {
      ctx.load3d.clearHDRI()

      expect(ctx.hdriManager.clear).toHaveBeenCalledOnce()
      expect(ctx.lightingManager.setHDRIMode).toHaveBeenCalledWith(false)
      expect(ctx.forceRender).toHaveBeenCalledOnce()
    })
  })

  describe('target size and viewport refresh', () => {
    it('setTargetSize updates stored dimensions and triggers a resize', () => {
      ctx.load3d.setTargetSize(1024, 512)

      expect(ctx.load3d.getTargetSize()).toEqual({ width: 1024, height: 512 })
      expect(ctx.handleResize).toHaveBeenCalledOnce()
    })

    it('refreshViewport delegates to handleResize', () => {
      ctx.load3d.refreshViewport()
      expect(ctx.handleResize).toHaveBeenCalledOnce()
    })
  })

  describe('mouse status and isActive', () => {
    it('updateStatusMouseOnNode/Scene/Viewer set the corresponding flags', () => {
      ctx.load3d.updateStatusMouseOnNode(true)
      ctx.load3d.updateStatusMouseOnScene(true)
      ctx.load3d.updateStatusMouseOnViewer(true)

      expect(ctx.load3d.STATUS_MOUSE_ON_NODE).toBe(true)
      expect(ctx.load3d.STATUS_MOUSE_ON_SCENE).toBe(true)
      expect(ctx.load3d.STATUS_MOUSE_ON_VIEWER).toBe(true)
    })

    it('isActive is true when the mouse is over the node', () => {
      ctx.load3d.updateStatusMouseOnNode(true)
      expect(ctx.load3d.isActive()).toBe(true)
    })

    it('isActive is true when recording', () => {
      ctx.recordingManager.getIsRecording.mockReturnValue(true)
      expect(ctx.load3d.isActive()).toBe(true)
    })

    it('isActive is true when an animation is playing', () => {
      ctx.animationManager.isAnimationPlaying = true
      expect(ctx.load3d.isActive()).toBe(true)
    })

    it('isActive is true until the initial render completes', () => {
      expect(ctx.load3d.isActive()).toBe(true)

      ctx.load3d.INITIAL_RENDER_DONE = true
      expect(ctx.load3d.isActive()).toBe(false)
    })
  })

  describe('animation delegation', () => {
    it('setAnimationSpeed forwards to animationManager', () => {
      ctx.load3d.setAnimationSpeed(2)
      expect(ctx.animationManager.setAnimationSpeed).toHaveBeenCalledWith(2)
    })

    it('updateSelectedAnimation forwards to animationManager', () => {
      ctx.load3d.updateSelectedAnimation(3)
      expect(ctx.animationManager.updateSelectedAnimation).toHaveBeenCalledWith(
        3
      )
    })

    it.each([undefined, true, false])('toggleAnimation forwards %s', (play) => {
      ctx.load3d.toggleAnimation(play)
      expect(ctx.animationManager.toggleAnimation).toHaveBeenCalledWith(play)
    })

    it('hasAnimations reflects animationManager.animationClips length', () => {
      expect(ctx.load3d.hasAnimations()).toBe(false)
      ctx.animationManager.animationClips = [
        new THREE.AnimationClip('run', 1, [])
      ]
      expect(ctx.load3d.hasAnimations()).toBe(true)
    })

    it('getAnimationTime and getAnimationDuration delegate to animationManager', () => {
      ctx.animationManager.getAnimationTime.mockReturnValue(1.5)
      ctx.animationManager.getAnimationDuration.mockReturnValue(5)

      expect(ctx.load3d.getAnimationTime()).toBe(1.5)
      expect(ctx.load3d.getAnimationDuration()).toBe(5)
    })

    it('setAnimationTime delegates and forces a render', () => {
      ctx.load3d.setAnimationTime(2.5)
      expect(ctx.animationManager.setAnimationTime).toHaveBeenCalledWith(2.5)
      expect(ctx.forceRender).toHaveBeenCalledOnce()
    })
  })

  describe('recording delegation', () => {
    it('startRecording hides the view helper and forwards target dimensions', async () => {
      const c = makeInstance({ targetWidth: 256, targetHeight: 256 })

      await c.load3d.startRecording()

      expect(c.viewHelperManager.visibleViewHelper).toHaveBeenCalledWith(false)
      expect(c.recordingManager.startRecording).toHaveBeenCalledWith(256, 256)
    })

    it('stopRecording restores the view helper and emits a status change', () => {
      ctx.load3d.stopRecording()

      expect(ctx.viewHelperManager.visibleViewHelper).toHaveBeenCalledWith(true)
      expect(ctx.recordingManager.stopRecording).toHaveBeenCalledOnce()
      expect(ctx.eventManager.emitEvent).toHaveBeenCalledWith(
        'recordingStatusChange',
        false
      )
    })

    it('isRecording, getRecordingDuration, getRecordingData delegate to recordingManager', () => {
      ctx.recordingManager.getIsRecording.mockReturnValue(true)
      ctx.recordingManager.getRecordingDuration.mockReturnValue(7)
      ctx.recordingManager.getRecordingData.mockReturnValue('data:video/mp4')

      expect(ctx.load3d.isRecording()).toBe(true)
      expect(ctx.load3d.getRecordingDuration()).toBe(7)
      expect(ctx.load3d.getRecordingData()).toBe('data:video/mp4')
    })

    it('exportRecording forwards the filename argument', () => {
      ctx.load3d.exportRecording('video.mp4')
      expect(ctx.recordingManager.exportRecording).toHaveBeenCalledWith(
        'video.mp4'
      )
    })

    it('clearRecording delegates', () => {
      ctx.load3d.clearRecording()
      expect(ctx.recordingManager.clearRecording).toHaveBeenCalledOnce()
    })
  })

  describe('event listener delegation', () => {
    it('addEventListener / removeEventListener forward to eventManager', () => {
      const cb = vi.fn()
      ctx.load3d.addEventListener('foo', cb)
      ctx.load3d.removeEventListener('foo', cb)

      expect(ctx.eventManager.addEventListener).toHaveBeenCalledWith('foo', cb)
      expect(ctx.eventManager.removeEventListener).toHaveBeenCalledWith(
        'foo',
        cb
      )
    })
  })

  describe('loadModel flow', () => {
    it('resets camera/controls/gizmo/model/animation before invoking the loader', async () => {
      const order: string[] = []
      ctx.cameraManager.reset.mockImplementation(() => order.push('camera'))
      ctx.controlsManager.reset.mockImplementation(() => order.push('controls'))
      ctx.gizmo.detach.mockImplementation(() => order.push('gizmo'))
      ctx.modelManager.clearModel.mockImplementation(() => order.push('model'))
      ctx.animationManager.dispose.mockImplementation(() =>
        order.push('animation')
      )
      ctx.loaderManager.loadModel.mockImplementation(() => {
        order.push('load')
        return Promise.resolve()
      })

      await ctx.load3d.loadModel('url', 'file.glb')

      expect(order).toEqual([
        'camera',
        'controls',
        'gizmo',
        'model',
        'animation',
        'load'
      ])
      expect(ctx.loaderManager.loadModel).toHaveBeenCalledWith(
        'url',
        'file.glb'
      )
      expect(ctx.handleResize).toHaveBeenCalledOnce()
    })

    it('sets up animations when the loader produces a model', async () => {
      const obj = new THREE.Object3D()
      const originalModel = { foo: 'bar' }
      ctx.loaderManager.loadModel.mockImplementation(async () => {
        ctx.modelManager.currentModel = obj
        ctx.modelManager.originalModel = originalModel
      })

      await ctx.load3d.loadModel('url')

      expect(ctx.animationManager.setupModelAnimations).toHaveBeenCalledWith(
        obj,
        originalModel
      )
    })

    it('skips animation setup when the loader does not produce a model', async () => {
      await ctx.load3d.loadModel('url')
      expect(ctx.animationManager.setupModelAnimations).not.toHaveBeenCalled()
    })

    it('awaits the previous loading promise before starting a new load', async () => {
      let resolvePrev!: () => void
      const prev = new Promise<void>((r) => {
        resolvePrev = r
      })
      ;(
        ctx.load3d as unknown as { loadingPromise: Promise<void> | null }
      ).loadingPromise = prev

      const loadPromise = ctx.load3d.loadModel('url')
      expect(ctx.loaderManager.loadModel).not.toHaveBeenCalled()

      resolvePrev()
      await loadPromise

      expect(ctx.loaderManager.loadModel).toHaveBeenCalledOnce()
    })

    it('swallows rejections from the previous loading promise', async () => {
      const prev = Promise.reject(new Error('prev failed'))
      ;(
        ctx.load3d as unknown as { loadingPromise: Promise<void> | null }
      ).loadingPromise = prev

      await expect(ctx.load3d.loadModel('url')).resolves.toBeUndefined()
    })
  })

  describe('exportModel', () => {
    beforeEach(() => {
      ctx.modelManager.currentModel = new THREE.Object3D()
      ctx.modelManager.originalFileName = 'cube'
      ctx.modelManager.originalURL = 'http://example.com/cube.glb'
    })

    it('throws when no model is loaded', async () => {
      ctx.modelManager.currentModel = null

      await expect(ctx.load3d.exportModel('glb')).rejects.toThrow(
        'No model to export'
      )
    })

    it('emits exportLoadingStart and Exit events around a GLB export', async () => {
      await ctx.load3d.exportModel('glb')

      expect(ctx.eventManager.emitEvent).toHaveBeenCalledWith(
        'exportLoadingStart',
        'Exporting as GLB...'
      )
      expect(ctx.eventManager.emitEvent).toHaveBeenCalledWith(
        'exportLoadingEnd',
        null
      )
      expect(ModelExporter.exportGLB).toHaveBeenCalledWith(
        expect.any(THREE.Object3D),
        'cube.glb',
        'http://example.com/cube.glb'
      )
    })

    it('dispatches to exportOBJ for the obj format', async () => {
      await ctx.load3d.exportModel('obj')
      expect(ModelExporter.exportOBJ).toHaveBeenCalled()
    })

    it('dispatches to exportSTL for the stl format', async () => {
      await ctx.load3d.exportModel('stl')
      expect(ModelExporter.exportSTL).toHaveBeenCalled()
    })

    it('throws for an unsupported format and still emits exportLoadingEnd', async () => {
      await expect(ctx.load3d.exportModel('abc')).rejects.toThrow(
        'Unsupported export format: abc'
      )

      expect(ctx.eventManager.emitEvent).toHaveBeenCalledWith(
        'exportLoadingEnd',
        null
      )
    })

    it('falls back to "model" as filename base when originalFileName is missing', async () => {
      ctx.modelManager.originalFileName = null
      await ctx.load3d.exportModel('glb')

      expect(ModelExporter.exportGLB).toHaveBeenCalledWith(
        expect.any(THREE.Object3D),
        'model.glb',
        'http://example.com/cube.glb'
      )
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

  describe('captureThumbnail', () => {
    it('throws when no model is loaded', async () => {
      await expect(ctx.load3d.captureThumbnail()).rejects.toThrow(
        'No model loaded for thumbnail capture'
      )
    })

    it('captures the scene and restores grid visibility after success', async () => {
      ctx.modelManager.currentModel = new THREE.Object3D()
      ctx.sceneManager.gridHelper.visible = true
      ctx.sceneManager.captureScene.mockResolvedValue({
        scene: 'data:image/png;base64,abc',
        mask: '',
        normal: ''
      })

      const result = await ctx.load3d.captureThumbnail(128, 128)

      expect(ctx.sceneManager.captureScene).toHaveBeenCalledWith(128, 128)
      expect(ctx.sceneManager.gridHelper.visible).toBe(true)
      expect(result).toBe('data:image/png;base64,abc')
    })

    it('temporarily switches to perspective and restores the camera type and state', async () => {
      ctx.modelManager.currentModel = new THREE.Object3D()
      ctx.cameraManager.getCurrentCameraType.mockReturnValue('orthographic')
      const savedState = {
        position: new THREE.Vector3(0, 0, 0),
        target: new THREE.Vector3(0, 0, 0),
        zoom: 1,
        cameraType: 'orthographic' as const
      }
      ctx.cameraManager.getCameraState.mockReturnValue(savedState)
      ctx.sceneManager.captureScene.mockResolvedValue({
        scene: 'img',
        mask: '',
        normal: ''
      })

      await ctx.load3d.captureThumbnail()

      expect(ctx.cameraManager.toggleCamera).toHaveBeenNthCalledWith(
        1,
        'perspective'
      )
      expect(ctx.cameraManager.toggleCamera).toHaveBeenNthCalledWith(
        2,
        'orthographic'
      )
      expect(ctx.cameraManager.setCameraState).toHaveBeenCalledWith(savedState)
    })

    it('restores camera and grid state even when capture fails', async () => {
      ctx.modelManager.currentModel = new THREE.Object3D()
      ctx.sceneManager.gridHelper.visible = true
      ctx.cameraManager.getCurrentCameraType.mockReturnValue('orthographic')
      const savedState = {
        position: new THREE.Vector3(0, 0, 0),
        target: new THREE.Vector3(0, 0, 0),
        zoom: 1,
        cameraType: 'orthographic' as const
      }
      ctx.cameraManager.getCameraState.mockReturnValue(savedState)
      const err = new Error('capture failed')
      ctx.sceneManager.captureScene.mockRejectedValue(err)

      await expect(ctx.load3d.captureThumbnail()).rejects.toBe(err)

      expect(ctx.sceneManager.gridHelper.visible).toBe(true)
      expect(ctx.cameraManager.toggleCamera).toHaveBeenNthCalledWith(
        2,
        'orthographic'
      )
      expect(ctx.cameraManager.setCameraState).toHaveBeenCalledWith(savedState)
    })
  })

  describe('handleResize', () => {
    function makeForResize(
      opts: Omit<MakeInstanceOptions, 'stubHandleResize'>
    ) {
      return makeInstance({ ...opts, stubHandleResize: false })
    }

    it('warns and returns when the canvas has no parent element', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const c = makeForResize({})
      c.renderer.domElement.remove()

      c.load3d.handleResize()

      expect(warnSpy).toHaveBeenCalled()
      expect(c.cameraManager.handleResize).not.toHaveBeenCalled()
      expect(c.sceneManager.handleResize).not.toHaveBeenCalled()
      warnSpy.mockRestore()
    })

    it('uses the container dimensions when no aspect ratio is enforced', () => {
      const c = makeForResize({})
      c.load3d.handleResize()

      expect(c.renderer.setSize).toHaveBeenCalledWith(800, 600)
      expect(c.cameraManager.handleResize).toHaveBeenCalledWith(800, 600)
      expect(c.sceneManager.handleResize).toHaveBeenCalledWith(800, 600)
      expect(c.forceRender).toHaveBeenCalledOnce()
    })

    it('letterboxes to the target aspect ratio when one is configured', () => {
      const c = makeForResize({ targetWidth: 400, targetHeight: 400 })
      c.load3d.handleResize()

      expect(c.renderer.setSize).toHaveBeenCalledWith(800, 600)
      expect(c.cameraManager.handleResize).toHaveBeenCalledWith(600, 600)
      expect(c.sceneManager.handleResize).toHaveBeenCalledWith(600, 600)
    })

    it('reads target dimensions from the dynamic getDimensions callback', () => {
      const getDimensions = vi.fn(() => ({ width: 100, height: 100 }))
      const c = makeForResize({ getDimensionsCallback: getDimensions })

      c.load3d.handleResize()

      expect(getDimensions).toHaveBeenCalled()
      expect(c.load3d.getTargetSize()).toEqual({ width: 100, height: 100 })
      expect(c.cameraManager.handleResize).toHaveBeenCalledWith(600, 600)
    })
  })

  describe('renderMainScene', () => {
    function makeForRender(
      opts: Omit<MakeInstanceOptions, 'stubForceRender'> = {}
    ) {
      return makeInstance({ ...opts, stubForceRender: false })
    }

    it('fills the container when no aspect ratio is enforced', () => {
      const c = makeForRender()

      c.load3d.renderMainScene()

      expect(c.renderer.setViewport).toHaveBeenCalledWith(0, 0, 800, 600)
      expect(c.renderer.setScissor).toHaveBeenCalledWith(0, 0, 800, 600)
      expect(c.renderer.setScissorTest).toHaveBeenCalledWith(true)
      expect(c.cameraManager.updateAspectRatio).not.toHaveBeenCalled()
      expect(c.sceneManager.renderBackground).toHaveBeenCalled()
      expect(c.renderer.render).toHaveBeenCalledWith(
        c.sceneManager.scene,
        c.cameraManager.activeCamera
      )
    })

    it('letterboxes and updates camera aspect ratio when a target aspect ratio is set', () => {
      const c = makeForRender({ targetWidth: 400, targetHeight: 400 })

      c.load3d.renderMainScene()

      expect(c.renderer.setClearColor).toHaveBeenCalled()
      expect(c.renderer.clear).toHaveBeenCalled()
      expect(c.renderer.setViewport).toHaveBeenLastCalledWith(100, 0, 600, 600)
      expect(c.cameraManager.updateAspectRatio).toHaveBeenCalledWith(1)
    })

    it('uses the dynamic getDimensions callback to update the target aspect ratio', () => {
      const getDimensions = vi.fn(() => ({ width: 320, height: 160 }))
      const c = makeForRender({ getDimensionsCallback: getDimensions })

      c.load3d.renderMainScene()

      expect(getDimensions).toHaveBeenCalled()
      expect(c.cameraManager.updateAspectRatio).toHaveBeenCalledWith(2)
    })
  })

  describe('forceRender', () => {
    it('performs a frame and sets the initial-render flag', () => {
      const c = makeInstance({ stubForceRender: false })
      expect(c.load3d.INITIAL_RENDER_DONE).toBe(false)

      c.load3d.forceRender()

      expect(c.renderer.render).toHaveBeenCalled()
      expect(c.viewHelperManager.update).toHaveBeenCalled()
      expect(c.controlsManager.update).toHaveBeenCalled()
      expect(c.animationManager.update).toHaveBeenCalled()
      expect(c.load3d.INITIAL_RENDER_DONE).toBe(true)
    })
  })

  describe('remove', () => {
    it('disposes all managers and tears down the renderer', () => {
      const canvasRemoveSpy = vi.spyOn(ctx.renderer.domElement, 'remove')
      const dispatchSpy = vi.spyOn(ctx.renderer.domElement, 'dispatchEvent')

      ctx.load3d.remove()

      expect(ctx.renderer.forceContextLoss).toHaveBeenCalledOnce()
      expect(dispatchSpy).toHaveBeenCalled()
      expect(ctx.sceneManager.dispose).toHaveBeenCalledOnce()
      expect(ctx.cameraManager.dispose).toHaveBeenCalledOnce()
      expect(ctx.controlsManager.dispose).toHaveBeenCalledOnce()
      expect(ctx.lightingManager.dispose).toHaveBeenCalledOnce()
      expect(ctx.hdriManager.dispose).toHaveBeenCalledOnce()
      expect(ctx.viewHelperManager.dispose).toHaveBeenCalledOnce()
      expect(ctx.loaderManager.dispose).toHaveBeenCalledOnce()
      expect(ctx.modelManager.dispose).toHaveBeenCalledOnce()
      expect(ctx.recordingManager.dispose).toHaveBeenCalledOnce()
      expect(ctx.animationManager.dispose).toHaveBeenCalledOnce()
      expect(ctx.gizmo.dispose).toHaveBeenCalledOnce()
      expect(ctx.renderer.dispose).toHaveBeenCalledOnce()
      expect(canvasRemoveSpy).toHaveBeenCalledOnce()
    })

    it('disconnects the ResizeObserver if one was attached', () => {
      const disconnect = vi.fn()
      ;(
        ctx.load3d as unknown as { resizeObserver: { disconnect: () => void } }
      ).resizeObserver = { disconnect }

      ctx.load3d.remove()

      expect(disconnect).toHaveBeenCalledOnce()
    })

    it('invokes the context menu guard dispose callback', () => {
      const disposeGuard = vi.fn()
      ;(
        ctx.load3d as unknown as { disposeContextMenuGuard: () => void }
      ).disposeContextMenuGuard = disposeGuard

      ctx.load3d.remove()

      expect(disposeGuard).toHaveBeenCalledOnce()
    })

    it('stops the render loop if one was running', () => {
      const stop = vi.fn()
      ;(
        ctx.load3d as unknown as { renderLoop: { stop: () => void } }
      ).renderLoop = { stop }

      ctx.load3d.remove()

      expect(stop).toHaveBeenCalledOnce()
    })
  })
})
