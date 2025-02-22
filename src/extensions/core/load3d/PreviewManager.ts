import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'

import { EventManagerInterface, PreviewManagerInterface } from './interfaces'

export class PreviewManager implements PreviewManagerInterface {
  previewRenderer: THREE.WebGLRenderer | null = null
  previewCamera: THREE.Camera
  previewContainer: HTMLDivElement = {} as HTMLDivElement
  showPreview: boolean = true
  previewWidth: number = 120

  private targetWidth: number = 1024
  private targetHeight: number = 1024
  private scene: THREE.Scene
  private getActiveCamera: () => THREE.Camera
  private getControls: () => OrbitControls
  private eventManager: EventManagerInterface

  private getRenderer: () => THREE.WebGLRenderer

  private previewBackgroundScene: THREE.Scene
  private previewBackgroundCamera: THREE.OrthographicCamera
  private previewBackgroundMesh: THREE.Mesh | null = null
  private previewBackgroundTexture: THREE.Texture | null = null

  constructor(
    scene: THREE.Scene,
    getActiveCamera: () => THREE.Camera,
    getControls: () => OrbitControls,
    getRenderer: () => THREE.WebGLRenderer,
    eventManager: EventManagerInterface,
    backgroundScene: THREE.Scene,
    backgroundCamera: THREE.OrthographicCamera
  ) {
    this.scene = scene
    this.getActiveCamera = getActiveCamera
    this.getControls = getControls
    this.getRenderer = getRenderer
    this.eventManager = eventManager

    this.previewCamera = this.getActiveCamera().clone()

    this.previewBackgroundScene = backgroundScene.clone()
    this.previewBackgroundCamera = backgroundCamera.clone()

    const planeGeometry = new THREE.PlaneGeometry(2, 2)
    const planeMaterial = new THREE.MeshBasicMaterial({
      transparent: true,
      depthWrite: false,
      depthTest: false,
      side: THREE.DoubleSide
    })

    this.previewBackgroundMesh = new THREE.Mesh(planeGeometry, planeMaterial)
    this.previewBackgroundMesh.position.set(0, 0, 0)
    this.previewBackgroundScene.add(this.previewBackgroundMesh)
  }

  init(): void {}

  dispose(): void {
    if (this.previewRenderer) {
      this.previewRenderer.dispose()
    }

    if (this.previewBackgroundTexture) {
      this.previewBackgroundTexture.dispose()
    }

    if (this.previewBackgroundMesh) {
      this.previewBackgroundMesh.geometry.dispose()
      ;(this.previewBackgroundMesh.material as THREE.Material).dispose()
    }
  }

  createCapturePreview(container: Element | HTMLElement): void {
    this.previewRenderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      preserveDrawingBuffer: true
    })

    this.previewRenderer.setSize(this.targetWidth, this.targetHeight)
    this.previewRenderer.setClearColor(0x282828)
    this.previewRenderer.autoClear = false
    this.previewRenderer.outputColorSpace = THREE.SRGBColorSpace

    this.previewContainer = document.createElement('div')
    this.previewContainer.style.cssText = `
      position: absolute;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.2);
      display: block;
      transition: border-color 0.1s ease;
    `
    this.previewContainer.appendChild(this.previewRenderer.domElement)

    const MIN_PREVIEW_WIDTH = 120
    const MAX_PREVIEW_WIDTH = 240

    this.previewContainer.addEventListener('wheel', (event) => {
      event.preventDefault()
      event.stopPropagation()

      const delta = event.deltaY
      const oldWidth = this.previewWidth

      if (delta > 0) {
        this.previewWidth = Math.max(MIN_PREVIEW_WIDTH, this.previewWidth - 10)
      } else {
        this.previewWidth = Math.min(MAX_PREVIEW_WIDTH, this.previewWidth + 10)
      }

      if (
        oldWidth !== this.previewWidth &&
        (this.previewWidth === MIN_PREVIEW_WIDTH ||
          this.previewWidth === MAX_PREVIEW_WIDTH)
      ) {
        this.flashPreviewBorder()
      }

      this.updatePreviewSize()
      this.updatePreviewRender()
    })

    this.previewContainer.style.display = this.showPreview ? 'block' : 'none'

    container.appendChild(this.previewContainer)

    this.updatePreviewSize()
  }

  flashPreviewBorder(): void {
    const originalBorder = this.previewContainer.style.border
    const originalBoxShadow = this.previewContainer.style.boxShadow

    this.previewContainer.style.border = '2px solid rgba(255, 255, 255, 0.8)'
    this.previewContainer.style.boxShadow = '0 0 8px rgba(255, 255, 255, 0.5)'

    setTimeout(() => {
      this.previewContainer.style.border = originalBorder
      this.previewContainer.style.boxShadow = originalBoxShadow
    }, 100)
  }

  updatePreviewSize(): void {
    if (!this.previewContainer) return

    const previewHeight =
      (this.previewWidth * this.targetHeight) / this.targetWidth
    this.previewRenderer?.setSize(this.previewWidth, previewHeight, false)
  }

  updatePreviewRender(): void {
    if (!this.previewRenderer || !this.previewContainer || !this.showPreview)
      return

    if (
      !this.previewCamera ||
      (this.getActiveCamera() instanceof THREE.PerspectiveCamera &&
        !(this.previewCamera instanceof THREE.PerspectiveCamera)) ||
      (this.getActiveCamera() instanceof THREE.OrthographicCamera &&
        !(this.previewCamera instanceof THREE.OrthographicCamera))
    ) {
      this.previewCamera = this.getActiveCamera().clone()
    }

    this.previewCamera.position.copy(this.getActiveCamera().position)
    this.previewCamera.rotation.copy(this.getActiveCamera().rotation)

    const aspect = this.targetWidth / this.targetHeight

    if (this.getActiveCamera() instanceof THREE.OrthographicCamera) {
      const activeOrtho = this.getActiveCamera() as THREE.OrthographicCamera
      const previewOrtho = this.previewCamera as THREE.OrthographicCamera

      const frustumHeight =
        (activeOrtho.top - activeOrtho.bottom) / activeOrtho.zoom

      const frustumWidth = frustumHeight * aspect

      previewOrtho.top = frustumHeight / 2
      previewOrtho.left = -frustumWidth / 2
      previewOrtho.right = frustumWidth / 2
      previewOrtho.bottom = -frustumHeight / 2
      previewOrtho.zoom = 1

      previewOrtho.updateProjectionMatrix()
    } else {
      ;(this.previewCamera as THREE.PerspectiveCamera).aspect = aspect
      ;(this.previewCamera as THREE.PerspectiveCamera).fov = (
        this.getActiveCamera() as THREE.PerspectiveCamera
      ).fov
      ;(this.previewCamera as THREE.PerspectiveCamera).updateProjectionMatrix()
    }

    this.previewCamera.lookAt(this.getControls().target)

    const previewHeight =
      (this.previewWidth * this.targetHeight) / this.targetWidth
    this.previewRenderer.setSize(this.previewWidth, previewHeight, false)
    this.previewRenderer.outputColorSpace = THREE.SRGBColorSpace
    this.previewRenderer.clear()

    if (this.previewBackgroundMesh && this.previewBackgroundTexture) {
      const material = this.previewBackgroundMesh
        .material as THREE.MeshBasicMaterial
      if (material.map) {
        const currentToneMapping = this.previewRenderer.toneMapping
        const currentExposure = this.previewRenderer.toneMappingExposure

        this.previewRenderer.toneMapping = THREE.NoToneMapping
        this.previewRenderer.render(
          this.previewBackgroundScene,
          this.previewBackgroundCamera
        )

        this.previewRenderer.toneMapping = currentToneMapping
        this.previewRenderer.toneMappingExposure = currentExposure
      }
    }

    this.previewRenderer.render(this.scene, this.previewCamera)
  }

  togglePreview(showPreview: boolean): void {
    if (this.previewRenderer) {
      this.showPreview = showPreview
      this.previewContainer.style.display = this.showPreview ? 'block' : 'none'
    }

    this.eventManager.emitEvent('showPreviewChange', showPreview)
  }

  setTargetSize(width: number, height: number): void {
    const oldAspect = this.targetWidth / this.targetHeight

    this.targetWidth = width
    this.targetHeight = height

    this.updatePreviewSize()

    const newAspect = width / height
    if (Math.abs(oldAspect - newAspect) > 0.001) {
      this.updateBackgroundSize(
        this.previewBackgroundTexture,
        this.previewBackgroundMesh,
        width,
        height
      )
    }

    if (this.previewRenderer && this.previewCamera) {
      if (this.previewCamera instanceof THREE.PerspectiveCamera) {
        this.previewCamera.aspect = width / height
        this.previewCamera.updateProjectionMatrix()
      } else if (this.previewCamera instanceof THREE.OrthographicCamera) {
        const frustumSize = 10
        const aspect = width / height
        this.previewCamera.left = (-frustumSize * aspect) / 2
        this.previewCamera.right = (frustumSize * aspect) / 2
        this.previewCamera.updateProjectionMatrix()
      }
    }
  }

  handleResize(): void {
    this.updatePreviewSize()
    this.updatePreviewRender()
  }

  updateBackgroundTexture(texture: THREE.Texture | null): void {
    if (this.previewBackgroundTexture) {
      this.previewBackgroundTexture.dispose()
    }

    this.previewBackgroundTexture = texture

    if (texture && this.previewBackgroundMesh) {
      const material2 = this.previewBackgroundMesh
        .material as THREE.MeshBasicMaterial
      material2.map = texture
      material2.needsUpdate = true

      this.previewBackgroundMesh.position.set(0, 0, 0)

      this.updateBackgroundSize(
        this.previewBackgroundTexture,
        this.previewBackgroundMesh,
        this.targetWidth,
        this.targetHeight
      )
    }
  }

  private updateBackgroundSize(
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

  reset(): void {}
}
