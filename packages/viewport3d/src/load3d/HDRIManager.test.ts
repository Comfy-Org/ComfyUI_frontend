import * as THREE from 'three'
import { fromAny, fromPartial } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { EXRLoader } from 'three/examples/jsm/loaders/EXRLoader'
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader'

import { createRendererViewState } from '#/three/sharedWebGLRenderer'

import { HDRIManager } from './HDRIManager'

const { mockFromEquirectangular, mockDisposePMREM } = vi.hoisted(() => ({
  mockFromEquirectangular: vi.fn(),
  mockDisposePMREM: vi.fn()
}))

vi.mock(import('three'), { spy: true })

beforeEach(() => {
  vi.spyOn(THREE, 'PMREMGenerator').mockImplementation(function () {
    return fromPartial<THREE.PMREMGenerator>({
      compileEquirectangularShader: vi.fn(),
      fromEquirectangular: mockFromEquirectangular,
      dispose: mockDisposePMREM
    })
  })
})

vi.mock(import('three/examples/jsm/loaders/EXRLoader'), () => {
  class EXRLoader {
    load(
      _url: string,
      resolve: (t: THREE.Texture) => void,
      _onProgress: undefined,
      _reject: (e: unknown) => void
    ) {
      resolve(new THREE.DataTexture(new Uint8Array(4), 1, 1))
    }
  }
  return { EXRLoader: fromAny(EXRLoader) }
})

vi.mock(import('three/examples/jsm/loaders/RGBELoader'), () => {
  class RGBELoader {
    load(
      _url: string,
      resolve: (t: THREE.Texture) => void,
      _onProgress: undefined,
      _reject: (e: unknown) => void
    ) {
      resolve(new THREE.DataTexture(new Uint8Array(4), 1, 1))
    }
  }
  return { RGBELoader: fromAny(RGBELoader) }
})

function makeMockEventManager() {
  return {
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    emitEvent: vi.fn()
  }
}

describe('HDRIManager', () => {
  let scene: THREE.Scene
  let eventManager: ReturnType<typeof makeMockEventManager>
  let manager: HDRIManager

  beforeEach(() => {
    scene = new THREE.Scene()
    eventManager = makeMockEventManager()

    mockFromEquirectangular.mockReturnValue({
      texture: new THREE.Texture(),
      dispose: vi.fn()
    })

    manager = new HDRIManager(
      scene,
      fromAny<THREE.WebGLRenderer, unknown>({}),
      createRendererViewState(),
      eventManager
    )
  })

  describe('initial state', () => {
    it('starts disabled with default intensity', () => {
      expect(manager.isEnabled).toBe(false)
      expect(manager.showAsBackground).toBe(false)
      expect(manager.intensity).toBe(1)
    })
  })

  describe('loadHDRI', () => {
    it.for([
      { url: 'http://example.com/env.exr', exr: 1, hdr: 0 },
      { url: 'http://example.com/env.hdr', exr: 0, hdr: 1 },
      { url: '/api/view?filename=env.exr&type=input', exr: 1, hdr: 0 },
      { url: '/api/view?filename=env.HDR&rand=0.5', exr: 0, hdr: 1 }
    ])(
      'picks the loader for $url by its file extension',
      async ({ url, exr, hdr }) => {
        const exrLoad = vi.spyOn(EXRLoader.prototype, 'load')
        const hdrLoad = vi.spyOn(RGBELoader.prototype, 'load')

        await manager.loadHDRI(url)

        expect({
          exr: exrLoad.mock.calls.length,
          hdr: hdrLoad.mock.calls.length
        }).toEqual({ exr, hdr })
      }
    )

    it('applies to scene immediately when already enabled', async () => {
      manager.setEnabled(true)
      // No texture loaded yet so scene.environment stays null
      expect(scene.environment).toBeNull()

      await manager.loadHDRI('http://example.com/env.hdr')

      expect(scene.environment).not.toBeNull()
    })

    it('does not apply to scene when disabled', async () => {
      await manager.loadHDRI('http://example.com/env.hdr')

      expect(scene.environment).toBeNull()
    })
  })

  describe('setEnabled', () => {
    it('applies environment map to scene when enabled after loading', async () => {
      await manager.loadHDRI('http://example.com/env.hdr')

      manager.setEnabled(true)

      expect(scene.environment).not.toBeNull()
      expect(eventManager.emitEvent).toHaveBeenCalledWith('hdriChange', {
        enabled: true,
        showAsBackground: false
      })
    })

    it('removes environment map from scene when disabled', async () => {
      await manager.loadHDRI('http://example.com/env.hdr')
      manager.setEnabled(true)

      manager.setEnabled(false)

      expect(scene.environment).toBeNull()
      expect(eventManager.emitEvent).toHaveBeenLastCalledWith('hdriChange', {
        enabled: false,
        showAsBackground: false
      })
    })
  })

  describe('setIntensity', () => {
    it('updates scene intensity when enabled', async () => {
      await manager.loadHDRI('http://example.com/env.hdr')
      manager.setEnabled(true)

      manager.setIntensity(2.5)

      expect(scene.environmentIntensity).toBe(2.5)
      expect(manager.intensity).toBe(2.5)
    })

    it('stores intensity without applying when disabled', () => {
      manager.setIntensity(3)

      expect(manager.intensity).toBe(3)
      expect(scene.environmentIntensity).not.toBe(3)
    })
  })

  describe('setShowAsBackground', () => {
    it('sets scene background texture when enabled and showing as background', async () => {
      await manager.loadHDRI('http://example.com/env.hdr')
      manager.setEnabled(true)

      manager.setShowAsBackground(true)

      expect(scene.background).not.toBeNull()
    })

    it('clears scene background when showAsBackground is false', async () => {
      await manager.loadHDRI('http://example.com/env.hdr')
      manager.setEnabled(true)
      manager.setShowAsBackground(true)

      manager.setShowAsBackground(false)

      expect(scene.background).toBeNull()
    })
  })

  describe('clear', () => {
    it('removes HDRI from scene and resets state', async () => {
      await manager.loadHDRI('http://example.com/env.hdr')
      manager.setEnabled(true)

      manager.clear()

      expect(manager.isEnabled).toBe(false)
      expect(scene.environment).toBeNull()
    })
  })

  describe('dispose', () => {
    it('disposes PMREMGenerator', () => {
      manager.dispose()

      expect(mockDisposePMREM).toHaveBeenCalled()
    })
  })
})
