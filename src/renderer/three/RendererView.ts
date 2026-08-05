import type * as THREE from 'three'

import type {
  RendererViewState,
  SharedRendererHandle
} from './sharedWebGLRenderer'
import {
  acquireSharedRenderer,
  applyRendererViewState,
  createRendererViewState,
  ensureRendererSize
} from './sharedWebGLRenderer'

export class RendererView {
  readonly renderer: THREE.WebGLRenderer
  readonly canvas: HTMLCanvasElement
  readonly state: RendererViewState = createRendererViewState()

  width = 1
  height = 1

  private readonly context: CanvasRenderingContext2D
  private readonly handle: SharedRendererHandle
  private resizeObserver: ResizeObserver | null = null

  constructor(container: HTMLElement) {
    this.canvas = document.createElement('canvas')
    this.canvas.classList.add(
      'absolute',
      'inset-0',
      'h-full',
      'w-full',
      'outline-none'
    )
    const context = this.canvas.getContext('2d')
    if (!context) {
      throw new Error('Failed to create 2D context for 3D view')
    }
    this.context = context

    this.handle = acquireSharedRenderer()
    this.renderer = this.handle.renderer
    container.appendChild(this.canvas)
  }

  setSize(width: number, height: number): void {
    this.width = Math.max(1, Math.round(width))
    this.height = Math.max(1, Math.round(height))
    if (this.canvas.width !== this.width) this.canvas.width = this.width
    if (this.canvas.height !== this.height) this.canvas.height = this.height
    ensureRendererSize(this.renderer, this.width, this.height)
  }

  beginRender(): void {
    ensureRendererSize(this.renderer, this.width, this.height)
    applyRendererViewState(this.renderer, this.state)
  }

  blit(): void {
    const source = this.renderer.domElement
    this.context.globalCompositeOperation = 'copy'
    this.context.drawImage(
      source,
      0,
      source.height - this.height,
      this.width,
      this.height,
      0,
      0,
      this.width,
      this.height
    )
  }

  observeResize(target: Element, onResize: () => void): void {
    if (typeof ResizeObserver === 'undefined') return
    this.resizeObserver?.disconnect()
    this.resizeObserver = new ResizeObserver(() => onResize())
    this.resizeObserver.observe(target)
  }

  dispose(): void {
    this.resizeObserver?.disconnect()
    this.resizeObserver = null
    this.canvas.remove()
    this.handle.release()
  }
}
