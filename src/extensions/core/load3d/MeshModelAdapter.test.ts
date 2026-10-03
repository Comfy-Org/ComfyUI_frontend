import { isBinaryFbx, readFbxPolygons } from '@comfyorg/quad-wireframe-three'
import * as THREE from 'three'
import { fromAny } from '@total-typescript/shoehorn'
import { describe, expect, it, vi } from 'vitest'

import { MeshModelAdapter } from './MeshModelAdapter'
import type { ModelLoadContext } from './ModelAdapter'
import { faceSizesFor } from './quadWireframe/faceSizesRegistry'

const stlLoaderStub = {
  setPath: vi.fn(),
  loadAsync: vi.fn<(filename: string) => Promise<THREE.BufferGeometry>>()
}
const fbxLoaderStub = {
  setPath: vi.fn(),
  loadAsync: vi.fn<(filename: string) => Promise<THREE.Object3D>>(),
  parse: vi.fn<(bytes: ArrayBuffer, path: string) => THREE.Object3D>()
}
vi.mock(import('@comfyorg/quad-wireframe-three'), { spy: true })
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
  setMaterials: vi.fn(),
  setBaseObject3d: vi.fn(),
  loadAsync: vi.fn<(url: string) => Promise<THREE.Object3D>>()
}

vi.mock(import('three/examples/jsm/loaders/STLLoader'), () => ({
  STLLoader: fromAny(
    class {
      setPath = stlLoaderStub.setPath
      loadAsync = stlLoaderStub.loadAsync
    }
  )
}))

vi.mock(import('three/examples/jsm/loaders/FBXLoader'), () => ({
  FBXLoader: fromAny(
    class {
      setPath = fbxLoaderStub.setPath
      loadAsync = fbxLoaderStub.loadAsync
      parse = fbxLoaderStub.parse
    }
  )
}))

vi.mock(import('three/examples/jsm/loaders/GLTFLoader'), () => ({
  GLTFLoader: fromAny(
    class {
      setPath = gltfLoaderStub.setPath
      loadAsync = gltfLoaderStub.loadAsync
    }
  )
}))

vi.mock(import('three/examples/jsm/loaders/MTLLoader'), () => ({
  MTLLoader: fromAny(
    class {
      setPath = mtlLoaderStub.setPath
      loadAsync = mtlLoaderStub.loadAsync
    }
  )
}))

vi.mock(import('wwobjloader2'), () => ({
  OBJLoader2Parallel: fromAny(
    class {
      setWorkerUrl = objLoaderStub.setWorkerUrl
      setMaterials = objLoaderStub.setMaterials
      setBaseObject3d = objLoaderStub.setBaseObject3d
      loadAsync = objLoaderStub.loadAsync
    }
  ),
  MtlObjBridge: fromAny({
    addMaterialsFromMtlLoader: vi.fn().mockReturnValue([])
  })
}))

vi.mock(import('wwobjloader2/bundle/worker/module?url'), () => ({
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
        'clay',
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
      expect(result!.object).toBeInstanceOf(THREE.Group)
      expect(result!.object.children[0]).toBeInstanceOf(THREE.Mesh)
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
      expect(result!.object).toBe(fbxModel)
    })

    it('parses fetched bytes and records binary FBX polygon sizes per mesh', async () => {
      const fbxModel = makeFbxLikeGroup()
      const mesh = fbxModel.children[0] as THREE.Mesh
      const bytes = new ArrayBuffer(8)
      const faceSizes = new Uint32Array(6).fill(4)
      fbxLoaderStub.parse.mockReturnValue(fbxModel)
      vi.mocked(isBinaryFbx).mockReturnValue(true)
      vi.mocked(readFbxPolygons).mockReturnValue([
        { id: 1, name: mesh.geometry.name, faceSizes }
      ])
      const fetchBytes = vi.fn(async () => bytes)

      const adapter = new MeshModelAdapter()
      const result = await adapter.load(
        makeContext(),
        '/api/view/',
        'quads.fbx',
        fetchBytes
      )

      expect(fbxLoaderStub.parse).toHaveBeenCalledWith(bytes, '/api/view/')
      expect(fbxLoaderStub.loadAsync).not.toHaveBeenCalled()
      expect(readFbxPolygons).toHaveBeenCalledWith(bytes)
      expect(result!.object).toBe(fbxModel)
      expect(faceSizesFor(mesh.geometry)).toEqual(faceSizes)
    })

    it('skips polygon lookup for ASCII FBX bytes', async () => {
      const fbxModel = makeFbxLikeGroup()
      fbxLoaderStub.parse.mockReturnValue(fbxModel)
      vi.mocked(isBinaryFbx).mockReturnValue(false)

      const adapter = new MeshModelAdapter()
      await adapter.load(
        makeContext(),
        '/api/view/',
        'ascii.fbx',
        async () => new ArrayBuffer(8)
      )

      expect(readFbxPolygons).not.toHaveBeenCalled()
      expect(
        faceSizesFor((fbxModel.children[0] as THREE.Mesh).geometry)
      ).toBeUndefined()
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

      expect(result!.object).toBeInstanceOf(THREE.Group)
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

    it('resets baseObject3d on every load so meshes do not accumulate across calls', async () => {
      objLoaderStub.loadAsync.mockResolvedValue(makeFbxLikeGroup())

      const adapter = new MeshModelAdapter()
      const ctx = makeContext('wireframe')
      await adapter.load(ctx, '/api/view/', 'first.obj')
      await adapter.load(ctx, '/api/view/', 'second.obj')

      expect(objLoaderStub.setBaseObject3d).toHaveBeenCalledTimes(2)
      const bases = objLoaderStub.setBaseObject3d.mock.calls.map(
        ([base]) => base
      )
      expect(bases[0]).toBeInstanceOf(THREE.Object3D)
      expect(bases[1]).toBeInstanceOf(THREE.Object3D)
      // Each call should hand the loader a fresh container, not the same one.
      expect(bases[0]).not.toBe(bases[1])
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
      expect(result!.object).toBe(scene)
    })

    it('records polygon sizes for meshes flagged with FB_ngon_encoding', async () => {
      const quad = new THREE.BufferGeometry()
      quad.setAttribute(
        'position',
        new THREE.Float32BufferAttribute(
          [0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0],
          3
        )
      )
      quad.setIndex([0, 1, 2, 0, 2, 3])
      const flagged = new THREE.Mesh(quad, new THREE.MeshStandardMaterial())
      flagged.userData.gltfExtensions = { FB_ngon_encoding: {} }
      const plain = new THREE.Mesh(
        quad.clone(),
        new THREE.MeshStandardMaterial()
      )
      const scene = new THREE.Group().add(flagged, plain)
      gltfLoaderStub.loadAsync.mockResolvedValue({ scene })

      const adapter = new MeshModelAdapter()
      await adapter.load(makeContext(), '/api/view/', 'nomad.glb')

      expect(faceSizesFor(flagged.geometry)).toEqual(Uint32Array.from([4]))
      expect(faceSizesFor(plain.geometry)).toBeUndefined()
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
