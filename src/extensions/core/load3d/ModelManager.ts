import * as THREE from 'three'
import { GLTF } from 'three/examples/jsm/loaders/GLTFLoader'

import {
  EventManagerInterface,
  MaterialMode,
  ModelManagerInterface,
  UpDirection
} from './interfaces'

export class ModelManager implements ModelManagerInterface {
  currentModel: THREE.Object3D | null = null
  originalModel: THREE.Object3D | THREE.BufferGeometry | GLTF | null = null
  originalRotation: THREE.Euler | null = null
  currentUpDirection: UpDirection = 'original'
  materialMode: MaterialMode = 'original'
  originalMaterials: WeakMap<THREE.Mesh, THREE.Material | THREE.Material[]> =
    new WeakMap()
  normalMaterial: THREE.MeshNormalMaterial
  standardMaterial: THREE.MeshStandardMaterial
  wireframeMaterial: THREE.MeshBasicMaterial
  depthMaterial: THREE.MeshDepthMaterial

  private scene: THREE.Scene
  private renderer: THREE.WebGLRenderer
  private eventManager: EventManagerInterface
  private activeCamera: THREE.Camera
  private setupCamera: (size: THREE.Vector3) => void

  constructor(
    scene: THREE.Scene,
    renderer: THREE.WebGLRenderer,
    eventManager: EventManagerInterface,
    getActiveCamera: () => THREE.Camera,
    setupCamera: (size: THREE.Vector3) => void
  ) {
    this.scene = scene
    this.renderer = renderer
    this.eventManager = eventManager
    this.activeCamera = getActiveCamera()
    this.setupCamera = setupCamera

    this.normalMaterial = new THREE.MeshNormalMaterial({
      flatShading: false,
      side: THREE.DoubleSide,
      normalScale: new THREE.Vector2(1, 1),
      transparent: false,
      opacity: 1.0
    })

    this.wireframeMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      wireframe: true,
      transparent: false,
      opacity: 1.0
    })

    this.depthMaterial = new THREE.MeshDepthMaterial({
      depthPacking: THREE.BasicDepthPacking,
      side: THREE.DoubleSide
    })

    this.standardMaterial = this.createSTLMaterial()
  }

  init(): void {}

  dispose(): void {
    this.clearModel()
    this.normalMaterial.dispose()
    this.standardMaterial.dispose()
    this.wireframeMaterial.dispose()
    this.depthMaterial.dispose()
  }

  createSTLMaterial(): THREE.MeshStandardMaterial {
    return new THREE.MeshStandardMaterial({
      color: 0x808080,
      metalness: 0.1,
      roughness: 0.8,
      flatShading: false,
      side: THREE.DoubleSide
    })
  }

  setMaterialMode(mode: MaterialMode): void {
    this.materialMode = mode

    if (!this.currentModel) return

    if (mode === 'depth') {
      this.renderer.outputColorSpace = THREE.LinearSRGBColorSpace
    } else {
      this.renderer.outputColorSpace = THREE.SRGBColorSpace
    }

    this.currentModel.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        switch (mode) {
          case 'depth':
            if (!this.originalMaterials.has(child)) {
              this.originalMaterials.set(child, child.material)
            }
            const depthMat = new THREE.MeshDepthMaterial({
              depthPacking: THREE.BasicDepthPacking,
              side: THREE.DoubleSide
            })

            depthMat.onBeforeCompile = (shader) => {
              shader.uniforms.cameraType = {
                value:
                  this.activeCamera instanceof THREE.OrthographicCamera
                    ? 1.0
                    : 0.0
              }

              shader.fragmentShader = `
                uniform float cameraType;
                ${shader.fragmentShader}
              `

              shader.fragmentShader = shader.fragmentShader.replace(
                /gl_FragColor\s*=\s*vec4\(\s*vec3\(\s*1.0\s*-\s*fragCoordZ\s*\)\s*,\s*opacity\s*\)\s*;/,
                `
                  float depth = 1.0 - fragCoordZ;
                  if (cameraType > 0.5) {
                    depth = pow(depth, 400.0);
                  } else {
                    depth = pow(depth, 0.6);
                  }
                  gl_FragColor = vec4(vec3(depth), opacity);
                `
              )
            }

            depthMat.customProgramCacheKey = () => {
              return this.activeCamera instanceof THREE.OrthographicCamera
                ? 'ortho'
                : 'persp'
            }

            child.material = depthMat
            break
          case 'normal':
            if (!this.originalMaterials.has(child)) {
              this.originalMaterials.set(child, child.material)
            }
            child.material = new THREE.MeshNormalMaterial({
              flatShading: false,
              side: THREE.DoubleSide,
              normalScale: new THREE.Vector2(1, 1),
              transparent: false,
              opacity: 1.0
            })
            break

          case 'wireframe':
            if (!this.originalMaterials.has(child)) {
              this.originalMaterials.set(child, child.material)
            }
            child.material = new THREE.MeshBasicMaterial({
              color: 0xffffff,
              wireframe: true,
              transparent: false,
              opacity: 1.0
            })
            break

          case 'original':
            const originalMaterial = this.originalMaterials.get(child)
            if (originalMaterial) {
              child.material = originalMaterial
            } else {
              child.material = this.standardMaterial
            }
            break
        }
      }
    })

    this.eventManager.emitEvent('materialModeChange', mode)
  }

  setupModelMaterials(model: THREE.Object3D): void {
    model.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        this.originalMaterials.set(child, child.material)
      }
    })

    if (this.materialMode !== 'original') {
      this.setMaterialMode(this.materialMode)
    }
  }

  clearModel(): void {
    const objectsToRemove: THREE.Object3D[] = []

    this.scene.traverse((object) => {
      const isEnvironmentObject =
        object instanceof THREE.GridHelper ||
        object instanceof THREE.Light ||
        object instanceof THREE.Camera

      if (!isEnvironmentObject) {
        objectsToRemove.push(object)
      }
    })

    objectsToRemove.forEach((obj) => {
      if (obj.parent && obj.parent !== this.scene) {
        obj.parent.remove(obj)
      } else {
        this.scene.remove(obj)
      }

      if (obj instanceof THREE.Mesh) {
        obj.geometry?.dispose()
        if (Array.isArray(obj.material)) {
          obj.material.forEach((material) => material.dispose())
        } else {
          obj.material?.dispose()
        }
      }
    })

    this.reset()
  }

  reset(): void {
    this.currentModel = null
    this.originalRotation = null
    this.currentUpDirection = 'original'
    this.setMaterialMode('original')

    this.originalMaterials = new WeakMap()
  }

  async setupModel(model: THREE.Object3D): Promise<void> {
    this.currentModel = model

    const box = new THREE.Box3().setFromObject(model)
    const size = box.getSize(new THREE.Vector3())
    const center = box.getCenter(new THREE.Vector3())

    const maxDim = Math.max(size.x, size.y, size.z)
    const targetSize = 5
    const scale = targetSize / maxDim
    model.scale.multiplyScalar(scale)

    box.setFromObject(model)
    box.getCenter(center)
    box.getSize(size)

    model.position.set(-center.x, -box.min.y, -center.z)

    this.scene.add(model)

    if (this.materialMode !== 'original') {
      this.setMaterialMode(this.materialMode)
    }

    if (this.currentUpDirection !== 'original') {
      this.setUpDirection(this.currentUpDirection)
    }
    this.setupModelMaterials(model)

    this.setupCamera(size)
  }

  setOriginalModel(model: THREE.Object3D | THREE.BufferGeometry | GLTF): void {
    this.originalModel = model
  }

  setUpDirection(direction: UpDirection): void {
    if (!this.currentModel) return

    if (!this.originalRotation && this.currentModel.rotation) {
      this.originalRotation = this.currentModel.rotation.clone()
    }

    this.currentUpDirection = direction

    if (this.originalRotation) {
      this.currentModel.rotation.copy(this.originalRotation)
    }

    switch (direction) {
      case 'original':
        break
      case '-x':
        this.currentModel.rotation.z = Math.PI / 2
        break
      case '+x':
        this.currentModel.rotation.z = -Math.PI / 2
        break
      case '-y':
        this.currentModel.rotation.x = Math.PI
        break
      case '+y':
        break
      case '-z':
        this.currentModel.rotation.x = Math.PI / 2
        break
      case '+z':
        this.currentModel.rotation.x = -Math.PI / 2
        break
    }

    this.eventManager.emitEvent('upDirectionChange', direction)
  }
}
