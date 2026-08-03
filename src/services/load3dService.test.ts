import * as THREE from 'three'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type Load3d from '@/extensions/core/load3d/Load3d'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { useLoad3dService } from '@/services/load3dService'
import { createMockLGraphNode } from '@/utils/__tests__/litegraphTestUtils'

const { nodeMap, useLoad3dViewerMock, skeletonCloneMock } = vi.hoisted(() => ({
  nodeMap: new Map<LGraphNode, Load3d>(),
  useLoad3dViewerMock: vi.fn(),
  skeletonCloneMock: vi.fn()
}))

vi.mock('@/composables/useLoad3d', () => ({
  nodeToLoad3dMap: nodeMap
}))

vi.mock('@/composables/useLoad3dViewer', () => ({
  useLoad3dViewer: useLoad3dViewerMock
}))

vi.mock('three/examples/jsm/utils/SkeletonUtils', () => ({
  clone: skeletonCloneMock
}))

// Track every node a test creates so the load3dService singleton's
// internal viewerInstances map can be drained in beforeEach without
// reaching into the module's private state.
const createdNodes = new Set<LGraphNode>()

function makeNode(id: number | string): LGraphNode {
  const node = createMockLGraphNode({ id })
  createdNodes.add(node)
  return node
}

function makeLoad3d(): Load3d {
  return {
    remove: vi.fn()
  } as unknown as Load3d
}

function makeViewer(overrides: Record<string, unknown> = {}) {
  return {
    needApplyChanges: { value: false },
    applyChanges: vi.fn().mockResolvedValue(true),
    cleanup: vi.fn(),
    ...overrides
  }
}

describe('load3dService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    nodeMap.clear()
    const svc = useLoad3dService()
    for (const node of createdNodes) svc.removeViewer(node)
    createdNodes.clear()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('singleton', () => {
    it('returns the same instance from useLoad3dService()', () => {
      expect(useLoad3dService()).toBe(useLoad3dService())
    })
  })

  describe('getLoad3d (sync)', () => {
    it('returns null when the load3d module has not been loaded yet', () => {
      // Before any async accessor has been called, the cache is empty.
      // We can't easily simulate "module never loaded" because vi.mock makes
      // it eagerly available, so this test verifies the behavior via missing
      // entries instead.
      const node = makeNode('missing')
      expect(useLoad3dService().getLoad3d(node)).toBeNull()
    })

    it('returns null after async load when the node has no entry in the map', async () => {
      const svc = useLoad3dService()
      // Trigger the async loader so the sync path has a populated cache.
      await svc.getLoad3dAsync(makeNode('anything'))

      expect(svc.getLoad3d(makeNode('still-missing'))).toBeNull()
    })

    it('returns the registered Load3d instance once the map has been populated', async () => {
      const svc = useLoad3dService()
      const node = makeNode('a')
      const load3d = makeLoad3d()
      nodeMap.set(node, load3d)
      await svc.getLoad3dAsync(node)

      expect(svc.getLoad3d(node)).toBe(load3d)
    })
  })

  describe('getLoad3dAsync', () => {
    it('returns the Load3d for a registered node', async () => {
      const svc = useLoad3dService()
      const node = makeNode('async-a')
      const load3d = makeLoad3d()
      nodeMap.set(node, load3d)

      await expect(svc.getLoad3dAsync(node)).resolves.toBe(load3d)
    })

    it('returns null for an unregistered node', async () => {
      const svc = useLoad3dService()
      await expect(
        svc.getLoad3dAsync(makeNode('async-missing'))
      ).resolves.toBeNull()
    })
  })

  describe('getNodeByLoad3d', () => {
    it('finds the node owning a given Load3d instance', async () => {
      const svc = useLoad3dService()
      const node = makeNode('owner')
      const load3d = makeLoad3d()
      nodeMap.set(node, load3d)
      await svc.getLoad3dAsync(node)

      expect(svc.getNodeByLoad3d(load3d)).toBe(node)
    })

    it('returns null when the Load3d instance is not in the map', async () => {
      const svc = useLoad3dService()
      await svc.getLoad3dAsync(makeNode('warmup'))

      expect(svc.getNodeByLoad3d(makeLoad3d())).toBeNull()
    })
  })

  describe('removeLoad3d', () => {
    it('calls remove() on the instance and drops it from the map', async () => {
      const svc = useLoad3dService()
      const node = makeNode('to-remove')
      const load3d = makeLoad3d()
      nodeMap.set(node, load3d)
      await svc.getLoad3dAsync(node)

      svc.removeLoad3d(node)

      expect(load3d.remove).toHaveBeenCalled()
      expect(nodeMap.has(node)).toBe(false)
    })

    it('is a no-op when the node has no registered Load3d', async () => {
      const svc = useLoad3dService()
      await svc.getLoad3dAsync(makeNode('warmup'))

      expect(() => svc.removeLoad3d(makeNode('not-there'))).not.toThrow()
    })
  })

  describe('clear', () => {
    it('removes every registered Load3d', async () => {
      const svc = useLoad3dService()
      const a = makeNode('a')
      const b = makeNode('b')
      const ld1 = makeLoad3d()
      const ld2 = makeLoad3d()
      nodeMap.set(a, ld1)
      nodeMap.set(b, ld2)
      await svc.getLoad3dAsync(a)

      svc.clear()

      expect(nodeMap.size).toBe(0)
      expect(ld1.remove).toHaveBeenCalled()
      expect(ld2.remove).toHaveBeenCalled()
    })
  })

  describe('viewer lifecycle', () => {
    it('getOrCreateViewer creates a viewer on first call and reuses it on subsequent calls', async () => {
      const svc = useLoad3dService()
      const node = makeNode('v1')
      const viewer = makeViewer()
      useLoad3dViewerMock.mockReturnValue(viewer)

      const first = await svc.getOrCreateViewer(node)
      const second = await svc.getOrCreateViewer(node)

      expect(first).toBe(viewer)
      expect(second).toBe(viewer)
      expect(useLoad3dViewerMock).toHaveBeenCalledTimes(1)
      expect(useLoad3dViewerMock).toHaveBeenCalledWith(node)
    })

    it('getOrCreateViewerSync uses the supplied factory once and caches the result', () => {
      const svc = useLoad3dService()
      const node = makeNode('v-sync')
      const viewer = makeViewer()
      const factory = vi.fn().mockReturnValue(viewer)

      const first = svc.getOrCreateViewerSync(
        node,
        factory as unknown as typeof useLoad3dViewerMock
      )
      const second = svc.getOrCreateViewerSync(
        node,
        factory as unknown as typeof useLoad3dViewerMock
      )

      expect(first).toBe(viewer)
      expect(second).toBe(viewer)
      expect(factory).toHaveBeenCalledTimes(1)
    })

    it('removeViewer calls cleanup and forgets the viewer', async () => {
      const svc = useLoad3dService()
      const node = makeNode('v2')
      const viewer = makeViewer()
      useLoad3dViewerMock.mockReturnValue(viewer)
      await svc.getOrCreateViewer(node)

      svc.removeViewer(node)

      expect(viewer.cleanup).toHaveBeenCalled()
      useLoad3dViewerMock.mockClear()
      const fresh = makeViewer()
      useLoad3dViewerMock.mockReturnValue(fresh)
      const result = await svc.getOrCreateViewer(node)
      expect(useLoad3dViewerMock).toHaveBeenCalledTimes(1)
      expect(result).toBe(fresh)
    })

    it('removeViewer is safe when no viewer has been created for the node', () => {
      const svc = useLoad3dService()
      expect(() => svc.removeViewer(makeNode('never'))).not.toThrow()
    })
  })

  describe('handleViewerClose', () => {
    it('removes the viewer without applying changes when none are pending', async () => {
      const svc = useLoad3dService()
      const node = makeNode('close-clean')
      const viewer = makeViewer({ needApplyChanges: { value: false } })
      useLoad3dViewerMock.mockReturnValue(viewer)
      await svc.getOrCreateViewer(node)

      await svc.handleViewerClose(node)

      expect(viewer.applyChanges).not.toHaveBeenCalled()
      expect(viewer.cleanup).toHaveBeenCalled()
    })

    it('applies changes and syncs the node config when changes are pending', async () => {
      const svc = useLoad3dService()
      const syncLoad3dConfig = vi.fn()
      const node = Object.assign(makeNode('close-dirty'), {
        syncLoad3dConfig
      }) as LGraphNode
      const viewer = makeViewer({ needApplyChanges: { value: true } })
      useLoad3dViewerMock.mockReturnValue(viewer)
      await svc.getOrCreateViewer(node)

      await svc.handleViewerClose(node)

      expect(viewer.applyChanges).toHaveBeenCalled()
      expect(syncLoad3dConfig).toHaveBeenCalled()
      expect(viewer.cleanup).toHaveBeenCalled()
    })

    it('skips syncLoad3dConfig when the node does not define it', async () => {
      const svc = useLoad3dService()
      const node = makeNode('close-no-sync')
      const viewer = makeViewer({ needApplyChanges: { value: true } })
      useLoad3dViewerMock.mockReturnValue(viewer)
      await svc.getOrCreateViewer(node)

      await expect(svc.handleViewerClose(node)).resolves.toBeUndefined()
      expect(viewer.applyChanges).toHaveBeenCalled()
      expect(viewer.cleanup).toHaveBeenCalled()
    })
  })

  describe('handleViewportRefresh', () => {
    it('returns silently when the load3d is null', () => {
      expect(() => useLoad3dService().handleViewportRefresh(null)).not.toThrow()
    })

    it('toggles the camera through the opposite type and back, then updates controls', () => {
      const controls = { update: vi.fn() }
      const load3d = {
        handleResize: vi.fn(),
        getCurrentCameraType: vi.fn().mockReturnValue('perspective'),
        toggleCamera: vi.fn(),
        getControlsManager: vi.fn().mockReturnValue({ controls })
      } as unknown as Load3d

      useLoad3dService().handleViewportRefresh(load3d)

      expect(load3d.handleResize).toHaveBeenCalled()
      expect(load3d.toggleCamera).toHaveBeenNthCalledWith(1, 'orthographic')
      expect(load3d.toggleCamera).toHaveBeenNthCalledWith(2, 'perspective')
      expect(controls.update).toHaveBeenCalled()
    })

    it('toggles in the reverse direction when starting from orthographic', () => {
      const controls = { update: vi.fn() }
      const load3d = {
        handleResize: vi.fn(),
        getCurrentCameraType: vi.fn().mockReturnValue('orthographic'),
        toggleCamera: vi.fn(),
        getControlsManager: vi.fn().mockReturnValue({ controls })
      } as unknown as Load3d

      useLoad3dService().handleViewportRefresh(load3d)

      expect(load3d.toggleCamera).toHaveBeenNthCalledWith(1, 'perspective')
      expect(load3d.toggleCamera).toHaveBeenNthCalledWith(2, 'orthographic')
    })
  })

  describe('copyLoad3dState', () => {
    type SourceOverrides = Partial<{
      currentModel: THREE.Object3D | null
      isSplat: boolean
      originalURL: string | null
      originalModel: unknown
      materialMode: string
      currentUpDirection: string
      appliedTexture: unknown
      gizmoEnabled: boolean
      hasAnimations: boolean
      cameraType: 'perspective' | 'orthographic'
      backgroundInfo: { type: 'image' | 'color' }
      lightsIntensity: number | undefined
      fov: number
    }>

    function makeSource(overrides: SourceOverrides = {}): Load3d {
      const {
        currentModel = null,
        isSplat = false,
        originalURL = null,
        originalModel = null,
        materialMode = 'original',
        currentUpDirection = 'original',
        appliedTexture = null,
        gizmoEnabled = false,
        hasAnimations = false,
        cameraType = 'perspective',
        backgroundInfo = { type: 'color' },
        lightsIntensity = 0.8,
        fov = 35
      } = overrides
      const ambient = { intensity: 0.5 }
      const main = { intensity: lightsIntensity }
      return {
        modelManager: { currentModel, originalURL },
        getGizmoManager: () => ({
          isEnabled: () => gizmoEnabled,
          getInitialTransform: () => ({
            position: { x: 1, y: 2, z: 3 },
            rotation: { x: 0.1, y: 0.2, z: 0.3 },
            scale: { x: 4, y: 5, z: 6 }
          })
        }),
        isSplatModel: () => isSplat,
        getModelManager: () => ({
          originalModel,
          materialMode,
          currentUpDirection,
          appliedTexture
        }),
        getGizmoTransform: () => ({
          position: { x: 7, y: 8, z: 9 },
          rotation: { x: 0.4, y: 0.5, z: 0.6 },
          scale: { x: 10, y: 11, z: 12 }
        }),
        hasAnimations: () => hasAnimations,
        getCurrentCameraType: () => cameraType,
        getCameraState: () => ({ snapshot: true }),
        getSceneManager: () => ({
          scene: new THREE.Scene(),
          currentBackgroundColor: '#abcdef',
          gridHelper: { visible: true },
          getCurrentBackgroundInfo: () => backgroundInfo
        }),
        getLightingManager: () => ({ lights: [ambient, main] }),
        getCameraManager: () => ({ perspectiveCamera: { fov } })
      } as unknown as Load3d
    }

    type TargetState = {
      modelManager: {
        currentModel: THREE.Object3D | null
        originalModel: unknown
        materialMode: string
        currentUpDirection: string
        appliedTexture: unknown
      }
      gizmoManager: {
        isEnabled: () => boolean
        detach: ReturnType<typeof vi.fn>
        setupForModel: ReturnType<typeof vi.fn>
      }
      animationManager: {
        setupModelAnimations: ReturnType<typeof vi.fn>
      }
      sceneRemoved: THREE.Object3D[]
      sceneAdded: THREE.Object3D[]
    }

    function makeTarget(
      opts: {
        gizmoEnabled?: boolean
        existingModel?: THREE.Object3D | null
      } = {}
    ) {
      const { gizmoEnabled = false, existingModel = null } = opts
      const scene = new THREE.Scene()
      const sceneRemoved: THREE.Object3D[] = []
      const sceneAdded: THREE.Object3D[] = []
      const sceneRemove = vi.fn((o: THREE.Object3D) => {
        sceneRemoved.push(o)
        scene.remove(o)
      })
      const sceneAdd = vi.fn((o: THREE.Object3D) => {
        sceneAdded.push(o)
        scene.add(o)
      })
      const modelManager = {
        currentModel: existingModel as THREE.Object3D | null,
        originalModel: null as unknown,
        materialMode: 'original',
        currentUpDirection: 'original',
        appliedTexture: null as unknown
      }
      const animationManager = {
        setupModelAnimations: vi.fn()
      }
      // Memoize the gizmo manager so production code's repeated
      // `target.getGizmoManager()` calls reach the same vi.fn instances.
      const gizmoManager = {
        isEnabled: () => gizmoEnabled,
        detach: vi.fn(),
        setupForModel: vi.fn()
      }
      const target = {
        getGizmoManager: () => gizmoManager,
        getModelManager: () => modelManager,
        getSceneManager: () => ({
          scene: {
            add: sceneAdd,
            remove: sceneRemove
          } as unknown as THREE.Scene
        }),
        loadModel: vi.fn().mockResolvedValue(undefined),
        setMaterialMode: vi.fn(),
        setUpDirection: vi.fn(),
        applyGizmoTransform: vi.fn(),
        setGizmoEnabled: vi.fn(),
        animationManager,
        toggleCamera: vi.fn(),
        setCameraState: vi.fn(),
        setBackgroundColor: vi.fn(),
        toggleGrid: vi.fn(),
        setBackgroundImage: vi.fn().mockResolvedValue(undefined),
        setLightIntensity: vi.fn(),
        setFOV: vi.fn()
      } as unknown as Load3d
      const state: TargetState = {
        modelManager,
        gizmoManager,
        animationManager,
        sceneRemoved,
        sceneAdded
      }
      return { target, state }
    }

    function makeModel(): THREE.Object3D {
      return new THREE.Object3D()
    }

    it('copies camera/scene/lighting/FOV even when there is no source model', async () => {
      const source = makeSource({ currentModel: null, lightsIntensity: 2 })
      const { target } = makeTarget()
      skeletonCloneMock.mockReturnValue(makeModel())

      await useLoad3dService().copyLoad3dState(source, target)

      expect(target.toggleCamera).toHaveBeenCalledWith('perspective')
      expect(target.setCameraState).toHaveBeenCalledWith({ snapshot: true })
      expect(target.setBackgroundColor).toHaveBeenCalledWith('#abcdef')
      expect(target.toggleGrid).toHaveBeenCalledWith(true)
      expect(target.setLightIntensity).toHaveBeenCalledWith(2)
      expect(target.setFOV).toHaveBeenCalledWith(35)
      expect(skeletonCloneMock).not.toHaveBeenCalled()
      expect(target.loadModel).not.toHaveBeenCalled()
    })

    it('uses target.loadModel(originalURL) for splat models, never invoking SkeletonUtils.clone', async () => {
      const source = makeSource({
        currentModel: makeModel(),
        isSplat: true,
        originalURL: 'http://example.com/scan.splat'
      })
      const { target } = makeTarget()

      await useLoad3dService().copyLoad3dState(source, target)

      expect(target.loadModel).toHaveBeenCalledWith(
        'http://example.com/scan.splat'
      )
      expect(skeletonCloneMock).not.toHaveBeenCalled()
    })

    it('skips loadModel for splat models when originalURL is null', async () => {
      const source = makeSource({
        currentModel: makeModel(),
        isSplat: true,
        originalURL: null
      })
      const { target } = makeTarget()

      await useLoad3dService().copyLoad3dState(source, target)

      expect(target.loadModel).not.toHaveBeenCalled()
    })

    it('removes the target existing model from the scene before adding the clone', async () => {
      const existing = makeModel()
      existing.name = 'existing'
      const source = makeSource({ currentModel: makeModel() })
      const { target, state } = makeTarget({ existingModel: existing })
      const clone = makeModel()
      skeletonCloneMock.mockReturnValue(clone)

      await useLoad3dService().copyLoad3dState(source, target)

      expect(state.sceneRemoved).toContain(existing)
      expect(state.sceneAdded).toContain(clone)
    })

    it('clones the source model via SkeletonUtils and assigns it as the target current model', async () => {
      const sourceModel = makeModel()
      const clone = makeModel()
      const source = makeSource({ currentModel: sourceModel })
      const { target, state } = makeTarget()
      skeletonCloneMock.mockReturnValue(clone)

      await useLoad3dService().copyLoad3dState(source, target)

      expect(skeletonCloneMock).toHaveBeenCalledWith(sourceModel)
      expect(state.modelManager.currentModel).toBe(clone)
    })

    it('copies originalModel, material mode, up direction, and applied texture from source to target', async () => {
      const sourceOriginal = { kind: 'gltf' }
      const texture = { id: 'tex1' }
      const source = makeSource({
        currentModel: makeModel(),
        originalModel: sourceOriginal,
        materialMode: 'wireframe',
        currentUpDirection: '+y',
        appliedTexture: texture
      })
      const { target, state } = makeTarget()
      skeletonCloneMock.mockReturnValue(makeModel())

      await useLoad3dService().copyLoad3dState(source, target)

      expect(state.modelManager.originalModel).toBe(sourceOriginal)
      expect(state.modelManager.materialMode).toBe('wireframe')
      expect(state.modelManager.currentUpDirection).toBe('+y')
      expect(state.modelManager.appliedTexture).toBe(texture)
      expect(target.setMaterialMode).toHaveBeenCalledWith('wireframe')
      expect(target.setUpDirection).toHaveBeenCalledWith('+y')
    })

    it('positions the clone at the source initial transform', async () => {
      const clone = makeModel()
      const source = makeSource({ currentModel: makeModel() })
      const { target } = makeTarget()
      skeletonCloneMock.mockReturnValue(clone)

      await useLoad3dService().copyLoad3dState(source, target)

      expect(clone.position.toArray()).toEqual([1, 2, 3])
      expect(clone.rotation.toArray().slice(0, 3)).toEqual([0.1, 0.2, 0.3])
      expect(clone.scale.toArray()).toEqual([4, 5, 6])
    })

    it('applies the source gizmo transform to the target', async () => {
      const source = makeSource({ currentModel: makeModel() })
      const { target } = makeTarget()
      skeletonCloneMock.mockReturnValue(makeModel())

      await useLoad3dService().copyLoad3dState(source, target)

      expect(target.applyGizmoTransform).toHaveBeenCalledWith(
        { x: 7, y: 8, z: 9 },
        { x: 0.4, y: 0.5, z: 0.6 },
        { x: 10, y: 11, z: 12 }
      )
    })

    it('enables the gizmo on target when the source had it enabled', async () => {
      const source = makeSource({
        currentModel: makeModel(),
        gizmoEnabled: true
      })
      const { target } = makeTarget({ gizmoEnabled: false })
      skeletonCloneMock.mockReturnValue(makeModel())

      await useLoad3dService().copyLoad3dState(source, target)

      expect(target.setGizmoEnabled).toHaveBeenCalledWith(true)
    })

    it('enables the gizmo on target when the target previously had it enabled, even if source did not', async () => {
      const source = makeSource({
        currentModel: makeModel(),
        gizmoEnabled: false
      })
      const { target } = makeTarget({ gizmoEnabled: true })
      skeletonCloneMock.mockReturnValue(makeModel())

      await useLoad3dService().copyLoad3dState(source, target)

      expect(target.setGizmoEnabled).toHaveBeenCalledWith(true)
    })

    it('does not enable the gizmo when neither side had it', async () => {
      const source = makeSource({
        currentModel: makeModel(),
        gizmoEnabled: false
      })
      const { target } = makeTarget({ gizmoEnabled: false })
      skeletonCloneMock.mockReturnValue(makeModel())

      await useLoad3dService().copyLoad3dState(source, target)

      expect(target.setGizmoEnabled).not.toHaveBeenCalled()
    })

    it('forwards animation setup when the source has animations', async () => {
      const sourceOriginal = { kind: 'gltf' }
      const clone = makeModel()
      const source = makeSource({
        currentModel: makeModel(),
        originalModel: sourceOriginal,
        hasAnimations: true
      })
      const { target, state } = makeTarget()
      skeletonCloneMock.mockReturnValue(clone)

      await useLoad3dService().copyLoad3dState(source, target)

      expect(state.animationManager.setupModelAnimations).toHaveBeenCalledWith(
        clone,
        sourceOriginal
      )
    })

    it('does not forward animation setup when the source has none', async () => {
      const source = makeSource({
        currentModel: makeModel(),
        hasAnimations: false
      })
      const { target, state } = makeTarget()
      skeletonCloneMock.mockReturnValue(makeModel())

      await useLoad3dService().copyLoad3dState(source, target)

      expect(state.animationManager.setupModelAnimations).not.toHaveBeenCalled()
    })

    it('forwards an image background to setBackgroundImage when the source node has a configured path', async () => {
      const node = createMockLGraphNode({
        id: 'bg-source',
        properties: { 'Scene Config': { backgroundImage: '3d/bg.png' } }
      })
      createdNodes.add(node)
      const source = makeSource({ backgroundInfo: { type: 'image' } })
      nodeMap.set(node, source)
      // Warm the cache so `getNodeByLoad3d` finds the source.
      await useLoad3dService().getLoad3dAsync(node)
      const { target } = makeTarget()

      await useLoad3dService().copyLoad3dState(source, target)

      expect(target.setBackgroundImage).toHaveBeenCalledWith('3d/bg.png')
    })

    it('clears the background when the source background type is not image', async () => {
      const source = makeSource({ backgroundInfo: { type: 'color' } })
      const { target } = makeTarget()

      await useLoad3dService().copyLoad3dState(source, target)

      expect(target.setBackgroundImage).toHaveBeenCalledWith('')
    })

    it('falls back to setLightIntensity(1) when the second light intensity is falsy', async () => {
      const source = makeSource({ lightsIntensity: 0 })
      const { target } = makeTarget()

      await useLoad3dService().copyLoad3dState(source, target)

      expect(target.setLightIntensity).toHaveBeenCalledWith(1)
    })

    it('skips setFOV when the source camera is orthographic', async () => {
      const source = makeSource({ cameraType: 'orthographic' })
      const { target } = makeTarget()

      await useLoad3dService().copyLoad3dState(source, target)

      expect(target.setFOV).not.toHaveBeenCalled()
    })

    it('always detaches the target gizmo at the start of the copy', async () => {
      const source = makeSource({ currentModel: makeModel() })
      const { target, state } = makeTarget()
      skeletonCloneMock.mockReturnValue(makeModel())

      await useLoad3dService().copyLoad3dState(source, target)

      expect(state.gizmoManager.detach).toHaveBeenCalled()
    })

    it('calls setupForModel on the target gizmo with the freshly cloned model', async () => {
      const clone = makeModel()
      const source = makeSource({ currentModel: makeModel() })
      const { target, state } = makeTarget()
      skeletonCloneMock.mockReturnValue(clone)

      await useLoad3dService().copyLoad3dState(source, target)

      expect(state.gizmoManager.setupForModel).toHaveBeenCalledWith(clone)
    })
  })
})
