import * as THREE from 'three'
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader'
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader'
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader'

import { OverrideMTLLoader } from '@/extensions/core/load3d/threejsOverride/OverrideMTLLoader'
import { t } from '@/i18n'
import { useToastStore } from '@/stores/toastStore'

import {
  EventManagerInterface,
  Load3DOptions,
  LoaderManagerInterface,
  ModelManagerInterface
} from './interfaces'

export class LoaderManager implements LoaderManagerInterface {
  gltfLoader: GLTFLoader
  objLoader: OBJLoader
  mtlLoader: OverrideMTLLoader
  fbxLoader: FBXLoader
  stlLoader: STLLoader

  private modelManager: ModelManagerInterface
  private eventManager: EventManagerInterface

  constructor(
    modelManager: ModelManagerInterface,
    eventManager: EventManagerInterface,
    options: Load3DOptions
  ) {
    let loadRootFolder = 'input'

    if (options && options.inputSpec?.isPreview) {
      loadRootFolder = 'output'
    }

    this.modelManager = modelManager
    this.eventManager = eventManager

    this.gltfLoader = new GLTFLoader()
    this.objLoader = new OBJLoader()
    this.mtlLoader = new OverrideMTLLoader(loadRootFolder)
    this.fbxLoader = new FBXLoader()
    this.stlLoader = new STLLoader()
  }

  init(): void {}

  dispose(): void {}

  async loadModel(url: string, originalFileName?: string): Promise<void> {
    try {
      this.eventManager.emitEvent('modelLoadingStart', null)

      this.modelManager.clearModel()

      this.modelManager.originalURL = url

      let fileExtension: string | undefined
      if (originalFileName) {
        fileExtension = originalFileName.split('.').pop()?.toLowerCase()

        this.modelManager.originalFileName =
          originalFileName.split('/').pop()?.split('.')[0] || 'model'
      } else {
        const filename = new URLSearchParams(url.split('?')[1]).get('filename')
        fileExtension = filename?.split('.').pop()?.toLowerCase()

        if (filename) {
          this.modelManager.originalFileName = filename.split('.')[0] || 'model'
        } else {
          this.modelManager.originalFileName = 'model'
        }
      }

      if (!fileExtension) {
        useToastStore().addAlert(t('toastMessages.couldNotDetermineFileType'))
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
      useToastStore().addAlert(t('toastMessages.errorLoadingModel'))
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
          const mtlUrl = url.replace(/(filename=.*?)\.obj/, '$1.mtl')

          const subfolderMatch = url.match(/[?&]subfolder=([^&]*)/)

          const subfolder = subfolderMatch
            ? decodeURIComponent(subfolderMatch[1])
            : '3d'

          this.mtlLoader.setSubfolder(subfolder)

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
