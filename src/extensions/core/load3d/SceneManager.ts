import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'

import Load3dUtils from './Load3dUtils'
import { EventManagerInterface, SceneManagerInterface } from './interfaces'

export class SceneManager implements SceneManagerInterface {
  scene: THREE.Scene
  gridHelper: THREE.GridHelper

  backgroundScene: THREE.Scene
  backgroundCamera: THREE.OrthographicCamera
  backgroundMesh: THREE.Mesh | null = null
  backgroundTexture: THREE.Texture | null = null

  backgroundColorMaterial: THREE.MeshBasicMaterial | null = null
  currentBackgroundType: 'color' | 'image' = 'color'
  currentBackgroundColor: string = '#282828'

  private eventManager: EventManagerInterface
  private renderer: THREE.WebGLRenderer

  private getActiveCamera: () => THREE.Camera
  // @ts-expect-error unused variable
  private getControls: () => OrbitControls

  constructor(
    renderer: THREE.WebGLRenderer,
    getActiveCamera: () => THREE.Camera,
    getControls: () => OrbitControls,
    eventManager: EventManagerInterface
  ) {
    this.renderer = renderer
    this.eventManager = eventManager
    this.scene = new THREE.Scene()

    this.getActiveCamera = getActiveCamera
    this.getControls = getControls

    this.gridHelper = new THREE.GridHelper(20, 20)
    this.gridHelper.position.set(0, 0, 0)
    this.scene.add(this.gridHelper)

    this.backgroundScene = new THREE.Scene()
    this.backgroundCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, -1, 1)

    this.initBackgroundScene()
  }

  private initBackgroundScene(): void {
    const planeGeometry = new THREE.PlaneGeometry(2, 2)

    this.backgroundColorMaterial = new THREE.MeshBasicMaterial({
      color: new THREE.Color(this.currentBackgroundColor),
      transparent: false,
      depthWrite: false,
      depthTest: false,
      side: THREE.DoubleSide
    })

    this.backgroundMesh = new THREE.Mesh(
      planeGeometry,
      this.backgroundColorMaterial
    )
    this.backgroundMesh.position.set(0, 0, 0)
    this.backgroundScene.add(this.backgroundMesh)

    this.renderer.setClearColor(0x000000, 0)
  }

  init(): void {}

  dispose(): void {
    if (this.backgroundTexture) {
      this.backgroundTexture.dispose()
    }

    if (this.backgroundColorMaterial) {
      this.backgroundColorMaterial.dispose()
    }

    if (this.backgroundMesh) {
      this.backgroundMesh.geometry.dispose()
      if (this.backgroundMesh.material instanceof THREE.Material) {
        this.backgroundMesh.material.dispose()
      }
    }

    this.scene.clear()
  }

  toggleGrid(showGrid: boolean): void {
    if (this.gridHelper) {
      this.gridHelper.visible = showGrid
    }

    this.eventManager.emitEvent('showGridChange', showGrid)
  }

  setBackgroundColor(color: string): void {
    this.currentBackgroundColor = color
    this.currentBackgroundType = 'color'

    if (!this.backgroundMesh || !this.backgroundColorMaterial) {
      this.initBackgroundScene()
    }

    this.backgroundColorMaterial!.color.set(color)
    this.backgroundColorMaterial!.map = null
    this.backgroundColorMaterial!.transparent = false
    this.backgroundColorMaterial!.needsUpdate = true

    if (this.backgroundMesh) {
      this.backgroundMesh.material = this.backgroundColorMaterial!
    }

    if (this.backgroundTexture) {
      this.backgroundTexture.dispose()
      this.backgroundTexture = null
    }

    this.eventManager.emitEvent('backgroundColorChange', color)
  }

  async setBackgroundImage(uploadPath: string): Promise<void> {
    if (uploadPath === '') {
      this.setBackgroundColor(this.currentBackgroundColor)

      return
    }

    this.eventManager.emitEvent('backgroundImageLoadingStart', null)

    let imageUrl = Load3dUtils.getResourceURL(
      ...Load3dUtils.splitFilePath(uploadPath)
    )

    if (!imageUrl.startsWith('/api')) {
      imageUrl = '/api' + imageUrl
    }

    try {
      const textureLoader = new THREE.TextureLoader()
      const texture = await new Promise<THREE.Texture>((resolve, reject) => {
        textureLoader.load(imageUrl, resolve, undefined, reject)
      })

      if (this.backgroundTexture) {
        this.backgroundTexture.dispose()
      }

      texture.colorSpace = THREE.SRGBColorSpace

      this.backgroundTexture = texture
      this.currentBackgroundType = 'image'

      if (!this.backgroundMesh) {
        this.initBackgroundScene()
      }

      const imageMaterial = new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        depthWrite: false,
        depthTest: false,
        side: THREE.DoubleSide
      })

      if (this.backgroundMesh) {
        if (
          this.backgroundMesh.material !== this.backgroundColorMaterial &&
          this.backgroundMesh.material instanceof THREE.Material
        ) {
          this.backgroundMesh.material.dispose()
        }

        this.backgroundMesh.material = imageMaterial
        this.backgroundMesh.position.set(0, 0, 0)
      }

      this.updateBackgroundSize(
        this.backgroundTexture,
        this.backgroundMesh,
        this.renderer.domElement.width,
        this.renderer.domElement.height
      )

      this.eventManager.emitEvent('backgroundImageChange', uploadPath)
      this.eventManager.emitEvent('backgroundImageLoadingEnd', null)
    } catch (error) {
      this.eventManager.emitEvent('backgroundImageLoadingEnd', null)
      console.error('Error loading background image:', error)
      this.setBackgroundColor(this.currentBackgroundColor)
    }
  }

  removeBackgroundImage(): void {
    this.setBackgroundColor(this.currentBackgroundColor)
    this.eventManager.emitEvent('backgroundImageLoadingEnd', null)
  }

  updateBackgroundSize(
    backgroundTexture: THREE.Texture | null,
    backgroundMesh: THREE.Mesh | null,
    targetWidth: number,
    targetHeight: number
  ): void {
    if (!backgroundTexture || !backgroundMesh) return

    const material = backgroundMesh.material as THREE.MeshBasicMaterial

    if (!material.map) return

    const imageAspect =
      backgroundTexture.image.width / backgroundTexture.image.height
    const targetAspect = targetWidth / targetHeight

    if (imageAspect > targetAspect) {
      backgroundMesh.scale.set(imageAspect / targetAspect, 1, 1)
    } else {
      backgroundMesh.scale.set(1, targetAspect / imageAspect, 1)
    }

    material.needsUpdate = true
  }

  handleResize(width: number, height: number): void {
    if (
      this.backgroundTexture &&
      this.backgroundMesh &&
      this.currentBackgroundType === 'image'
    ) {
      this.updateBackgroundSize(
        this.backgroundTexture,
        this.backgroundMesh,
        width,
        height
      )
    }
  }

  renderBackground(): void {
    if (this.backgroundMesh) {
      const currentToneMapping = this.renderer.toneMapping
      const currentExposure = this.renderer.toneMappingExposure

      this.renderer.toneMapping = THREE.NoToneMapping
      this.renderer.render(this.backgroundScene, this.backgroundCamera)

      this.renderer.toneMapping = currentToneMapping
      this.renderer.toneMappingExposure = currentExposure
    }
  }

  getCurrentBackgroundInfo(): { type: 'color' | 'image'; value: string } {
    return {
      type: this.currentBackgroundType,
      value:
        this.currentBackgroundType === 'color'
          ? this.currentBackgroundColor
          : ''
    }
  }

  captureScene(
    width: number,
    height: number
  ): Promise<{ scene: string; mask: string; normal: string; lineart: string }> {
    return new Promise(async (resolve, reject) => {
      try {
        const originalWidth = this.renderer.domElement.width
        const originalHeight = this.renderer.domElement.height
        const originalClearColor = this.renderer.getClearColor(
          new THREE.Color()
        )
        const originalClearAlpha = this.renderer.getClearAlpha()
        const originalOutputColorSpace = this.renderer.outputColorSpace

        this.renderer.setSize(width, height)

        if (this.getActiveCamera() instanceof THREE.PerspectiveCamera) {
          const perspectiveCamera =
            this.getActiveCamera() as THREE.PerspectiveCamera

          perspectiveCamera.aspect = width / height
          perspectiveCamera.updateProjectionMatrix()
        } else {
          const orthographicCamera =
            this.getActiveCamera() as THREE.OrthographicCamera

          const frustumSize = 10
          const aspect = width / height

          orthographicCamera.left = (-frustumSize * aspect) / 2
          orthographicCamera.right = (frustumSize * aspect) / 2
          orthographicCamera.top = frustumSize / 2
          orthographicCamera.bottom = -frustumSize / 2

          orthographicCamera.updateProjectionMatrix()
        }

        if (
          this.backgroundTexture &&
          this.backgroundMesh &&
          this.currentBackgroundType === 'image'
        ) {
          this.updateBackgroundSize(
            this.backgroundTexture,
            this.backgroundMesh,
            width,
            height
          )
        }

        const originalMaterials = new Map<
          THREE.Mesh,
          THREE.Material | THREE.Material[]
        >()

        this.renderer.clear()
        this.renderBackground()
        this.renderer.render(this.scene, this.getActiveCamera())
        const sceneData = this.renderer.domElement.toDataURL('image/png')

        this.renderer.setClearColor(0x000000, 0)
        this.renderer.clear()
        this.renderer.render(this.scene, this.getActiveCamera())
        const maskData = this.renderer.domElement.toDataURL('image/png')

        this.scene.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            originalMaterials.set(child, child.material)

            child.material = new THREE.MeshNormalMaterial({
              flatShading: false,
              side: THREE.DoubleSide,
              normalScale: new THREE.Vector2(1, 1)
            })
          }
        })

        const gridVisible = this.gridHelper.visible
        this.gridHelper.visible = false

        this.renderer.setClearColor(0x000000, 1)
        this.renderer.clear()
        this.renderer.render(this.scene, this.getActiveCamera())
        const normalData = this.renderer.domElement.toDataURL('image/png')

        this.scene.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            const originalMaterial = originalMaterials.get(child)
            if (originalMaterial) {
              child.material = originalMaterial
            }
          }
        })

        let lineartModel: THREE.Group | null = null

        const originalSceneVisible: Map<THREE.Object3D, boolean> = new Map()

        this.scene.traverse((child) => {
          if (child instanceof THREE.Group && child.name === 'lineartModel') {
            lineartModel = child as THREE.Group
          }

          if (
            child instanceof THREE.Mesh &&
            !(child.parent?.name === 'lineartModel')
          ) {
            originalSceneVisible.set(child, child.visible)

            child.visible = false
          }
        })

        this.renderer.setClearColor(0xffffff, 1)
        this.renderer.clear()

        if (lineartModel !== null) {
          lineartModel = lineartModel as THREE.Group

          const originalLineartVisibleMap: Map<THREE.Object3D, boolean> =
            new Map()

          lineartModel.traverse((child: THREE.Object3D) => {
            if (child instanceof THREE.Mesh) {
              originalLineartVisibleMap.set(child, child.visible)

              child.visible = true
            }
          })

          const originalLineartVisible = lineartModel.visible
          lineartModel.visible = true

          this.renderer.render(this.scene, this.getActiveCamera())

          lineartModel.visible = originalLineartVisible

          originalLineartVisibleMap.forEach((visible, object) => {
            object.visible = visible
          })
        }

        const lineartData = this.renderer.domElement.toDataURL('image/png')

        originalSceneVisible.forEach((visible, object) => {
          object.visible = visible
        })

        this.gridHelper.visible = gridVisible

        this.renderer.setClearColor(originalClearColor, originalClearAlpha)
        this.renderer.setSize(originalWidth, originalHeight)
        this.renderer.outputColorSpace = originalOutputColorSpace

        this.handleResize(originalWidth, originalHeight)

        resolve({
          scene: sceneData,
          mask: maskData,
          normal: normalData,
          lineart: lineartData
        })
      } catch (error) {
        reject(error)
      }
    })
  }

  reset(): void {}
}
