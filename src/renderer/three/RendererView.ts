import type * as THREE from 'three'

import type {
  RendererViewState,
  SharedRendererHandle
} from './sharedWebGLRenderer'
import {
  acquireSharedRenderer,
  applyRendererViewState,
  createRendererViewState,
  ensureRendererSize,
  ensureSharedHighPrecisionTarget,
  resolveHighPrecisionTarget
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
  private outputTarget: THREE.WebGLRenderTarget | null = null
  private outputWidth = 1
  private outputHeight = 1

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

  beginRender(highPrecision = false): void {
    ensureRendererSize(this.renderer, this.width, this.height)
    applyRendererViewState(this.renderer, this.state)
    this.bindOutput(
      highPrecision
        ? ensureSharedHighPrecisionTarget(this.width, this.height)
        : null,
      this.width,
      this.height
    )
  }

  bindOutput(
    target: THREE.WebGLRenderTarget | null,
    width: number,
    height: number
  ): void {
    this.outputTarget = target
    this.outputWidth = width
    this.outputHeight = height
    if (target) target.texture.colorSpace = this.state.outputColorSpace
    this.renderer.setRenderTarget(target)
    this.setViewport(0, 0, width, height)
    this.setScissor(0, 0, width, height)
    this.setScissorTest(false)
  }

  resolveOutput(): void {
    if (!this.outputTarget) return
    resolveHighPrecisionTarget(
      this.renderer,
      this.outputTarget,
      this.outputWidth,
      this.outputHeight
    )
    this.outputTarget = null
  }

  setViewport(x: number, y: number, width: number, height: number): void {
    this.renderer.setViewport(x, y, width, height)
    this.outputTarget?.viewport.set(x, y, width, height)
  }

  getViewport(target: THREE.Vector4): THREE.Vector4 {
    return this.renderer.getViewport(target)
  }

  setScissor(x: number, y: number, width: number, height: number): void {
    this.renderer.setScissor(x, y, width, height)
    this.outputTarget?.scissor.set(x, y, width, height)
  }

  setScissorTest(enabled: boolean): void {
    this.renderer.setScissorTest(enabled)
    if (this.outputTarget) this.outputTarget.scissorTest = enabled
  }

  blit(): void {
    this.resolveOutput()
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
