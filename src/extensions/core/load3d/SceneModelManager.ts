import * as THREE from 'three'
import { type GLTF } from 'three/examples/jsm/loaders/GLTFLoader'

import {
  DEFAULT_MODEL_CAPABILITIES,
  type ModelAdapterCapabilities
} from './ModelAdapter'
import { buildPointCloudForMaterialMode } from './PointCloudModelAdapter'
import {
  type EventManagerInterface,
  type MaterialMode,
  type ModelManagerInterface,
  type UpDirection
} from './interfaces'

export class SceneModelManager implements ModelManagerInterface {
  currentModel: THREE.Object3D | null = null
  originalModel:
    | THREE.Object3D
    | THREE.Group
    | THREE.BufferGeometry
    | GLTF
    | null = null
  originalRotation: THREE.Euler | null = null
  currentUpDirection: UpDirection = 'original'
  materialMode: MaterialMode = 'original'
  originalMaterials: WeakMap<THREE.Mesh, THREE.Material | THREE.Material[]> =
    new WeakMap()
  normalMaterial: THREE.MeshNormalMaterial
  standardMaterial: THREE.MeshStandardMaterial
  wireframeMaterial: THREE.MeshBasicMaterial
  depthMaterial: THREE.MeshDepthMaterial
  originalFileName: string | null = null
  originalURL: string | null = null
  appliedTexture: THREE.Texture | null = null
  textureLoader: THREE.TextureLoader
  skeletonHelper: THREE.SkeletonHelper | null = null
  showSkeleton: boolean = false

  private scene: THREE.Scene
  private renderer: THREE.WebGLRenderer
  private eventManager: EventManagerInterface
  private activeCamera: THREE.Camera
  private setupCamera: (size: THREE.Vector3, center: THREE.Vector3) => void
  private setupGizmo: (model: THREE.Object3D) => void
  private getCurrentCapabilities: () => ModelAdapterCapabilities
  private getBoundsFromAdapter: (model: THREE.Object3D) => THREE.Box3 | null
  private disposeModelViaAdapter: (model: THREE.Object3D) => void
  private getDefaultCameraPose: () => {
    size: THREE.Vector3
    center: THREE.Vector3
  } | null

  constructor(
    scene: THREE.Scene,
    renderer: THREE.WebGLRenderer,
    eventManager: EventManagerInterface,
    getActiveCamera: () => THREE.Camera,
    setupCamera: (size: THREE.Vector3, center: THREE.Vector3) => void,
    setupGizmo: (model: THREE.Object3D) => void,
    getCurrentCapabilities: () => ModelAdapterCapabilities = () =>
      DEFAULT_MODEL_CAPABILITIES,
    getBoundsFromAdapter: (model: THREE.Object3D) => THREE.Box3 | null = () =>
      null,
    disposeModelViaAdapter: (model: THREE.Object3D) => void = () => {},
    getDefaultCameraPose: () => {
      size: THREE.Vector3
      center: THREE.Vector3
    } | null = () => null
  ) {
    this.scene = scene
    this.renderer = renderer
    this.eventManager = eventManager
    this.activeCamera = getActiveCamera()
    this.setupCamera = setupCamera
    this.textureLoader = new THREE.TextureLoader()
    this.setupGizmo = setupGizmo
    this.getCurrentCapabilities = getCurrentCapabilities
    this.getBoundsFromAdapter = getBoundsFromAdapter
    this.disposeModelViaAdapter = disposeModelViaAdapter
    this.getDefaultCameraPose = getDefaultCameraPose

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

    if (this.appliedTexture) {
      this.appliedTexture.dispose()
      this.appliedTexture = null
    }
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

  private removeAllMainModelsFromScene(): void {
    const oldMainModels: THREE.Object3D[] = []
    this.scene.traverse((obj) => {
      if (obj.name === 'MainModel') oldMainModels.push(obj)
    })
    oldMainModels.forEach((oldModel) => {
      oldModel.traverse((child) => {
        if (child instanceof THREE.Mesh || child instanceof THREE.Points) {
          child.geometry?.dispose()
          if (Array.isArray(child.material)) {
            child.material.forEach((m) => m.dispose())
          } else {
            child.material?.dispose()
          }
        }
      })
      this.disposeModelViaAdapter(oldModel)
      this.scene.remove(oldModel)
    })
  }

  private rebuildForMaterialMode(mode: MaterialMode): void {
    if (!(this.originalModel instanceof THREE.BufferGeometry)) return

    this.removeAllMainModelsFromScene()
    this.currentModel = null

    const newModel = buildPointCloudForMaterialMode(
      this.originalModel,
      mode,
      this.standardMaterial,
      this.originalMaterials
    )
    newModel.name = 'MainModel'

    if (mode !== 'pointCloud') {
      const box = new THREE.Box3().setFromObject(newModel)
      const size = box.getSize(new THREE.Vector3())
      const center = box.getCenter(new THREE.Vector3())
      const maxDim = Math.max(size.x, size.y, size.z)
      const targetSize = this.getCurrentCapabilities().fitTargetSize
      const scale = targetSize / maxDim
      newModel.scale.multiplyScalar(scale)

      box.setFromObject(newModel)
      box.getCenter(center)
      box.getSize(size)

      newModel.position.set(-center.x, -box.min.y, -center.z)
    }

    this.scene.add(newModel)
    this.currentModel = newModel
    this.eventManager.emitEvent('materialModeChange', mode)
  }

  setMaterialMode(mode: MaterialMode): void {
    if (!this.currentModel || mode === this.materialMode) {
      return
    }

    this.materialMode = mode

    if (this.getCurrentCapabilities().requiresMaterialRebuild) {
      this.rebuildForMaterialMode(mode)
      return
    }

    if (mode === 'depth') {
      this.renderer.outputColorSpace = THREE.LinearSRGBColorSpace
    } else {
      this.renderer.outputColorSpace = THREE.SRGBColorSpace
    }

    if (this.currentModel) {
      this.currentModel.visible = true
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
          case 'pointCloud':
            const originalMaterial = this.originalMaterials.get(child)
            if (originalMaterial) {
              child.material = originalMaterial
            } else {
              if (this.appliedTexture) {
                child.material = new THREE.MeshStandardMaterial({
                  map: this.appliedTexture,
                  metalness: 0.1,
                  roughness: 0.8,
                  side: THREE.DoubleSide
                })
              } else {
                child.material = this.standardMaterial
              }
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

    this.setMaterialMode('original')
  }

  clearModel(): void {
    const objectsToRemove: THREE.Object3D[] = []

    for (const object of [...this.scene.children]) {
      const isEnvironmentObject =
        object instanceof THREE.GridHelper ||
        object instanceof THREE.Light ||
        object instanceof THREE.Camera ||
        object.name === 'GizmoTransformControls'

      if (!isEnvironmentObject) {
        objectsToRemove.push(object)
      }
    }

    objectsToRemove.forEach((obj) => {
      this.scene.remove(obj)

      obj.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry?.dispose()
          if (Array.isArray(child.material)) {
            child.material.forEach((material) => material.dispose())
          } else {
            child.material?.dispose()
          }
        }
      })
      this.disposeModelViaAdapter(obj)
    })

    this.reset()
  }

  reset(): void {
    this.currentModel = null
    this.originalModel = null
    this.originalRotation = null
    this.currentUpDirection = 'original'
    this.setMaterialMode('original')
    this.originalFileName = null
    this.originalURL = null

    if (this.appliedTexture) {
      this.appliedTexture.dispose()
      this.appliedTexture = null
    }

    if (this.skeletonHelper) {
      this.scene.remove(this.skeletonHelper)
      this.skeletonHelper.dispose()
      this.skeletonHelper = null
    }
    this.showSkeleton = false

    this.originalMaterials = new WeakMap()
  }

  hasSkeleton(): boolean {
    if (!this.currentModel) return false
    let found = false
    this.currentModel.traverse((child) => {
      if (child instanceof THREE.SkinnedMesh && child.skeleton) {
        found = true
      }
    })
    return found
  }

  setShowSkeleton(show: boolean): void {
    this.showSkeleton = show

    if (show) {
      if (!this.skeletonHelper && this.currentModel) {
        let rootBone: THREE.Bone | null = null
        this.currentModel.traverse((child) => {
          if (child instanceof THREE.Bone && !rootBone) {
            if (!(child.parent instanceof THREE.Bone)) {
              rootBone = child
            }
          }
        })

        if (rootBone) {
          this.skeletonHelper = new THREE.SkeletonHelper(rootBone)
          this.scene.add(this.skeletonHelper)
        } else {
          let skinnedMesh: THREE.SkinnedMesh | null = null
          this.currentModel.traverse((child) => {
            if (child instanceof THREE.SkinnedMesh && !skinnedMesh) {
              skinnedMesh = child
            }
          })

          if (skinnedMesh) {
            this.skeletonHelper = new THREE.SkeletonHelper(skinnedMesh)
            this.scene.add(this.skeletonHelper)
          }
        }
      } else if (this.skeletonHelper) {
        this.skeletonHelper.visible = true
      }
    } else {
      if (this.skeletonHelper) {
        this.skeletonHelper.visible = false
      }
    }

    this.eventManager.emitEvent('skeletonVisibilityChange', show)
  }

  addModelToScene(model: THREE.Object3D): void {
    this.currentModel = model
    model.name = 'MainModel'

    this.scene.add(this.currentModel)
  }

  private computeWorldBounds(model: THREE.Object3D): THREE.Box3 {
    return (
      this.getBoundsFromAdapter(model) ?? new THREE.Box3().setFromObject(model)
    )
  }

  async setupModel(model: THREE.Object3D): Promise<void> {
    this.currentModel = model
    model.name = 'MainModel'

    if (!this.getCurrentCapabilities().fitToViewer) {
      this.scene.add(model)
      const pose = this.getDefaultCameraPose()
      if (pose) this.setupCamera(pose.size, pose.center)
      return
    }

    this.scene.add(model)

    if (this.materialMode !== 'original') {
      this.setMaterialMode(this.materialMode)
    }

    if (this.currentUpDirection !== 'original') {
      this.setUpDirection(this.currentUpDirection)
    }
    this.setupModelMaterials(model)

    const box = this.computeWorldBounds(model)
    const size = box.getSize(new THREE.Vector3())
    const center = box.getCenter(new THREE.Vector3())

    this.setupCamera(size, center)

    this.setupGizmo(model)
  }

  fitToViewer(): void {
    if (!this.currentModel || !this.getCurrentCapabilities().fitToViewer) return
    const model = this.currentModel

    model.scale.set(1, 1, 1)
    model.position.set(0, 0, 0)
    model.rotation.set(0, 0, 0)

    const box = this.computeWorldBounds(model)
    const size = box.getSize(new THREE.Vector3())
    const center = box.getCenter(new THREE.Vector3())

    const maxDim = Math.max(size.x, size.y, size.z)
    if (maxDim === 0) return

    const targetSize = this.getCurrentCapabilities().fitTargetSize
    const scale = targetSize / maxDim
    model.scale.set(scale, scale, scale)

    const scaledBox = this.computeWorldBounds(model)
    scaledBox.getCenter(center)
    scaledBox.getSize(size)

    model.position.set(-center.x, -scaledBox.min.y, -center.z)

    const newBox = this.computeWorldBounds(model)
    const newSize = newBox.getSize(new THREE.Vector3())
    const newCenter = newBox.getCenter(new THREE.Vector3())

    this.setupCamera(newSize, newCenter)
    this.setupGizmo(model)
  }

  setOriginalModel(model: THREE.Object3D | THREE.BufferGeometry | GLTF): void {
    this.originalModel = model
  }

  setUpDirection(direction: UpDirection): void {
    if (!this.currentModel) return

    const directionChanged = this.currentUpDirection !== direction

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

    if (directionChanged) {
      this.setupGizmo(this.currentModel)
    }
  }
}
