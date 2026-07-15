import * as THREE from 'three'
import { describe, expect, it, vi } from 'vitest'

import {
  acquireSharedRenderer,
  applyRendererViewState,
  createRendererViewState,
  ensureRendererSize
} from './sharedWebGLRenderer'

const { rendererCtor, forceContextLoss, dispose } = vi.hoisted(() => ({
  rendererCtor: vi.fn(),
  forceContextLoss: vi.fn(),
  dispose: vi.fn()
}))

vi.mock('three', async (importOriginal) => {
  const actual = await importOriginal<typeof THREE>()
  class WebGLRenderer {
    domElement = document.createElement('canvas')
    autoClear = true
    outputColorSpace = ''
    toneMapping = 0
    toneMappingExposure = 1
    width = 0
    height = 0
    constructor(opts: unknown) {
      rendererCtor(opts)
    }
    setSize(width: number, height: number) {
      this.width = width
      this.height = height
    }
    getSize(target: THREE.Vector2) {
      target.set(this.width, this.height)
      return target
    }
    setPixelRatio() {}
    setClearColor = vi.fn()
    forceContextLoss = forceContextLoss
    dispose = dispose
  }
  return { ...actual, WebGLRenderer }
})

describe('acquireSharedRenderer', () => {
  it('returns the same renderer for concurrent views and disposes after the last release', () => {
    rendererCtor.mockClear()
    forceContextLoss.mockClear()
    dispose.mockClear()

    const first = acquireSharedRenderer()
    const second = acquireSharedRenderer()

    expect(second.renderer).toBe(first.renderer)
    expect(rendererCtor).toHaveBeenCalledTimes(1)

    first.release()
    expect(dispose).not.toHaveBeenCalled()

    const disposedWhenContextLostFired: boolean[] = []
    second.renderer.domElement.addEventListener('webglcontextlost', () => {
      disposedWhenContextLostFired.push(dispose.mock.calls.length > 0)
    })

    second.release()
    expect(forceContextLoss).toHaveBeenCalledTimes(1)
    expect(dispose).toHaveBeenCalledTimes(1)
    expect(disposedWhenContextLostFired).toEqual([false])
  })

  it('creates a fresh renderer after the previous one was torn down', () => {
    rendererCtor.mockClear()

    const first = acquireSharedRenderer()
    first.release()

    const second = acquireSharedRenderer()

    expect(rendererCtor).toHaveBeenCalledTimes(2)
    expect(second.renderer).not.toBe(first.renderer)
    second.release()
  })

  it('ignores double release from the same handle', () => {
    dispose.mockClear()

    const first = acquireSharedRenderer()
    const second = acquireSharedRenderer()

    first.release()
    first.release()

    expect(dispose).not.toHaveBeenCalled()
    second.release()
    expect(dispose).toHaveBeenCalledTimes(1)
  })
})

describe('ensureRendererSize', () => {
  it('grows the drawing buffer per-axis but never shrinks it', () => {
    const handle = acquireSharedRenderer()
    const renderer = handle.renderer
    renderer.setSize(300, 300)

    ensureRendererSize(renderer, 500, 200)
    expect(renderer.getSize(new THREE.Vector2())).toEqual(
      new THREE.Vector2(500, 300)
    )

    ensureRendererSize(renderer, 400, 250)
    expect(renderer.getSize(new THREE.Vector2())).toEqual(
      new THREE.Vector2(500, 300)
    )

    handle.release()
  })
})

describe('applyRendererViewState', () => {
  it('writes the per-view state onto the renderer', () => {
    const handle = acquireSharedRenderer()
    const renderer = handle.renderer
    const state = createRendererViewState()
    state.toneMapping = THREE.ACESFilmicToneMapping
    state.toneMappingExposure = 0.5
    state.outputColorSpace = THREE.LinearSRGBColorSpace
    state.clearColor.set(0x123456)
    state.clearAlpha = 0.25

    applyRendererViewState(renderer, state)

    expect(renderer.toneMapping).toBe(THREE.ACESFilmicToneMapping)
    expect(renderer.toneMappingExposure).toBe(0.5)
    expect(renderer.outputColorSpace).toBe(THREE.LinearSRGBColorSpace)
    expect(renderer.setClearColor).toHaveBeenCalledWith(state.clearColor, 0.25)

    handle.release()
  })
})
