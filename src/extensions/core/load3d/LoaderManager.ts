import * as THREE from 'three'
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader'
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader'
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader'
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader'

import { useToastStore } from '@/stores/toastStore'

import {
  EventManagerInterface,
  LoaderManagerInterface,
  ModelManagerInterface
} from './interfaces'

export class LoaderManager implements LoaderManagerInterface {
  gltfLoader: GLTFLoader
  objLoader: OBJLoader
  mtlLoader: MTLLoader
  fbxLoader: FBXLoader
  stlLoader: STLLoader

  private modelManager: ModelManagerInterface
  private eventManager: EventManagerInterface

  constructor(
    modelManager: ModelManagerInterface,
    eventManager: EventManagerInterface
  ) {
    this.modelManager = modelManager
    this.eventManager = eventManager

    this.gltfLoader = new GLTFLoader()
    this.objLoader = new OBJLoader()
    this.mtlLoader = new MTLLoader()
    this.fbxLoader = new FBXLoader()
    this.stlLoader = new STLLoader()
  }

  init(): void {}

  dispose(): void {}

  async loadModel(url: string, originalFileName?: string): Promise<void> {
    try {
      this.eventManager.emitEvent('modelLoadingStart', null)

      this.modelManager.clearModel()

      let fileExtension: string | undefined
      if (originalFileName) {
        fileExtension = originalFileName.split('.').pop()?.toLowerCase()
      } else {
        const filename = new URLSearchParams(url.split('?')[1]).get('filename')
        fileExtension = filename?.split('.').pop()?.toLowerCase()
      }

      if (!fileExtension) {
        useToastStore().addAlert('Could not determine file type')
        return
      }

      let model = await this.loadModelInternal(url, fileExtension)

      if (model) {
        await this.modelManager.setupModel(model)
      }

      this.eventManager.emitEvent('modelLoadingEnd', null)
    } catch (error) {
      this.eventManager.emitEvent('modelLoadingEnd', null)
      console.error('Error loading model:', error)
      useToastStore().addAlert('Error loading model')
    }
  }

  private async loadModelInternal(
    url: string,
    fileExtension: string
  ): Promise<THREE.Object3D | null> {
    let model: THREE.Object3D | null = null

    switch (fileExtension) {
      case 'stl':
        const geometry = await this.stlLoader.loadAsync(url)
        this.modelManager.setOriginalModel(geometry)
        geometry.computeVertexNormals()

        const mesh = new THREE.Mesh(
          geometry,
          this.modelManager.standardMaterial
        )

        const group = new THREE.Group()
        group.add(mesh)
        model = group
        break

      case 'fbx':
        const fbxModel = await this.fbxLoader.loadAsync(url)
        this.modelManager.setOriginalModel(fbxModel)
        model = fbxModel

        fbxModel.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            this.modelManager.originalMaterials.set(child, child.material)
          }
        })
        break

      case 'obj':
        if (this.modelManager.materialMode === 'original') {
          const mtlUrl = url.replace(/\.obj([^.]*$)/, '.mtl$1')
          try {
            const materials = await this.mtlLoader.loadAsync(mtlUrl)
            materials.preload()
            this.objLoader.setMaterials(materials)
          } catch (e) {
            console.log(
              'No MTL file found or error loading it, continuing without materials'
            )
          }
        }

        model = await this.objLoader.loadAsync(url)
        model.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            this.modelManager.originalMaterials.set(child, child.material)
          }
        })
        break

      case 'gltf':
      case 'glb':
        const gltf = await this.gltfLoader.loadAsync(url)
        this.modelManager.setOriginalModel(gltf)
        model = gltf.scene

        gltf.scene.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.geometry.computeVertexNormals()
            this.modelManager.originalMaterials.set(child, child.material)
          }
        })
        break
    }

    return model
  }
}
