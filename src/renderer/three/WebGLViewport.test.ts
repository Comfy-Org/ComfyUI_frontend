import type * as THREE from 'three'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { WebGLViewport } from './WebGLViewport'

function fakeRenderer() {
  const domElement = document.createElement('canvas')
  return {
    forceContextLoss: vi.fn(),
    dispose: vi.fn(),
    domElement
  } as unknown as THREE.WebGLRenderer
}

describe('WebGLViewport', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('releases the context via forceContextLoss before disposing', () => {
    const renderer = fakeRenderer()
    const dispatchSpy = vi.spyOn(renderer.domElement, 'dispatchEvent')
    const removeSpy = vi.spyOn(renderer.domElement, 'remove')

    new WebGLViewport(renderer).disposeRenderer()

    expect(renderer.forceContextLoss).toHaveBeenCalledOnce()
    expect(renderer.dispose).toHaveBeenCalledOnce()
    expect(removeSpy).toHaveBeenCalledOnce()
    expect(dispatchSpy.mock.calls[0][0].type).toBe('webglcontextlost')
  })

  it('observes the resize target and disconnects on dispose', () => {
    const observe = vi.fn()
    const disconnect = vi.fn()
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe = observe
        disconnect = disconnect
        unobserve = vi.fn()
      }
    )
    const target = document.createElement('div')
    const onResize = vi.fn()
    const viewport = new WebGLViewport(fakeRenderer())

    viewport.observeResize(target, onResize)
    expect(observe).toHaveBeenCalledWith(target)

    viewport.disposeRenderer()
    expect(disconnect).toHaveBeenCalledOnce()
  })
})
