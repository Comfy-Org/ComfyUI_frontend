import * as THREE from 'three'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import Load3d from '@/extensions/core/load3d/Load3d'
import type { GizmoMode } from '@/extensions/core/load3d/interfaces'

type GizmoStub = {
  setEnabled: ReturnType<typeof vi.fn>
  setMode: ReturnType<typeof vi.fn>
  reset: ReturnType<typeof vi.fn>
  applyTransform: ReturnType<typeof vi.fn>
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

type Load3dPrivate = {
  setGizmo(model: THREE.Object3D): void
  setupCamera(size: THREE.Vector3, center: THREE.Vector3): void
}

function makeGizmoStub(): GizmoStub {
  return {
    setEnabled: vi.fn(),
    setMode: vi.fn(),
    reset: vi.fn(),
    applyTransform: vi.fn(),
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
  const load3d = Object.create(Load3d.prototype) as Load3d
  Object.assign(load3d, {
    gizmoManager: gizmo,
    modelManager,
    cameraManager,
    sceneManager,
    controlsManager,
    viewHelperManager,
    animationManager,
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
    })

    it('setGizmo (private) forwards the model to gizmoManager.setupForModel', () => {
      const model = new THREE.Object3D()

      ;(ctx.load3d as unknown as Load3dPrivate).setGizmo(model)

      expect(ctx.gizmo.setupForModel).toHaveBeenCalledWith(model)
    })

    it('setupCamera (private) forwards size and center to cameraManager', () => {
      const size = new THREE.Vector3(1, 2, 3)
      const center = new THREE.Vector3(4, 5, 6)

      ;(ctx.load3d as unknown as Load3dPrivate).setupCamera(size, center)

      expect(ctx.cameraManager.setupForModel).toHaveBeenCalledWith(size, center)
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
})
