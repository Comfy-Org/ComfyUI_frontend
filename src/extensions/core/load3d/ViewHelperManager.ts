import * as THREE from 'three'
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'
import { ViewHelper } from 'three/examples/jsm/helpers/ViewHelper'

import type {
  CameraState,
  EventManagerInterface,
  ViewHelperManagerInterface
} from './interfaces'

export class ViewHelperManager implements ViewHelperManagerInterface {
  viewHelper: ViewHelper | null = null
  viewHelperContainer: HTMLDivElement | null = null

  private getActiveCamera: () => THREE.Camera
  private getControls: () => OrbitControls
  private getCameraState: () => CameraState
  private eventManager: EventManagerInterface

  private readonly helperCamera = new THREE.OrthographicCamera(
    -2,
    2,
    2,
    -2,
    0,
    4
  )
  private readonly savedViewport = new THREE.Vector4()

  constructor(
    _renderer: THREE.WebGLRenderer,
    getActiveCamera: () => THREE.Camera,
    getControls: () => OrbitControls,
    getCameraState: () => CameraState,
    eventManager: EventManagerInterface
  ) {
    this.getActiveCamera = getActiveCamera
    this.getControls = getControls
    this.getCameraState = getCameraState
    this.eventManager = eventManager
    this.helperCamera.position.set(0, 0, 2)
  }

  init(): void {}

  render(renderer: THREE.WebGLRenderer, size: number): void {
    const helper = this.viewHelper
    if (!helper) return

    helper.quaternion.copy(this.getActiveCamera().quaternion).invert()
    helper.updateMatrixWorld()

    renderer.clearDepth()
    renderer.getViewport(this.savedViewport)
    renderer.setViewport(0, 0, size, size)
    renderer.render(helper, this.helperCamera)
    renderer.setViewport(this.savedViewport)
  }

  dispose(): void {
    this.viewHelper?.dispose()
    this.viewHelperContainer?.remove()
  }

  createViewHelper(container: Element | HTMLElement): void {
    const helperContainer = document.createElement('div')

    helperContainer.style.position = 'absolute'
    helperContainer.style.bottom = '0'
    helperContainer.style.left = '0'
    helperContainer.style.width = '128px'
    helperContainer.style.height = '128px'

    helperContainer.addEventListener('pointerup', (event) => {
      event.stopPropagation()
      this.viewHelper?.handleClick(event)
    })

    helperContainer.addEventListener('pointerdown', (event) => {
      event.stopPropagation()
    })

    container.appendChild(helperContainer)
    this.viewHelperContainer = helperContainer
    this.viewHelper = this.buildViewHelper(helperContainer)
  }

  update(delta: number): void {
    const helper = this.viewHelper
    if (!helper) return
    const { animating } = helper
    if (!animating) return

    helper.update(delta)
    if (!helper.animating) {
      this.eventManager.emitEvent('cameraChanged', this.getCameraState())
    }
  }

  handleResize(): void {}

  visibleViewHelper(visible: boolean) {
    if (this.viewHelper) this.viewHelper.visible = visible
    if (this.viewHelperContainer) {
      this.viewHelperContainer.style.display = visible ? 'block' : 'none'
    }
  }

  recreateViewHelper(): void {
    if (!this.viewHelperContainer) return
    this.viewHelper?.dispose()
    this.viewHelper = this.buildViewHelper(this.viewHelperContainer)
  }

  private buildViewHelper(container: HTMLDivElement): ViewHelper {
    const helper = new ViewHelper(this.getActiveCamera(), container)
    helper.center = this.getControls().target
    return helper
  }

  reset(): void {}
}
