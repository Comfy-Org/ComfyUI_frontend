import {
  hasNgonEncoding,
  isBinaryFbx,
  matchFbxPolygons,
  ngonEncodedFaceSizes,
  readFbxPolygons
} from '@comfyorg/quad-wireframe-three'
import * as THREE from 'three'
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader'
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader'
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader'
import { MtlObjBridge, OBJLoader2Parallel } from 'wwobjloader2'
// Use pre-bundled worker module (has all dependencies included).
// The unbundled 'wwobjloader2/worker' has ES imports that fail in production builds.
import OBJLoader2WorkerUrl from 'wwobjloader2/bundle/worker/module?url'

import type {
  ModelAdapter,
  ModelAdapterCapabilities,
  ModelLoadContext,
  ModelLoadResult
} from './ModelAdapter'
import { registerFaceSizes } from './quadWireframe/faceSizesRegistry'

export class MeshModelAdapter implements ModelAdapter {
  readonly kind = 'mesh' as const
  readonly extensions = ['stl', 'fbx', 'obj', 'gltf', 'glb'] as const
  readonly capabilities: ModelAdapterCapabilities = {
    fitToViewer: true,
    requiresMaterialRebuild: false,
    gizmoTransform: true,
    lighting: true,
    exportable: true,
    materialModes: ['original', 'clay', 'normal', 'wireframe'],
    fitTargetSize: 5
  }

  private readonly gltfLoader = new GLTFLoader()
  private readonly mtlLoader = new MTLLoader()
  private readonly fbxLoader = new FBXLoader()
  private readonly stlLoader = new STLLoader()

  async load(
    ctx: ModelLoadContext,
    path: string,
    filename: string,
    fetchBytes?: () => Promise<ArrayBuffer>
  ): Promise<ModelLoadResult | null> {
    const extension = filename.split('.').pop()?.toLowerCase()
    const object = await (extension === 'stl'
      ? this.loadSTL(ctx, path, filename)
      : extension === 'fbx'
        ? this.loadFBX(ctx, path, filename, fetchBytes)
        : extension === 'obj'
          ? this.loadOBJ(ctx, path, filename)
          : extension === 'gltf' || extension === 'glb'
            ? this.loadGLTF(ctx, path, filename)
            : Promise.resolve(null))
    return object ? { object, capabilities: this.capabilities } : null
  }

  private async loadSTL(
    ctx: ModelLoadContext,
    path: string,
    filename: string
  ): Promise<THREE.Object3D> {
    this.stlLoader.setPath(path)
    const geometry = await this.stlLoader.loadAsync(filename)
    ctx.setOriginalModel(geometry)
    geometry.computeVertexNormals()

    const mesh = new THREE.Mesh(geometry, ctx.standardMaterial)
    const group = new THREE.Group()
    group.add(mesh)
    return group
  }

  private async loadFBX(
    ctx: ModelLoadContext,
    path: string,
    filename: string,
    fetchBytes?: () => Promise<ArrayBuffer>
  ): Promise<THREE.Object3D> {
    this.fbxLoader.setPath(path)
    const bytes = fetchBytes ? await fetchBytes() : null
    const fbxModel = bytes
      ? this.fbxLoader.parse(bytes, path)
      : await this.fbxLoader.loadAsync(filename)
    ctx.setOriginalModel(fbxModel)

    const polygons = bytes && isBinaryFbx(bytes) ? readFbxPolygons(bytes) : []
    fbxModel.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        ctx.registerOriginalMaterial(child, child.material)
        if (child instanceof THREE.SkinnedMesh) {
          child.frustumCulled = false
        }
        const faceSizes = matchFbxPolygons(polygons, child.geometry)
        if (faceSizes) registerFaceSizes(child.geometry, faceSizes)
      }
    })

    return fbxModel
  }

  private async loadOBJ(
    ctx: ModelLoadContext,
    path: string,
    filename: string
  ): Promise<THREE.Object3D> {
    const objLoader = new OBJLoader2Parallel()
    objLoader.setWorkerUrl(true, new URL(OBJLoader2WorkerUrl, import.meta.url))
    objLoader.setTerminateWorkerOnLoad(true)
    objLoader.setBaseObject3d(new THREE.Object3D())

    if (ctx.materialMode === 'original') {
      try {
        this.mtlLoader.setPath(path)
        const mtlFileName = filename.replace(/\.obj$/i, '.mtl')
        const materials = await this.mtlLoader.loadAsync(mtlFileName)
        materials.preload()
        const materialsFromMtl =
          MtlObjBridge.addMaterialsFromMtlLoader(materials)
        objLoader.setMaterials(materialsFromMtl)
      } catch {
        console.warn(
          'No MTL file found or error loading it, continuing without materials'
        )
      }
    }

    const objUrl = path + encodeURIComponent(filename)
    const model = await this.parseOBJ(objLoader, objUrl)

    model.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        ctx.registerOriginalMaterial(child, child.material)
      }
    })

    return model
  }

  private async parseOBJ(
    objLoader: OBJLoader2Parallel,
    objUrl: string
  ): Promise<THREE.Object3D> {
    const bytes = (await new THREE.FileLoader()
      .setResponseType('arraybuffer')
      .loadAsync(objUrl)) as ArrayBuffer

    return new Promise((resolve, reject) => {
      objLoader.setCallbackOnLoad(resolve)
      // FileLoader shares one buffer between concurrent requests for the same
      // URL, and the worker transfer detaches it, so each parse needs its own.
      objLoader.parse(bytes.slice(0))
      rejectOnWorkerFailure(objLoader, reject)
    })
  }

  private async loadGLTF(
    ctx: ModelLoadContext,
    path: string,
    filename: string
  ): Promise<THREE.Object3D> {
    this.gltfLoader.setPath(path)
    const gltf = await this.gltfLoader.loadAsync(filename)
    ctx.setOriginalModel(gltf)

    gltf.scene.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.computeVertexNormals()
        ctx.registerOriginalMaterial(child, child.material)
        if (child instanceof THREE.SkinnedMesh) {
          child.frustumCulled = false
        }
        if (hasNgonEncoding(child)) {
          registerFaceSizes(
            child.geometry,
            ngonEncodedFaceSizes(child.geometry)
          )
        }
      }
    })

    return gltf.scene
  }
}

interface ObjLoaderInternals {
  workerTask?: { getWorker(): Worker | undefined }
}

// OBJLoader2Parallel swallows worker failures (it only logs them), which leaves
// the load promise pending forever. The worker is created synchronously inside
// parse(), so hook it to surface those failures as rejections.
function rejectOnWorkerFailure(
  objLoader: OBJLoader2Parallel,
  reject: (reason: unknown) => void
): void {
  const worker = (
    objLoader as unknown as ObjLoaderInternals
  ).workerTask?.getWorker()
  if (!worker) return

  const fail = (reason: unknown) => {
    worker.terminate()
    reject(reason)
  }
  worker.addEventListener('error', (event) =>
    fail(event.error ?? new Error(event.message))
  )
  const postMessage = worker.postMessage.bind(worker)
  worker.postMessage = ((message: unknown, transfer: Transferable[]) => {
    try {
      postMessage(message, transfer)
    } catch (error) {
      fail(error)
      throw error
    }
  }) as Worker['postMessage']
}
