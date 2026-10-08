import { isBinaryFbx, readFbxPolygons } from '@comfyorg/quad-wireframe-three'
import * as THREE from 'three'
import { fromAny } from '@total-typescript/shoehorn'
import { assert, beforeEach, describe, expect, it, vi } from 'vitest'

import { MeshModelAdapter } from './MeshModelAdapter'
import type { ModelLoadContext } from './ModelAdapter'
import { faceSizesFor } from './quadWireframe/faceSizesRegistry'

const stlLoaderStub = {
  setPath: vi.fn(),
  parse: vi.fn<(bytes: ArrayBuffer) => THREE.BufferGeometry>()
}
const fbxLoaderStub = {
  setPath: vi.fn(),
  parse: vi.fn<(bytes: ArrayBuffer, path: string) => THREE.Object3D>()
}
vi.mock(import('@comfyorg/quad-wireframe-three'), { spy: true })
const gltfLoaderStub = {
  setPath: vi.fn(),
  parseAsync:
    vi.fn<
      (bytes: ArrayBuffer, path: string) => Promise<{ scene: THREE.Object3D }>
    >()
}
const mtlLoaderStub = {
  setPath: vi.fn(),
  loadAsync: vi.fn<(filename: string) => Promise<{ preload: () => void }>>()
}

type ObjLoaderDouble = {
  complete(model: THREE.Object3D): void
}

const objLoaderInstances: ObjLoaderDouble[] = []
const objLoaderStub = {
  setWorkerUrl: vi.fn<(moduleWorker: boolean, workerUrl: URL) => void>(),
  setMaterials: vi.fn<(materials: unknown) => void>(),
  setBaseObject3d: vi.fn<(base: THREE.Object3D) => void>(),
  setCallbackOnLoad:
    vi.fn<(callback: (model: THREE.Object3D) => void) => void>(),
  parse: vi.fn<(loader: ObjLoaderDouble, bytes: ArrayBuffer) => void>(
    (loader) => loader.complete(makeFbxLikeGroup())
  )
}

vi.mock(import('three/examples/jsm/loaders/STLLoader'), () => ({
  STLLoader: fromAny(
    class {
      setPath = stlLoaderStub.setPath
      parse = stlLoaderStub.parse
    }
  )
}))

vi.mock(import('three/examples/jsm/loaders/FBXLoader'), () => ({
  FBXLoader: fromAny(
    class {
      setPath = fbxLoaderStub.setPath
      parse = fbxLoaderStub.parse
    }
  )
}))

vi.mock(import('three/examples/jsm/loaders/GLTFLoader'), () => ({
  GLTFLoader: fromAny(
    class {
      setPath = gltfLoaderStub.setPath
      parseAsync = gltfLoaderStub.parseAsync
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
      private onLoad: (model: THREE.Object3D) => void = () => {}

      constructor() {
        objLoaderInstances.push(this)
      }

      setWorkerUrl(moduleWorker: boolean, workerUrl: URL) {
        objLoaderStub.setWorkerUrl(moduleWorker, workerUrl)
        return this
      }

      setMaterials(materials: unknown) {
        objLoaderStub.setMaterials(materials)
        return this
      }

      setBaseObject3d(base: THREE.Object3D) {
        objLoaderStub.setBaseObject3d(base)
        return this
      }

      setCallbackOnLoad(callback: (model: THREE.Object3D) => void) {
        objLoaderStub.setCallbackOnLoad(callback)
        this.onLoad = callback
        return this
      }

      parse(bytes: ArrayBuffer) {
        objLoaderStub.parse(this, bytes)
        return new THREE.Object3D()
      }

      complete(model: THREE.Object3D) {
        this.onLoad(model)
      }
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

const fetchBytes = vi.fn(async () => new ArrayBuffer(8))

describe('MeshModelAdapter', () => {
  beforeEach(() => {
    objLoaderInstances.length = 0
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
      const result = await adapter.load(
        makeContext(),
        '/path/',
        'cloud.ply',
        fetchBytes
      )
      expect(result).toBeNull()
    })

    it('returns null for an unknown extension', async () => {
      const adapter = new MeshModelAdapter()
      const result = await adapter.load(
        makeContext(),
        '/path/',
        'data.xyz',
        fetchBytes
      )
      expect(result).toBeNull()
    })

    it('returns null for a filename without an extension', async () => {
      const adapter = new MeshModelAdapter()
      const result = await adapter.load(
        makeContext(),
        '/path/',
        'noextension',
        fetchBytes
      )
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
      stlLoaderStub.parse.mockReturnValue(geometry)

      const adapter = new MeshModelAdapter()
      const ctx = makeContext()

      const result = await adapter.load(
        ctx,
        '/api/view/',
        'model.stl',
        fetchBytes
      )

      expect(stlLoaderStub.setPath).toHaveBeenCalledWith('/api/view/')
      expect(stlLoaderStub.parse).toHaveBeenCalledWith(expect.any(ArrayBuffer))
      expect(ctx.setOriginalModel).toHaveBeenCalledWith(geometry)
      expect(result!.object).toBeInstanceOf(THREE.Group)
      expect(result!.object.children[0]).toBeInstanceOf(THREE.Mesh)
    })

    it('parses abortable fetched bytes without starting a direct request', async () => {
      const bytes = new ArrayBuffer(8)
      const geometry = new THREE.BufferGeometry()
      stlLoaderStub.parse.mockReturnValue(geometry)
      const fetchBytes = vi.fn().mockResolvedValue(bytes)

      const adapter = new MeshModelAdapter()
      const result = await adapter.load(
        makeContext(),
        '/api/view/',
        'model.stl',
        fetchBytes
      )

      expect(fetchBytes).toHaveBeenCalledOnce()
      expect(stlLoaderStub.parse).toHaveBeenCalledWith(bytes)
      expect(result?.object).toBeInstanceOf(THREE.Group)
    })
  })

  describe('FBX loader path', () => {
    it('loads an FBX model and registers its mesh materials', async () => {
      const fbxModel = makeFbxLikeGroup()
      fbxLoaderStub.parse.mockReturnValue(fbxModel)

      const adapter = new MeshModelAdapter()
      const ctx = makeContext()

      const result = await adapter.load(
        ctx,
        '/api/view/',
        'rig.fbx',
        fetchBytes
      )

      expect(fbxLoaderStub.setPath).toHaveBeenCalledWith('/api/view/')
      expect(fbxLoaderStub.parse).toHaveBeenCalledWith(
        expect.any(ArrayBuffer),
        '/api/view/'
      )
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
      fbxLoaderStub.parse.mockReturnValue(group)

      const adapter = new MeshModelAdapter()
      await adapter.load(
        makeContext(),
        '/api/view/',
        'animated.fbx',
        fetchBytes
      )

      expect(skinned.frustumCulled).toBe(false)
    })
  })

  describe('OBJ loader path', () => {
    it('attempts the MTL sidecar in original material mode', async () => {
      mtlLoaderStub.loadAsync.mockResolvedValue({ preload: vi.fn() })

      const adapter = new MeshModelAdapter()
      await adapter.load(
        makeContext('original'),
        '/api/view/',
        'cube.obj',
        fetchBytes
      )

      expect(mtlLoaderStub.setPath).toHaveBeenCalledWith('/api/view/')
      expect(mtlLoaderStub.loadAsync).toHaveBeenCalledWith('cube.mtl')
      expect(objLoaderStub.setMaterials).toHaveBeenCalled()
      expect(objLoaderStub.parse).toHaveBeenCalledWith(
        expect.anything(),
        expect.any(ArrayBuffer)
      )
    })

    it('swallows MTL load errors and continues without materials', async () => {
      mtlLoaderStub.loadAsync.mockRejectedValue(new Error('no mtl'))

      const adapter = new MeshModelAdapter()
      const result = await adapter.load(
        makeContext('original'),
        '/api/view/',
        'cube.obj',
        fetchBytes
      )

      expect(result!.object).toBeInstanceOf(THREE.Group)
      expect(objLoaderStub.setMaterials).not.toHaveBeenCalled()
    })

    it('skips the MTL attempt for non-original material modes', async () => {
      const adapter = new MeshModelAdapter()
      await adapter.load(
        makeContext('wireframe'),
        '/api/view/',
        'cube.obj',
        fetchBytes
      )

      expect(mtlLoaderStub.loadAsync).not.toHaveBeenCalled()
      expect(objLoaderStub.parse).toHaveBeenCalledWith(
        expect.anything(),
        expect.any(ArrayBuffer)
      )
    })

    it('registers materials for each mesh child', async () => {
      const adapter = new MeshModelAdapter()
      const ctx = makeContext('wireframe')
      await adapter.load(ctx, '/api/view/', 'cube.obj', fetchBytes)

      expect(ctx.registerOriginalMaterial).toHaveBeenCalledTimes(1)
    })

    it('uses a fresh loader and base object for every load', async () => {
      const adapter = new MeshModelAdapter()
      const ctx = makeContext('wireframe')
      await adapter.load(ctx, '/api/view/', 'first.obj', fetchBytes)
      await adapter.load(ctx, '/api/view/', 'second.obj', fetchBytes)

      expect(objLoaderInstances).toHaveLength(2)
      expect(objLoaderStub.setBaseObject3d).toHaveBeenCalledTimes(2)
      const bases = objLoaderStub.setBaseObject3d.mock.calls.map(
        ([base]) => base
      )
      expect(bases[0]).toBeInstanceOf(THREE.Object3D)
      expect(bases[1]).toBeInstanceOf(THREE.Object3D)
      expect(bases[0]).not.toBe(bases[1])
    })

    it('settles overlapping parses through their own loader callbacks', async () => {
      objLoaderStub.parse.mockImplementation(() => {})
      const adapter = new MeshModelAdapter()

      const firstLoad = adapter.load(
        makeContext('wireframe'),
        '/api/view/',
        'first.obj',
        fetchBytes
      )
      const secondLoad = adapter.load(
        makeContext('wireframe'),
        '/api/view/',
        'second.obj',
        fetchBytes
      )
      await vi.waitFor(() =>
        expect(objLoaderStub.parse).toHaveBeenCalledTimes(2)
      )
      const [firstLoader, secondLoader] = objLoaderInstances
      assert.exists(firstLoader)
      assert.exists(secondLoader)
      const firstModel = makeFbxLikeGroup()
      const secondModel = makeFbxLikeGroup()

      secondLoader.complete(secondModel)
      firstLoader.complete(firstModel)

      await expect(firstLoad).resolves.toMatchObject({ object: firstModel })
      await expect(secondLoad).resolves.toMatchObject({ object: secondModel })
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
      gltfLoaderStub.parseAsync.mockResolvedValue(gltf)

      const adapter = new MeshModelAdapter()
      const ctx = makeContext()

      const result = await adapter.load(
        ctx,
        '/api/view/',
        'scene.glb',
        fetchBytes
      )

      expect(gltfLoaderStub.setPath).toHaveBeenCalledWith('/api/view/')
      expect(gltfLoaderStub.parseAsync).toHaveBeenCalledWith(
        expect.any(ArrayBuffer),
        '/api/view/'
      )
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
      gltfLoaderStub.parseAsync.mockResolvedValue({ scene })

      const adapter = new MeshModelAdapter()
      await adapter.load(makeContext(), '/api/view/', 'nomad.glb', fetchBytes)

      expect(faceSizesFor(flagged.geometry)).toEqual(Uint32Array.from([4]))
      expect(faceSizesFor(plain.geometry)).toBeUndefined()
    })

    it('also handles .gltf filenames', async () => {
      gltfLoaderStub.parseAsync.mockResolvedValue({ scene: new THREE.Group() })

      const adapter = new MeshModelAdapter()
      await adapter.load(makeContext(), '/api/view/', 'scene.gltf', fetchBytes)

      expect(gltfLoaderStub.parseAsync).toHaveBeenCalledWith(
        expect.any(ArrayBuffer),
        '/api/view/'
      )
    })

    it('disables frustum culling on SkinnedMesh children inside the scene', async () => {
      const scene = new THREE.Group()
      const skinned = new THREE.SkinnedMesh(
        new THREE.BoxGeometry(),
        new THREE.MeshStandardMaterial()
      )
      skinned.frustumCulled = true
      scene.add(skinned)
      gltfLoaderStub.parseAsync.mockResolvedValue({ scene })

      const adapter = new MeshModelAdapter()
      await adapter.load(makeContext(), '/api/view/', 'rigged.glb', fetchBytes)

      expect(skinned.frustumCulled).toBe(false)
    })
  })
})
