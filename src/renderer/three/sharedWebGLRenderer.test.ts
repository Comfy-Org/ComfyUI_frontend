import { fromPartial } from '@total-typescript/shoehorn'
import * as THREE from 'three'
import { WebGLRenderer } from 'three'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  acquireSharedRenderer,
  applyRendererViewState,
  createRendererViewState,
  ensureRendererSize
} from './sharedWebGLRenderer'

vi.mock(import('three'), { spy: true })

const forceContextLoss = vi.fn()
const dispose = vi.fn()

function fakeRenderer() {
  const domElement = document.createElement('canvas')
  let width = 0
  let height = 0
  return fromPartial<WebGLRenderer>({
    domElement,
    autoClear: true,
    outputColorSpace: THREE.SRGBColorSpace,
    toneMapping: THREE.NoToneMapping,
    toneMappingExposure: 1,
    setSize(nextWidth: number, nextHeight: number) {
      width = nextWidth
      height = nextHeight
    },
    getSize(target: THREE.Vector2) {
      return target.set(width, height)
    },
    setPixelRatio: vi.fn(),
    setClearColor: vi.fn(),
    forceContextLoss,
    dispose
  })
}

beforeEach(() => {
  vi.mocked(WebGLRenderer).mockImplementation(fakeRenderer)
})

describe('acquireSharedRenderer', () => {
  it('returns the same renderer for concurrent views and disposes after the last release', () => {
    vi.mocked(THREE.WebGLRenderer).mockClear()
    forceContextLoss.mockClear()
    dispose.mockClear()

    const first = acquireSharedRenderer()
    const second = acquireSharedRenderer()

    expect(second.renderer).toBe(first.renderer)
    expect(THREE.WebGLRenderer).toHaveBeenCalledTimes(1)

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
    vi.mocked(THREE.WebGLRenderer).mockClear()

    const first = acquireSharedRenderer()
    first.release()

    const second = acquireSharedRenderer()

    expect(THREE.WebGLRenderer).toHaveBeenCalledTimes(2)
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
    expect(renderer.getSize(new THREE.Vector2())).toMatchObject({
      x: 500,
      y: 300
    })

    ensureRendererSize(renderer, 400, 250)
    expect(renderer.getSize(new THREE.Vector2())).toMatchObject({
      x: 500,
      y: 300
    })

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
