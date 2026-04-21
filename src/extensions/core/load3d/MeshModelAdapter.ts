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
  ModelLoadContext
} from './ModelAdapter'

export class MeshModelAdapter implements ModelAdapter {
  readonly kind = 'mesh' as const
  readonly extensions = ['stl', 'fbx', 'obj', 'gltf', 'glb'] as const
  readonly capabilities: ModelAdapterCapabilities = {
    fitToViewer: true,
    requiresMaterialRebuild: false,
    gizmoTransform: true,
    lighting: true,
    exportable: true,
    materialModes: ['original', 'normal', 'wireframe']
  }

  private readonly gltfLoader = new GLTFLoader()
  private readonly objLoader: OBJLoader2Parallel
  private readonly mtlLoader = new MTLLoader()
  private readonly fbxLoader = new FBXLoader()
  private readonly stlLoader = new STLLoader()

  constructor() {
    this.objLoader = new OBJLoader2Parallel()
    this.objLoader.setWorkerUrl(
      true,
      new URL(OBJLoader2WorkerUrl, import.meta.url)
    )
    this.objLoader.setTerminateWorkerOnLoad(true)
  }

  async load(
    ctx: ModelLoadContext,
    path: string,
    filename: string
  ): Promise<THREE.Object3D | null> {
    const extension = filename.split('.').pop()?.toLowerCase()
    switch (extension) {
      case 'stl':
        return this.loadSTL(ctx, path, filename)
      case 'fbx':
        return this.loadFBX(ctx, path, filename)
      case 'obj':
        return this.loadOBJ(ctx, path, filename)
      case 'gltf':
      case 'glb':
        return this.loadGLTF(ctx, path, filename)
    }
    return null
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
    filename: string
  ): Promise<THREE.Object3D> {
    this.fbxLoader.setPath(path)
    const fbxModel = await this.fbxLoader.loadAsync(filename)
    ctx.setOriginalModel(fbxModel)

    fbxModel.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        ctx.registerOriginalMaterial(child, child.material)
        if (child instanceof THREE.SkinnedMesh) {
          child.frustumCulled = false
        }
      }
    })

    return fbxModel
  }

  private async loadOBJ(
    ctx: ModelLoadContext,
    path: string,
    filename: string
  ): Promise<THREE.Object3D> {
    if (ctx.materialMode === 'original') {
      try {
        this.mtlLoader.setPath(path)
        const mtlFileName = filename.replace(/\.obj$/, '.mtl')
        const materials = await this.mtlLoader.loadAsync(mtlFileName)
        materials.preload()
        const materialsFromMtl =
          MtlObjBridge.addMaterialsFromMtlLoader(materials)
        this.objLoader.setMaterials(materialsFromMtl)
      } catch {
        console.log(
          'No MTL file found or error loading it, continuing without materials'
        )
      }
    }

    const objUrl = path + encodeURIComponent(filename)
    const model = await this.objLoader.loadAsync(objUrl)

    model.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        ctx.registerOriginalMaterial(child, child.material)
      }
    })

    return model
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
      }
    })

    return gltf.scene
  }
}
