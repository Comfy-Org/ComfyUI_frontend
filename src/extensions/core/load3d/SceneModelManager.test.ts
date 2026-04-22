import * as THREE from 'three'
import { describe, expect, it, vi } from 'vitest'

import type { EventManagerInterface } from './interfaces'
import { SceneModelManager } from './SceneModelManager'

function createMockRenderer(): THREE.WebGLRenderer {
  return {
    outputColorSpace: THREE.SRGBColorSpace,
    dispose: vi.fn()
  } as unknown as THREE.WebGLRenderer
}

function createMockEventManager(): EventManagerInterface {
  return {
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    emitEvent: vi.fn()
  }
}

function createManager(
  overrides: {
    scene?: THREE.Scene
    eventManager?: EventManagerInterface
  } = {}
) {
  const scene = overrides.scene ?? new THREE.Scene()
  const renderer = createMockRenderer()
  const eventManager = overrides.eventManager ?? createMockEventManager()
  const camera = new THREE.PerspectiveCamera()
  const getActiveCamera = () => camera
  const setupCamera = vi.fn()
  const setupGizmo = vi.fn()

  const manager = new SceneModelManager(
    scene,
    renderer,
    eventManager,
    getActiveCamera,
    setupCamera,
    setupGizmo
  )

  return {
    manager,
    scene,
    renderer,
    eventManager,
    camera,
    setupCamera,
    setupGizmo
  }
}

function createMeshModel(name = 'TestModel'): THREE.Group {
  const geometry = new THREE.BoxGeometry(1, 1, 1)
  const material = new THREE.MeshStandardMaterial({ color: 0xff0000 })
  const mesh = new THREE.Mesh(geometry, material)
  const group = new THREE.Group()
  group.name = name
  group.add(mesh)
  return group
}

describe('SceneModelManager', () => {
  describe('constructor', () => {
    it('initializes default state', () => {
      const { manager } = createManager()

      expect(manager.currentModel).toBeNull()
      expect(manager.originalModel).toBeNull()
      expect(manager.originalRotation).toBeNull()
      expect(manager.currentUpDirection).toBe('original')
      expect(manager.materialMode).toBe('original')
      expect(manager.originalFileName).toBeNull()
      expect(manager.originalURL).toBeNull()
      expect(manager.appliedTexture).toBeNull()
      expect(manager.skeletonHelper).toBeNull()
      expect(manager.showSkeleton).toBe(false)
    })

    it('creates material instances', () => {
      const { manager } = createManager()

      expect(manager.normalMaterial).toBeInstanceOf(THREE.MeshNormalMaterial)
      expect(manager.wireframeMaterial).toBeInstanceOf(THREE.MeshBasicMaterial)
      expect(manager.wireframeMaterial.wireframe).toBe(true)
      expect(manager.depthMaterial).toBeInstanceOf(THREE.MeshDepthMaterial)
      expect(manager.standardMaterial).toBeInstanceOf(
        THREE.MeshStandardMaterial
      )
    })
  })

  describe('dispose', () => {
    it('disposes all materials', () => {
      const { manager } = createManager()

      const normalDispose = vi.spyOn(manager.normalMaterial, 'dispose')
      const standardDispose = vi.spyOn(manager.standardMaterial, 'dispose')
      const wireframeDispose = vi.spyOn(manager.wireframeMaterial, 'dispose')
      const depthDispose = vi.spyOn(manager.depthMaterial, 'dispose')

      manager.dispose()

      expect(normalDispose).toHaveBeenCalled()
      expect(standardDispose).toHaveBeenCalled()
      expect(wireframeDispose).toHaveBeenCalled()
      expect(depthDispose).toHaveBeenCalled()
    })

    it('disposes applied texture', () => {
      const { manager } = createManager()
      const texture = new THREE.Texture()
      const textureDispose = vi.spyOn(texture, 'dispose')
      manager.appliedTexture = texture

      manager.dispose()

      expect(textureDispose).toHaveBeenCalled()
      expect(manager.appliedTexture).toBeNull()
    })
  })

  describe('createSTLMaterial', () => {
    it('returns a MeshStandardMaterial with expected properties', () => {
      const { manager } = createManager()
      const mat = manager.createSTLMaterial()

      expect(mat).toBeInstanceOf(THREE.MeshStandardMaterial)
      expect(mat.color.getHex()).toBe(0x808080)
      expect(mat.metalness).toBe(0.1)
      expect(mat.roughness).toBe(0.8)
      expect(mat.side).toBe(THREE.DoubleSide)
    })
  })

  describe('addModelToScene', () => {
    it('adds the model to the scene and sets currentModel', () => {
      const { manager, scene } = createManager()
      const model = createMeshModel()

      manager.addModelToScene(model)

      expect(manager.currentModel).toBe(model)
      expect(model.name).toBe('MainModel')
      expect(scene.children).toContain(model)
    })
  })

  describe('setupModel', () => {
    it('scales and positions the model, then adds to scene', async () => {
      const { manager, scene, setupCamera } = createManager()
      const model = createMeshModel()

      await manager.setupModel(model)

      expect(manager.currentModel).toBe(model)
      expect(model.name).toBe('MainModel')
      expect(scene.children).toContain(model)
      expect(setupCamera).toHaveBeenCalled()
    })

    it('does not skip materialMode when it differs from original', async () => {
      const { manager } = createManager()
      const model = createMeshModel()

      // setupModel checks materialMode !== 'original' and calls
      // setMaterialMode, but the guard `mode === this.materialMode`
      // causes it to no-op. Then setupModelMaterials resets to 'original'.
      manager.materialMode = 'wireframe'
      const spy = vi.spyOn(manager, 'setMaterialMode')
      await manager.setupModel(model)

      // setMaterialMode is called with the stored mode and then 'original'
      expect(spy).toHaveBeenCalledWith('wireframe')
      expect(spy).toHaveBeenCalledWith('original')
    })

    it('applies current up direction if not original', async () => {
      const { manager, eventManager } = createManager()
      const model = createMeshModel()

      manager.currentUpDirection = '+z'
      await manager.setupModel(model)

      expect(eventManager.emitEvent).toHaveBeenCalledWith(
        'upDirectionChange',
        '+z'
      )
    })
  })

  describe('setOriginalModel', () => {
    it('stores the original model reference', () => {
      const { manager } = createManager()
      const model = new THREE.Group()

      manager.setOriginalModel(model)

      expect(manager.originalModel).toBe(model)
    })
  })

  describe('clearModel', () => {
    it('removes non-environment objects from scene', async () => {
      const { manager, scene } = createManager()
      const model = createMeshModel()
      await manager.setupModel(model)

      const light = new THREE.DirectionalLight()
      scene.add(light)

      manager.clearModel()

      expect(manager.currentModel).toBeNull()
      expect(scene.children).toContain(light)
    })

    it('disposes mesh geometry and materials', async () => {
      const { manager } = createManager()
      const model = createMeshModel()
      const mesh = model.children[0] as THREE.Mesh
      const geoDispose = vi.spyOn(mesh.geometry, 'dispose')
      const matDispose = vi.spyOn(mesh.material as THREE.Material, 'dispose')

      await manager.setupModel(model)
      manager.clearModel()

      expect(geoDispose).toHaveBeenCalled()
      expect(matDispose).toHaveBeenCalled()
    })
  })

  describe('reset', () => {
    it('resets all state to defaults', async () => {
      const { manager } = createManager()
      const model = createMeshModel()
      await manager.setupModel(model)
      manager.originalFileName = 'test.glb'
      manager.originalURL = 'http://example.com/test.glb'
      manager.originalModel = model

      manager.reset()

      expect(manager.currentModel).toBeNull()
      expect(manager.originalModel).toBeNull()
      expect(manager.originalRotation).toBeNull()
      expect(manager.currentUpDirection).toBe('original')
      expect(manager.originalFileName).toBeNull()
      expect(manager.originalURL).toBeNull()
    })

    it('disposes applied texture', () => {
      const { manager } = createManager()
      const texture = new THREE.Texture()
      const textureDispose = vi.spyOn(texture, 'dispose')
      manager.appliedTexture = texture

      manager.reset()

      expect(textureDispose).toHaveBeenCalled()
      expect(manager.appliedTexture).toBeNull()
    })

    it('removes and disposes skeleton helper', async () => {
      const { manager, scene } = createManager()
      const model = createMeshModel()
      await manager.setupModel(model)

      const mockHelper = new THREE.SkeletonHelper(model)
      const helperDispose = vi.spyOn(mockHelper, 'dispose')
      manager.skeletonHelper = mockHelper
      scene.add(mockHelper)

      manager.reset()

      expect(helperDispose).toHaveBeenCalled()
      expect(manager.skeletonHelper).toBeNull()
      expect(manager.showSkeleton).toBe(false)
    })
  })

  describe('setMaterialMode', () => {
    it('does nothing when no current model', () => {
      const { manager, eventManager } = createManager()

      manager.setMaterialMode('normal')

      expect(eventManager.emitEvent).not.toHaveBeenCalled()
    })

    it('does nothing when mode is unchanged', async () => {
      const { manager, eventManager } = createManager()
      const model = createMeshModel()
      await manager.setupModel(model)
      vi.mocked(eventManager.emitEvent).mockClear()

      manager.setMaterialMode('original')

      expect(eventManager.emitEvent).not.toHaveBeenCalled()
    })

    it('switches to normal material', async () => {
      const { manager, eventManager } = createManager()
      const model = createMeshModel()
      await manager.setupModel(model)

      manager.setMaterialMode('normal')

      const mesh = model.children[0] as THREE.Mesh
      expect(mesh.material).toBeInstanceOf(THREE.MeshNormalMaterial)
      expect(manager.materialMode).toBe('normal')
      expect(eventManager.emitEvent).toHaveBeenCalledWith(
        'materialModeChange',
        'normal'
      )
    })

    it('switches to wireframe material', async () => {
      const { manager, eventManager } = createManager()
      const model = createMeshModel()
      await manager.setupModel(model)

      manager.setMaterialMode('wireframe')

      const mesh = model.children[0] as THREE.Mesh
      expect(mesh.material).toBeInstanceOf(THREE.MeshBasicMaterial)
      expect((mesh.material as THREE.MeshBasicMaterial).wireframe).toBe(true)
      expect(eventManager.emitEvent).toHaveBeenCalledWith(
        'materialModeChange',
        'wireframe'
      )
    })

    it('switches to depth material', async () => {
      const { manager, renderer } = createManager()
      const model = createMeshModel()
      await manager.setupModel(model)

      manager.setMaterialMode('depth')

      const mesh = model.children[0] as THREE.Mesh
      expect(mesh.material).toBeInstanceOf(THREE.MeshDepthMaterial)
      expect(renderer.outputColorSpace).toBe(THREE.LinearSRGBColorSpace)
    })

    it('restores original material when switching back', async () => {
      const { manager } = createManager()
      const model = createMeshModel()
      await manager.setupModel(model)
      const mesh = model.children[0] as THREE.Mesh
      const originalMat = mesh.material

      manager.setMaterialMode('normal')
      manager.setMaterialMode('original')

      expect(mesh.material).toBe(originalMat)
    })

    it('uses appliedTexture when no original material stored', async () => {
      const { manager } = createManager()
      const model = createMeshModel()
      const texture = new THREE.Texture()
      manager.appliedTexture = texture

      manager.addModelToScene(model)
      manager.materialMode = 'normal'
      manager.setMaterialMode('original')

      const mesh = model.children[0] as THREE.Mesh
      expect(mesh.material).toBeInstanceOf(THREE.MeshStandardMaterial)
      expect((mesh.material as THREE.MeshStandardMaterial).map).toBe(texture)
    })

    it('sets renderer color space to SRGB for non-depth modes', async () => {
      const { manager, renderer } = createManager()
      const model = createMeshModel()
      await manager.setupModel(model)

      manager.setMaterialMode('depth')
      expect(renderer.outputColorSpace).toBe(THREE.LinearSRGBColorSpace)

      manager.setMaterialMode('normal')
      expect(renderer.outputColorSpace).toBe(THREE.SRGBColorSpace)
    })

    it('delegates to handlePLYModeSwitch for BufferGeometry original model', async () => {
      const { manager, eventManager } = createManager()
      const model = createMeshModel()
      await manager.setupModel(model)

      manager.originalModel = new THREE.BufferGeometry()
      ;(manager.originalModel as THREE.BufferGeometry).setAttribute(
        'position',
        new THREE.Float32BufferAttribute([0, 0, 0, 1, 1, 1, 2, 2, 2], 3)
      )

      manager.setMaterialMode('wireframe')

      expect(eventManager.emitEvent).toHaveBeenCalledWith(
        'materialModeChange',
        'wireframe'
      )
    })
  })

  describe('setupModelMaterials', () => {
    it('stores original materials in the WeakMap', () => {
      const { manager } = createManager()
      const model = createMeshModel()
      const mesh = model.children[0] as THREE.Mesh
      const originalMat = mesh.material

      manager.currentModel = model
      manager.setupModelMaterials(model)

      expect(manager.originalMaterials.get(mesh)).toBe(originalMat)
    })
  })

  describe('setUpDirection', () => {
    it('does nothing when no current model', () => {
      const { manager, eventManager } = createManager()

      manager.setUpDirection('+x')

      expect(eventManager.emitEvent).not.toHaveBeenCalled()
    })

    it('stores the original rotation on first call', async () => {
      const { manager } = createManager()
      const model = createMeshModel()
      await manager.setupModel(model)

      manager.setUpDirection('+x')

      expect(manager.originalRotation).not.toBeNull()
    })

    it('applies correct rotation for each direction', async () => {
      const { manager, eventManager } = createManager()
      const model = createMeshModel()
      await manager.setupModel(model)

      const directions: Array<{
        dir: '-x' | '+x' | '-y' | '+y' | '-z' | '+z'
        axis: 'x' | 'z'
        value: number
      }> = [
        { dir: '-x', axis: 'z', value: Math.PI / 2 },
        { dir: '+x', axis: 'z', value: -Math.PI / 2 },
        { dir: '-y', axis: 'x', value: Math.PI },
        { dir: '-z', axis: 'x', value: Math.PI / 2 },
        { dir: '+z', axis: 'x', value: -Math.PI / 2 }
      ]

      for (const { dir, axis, value } of directions) {
        manager.setUpDirection(dir)
        expect(model.rotation[axis]).toBeCloseTo(value)
        expect(manager.currentUpDirection).toBe(dir)
        expect(eventManager.emitEvent).toHaveBeenCalledWith(
          'upDirectionChange',
          dir
        )
      }
    })

    it('restores original rotation before applying new direction', async () => {
      const { manager } = createManager()
      const model = createMeshModel()
      await manager.setupModel(model)

      manager.setUpDirection('+x')
      const zAfterX = model.rotation.z

      manager.setUpDirection('-z')
      expect(model.rotation.x).toBeCloseTo(Math.PI / 2)
      expect(model.rotation.z).not.toBeCloseTo(zAfterX)
    })

    it('emits upDirectionChange event', async () => {
      const { manager, eventManager } = createManager()
      const model = createMeshModel()
      await manager.setupModel(model)

      manager.setUpDirection('original')

      expect(eventManager.emitEvent).toHaveBeenCalledWith(
        'upDirectionChange',
        'original'
      )
    })
  })

  describe('hasSkeleton', () => {
    it('returns false when no current model', () => {
      const { manager } = createManager()
      expect(manager.hasSkeleton()).toBe(false)
    })

    it('returns false for model without skeleton', async () => {
      const { manager } = createManager()
      const model = createMeshModel()
      await manager.setupModel(model)

      expect(manager.hasSkeleton()).toBe(false)
    })

    it('returns true for model with SkinnedMesh', () => {
      const { manager } = createManager()
      const group = new THREE.Group()
      const geometry = new THREE.BoxGeometry(1, 1, 1)
      const material = new THREE.MeshStandardMaterial()
      const bones = [new THREE.Bone(), new THREE.Bone()]
      bones[0].add(bones[1])
      const skeleton = new THREE.Skeleton(bones)
      const skinnedMesh = new THREE.SkinnedMesh(geometry, material)
      skinnedMesh.add(bones[0])
      skinnedMesh.bind(skeleton)
      group.add(skinnedMesh)

      manager.currentModel = group

      expect(manager.hasSkeleton()).toBe(true)
    })
  })

  describe('setShowSkeleton', () => {
    it('sets showSkeleton flag', () => {
      const { manager } = createManager()
      manager.setShowSkeleton(true)
      expect(manager.showSkeleton).toBe(true)
    })

    it('emits skeletonVisibilityChange event', () => {
      const { manager, eventManager } = createManager()

      manager.setShowSkeleton(true)

      expect(eventManager.emitEvent).toHaveBeenCalledWith(
        'skeletonVisibilityChange',
        true
      )
    })

    it('hides existing skeleton helper when set to false', async () => {
      const { manager, scene } = createManager()
      const model = createMeshModel()
      await manager.setupModel(model)

      const helper = new THREE.SkeletonHelper(model)
      manager.skeletonHelper = helper
      scene.add(helper)

      manager.setShowSkeleton(false)

      expect(helper.visible).toBe(false)
    })

    it('shows existing skeleton helper when set to true', async () => {
      const { manager, scene } = createManager()
      const model = createMeshModel()
      await manager.setupModel(model)

      const helper = new THREE.SkeletonHelper(model)
      helper.visible = false
      manager.skeletonHelper = helper
      scene.add(helper)

      manager.setShowSkeleton(true)

      expect(helper.visible).toBe(true)
    })
  })

  describe('containsSplatMesh', () => {
    it('returns false when no model', () => {
      const { manager } = createManager()
      expect(manager.containsSplatMesh()).toBe(false)
    })

    it('returns false for regular model', async () => {
      const { manager } = createManager()
      const model = createMeshModel()
      await manager.setupModel(model)

      expect(manager.containsSplatMesh()).toBe(false)
    })

    it('returns false for explicit null argument', () => {
      const { manager } = createManager()
      expect(manager.containsSplatMesh(null)).toBe(false)
    })
  })

  describe('PLY mode switching', () => {
    function createPLYManager() {
      const ctx = createManager()
      const geometry = new THREE.BufferGeometry()
      geometry.setAttribute(
        'position',
        new THREE.Float32BufferAttribute([0, 0, 0, 1, 1, 1, 2, 0, 0], 3)
      )

      const mesh = new THREE.Mesh(
        geometry.clone(),
        ctx.manager.standardMaterial.clone()
      )
      const group = new THREE.Group()
      group.name = 'MainModel'
      group.add(mesh)
      ctx.scene.add(group)

      ctx.manager.currentModel = group
      ctx.manager.originalModel = geometry

      return ctx
    }

    it('recreates model as point cloud', () => {
      const { manager, scene, eventManager } = createPLYManager()

      manager.setMaterialMode('pointCloud')

      const mainModel = scene.children.find((c) => c.name === 'MainModel')
      expect(mainModel).toBeDefined()
      const points = mainModel!.children.find((c) => c instanceof THREE.Points)
      expect(points).toBeInstanceOf(THREE.Points)
      expect(eventManager.emitEvent).toHaveBeenCalledWith(
        'materialModeChange',
        'pointCloud'
      )
    })

    it('recreates model as wireframe mesh', () => {
      const { manager, scene } = createPLYManager()

      manager.setMaterialMode('wireframe')

      const mainModel = scene.children.find((c) => c.name === 'MainModel')
      expect(mainModel).toBeDefined()

      let foundWireframe = false
      mainModel!.traverse((child) => {
        if (
          child instanceof THREE.Mesh &&
          child.material instanceof THREE.MeshBasicMaterial
        ) {
          foundWireframe = child.material.wireframe
        }
      })
      expect(foundWireframe).toBe(true)
    })

    it('uses vertex colors when available', () => {
      const { manager, scene } = createManager()
      const geometry = new THREE.BufferGeometry()
      geometry.setAttribute(
        'position',
        new THREE.Float32BufferAttribute([0, 0, 0, 1, 1, 1, 2, 0, 0], 3)
      )
      geometry.setAttribute(
        'color',
        new THREE.Float32BufferAttribute([1, 0, 0, 0, 1, 0, 0, 0, 1], 3)
      )

      const mesh = new THREE.Mesh(
        geometry.clone(),
        new THREE.MeshBasicMaterial()
      )
      const group = new THREE.Group()
      group.name = 'MainModel'
      group.add(mesh)
      scene.add(group)

      manager.currentModel = group
      manager.originalModel = geometry

      manager.setMaterialMode('pointCloud')

      const mainModel = scene.children.find((c) => c.name === 'MainModel')
      const points = mainModel!.children.find(
        (c) => c instanceof THREE.Points
      ) as THREE.Points
      expect((points.material as THREE.PointsMaterial).vertexColors).toBe(true)
    })

    it('removes old MainModel objects before adding new one', () => {
      const { manager, scene } = createPLYManager()

      manager.setMaterialMode('wireframe')

      const mainModels = scene.children.filter((c) => c.name === 'MainModel')
      expect(mainModels).toHaveLength(1)
    })
  })
})
