import * as THREE from 'three'
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial'
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2'
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry'
import { GLTF } from 'three/examples/jsm/loaders/GLTFLoader'
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils'

import Load3dUtils from './Load3dUtils'
import { ColoredShadowMaterial } from './conditional-lines/ColoredShadowMaterial'
import { ConditionalEdgesGeometry } from './conditional-lines/ConditionalEdgesGeometry'
import { ConditionalEdgesShader } from './conditional-lines/ConditionalEdgesShader.js'
import { ConditionalLineMaterial } from './conditional-lines/Lines2/ConditionalLineMaterial'
import { ConditionalLineSegmentsGeometry } from './conditional-lines/Lines2/ConditionalLineSegmentsGeometry'
import {
  EventManagerInterface,
  Load3DOptions,
  MaterialMode,
  ModelManagerInterface,
  UpDirection
} from './interfaces'

export class ModelManager implements ModelManagerInterface {
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

  private scene: THREE.Scene
  private renderer: THREE.WebGLRenderer
  private eventManager: EventManagerInterface
  private activeCamera: THREE.Camera
  private setupCamera: (size: THREE.Vector3) => void
  private lineartModel: THREE.Group
  private createLineartModel: boolean = false

  LIGHT_MODEL = 0xffffff
  LIGHT_LINES = 0x455a64

  conditionalModel: THREE.Object3D | null = null
  edgesModel: THREE.Object3D | null = null
  backgroundModel: THREE.Object3D | null = null
  shadowModel: THREE.Object3D | null = null
  depthModel: THREE.Object3D | null = null

  constructor(
    scene: THREE.Scene,
    renderer: THREE.WebGLRenderer,
    eventManager: EventManagerInterface,
    getActiveCamera: () => THREE.Camera,
    setupCamera: (size: THREE.Vector3) => void,
    options: Load3DOptions
  ) {
    this.scene = scene
    this.renderer = renderer
    this.eventManager = eventManager
    this.activeCamera = getActiveCamera()
    this.setupCamera = setupCamera
    this.textureLoader = new THREE.TextureLoader()

    if (
      options &&
      !options.inputSpec?.isPreview &&
      !options.inputSpec?.isAnimation
    ) {
      this.createLineartModel = true
    }

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

    this.lineartModel = new THREE.Group()

    this.lineartModel.name = 'lineartModel'
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

    this.disposeLineartModel()
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

  async applyTexture(texturePath: string): Promise<void> {
    if (!this.currentModel) {
      throw new Error('No model available to apply texture to')
    }

    if (this.appliedTexture) {
      this.appliedTexture.dispose()
    }

    try {
      let imageUrl = Load3dUtils.getResourceURL(
        ...Load3dUtils.splitFilePath(texturePath)
      )

      if (!imageUrl.startsWith('/api')) {
        imageUrl = '/api' + imageUrl
      }

      this.appliedTexture = await new Promise<THREE.Texture>(
        (resolve, reject) => {
          this.textureLoader.load(
            imageUrl,
            (texture) => {
              texture.colorSpace = THREE.SRGBColorSpace
              texture.wrapS = THREE.RepeatWrapping
              texture.wrapT = THREE.RepeatWrapping
              resolve(texture)
            },
            undefined,
            (error) => reject(error)
          )
        }
      )

      if (this.materialMode === 'original') {
        this.currentModel.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            const material = new THREE.MeshStandardMaterial({
              map: this.appliedTexture,
              metalness: 0.1,
              roughness: 0.8,
              side: THREE.DoubleSide
            })

            if (!this.originalMaterials.has(child)) {
              this.originalMaterials.set(child, child.material)
            }

            child.material = material
          }
        })
      }

      return Promise.resolve()
    } catch (error) {
      console.error('Error applying texture:', error)
      return Promise.reject(error)
    }
  }

  disposeLineartModel(): void {
    this.disposeEdgesModel()
    this.disposeShadowModel()
    this.disposeBackgroundModel()
    this.disposeDepthModel()
    this.disposeConditionalModel()
  }

  disposeEdgesModel(): void {
    if (this.edgesModel) {
      if (this.edgesModel.parent) {
        this.edgesModel.parent.remove(this.edgesModel)
      }

      this.edgesModel.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          if (Array.isArray(child.material)) {
            child.material.forEach((m) => m.dispose())
          } else {
            child.material.dispose()
          }
        }
      })
    }
  }

  initEdgesModel() {
    this.disposeEdgesModel()

    if (!this.currentModel) {
      return
    }

    this.edgesModel = this.currentModel.clone()
    this.lineartModel.add(this.edgesModel)

    const meshes: THREE.Mesh[] = []

    this.edgesModel.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        meshes.push(child)
      }
    })

    for (const key in meshes) {
      const mesh = meshes[key]
      const parent = mesh.parent

      let lineGeom = new THREE.EdgesGeometry(mesh.geometry, 85)

      const line = new THREE.LineSegments(
        lineGeom,
        new THREE.LineBasicMaterial({ color: this.LIGHT_LINES })
      )
      line.position.copy(mesh.position)
      line.scale.copy(mesh.scale)
      line.rotation.copy(mesh.rotation)

      const thickLineGeom = new LineSegmentsGeometry().fromEdgesGeometry(
        lineGeom
      )
      const thickLines = new LineSegments2(
        thickLineGeom,
        new LineMaterial({ color: this.LIGHT_LINES, linewidth: 13 })
      )
      thickLines.position.copy(mesh.position)
      thickLines.scale.copy(mesh.scale)
      thickLines.rotation.copy(mesh.rotation)

      parent?.remove(mesh)
      parent?.add(line)
      parent?.add(thickLines)
    }

    this.edgesModel.traverse((child) => {
      if (
        child instanceof THREE.Mesh &&
        child.material &&
        child.material.resolution
      ) {
        this.renderer.getSize(child.material.resolution)
        child.material.resolution.multiplyScalar(window.devicePixelRatio)
        child.material.linewidth = 1
      }
    })
  }

  setEdgeThreshold(threshold: number): void {
    if (!this.edgesModel || !this.currentModel) {
      return
    }

    const linesToRemove: THREE.Object3D[] = []
    this.edgesModel.traverse((child) => {
      if (
        child instanceof THREE.LineSegments ||
        child instanceof LineSegments2
      ) {
        linesToRemove.push(child)
      }
    })

    for (const line of linesToRemove) {
      if (line.parent) {
        line.parent.remove(line)
      }
    }

    const meshes: THREE.Mesh[] = []
    this.currentModel.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        meshes.push(child)
      }
    })

    for (const mesh of meshes) {
      const meshClone = mesh.clone()

      let lineGeom = new THREE.EdgesGeometry(meshClone.geometry, threshold)

      const line = new THREE.LineSegments(
        lineGeom,
        new THREE.LineBasicMaterial({ color: this.LIGHT_LINES })
      )
      line.position.copy(mesh.position)
      line.scale.copy(mesh.scale)
      line.rotation.copy(mesh.rotation)

      const thickLineGeom = new LineSegmentsGeometry().fromEdgesGeometry(
        lineGeom
      )
      const thickLines = new LineSegments2(
        thickLineGeom,
        new LineMaterial({ color: this.LIGHT_LINES, linewidth: 13 })
      )
      thickLines.position.copy(mesh.position)
      thickLines.scale.copy(mesh.scale)
      thickLines.rotation.copy(mesh.rotation)

      this.edgesModel.add(line)
      this.edgesModel.add(thickLines)
    }

    this.edgesModel.traverse((child) => {
      if (
        child instanceof THREE.Mesh &&
        child.material &&
        child.material.resolution
      ) {
        this.renderer.getSize(child.material.resolution)
        child.material.resolution.multiplyScalar(window.devicePixelRatio)
        child.material.linewidth = 1
      }
    })
    this.eventManager.emitEvent('edgeThresholdChange', threshold)
  }

  disposeBackgroundModel(): void {
    if (this.backgroundModel) {
      if (this.backgroundModel.parent) {
        this.backgroundModel.parent.remove(this.backgroundModel)
      }

      this.backgroundModel.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.material.dispose()
        }
      })
    }
  }

  disposeShadowModel(): void {
    if (this.shadowModel) {
      if (this.shadowModel.parent) {
        this.shadowModel.parent.remove(this.shadowModel)
      }

      this.shadowModel.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.material.dispose()
        }
      })
    }
  }

  disposeDepthModel(): void {
    if (this.depthModel) {
      if (this.depthModel.parent) {
        this.depthModel.parent.remove(this.depthModel)
      }

      this.depthModel.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.material.dispose()
        }
      })
    }
  }

  disposeConditionalModel(): void {
    if (this.conditionalModel) {
      if (this.conditionalModel.parent) {
        this.conditionalModel.parent.remove(this.conditionalModel)
      }

      this.conditionalModel.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.material.dispose()
        }
      })
    }
  }

  initBackgroundModel() {
    this.disposeBackgroundModel()
    this.disposeShadowModel()
    this.disposeDepthModel()

    if (!this.currentModel) {
      return
    }

    this.backgroundModel = this.currentModel.clone()
    this.backgroundModel.visible = true
    this.backgroundModel.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.material = new THREE.MeshBasicMaterial({
          color: this.LIGHT_MODEL
        })
        child.material.polygonOffset = true
        child.material.polygonOffsetFactor = 1
        child.material.polygonOffsetUnits = 1
        child.renderOrder = 2
        child.material.transparent = false
        child.material.opacity = 0.25
      }
    })

    this.lineartModel.add(this.backgroundModel)

    this.shadowModel = this.currentModel.clone()

    // TODO this has some error, need to fix later
    this.shadowModel.visible = false

    this.shadowModel.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.material = new ColoredShadowMaterial({
          color: this.LIGHT_MODEL,
          shininess: 1.0
        })
        child.material.polygonOffset = true
        child.material.polygonOffsetFactor = 1
        child.material.polygonOffsetUnits = 1
        child.receiveShadow = true
        child.renderOrder = 2
      }
    })

    this.lineartModel.add(this.shadowModel)

    this.depthModel = this.currentModel.clone()
    this.depthModel.visible = true
    this.depthModel.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.material = new THREE.MeshBasicMaterial({
          color: this.LIGHT_MODEL
        })
        child.material.polygonOffset = true
        child.material.polygonOffsetFactor = 1
        child.material.polygonOffsetUnits = 1
        child.material.colorWrite = false
        child.renderOrder = 1
      }
    })

    this.lineartModel.add(this.depthModel)
  }

  initConditionalModel() {
    this.disposeConditionalModel()

    if (!this.currentModel) {
      return
    }

    this.conditionalModel = this.currentModel.clone()
    this.lineartModel.add(this.conditionalModel)
    this.conditionalModel.visible = true

    const meshes: THREE.Mesh[] = []

    this.conditionalModel.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        meshes.push(child)
      }
    })

    for (const key in meshes) {
      const mesh = meshes[key]
      const parent = mesh.parent

      const mergedGeom = mesh.geometry.clone()
      for (const key in mergedGeom.attributes) {
        if (key !== 'position') {
          mergedGeom.deleteAttribute(key)
        }
      }

      const lineGeom = new ConditionalEdgesGeometry(mergeVertices(mergedGeom))
      const material = new THREE.ShaderMaterial(ConditionalEdgesShader)
      material.uniforms.diffuse.value.set(this.LIGHT_LINES)

      const line = new THREE.LineSegments(lineGeom, material)
      line.position.copy(mesh.position)
      line.scale.copy(mesh.scale)
      line.rotation.copy(mesh.rotation)

      const thickLineGeom =
        new ConditionalLineSegmentsGeometry().fromConditionalEdgesGeometry(
          lineGeom
        )

      const conditionalLineMaterial = new ConditionalLineMaterial({
        color: this.LIGHT_LINES,
        linewidth: 2
      })

      const thickLines = new LineSegments2(
        thickLineGeom,
        conditionalLineMaterial
      )
      thickLines.position.copy(mesh.position)
      thickLines.scale.copy(mesh.scale)
      thickLines.rotation.copy(mesh.rotation)

      parent?.remove(mesh)
      parent?.add(line)
      parent?.add(thickLines)
    }

    this.conditionalModel.traverse((child) => {
      if (
        child instanceof THREE.Mesh &&
        child.material &&
        child.material.resolution
      ) {
        this.renderer.getSize(child.material.resolution)
        child.material.resolution.multiplyScalar(window.devicePixelRatio)
        child.material.linewidth = 1
      }
    })
  }

  setMaterialMode(mode: MaterialMode): void {
    if (!this.currentModel || mode === this.materialMode) {
      return
    }

    this.materialMode = mode

    if (mode === 'depth') {
      this.renderer.outputColorSpace = THREE.LinearSRGBColorSpace
    } else {
      this.renderer.outputColorSpace = THREE.SRGBColorSpace
    }

    if (this.currentModel) {
      this.currentModel.visible = mode !== 'lineart'
    }

    if (this.lineartModel) {
      this.lineartModel.visible = mode === 'lineart'
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
    this.originalFileName = null
    this.originalURL = null

    if (this.appliedTexture) {
      this.appliedTexture.dispose()
      this.appliedTexture = null
    }

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

    if (this.createLineartModel) {
      this.setupLineartModel()
    }
  }

  setupLineartModel(): void {
    this.scene.add(this.lineartModel)

    this.initEdgesModel()
    this.initBackgroundModel()
    this.initConditionalModel()

    this.lineartModel.visible = false
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
      this.lineartModel.rotation.copy(this.originalRotation)
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

    this.lineartModel.rotation.copy(this.currentModel.rotation)

    this.eventManager.emitEvent('upDirectionChange', direction)
  }
}
