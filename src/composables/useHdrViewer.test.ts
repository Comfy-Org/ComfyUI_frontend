import { describe, expect, it, vi } from 'vitest'
import * as THREE from 'three'

import { loadHdrTexture } from '@/platform/hdr/hdrTextureLoader'

import { useHdrViewer } from './useHdrViewer'

vi.mock(import('three'), { spy: true })
vi.mock(import('@/renderer/three/WebGLViewport'))
vi.mock(import('@/platform/hdr/hdrTextureLoader'))

/** happy-dom has no WebGL; any renderer method is a no-op returning 1. */
function fakeRenderer() {
  const target: Record<PropertyKey, unknown> = {
    domElement: document.createElement('canvas')
  }
  return new Proxy(target, {
    get: (object, key) =>
      key === 'then' ? undefined : (object[key] ??= vi.fn(() => 1))
  })
}

describe('useHdrViewer', () => {
  it('loads the texture under the filename it was given', async () => {
    vi.mocked(THREE.WebGLRenderer).mockImplementation(function () {
      return fakeRenderer() as unknown as THREE.WebGLRenderer
    })
    vi.mocked(loadHdrTexture).mockRejectedValue(new Error('stop'))

    await useHdrViewer().mount(
      document.createElement('div'),
      '/api/assets/abc/content',
      'sky.hdr'
    )

    expect(loadHdrTexture).toHaveBeenCalledWith(
      '/api/assets/abc/content',
      'sky.hdr'
    )
  })
})
