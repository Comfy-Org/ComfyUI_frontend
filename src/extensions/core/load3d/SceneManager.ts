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

    const planeGeometry = new THREE.PlaneGeometry(2, 2)
    const planeMaterial = new THREE.MeshBasicMaterial({
      transparent: true,
      depthWrite: false,
      depthTest: false,
      side: THREE.DoubleSide
    })

    this.backgroundMesh = new THREE.Mesh(planeGeometry, planeMaterial)
    this.backgroundMesh.position.set(0, 0, 0)
    this.backgroundScene.add(this.backgroundMesh)
  }

  init(): void {}

  dispose(): void {
    if (this.backgroundTexture) {
      this.backgroundTexture.dispose()
    }

    if (this.backgroundMesh) {
      this.backgroundMesh.geometry.dispose()
      ;(this.backgroundMesh.material as THREE.Material).dispose()
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
    this.renderer.setClearColor(new THREE.Color(color))
    this.eventManager.emitEvent('backgroundColorChange', color)
  }

  async setBackgroundImage(uploadPath: string): Promise<void> {
    if (uploadPath === '') {
      this.removeBackgroundImage()
      return
    }

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

      const material = this.backgroundMesh?.material as THREE.MeshBasicMaterial
      material.map = texture
      material.needsUpdate = true

      this.backgroundMesh?.position.set(0, 0, 0)

      this.updateBackgroundSize(
        this.backgroundTexture,
        this.backgroundMesh,
        this.renderer.domElement.width,
        this.renderer.domElement.height
      )

      this.eventManager.emitEvent('backgroundImageChange', uploadPath)
    } catch (error) {
      console.error('Error loading background image:', error)
    }
  }

  removeBackgroundImage(): void {
    if (this.backgroundMesh) {
      const material = this.backgroundMesh.material as THREE.MeshBasicMaterial
      material.map = null
      material.needsUpdate = true
    }

    if (this.backgroundTexture) {
      this.backgroundTexture.dispose()
      this.backgroundTexture = null
    }
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
    if (this.backgroundTexture && this.backgroundMesh) {
      this.updateBackgroundSize(
        this.backgroundTexture,
        this.backgroundMesh,
        width,
        height
      )
    }
  }

  renderBackground(): void {
    if (this.backgroundMesh && this.backgroundTexture) {
      const material = this.backgroundMesh.material as THREE.MeshBasicMaterial
      if (material.map) {
        const currentToneMapping = this.renderer.toneMapping
        const currentExposure = this.renderer.toneMappingExposure

        this.renderer.toneMapping = THREE.NoToneMapping
        this.renderer.render(this.backgroundScene, this.backgroundCamera)

        this.renderer.toneMapping = currentToneMapping
        this.renderer.toneMappingExposure = currentExposure
      }
    }
  }

  captureScene(
    width: number,
    height: number
  ): Promise<{ scene: string; mask: string }> {
    return new Promise(async (resolve, reject) => {
      try {
        const originalWidth = this.renderer.domElement.width
        const originalHeight = this.renderer.domElement.height
        const originalClearColor = this.renderer.getClearColor(
          new THREE.Color()
        )
        const originalClearAlpha = this.renderer.getClearAlpha()
        const originalToneMapping = this.renderer.toneMapping
        const originalExposure = this.renderer.toneMappingExposure

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

        if (this.backgroundTexture && this.backgroundMesh) {
          this.updateBackgroundSize(
            this.backgroundTexture,
            this.backgroundMesh,
            width,
            height
          )
        }

        this.renderer.clear()

        if (this.backgroundMesh && this.backgroundTexture) {
          const material = this.backgroundMesh
            .material as THREE.MeshBasicMaterial

          if (material.map) {
            this.renderer.toneMapping = THREE.NoToneMapping
            this.renderer.render(this.backgroundScene, this.backgroundCamera)
            this.renderer.toneMapping = originalToneMapping
            this.renderer.toneMappingExposure = originalExposure
          }
        }

        this.renderer.render(this.scene, this.getActiveCamera())
        const sceneData = this.renderer.domElement.toDataURL('image/png')

        this.renderer.setClearColor(0x000000, 0)
        this.renderer.clear()
        this.renderer.render(this.scene, this.getActiveCamera())
        const maskData = this.renderer.domElement.toDataURL('image/png')

        this.renderer.setClearColor(originalClearColor, originalClearAlpha)
        this.renderer.setSize(originalWidth, originalHeight)

        this.handleResize(width, height)

        resolve({ scene: sceneData, mask: maskData })
      } catch (error) {
        reject(error)
      }
    })
  }

  reset(): void {}
}
