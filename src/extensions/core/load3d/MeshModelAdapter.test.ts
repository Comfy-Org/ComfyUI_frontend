import * as THREE from 'three'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { MeshModelAdapter } from './MeshModelAdapter'
import type { ModelLoadContext } from './ModelAdapter'

// Capture the loader instances for per-test assertions.
const stlLoaderStub = {
  setPath: vi.fn(),
  loadAsync: vi.fn<(filename: string) => Promise<THREE.BufferGeometry>>()
}
const fbxLoaderStub = {
  setPath: vi.fn(),
  loadAsync: vi.fn<(filename: string) => Promise<THREE.Object3D>>()
}
const gltfLoaderStub = {
  setPath: vi.fn(),
  loadAsync: vi.fn<(filename: string) => Promise<{ scene: THREE.Object3D }>>()
}
const mtlLoaderStub = {
  setPath: vi.fn(),
  loadAsync: vi.fn<(filename: string) => Promise<{ preload: () => void }>>()
}
const objLoaderStub = {
  setWorkerUrl: vi.fn(),
  setTerminateWorkerOnLoad: vi.fn(),
  setMaterials: vi.fn(),
  loadAsync: vi.fn<(url: string) => Promise<THREE.Object3D>>()
}

vi.mock('three/examples/jsm/loaders/STLLoader', () => ({
  STLLoader: class {
    setPath = stlLoaderStub.setPath
    loadAsync = stlLoaderStub.loadAsync
  }
}))

vi.mock('three/examples/jsm/loaders/FBXLoader', () => ({
  FBXLoader: class {
    setPath = fbxLoaderStub.setPath
    loadAsync = fbxLoaderStub.loadAsync
  }
}))

vi.mock('three/examples/jsm/loaders/GLTFLoader', () => ({
  GLTFLoader: class {
    setPath = gltfLoaderStub.setPath
    loadAsync = gltfLoaderStub.loadAsync
  }
}))

vi.mock('three/examples/jsm/loaders/MTLLoader', () => ({
  MTLLoader: class {
    setPath = mtlLoaderStub.setPath
    loadAsync = mtlLoaderStub.loadAsync
  }
}))

vi.mock('wwobjloader2', () => ({
  OBJLoader2Parallel: class {
    setWorkerUrl = objLoaderStub.setWorkerUrl
    setTerminateWorkerOnLoad = objLoaderStub.setTerminateWorkerOnLoad
    setMaterials = objLoaderStub.setMaterials
    loadAsync = objLoaderStub.loadAsync
  },
  MtlObjBridge: {
    addMaterialsFromMtlLoader: vi.fn().mockReturnValue([])
  }
}))

vi.mock('wwobjloader2/bundle/worker/module?url', () => ({
  default: 'mock-worker-url'
}))

function makeContext(
  materialMode: ModelLoadContext['materialMode'] = 'original'
): ModelLoadContext {
  return {
    setOriginalModel: vi.fn(),
    registerOriginalMaterial: vi.fn(),
    standardMaterial: new THREE.MeshStandardMaterial(),
    materialMode
  }
}

function makeFbxLikeGroup(): THREE.Group {
  const group = new THREE.Group()
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(),
    new THREE.MeshStandardMaterial()
  )
  group.add(mesh)
  return group
}

describe('MeshModelAdapter', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('identity', () => {
    it('identifies as a mesh adapter with full capabilities', () => {
      const adapter = new MeshModelAdapter()
      expect(adapter.kind).toBe('mesh')
      expect(adapter.capabilities.fitToViewer).toBe(true)
      expect(adapter.capabilities.requiresMaterialRebuild).toBe(false)
      expect(adapter.capabilities.gizmoTransform).toBe(true)
      expect(adapter.capabilities.lighting).toBe(true)
      expect(adapter.capabilities.exportable).toBe(true)
      expect([...adapter.capabilities.materialModes]).toEqual([
        'original',
        'normal',
        'wireframe'
      ])
    })

    it('handles the expected mesh extensions', () => {
      const adapter = new MeshModelAdapter()
      expect([...adapter.extensions]).toEqual([
        'stl',
        'fbx',
        'obj',
        'gltf',
        'glb'
      ])
    })

    it('configures the OBJ worker to terminate after each load', () => {
      new MeshModelAdapter()
      expect(objLoaderStub.setTerminateWorkerOnLoad).toHaveBeenCalledWith(true)
    })
  })

  describe('dispatch fallbacks', () => {
    it('returns null when the filename extension belongs to another adapter', async () => {
      const adapter = new MeshModelAdapter()
      const result = await adapter.load(makeContext(), '/path/', 'cloud.ply')
      expect(result).toBeNull()
    })

    it('returns null for an unknown extension', async () => {
      const adapter = new MeshModelAdapter()
      const result = await adapter.load(makeContext(), '/path/', 'data.xyz')
      expect(result).toBeNull()
    })

    it('returns null for a filename without an extension', async () => {
      const adapter = new MeshModelAdapter()
      const result = await adapter.load(makeContext(), '/path/', 'noextension')
      expect(result).toBeNull()
    })
  })

  describe('STL loader path', () => {
    it('loads STL geometry and wraps it in a Group with a Mesh child', async () => {
      const geometry = new THREE.BufferGeometry()
      geometry.setAttribute(
        'position',
        new THREE.Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0], 3)
      )
      stlLoaderStub.loadAsync.mockResolvedValue(geometry)

      const adapter = new MeshModelAdapter()
      const ctx = makeContext()

      const result = await adapter.load(ctx, '/api/view/', 'model.stl')

      expect(stlLoaderStub.setPath).toHaveBeenCalledWith('/api/view/')
      expect(stlLoaderStub.loadAsync).toHaveBeenCalledWith('model.stl')
      expect(ctx.setOriginalModel).toHaveBeenCalledWith(geometry)
      expect(result).toBeInstanceOf(THREE.Group)
      expect(result!.children[0]).toBeInstanceOf(THREE.Mesh)
    })
  })

  describe('FBX loader path', () => {
    it('loads an FBX model and registers its mesh materials', async () => {
      const fbxModel = makeFbxLikeGroup()
      fbxLoaderStub.loadAsync.mockResolvedValue(fbxModel)

      const adapter = new MeshModelAdapter()
      const ctx = makeContext()

      const result = await adapter.load(ctx, '/api/view/', 'rig.fbx')

      expect(fbxLoaderStub.setPath).toHaveBeenCalledWith('/api/view/')
      expect(fbxLoaderStub.loadAsync).toHaveBeenCalledWith('rig.fbx')
      expect(ctx.setOriginalModel).toHaveBeenCalledWith(fbxModel)
      expect(ctx.registerOriginalMaterial).toHaveBeenCalledTimes(1)
      expect(result).toBe(fbxModel)
    })

    it('disables frustum culling on SkinnedMesh children', async () => {
      const group = new THREE.Group()
      const skinned = new THREE.SkinnedMesh(
        new THREE.BoxGeometry(),
        new THREE.MeshStandardMaterial()
      )
      skinned.frustumCulled = true
      group.add(skinned)
      fbxLoaderStub.loadAsync.mockResolvedValue(group)

      const adapter = new MeshModelAdapter()
      await adapter.load(makeContext(), '/api/view/', 'animated.fbx')

      expect(skinned.frustumCulled).toBe(false)
    })
  })

  describe('OBJ loader path', () => {
    it('attempts the MTL sidecar in original material mode', async () => {
      mtlLoaderStub.loadAsync.mockResolvedValue({ preload: vi.fn() })
      objLoaderStub.loadAsync.mockResolvedValue(makeFbxLikeGroup())

      const adapter = new MeshModelAdapter()
      await adapter.load(makeContext('original'), '/api/view/', 'cube.obj')

      expect(mtlLoaderStub.setPath).toHaveBeenCalledWith('/api/view/')
      expect(mtlLoaderStub.loadAsync).toHaveBeenCalledWith('cube.mtl')
      expect(objLoaderStub.setMaterials).toHaveBeenCalled()
      expect(objLoaderStub.loadAsync).toHaveBeenCalledWith('/api/view/cube.obj')
    })

    it('swallows MTL load errors and continues without materials', async () => {
      mtlLoaderStub.loadAsync.mockRejectedValue(new Error('no mtl'))
      objLoaderStub.loadAsync.mockResolvedValue(makeFbxLikeGroup())

      const adapter = new MeshModelAdapter()
      const result = await adapter.load(
        makeContext('original'),
        '/api/view/',
        'cube.obj'
      )

      expect(result).toBeInstanceOf(THREE.Group)
      expect(objLoaderStub.setMaterials).not.toHaveBeenCalled()
    })

    it('skips the MTL attempt for non-original material modes', async () => {
      objLoaderStub.loadAsync.mockResolvedValue(makeFbxLikeGroup())

      const adapter = new MeshModelAdapter()
      await adapter.load(makeContext('wireframe'), '/api/view/', 'cube.obj')

      expect(mtlLoaderStub.loadAsync).not.toHaveBeenCalled()
      expect(objLoaderStub.loadAsync).toHaveBeenCalledWith('/api/view/cube.obj')
    })

    it('registers materials for each mesh child', async () => {
      objLoaderStub.loadAsync.mockResolvedValue(makeFbxLikeGroup())

      const adapter = new MeshModelAdapter()
      const ctx = makeContext('wireframe')
      await adapter.load(ctx, '/api/view/', 'cube.obj')

      expect(ctx.registerOriginalMaterial).toHaveBeenCalledTimes(1)
    })
  })

  describe('GLTF loader path', () => {
    it('loads a .glb and returns the scene with vertex normals computed', async () => {
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(),
        new THREE.MeshStandardMaterial()
      )
      const computeNormals = vi.spyOn(mesh.geometry, 'computeVertexNormals')
      const scene = new THREE.Group()
      scene.add(mesh)
      const gltf = { scene }
      gltfLoaderStub.loadAsync.mockResolvedValue(gltf)

      const adapter = new MeshModelAdapter()
      const ctx = makeContext()

      const result = await adapter.load(ctx, '/api/view/', 'scene.glb')

      expect(gltfLoaderStub.setPath).toHaveBeenCalledWith('/api/view/')
      expect(gltfLoaderStub.loadAsync).toHaveBeenCalledWith('scene.glb')
      expect(ctx.setOriginalModel).toHaveBeenCalledWith(gltf)
      expect(computeNormals).toHaveBeenCalled()
      expect(ctx.registerOriginalMaterial).toHaveBeenCalledTimes(1)
      expect(result).toBe(scene)
    })

    it('also handles .gltf filenames', async () => {
      gltfLoaderStub.loadAsync.mockResolvedValue({ scene: new THREE.Group() })

      const adapter = new MeshModelAdapter()
      await adapter.load(makeContext(), '/api/view/', 'scene.gltf')

      expect(gltfLoaderStub.loadAsync).toHaveBeenCalledWith('scene.gltf')
    })

    it('disables frustum culling on SkinnedMesh children inside the scene', async () => {
      const scene = new THREE.Group()
      const skinned = new THREE.SkinnedMesh(
        new THREE.BoxGeometry(),
        new THREE.MeshStandardMaterial()
      )
      skinned.frustumCulled = true
      scene.add(skinned)
      gltfLoaderStub.loadAsync.mockResolvedValue({ scene })

      const adapter = new MeshModelAdapter()
      await adapter.load(makeContext(), '/api/view/', 'rigged.glb')

      expect(skinned.frustumCulled).toBe(false)
    })
  })
})
