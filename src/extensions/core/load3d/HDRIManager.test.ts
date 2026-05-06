import * as THREE from 'three'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { HDRIManager } from './HDRIManager'
import Load3dUtils from './Load3dUtils'

const { mockFromEquirectangular, mockDisposePMREM } = vi.hoisted(() => ({
  mockFromEquirectangular: vi.fn(),
  mockDisposePMREM: vi.fn()
}))

vi.mock('./Load3dUtils', () => ({
  default: {
    getFilenameExtension: vi.fn()
  }
}))

vi.mock('three', async (importOriginal) => {
  const actual = await importOriginal<typeof THREE>()
  class MockPMREMGenerator {
    compileEquirectangularShader = vi.fn()
    fromEquirectangular = mockFromEquirectangular
    dispose = mockDisposePMREM
  }
  return { ...actual, PMREMGenerator: MockPMREMGenerator }
})

vi.mock('three/examples/jsm/loaders/EXRLoader', () => {
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
  return { EXRLoader }
})

vi.mock('three/examples/jsm/loaders/RGBELoader', () => {
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
  return { RGBELoader }
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
    vi.clearAllMocks()
    scene = new THREE.Scene()
    eventManager = makeMockEventManager()

    mockFromEquirectangular.mockReturnValue({
      texture: new THREE.Texture(),
      dispose: vi.fn()
    })

    manager = new HDRIManager(scene, {} as THREE.WebGLRenderer, eventManager)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('initial state', () => {
    it('starts disabled with default intensity', () => {
      expect(manager.isEnabled).toBe(false)
      expect(manager.showAsBackground).toBe(false)
      expect(manager.intensity).toBe(1)
    })
  })

  describe('loadHDRI', () => {
    it('loads .exr files without error', async () => {
      vi.mocked(Load3dUtils.getFilenameExtension).mockReturnValue('exr')

      await expect(
        manager.loadHDRI('http://example.com/env.exr')
      ).resolves.toBeUndefined()
    })

    it('loads .hdr files without error', async () => {
      vi.mocked(Load3dUtils.getFilenameExtension).mockReturnValue('hdr')

      await expect(
        manager.loadHDRI('http://example.com/env.hdr')
      ).resolves.toBeUndefined()
    })

    it('applies to scene immediately when already enabled', async () => {
      vi.mocked(Load3dUtils.getFilenameExtension).mockReturnValue('hdr')
      manager.setEnabled(true)
      // No texture loaded yet so scene.environment stays null
      expect(scene.environment).toBeNull()

      await manager.loadHDRI('http://example.com/env.hdr')

      expect(scene.environment).not.toBeNull()
    })

    it('does not apply to scene when disabled', async () => {
      vi.mocked(Load3dUtils.getFilenameExtension).mockReturnValue('hdr')

      await manager.loadHDRI('http://example.com/env.hdr')

      expect(scene.environment).toBeNull()
    })
  })

  describe('setEnabled', () => {
    it('applies environment map to scene when enabled after loading', async () => {
      vi.mocked(Load3dUtils.getFilenameExtension).mockReturnValue('hdr')
      await manager.loadHDRI('http://example.com/env.hdr')

      manager.setEnabled(true)

      expect(scene.environment).not.toBeNull()
      expect(eventManager.emitEvent).toHaveBeenCalledWith('hdriChange', {
        enabled: true,
        showAsBackground: false
      })
    })

    it('removes environment map from scene when disabled', async () => {
      vi.mocked(Load3dUtils.getFilenameExtension).mockReturnValue('hdr')
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
      vi.mocked(Load3dUtils.getFilenameExtension).mockReturnValue('hdr')
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
      vi.mocked(Load3dUtils.getFilenameExtension).mockReturnValue('hdr')
      await manager.loadHDRI('http://example.com/env.hdr')
      manager.setEnabled(true)

      manager.setShowAsBackground(true)

      expect(scene.background).not.toBeNull()
    })

    it('clears scene background when showAsBackground is false', async () => {
      vi.mocked(Load3dUtils.getFilenameExtension).mockReturnValue('hdr')
      await manager.loadHDRI('http://example.com/env.hdr')
      manager.setEnabled(true)
      manager.setShowAsBackground(true)

      manager.setShowAsBackground(false)

      expect(scene.background).toBeNull()
    })
  })

  describe('clear', () => {
    it('removes HDRI from scene and resets state', async () => {
      vi.mocked(Load3dUtils.getFilenameExtension).mockReturnValue('hdr')
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
