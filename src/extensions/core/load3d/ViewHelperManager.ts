import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'
import { ViewHelper } from 'three/examples/jsm/helpers/ViewHelper'

import {
  type EventManagerInterface,
  type ViewHelperManagerInterface
} from './interfaces'

export class ViewHelperManager implements ViewHelperManagerInterface {
  viewHelper: ViewHelper = {} as ViewHelper
  viewHelperContainer: HTMLDivElement = {} as HTMLDivElement

  private getActiveCamera: () => THREE.Camera
  private getControls: () => OrbitControls
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
    eventManager: EventManagerInterface
  ) {
    this.getActiveCamera = getActiveCamera
    this.getControls = getControls
    this.eventManager = eventManager
    this.helperCamera.position.set(0, 0, 2)
  }

  init(): void {}

  render(renderer: THREE.WebGLRenderer, size: number): void {
    const helper = this.viewHelper
    if (!helper.isViewHelper) return

    helper.quaternion.copy(this.getActiveCamera().quaternion).invert()
    helper.updateMatrixWorld()

    renderer.clearDepth()
    renderer.getViewport(this.savedViewport)
    renderer.setViewport(0, 0, size, size)
    renderer.render(helper, this.helperCamera)
    renderer.setViewport(this.savedViewport)
  }

  dispose(): void {
    if (this.viewHelper) {
      this.viewHelper.dispose()
    }

    if (this.viewHelperContainer && this.viewHelperContainer.parentNode) {
      this.viewHelperContainer.parentNode.removeChild(this.viewHelperContainer)
    }
  }

  createViewHelper(container: Element | HTMLElement): void {
    this.viewHelperContainer = document.createElement('div')

    this.viewHelperContainer.style.position = 'absolute'
    this.viewHelperContainer.style.bottom = '0'
    this.viewHelperContainer.style.left = '0'
    this.viewHelperContainer.style.width = '128px'
    this.viewHelperContainer.style.height = '128px'

    this.viewHelperContainer.addEventListener('pointerup', (event) => {
      event.stopPropagation()
      this.viewHelper.handleClick(event)
    })

    this.viewHelperContainer.addEventListener('pointerdown', (event) => {
      event.stopPropagation()
    })

    container.appendChild(this.viewHelperContainer)

    this.viewHelper = new ViewHelper(
      this.getActiveCamera(),
      this.viewHelperContainer
    )

    this.viewHelper.center = this.getControls().target
  }

  update(delta: number): void {
    if (this.viewHelper.animating) {
      this.viewHelper.update(delta)

      if (!this.viewHelper.animating) {
        const cameraState = {
          position: this.getActiveCamera().position.clone(),
          target: this.getControls().target.clone(),
          zoom:
            this.getActiveCamera() instanceof THREE.OrthographicCamera
              ? (this.getActiveCamera() as THREE.OrthographicCamera).zoom
              : (this.getActiveCamera() as THREE.PerspectiveCamera).zoom,
          cameraType:
            this.getActiveCamera() instanceof THREE.PerspectiveCamera
              ? 'perspective'
              : 'orthographic'
        }

        this.eventManager.emitEvent('cameraChanged', cameraState)
      }
    }
  }

  handleResize(): void {}

  visibleViewHelper(visible: boolean) {
    if (visible) {
      this.viewHelper.visible = true
      this.viewHelperContainer.style.display = 'block'
    } else {
      this.viewHelper.visible = false
      this.viewHelperContainer.style.display = 'none'
    }
  }

  recreateViewHelper(): void {
    if (this.viewHelper) {
      this.viewHelper.dispose()
    }

    this.viewHelper = new ViewHelper(
      this.getActiveCamera(),
      this.viewHelperContainer
    )
    this.viewHelper.center = this.getControls().target
  }

  reset(): void {}
}
