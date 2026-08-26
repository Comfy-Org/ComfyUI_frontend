import type * as THREE from 'three'

export class WebGLViewport {
  renderer: THREE.WebGLRenderer
  private resizeObserver: ResizeObserver | null = null

  constructor(renderer: THREE.WebGLRenderer) {
    this.renderer = renderer
  }

  observeResize(target: Element, onResize: () => void): void {
    if (typeof ResizeObserver === 'undefined') return
    this.resizeObserver?.disconnect()
    this.resizeObserver = new ResizeObserver(() => onResize())
    this.resizeObserver.observe(target)
  }

  disposeRenderer(): void {
    this.resizeObserver?.disconnect()
    this.resizeObserver = null

    this.renderer.forceContextLoss()
    this.renderer.domElement.dispatchEvent(
      new Event('webglcontextlost', { bubbles: true, cancelable: true })
    )
    this.renderer.dispose()
    this.renderer.domElement.remove()
  }
}
