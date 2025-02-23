import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'
import { ViewHelper } from 'three/examples/jsm/helpers/ViewHelper'

import { NodeStorageInterface, ViewHelperManagerInterface } from './interfaces'

export class ViewHelperManager implements ViewHelperManagerInterface {
  viewHelper: ViewHelper = {} as ViewHelper
  viewHelperContainer: HTMLDivElement = {} as HTMLDivElement

  private getActiveCamera: () => THREE.Camera
  private getControls: () => OrbitControls
  private nodeStorage: NodeStorageInterface
  private renderer: THREE.WebGLRenderer

  constructor(
    renderer: THREE.WebGLRenderer,
    getActiveCamera: () => THREE.Camera,
    getControls: () => OrbitControls,
    nodeStorage: NodeStorageInterface
  ) {
    this.renderer = renderer
    this.getActiveCamera = getActiveCamera
    this.getControls = getControls
    this.nodeStorage = nodeStorage
  }

  init(): void {}

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
        this.nodeStorage.storeNodeProperty('Camera Info', {
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
        })
      }
    }
  }

  handleResize(): void {}

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
