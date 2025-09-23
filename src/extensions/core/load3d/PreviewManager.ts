import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'

import { EventManagerInterface, PreviewManagerInterface } from './interfaces'

export class PreviewManager implements PreviewManagerInterface {
  previewCamera: THREE.Camera
  previewContainer: HTMLDivElement = null!
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

  private previewBackgroundColorMaterial: THREE.MeshBasicMaterial | null = null
  private currentBackgroundColor: THREE.Color = new THREE.Color(0x282828)

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

    this.initPreviewBackgroundScene()
  }

  private initPreviewBackgroundScene(): void {
    const planeGeometry = new THREE.PlaneGeometry(2, 2)

    this.previewBackgroundColorMaterial = new THREE.MeshBasicMaterial({
      color: this.currentBackgroundColor.clone(),
      transparent: false,
      depthWrite: false,
      depthTest: false,
      side: THREE.DoubleSide
    })

    this.previewBackgroundMesh = new THREE.Mesh(
      planeGeometry,
      this.previewBackgroundColorMaterial
    )
    this.previewBackgroundMesh.position.set(0, 0, 0)
    this.previewBackgroundScene.add(this.previewBackgroundMesh)
  }

  init(): void {}

  dispose(): void {
    if (this.previewBackgroundTexture) {
      this.previewBackgroundTexture.dispose()
    }

    if (this.previewBackgroundColorMaterial) {
      this.previewBackgroundColorMaterial.dispose()
    }

    if (this.previewBackgroundMesh) {
      this.previewBackgroundMesh.geometry.dispose()
      if (this.previewBackgroundMesh.material instanceof THREE.Material) {
        this.previewBackgroundMesh.material.dispose()
      }
    }
  }

  createCapturePreview(container: Element | HTMLElement): void {
    this.previewContainer = document.createElement('div')
    this.previewContainer.style.cssText = `
      position: absolute;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.2);
      display: block;
      transition: border-color 0.1s ease;
    `

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

    this.previewContainer.style.width = `${this.previewWidth}px`
    this.previewContainer.style.height = `${previewHeight}px`
  }

  getPreviewViewport(): {
    left: number
    bottom: number
    width: number
    height: number
  } | null {
    if (!this.showPreview || !this.previewContainer) {
      return null
    }

    const renderer = this.getRenderer()
    const canvas = renderer.domElement

    const containerRect = this.previewContainer.getBoundingClientRect()
    const canvasRect = canvas.getBoundingClientRect()

    if (
      containerRect.bottom < canvasRect.top ||
      containerRect.top > canvasRect.bottom ||
      containerRect.right < canvasRect.left ||
      containerRect.left > canvasRect.right
    ) {
      return null
    }

    const width = parseFloat(this.previewContainer.style.width)
    const height = parseFloat(this.previewContainer.style.height)

    const left = this.getRenderer().domElement.clientWidth - width

    const bottom = 0

    return { left, bottom, width, height }
  }

  renderPreview(): void {
    const viewport = this.getPreviewViewport()
    if (!viewport) return

    const renderer = this.getRenderer()

    const originalClearColor = renderer.getClearColor(new THREE.Color())
    const originalClearAlpha = renderer.getClearAlpha()

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
      const activePerspective =
        this.getActiveCamera() as THREE.PerspectiveCamera
      const previewPerspective = this.previewCamera as THREE.PerspectiveCamera

      previewPerspective.fov = activePerspective.fov
      previewPerspective.zoom = activePerspective.zoom
      previewPerspective.aspect = aspect

      previewPerspective.updateProjectionMatrix()
    }

    this.previewCamera.lookAt(this.getControls().target)

    renderer.setViewport(
      viewport.left,
      viewport.bottom,
      viewport.width,
      viewport.height
    )
    renderer.setScissor(
      viewport.left,
      viewport.bottom,
      viewport.width,
      viewport.height
    )

    renderer.setClearColor(0x000000, 0)
    renderer.clear()

    this.renderPreviewBackground(renderer)

    renderer.render(this.scene, this.previewCamera)

    renderer.setClearColor(originalClearColor, originalClearAlpha)
  }

  private renderPreviewBackground(renderer: THREE.WebGLRenderer): void {
    if (this.previewBackgroundMesh) {
      const currentToneMapping = renderer.toneMapping
      const currentExposure = renderer.toneMappingExposure

      renderer.toneMapping = THREE.NoToneMapping
      renderer.render(this.previewBackgroundScene, this.previewBackgroundCamera)

      renderer.toneMapping = currentToneMapping
      renderer.toneMappingExposure = currentExposure
    }
  }

  setPreviewBackgroundColor(color: string | number | THREE.Color): void {
    this.currentBackgroundColor.set(color)

    if (!this.previewBackgroundMesh || !this.previewBackgroundColorMaterial) {
      this.initPreviewBackgroundScene()
    }

    this.previewBackgroundColorMaterial!.color.copy(this.currentBackgroundColor)

    if (this.previewBackgroundMesh) {
      this.previewBackgroundMesh.material = this.previewBackgroundColorMaterial!
    }

    if (this.previewBackgroundTexture) {
      this.previewBackgroundTexture.dispose()
      this.previewBackgroundTexture = null
    }
  }

  togglePreview(showPreview: boolean): void {
    this.showPreview = showPreview
    if (this.previewContainer) {
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

    if (this.previewCamera) {
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
  }

  updateBackgroundTexture(texture: THREE.Texture | null): void {
    if (texture) {
      if (this.previewBackgroundTexture) {
        this.previewBackgroundTexture.dispose()
      }

      this.previewBackgroundTexture = texture

      if (this.previewBackgroundMesh) {
        const imageMaterial = new THREE.MeshBasicMaterial({
          map: texture,
          transparent: true,
          depthWrite: false,
          depthTest: false,
          side: THREE.DoubleSide
        })

        if (
          this.previewBackgroundMesh.material instanceof THREE.Material &&
          this.previewBackgroundMesh.material !==
            this.previewBackgroundColorMaterial
        ) {
          this.previewBackgroundMesh.material.dispose()
        }

        this.previewBackgroundMesh.material = imageMaterial
        this.previewBackgroundMesh.position.set(0, 0, 0)

        this.updateBackgroundSize(
          this.previewBackgroundTexture,
          this.previewBackgroundMesh,
          this.targetWidth,
          this.targetHeight
        )
      }
    } else {
      this.setPreviewBackgroundColor(this.currentBackgroundColor)
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
