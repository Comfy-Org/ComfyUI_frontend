import * as THREE from 'three'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { GizmoManager } from './GizmoManager'

const { mockSetMode, mockAttach, mockDetach, mockGetHelper, mockDispose } =
  vi.hoisted(() => ({
    mockSetMode: vi.fn(),
    mockAttach: vi.fn(),
    mockDetach: vi.fn(),
    mockGetHelper: vi.fn(),
    mockDispose: vi.fn()
  }))

vi.mock('three/examples/jsm/controls/TransformControls', () => {
  class TransformControls {
    enabled = true
    camera: THREE.Camera
    private listeners = new Map<string, ((e: unknown) => void)[]>()

    constructor(camera: THREE.Camera) {
      this.camera = camera
    }

    addEventListener(event: string, cb: (e: unknown) => void) {
      if (!this.listeners.has(event)) this.listeners.set(event, [])
      this.listeners.get(event)!.push(cb)
    }

    setMode = mockSetMode
    attach = mockAttach
    detach = mockDetach
    getHelper = mockGetHelper
    dispose = mockDispose

    emit(event: string, data: unknown) {
      for (const cb of this.listeners.get(event) ?? []) cb(data)
    }
  }
  return { TransformControls }
})

vi.mock('three/examples/jsm/controls/OrbitControls', () => {
  class OrbitControls {
    enabled = true
  }
  return { OrbitControls }
})

function makeMockOrbitControls() {
  return { enabled: true } as unknown as InstanceType<
    typeof import('three/examples/jsm/controls/OrbitControls').OrbitControls
  >
}

describe('GizmoManager', () => {
  let scene: THREE.Scene
  let renderer: THREE.WebGLRenderer
  let camera: THREE.PerspectiveCamera
  let orbitControls: ReturnType<typeof makeMockOrbitControls>
  let manager: GizmoManager
  let onTransformChange: () => void
  let mockHelper: THREE.Object3D

  beforeEach(() => {
    vi.clearAllMocks()

    scene = new THREE.Scene()
    renderer = {
      domElement: document.createElement('canvas')
    } as unknown as THREE.WebGLRenderer
    camera = new THREE.PerspectiveCamera()
    orbitControls = makeMockOrbitControls()
    onTransformChange = vi.fn()

    mockHelper = new THREE.Object3D()
    mockHelper.name = ''
    mockHelper.renderOrder = 0
    mockGetHelper.mockReturnValue(mockHelper)

    manager = new GizmoManager(
      scene,
      renderer,
      orbitControls,
      () => camera,
      onTransformChange
    )
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('init', () => {
    it('adds helper to scene with correct name and render order', () => {
      manager.init()

      expect(mockGetHelper).toHaveBeenCalled()
      expect(mockHelper.name).toBe('GizmoTransformControls')
      expect(mockHelper.renderOrder).toBe(999)
      expect(scene.children).toContain(mockHelper)
    })
  })

  describe('setupForModel', () => {
    it('attaches to model and stores initial transform when enabled', () => {
      manager.init()
      manager.setEnabled(true)

      const model = new THREE.Object3D()
      model.position.set(1, 2, 3)
      model.rotation.set(0.1, 0.2, 0.3)

      manager.setupForModel(model)

      expect(mockDetach).toHaveBeenCalled()
      expect(mockAttach).toHaveBeenCalledWith(model)
      expect(mockSetMode).toHaveBeenCalledWith('translate')
    })

    it('does not attach when disabled', () => {
      manager.init()

      const model = new THREE.Object3D()
      manager.setupForModel(model)

      expect(mockAttach).not.toHaveBeenCalled()
    })

    it('does nothing before init', () => {
      const model = new THREE.Object3D()
      manager.setupForModel(model)

      expect(mockDetach).not.toHaveBeenCalled()
    })
  })

  describe('setEnabled', () => {
    it('attaches to target when enabled with a target', () => {
      manager.init()
      const model = new THREE.Object3D()
      manager.setupForModel(model)

      vi.mocked(mockAttach).mockClear()
      manager.setEnabled(true)

      expect(mockAttach).toHaveBeenCalledWith(model)
      expect(manager.isEnabled()).toBe(true)
    })

    it('detaches when disabled', () => {
      manager.init()
      const model = new THREE.Object3D()
      manager.setupForModel(model)
      manager.setEnabled(true)

      vi.mocked(mockDetach).mockClear()
      manager.setEnabled(false)

      expect(mockDetach).toHaveBeenCalled()
      expect(manager.isEnabled()).toBe(false)
    })

    it('does nothing before init', () => {
      manager.setEnabled(true)
      expect(mockAttach).not.toHaveBeenCalled()
    })
  })

  describe('detach', () => {
    it('detaches and clears target', () => {
      manager.init()
      const model = new THREE.Object3D()
      manager.setupForModel(model)
      manager.setEnabled(true)

      vi.mocked(mockDetach).mockClear()
      manager.detach()

      expect(mockDetach).toHaveBeenCalled()
      expect(manager.isEnabled()).toBe(false)
    })
  })

  describe('setMode / getMode', () => {
    it('defaults to translate', () => {
      expect(manager.getMode()).toBe('translate')
    })

    it('switches to rotate', () => {
      manager.init()
      manager.setMode('rotate')

      expect(manager.getMode()).toBe('rotate')
      expect(mockSetMode).toHaveBeenCalledWith('rotate')
    })

    it('stores mode before init', () => {
      manager.setMode('rotate')
      expect(manager.getMode()).toBe('rotate')
    })
  })

  describe('reset', () => {
    it('restores initial position, rotation, and scale', () => {
      manager.init()
      const model = new THREE.Object3D()
      model.position.set(1, 2, 3)
      model.rotation.set(0.1, 0.2, 0.3)
      model.scale.set(2, 2, 2)

      manager.setupForModel(model)

      model.position.set(10, 20, 30)
      model.rotation.set(1, 2, 3)
      model.scale.set(5, 5, 5)

      manager.reset()

      expect(model.position.x).toBeCloseTo(1)
      expect(model.position.y).toBeCloseTo(2)
      expect(model.position.z).toBeCloseTo(3)
      expect(model.rotation.x).toBeCloseTo(0.1)
      expect(model.rotation.y).toBeCloseTo(0.2)
      expect(model.rotation.z).toBeCloseTo(0.3)
      expect(model.scale.x).toBeCloseTo(2)
      expect(model.scale.y).toBeCloseTo(2)
      expect(model.scale.z).toBeCloseTo(2)
    })

    it('does nothing without a target', () => {
      manager.init()
      expect(() => manager.reset()).not.toThrow()
    })

    it('invokes onTransformChange after resetting', () => {
      manager.init()
      const model = new THREE.Object3D()
      model.position.set(1, 2, 3)
      manager.setupForModel(model)

      expect(onTransformChange).not.toHaveBeenCalled()

      manager.reset()

      expect(onTransformChange).toHaveBeenCalledOnce()
    })
  })

  describe('applyTransform', () => {
    it('sets position and rotation on target', () => {
      manager.init()
      const model = new THREE.Object3D()
      manager.setupForModel(model)

      manager.applyTransform({ x: 5, y: 6, z: 7 }, { x: 0.5, y: 0.6, z: 0.7 })

      expect(model.position.x).toBeCloseTo(5)
      expect(model.position.y).toBeCloseTo(6)
      expect(model.position.z).toBeCloseTo(7)
      expect(model.rotation.x).toBeCloseTo(0.5)
      expect(model.rotation.y).toBeCloseTo(0.6)
      expect(model.rotation.z).toBeCloseTo(0.7)
    })

    it('applies scale when provided', () => {
      manager.init()
      const model = new THREE.Object3D()
      manager.setupForModel(model)

      manager.applyTransform(
        { x: 0, y: 0, z: 0 },
        { x: 0, y: 0, z: 0 },
        { x: 2, y: 3, z: 4 }
      )

      expect(model.scale.x).toBeCloseTo(2)
      expect(model.scale.y).toBeCloseTo(3)
      expect(model.scale.z).toBeCloseTo(4)
    })

    it('does nothing without a target', () => {
      manager.init()
      expect(() =>
        manager.applyTransform({ x: 1, y: 2, z: 3 }, { x: 0, y: 0, z: 0 })
      ).not.toThrow()
    })
  })

  describe('getTransform', () => {
    it('returns current target transform', () => {
      manager.init()
      const model = new THREE.Object3D()
      model.position.set(1, 2, 3)
      model.rotation.set(0.1, 0.2, 0.3)
      model.scale.set(4, 5, 6)
      manager.setupForModel(model)

      const transform = manager.getTransform()

      expect(transform.position).toEqual({ x: 1, y: 2, z: 3 })
      expect(transform.rotation.x).toBeCloseTo(0.1)
      expect(transform.rotation.y).toBeCloseTo(0.2)
      expect(transform.rotation.z).toBeCloseTo(0.3)
      expect(transform.scale).toEqual({ x: 4, y: 5, z: 6 })
    })

    it('returns zero/identity when no target', () => {
      const transform = manager.getTransform()

      expect(transform.position).toEqual({ x: 0, y: 0, z: 0 })
      expect(transform.rotation).toEqual({ x: 0, y: 0, z: 0 })
      expect(transform.scale).toEqual({ x: 1, y: 1, z: 1 })
    })
  })

  describe('removeFromScene / ensureHelperInScene', () => {
    it('removes helper from scene', () => {
      manager.init()
      expect(scene.children).toContain(mockHelper)

      manager.removeFromScene()

      expect(scene.children).not.toContain(mockHelper)
    })

    it('restores helper to scene', () => {
      manager.init()
      manager.removeFromScene()

      manager.ensureHelperInScene()

      expect(scene.children).toContain(mockHelper)
    })
  })

  describe('dispose', () => {
    it('removes helper, detaches, and disposes controls', () => {
      manager.init()
      scene.add(mockHelper)

      manager.dispose()

      expect(mockDetach).toHaveBeenCalled()
      expect(mockDispose).toHaveBeenCalled()
    })

    it('is safe to call before init', () => {
      expect(() => manager.dispose()).not.toThrow()
    })
  })

  describe('ensureHelperInScene', () => {
    it('re-adds helper if it was removed from its parent', () => {
      manager.init()
      // Simulate helper being removed from scene
      scene.remove(mockHelper)
      expect(scene.children).not.toContain(mockHelper)

      // setEnabled triggers ensureHelperInScene internally
      const model = new THREE.Object3D()
      manager.setupForModel(model)
      manager.setEnabled(true)

      expect(scene.children).toContain(mockHelper)
    })
  })
})
