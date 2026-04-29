import * as THREE from 'three'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { SceneManager } from './SceneManager'

vi.mock('three/examples/jsm/controls/OrbitControls', () => {
  class OrbitControls {}
  return { OrbitControls }
})

function makeMockRenderer(pixelRatio = 1): THREE.WebGLRenderer {
  const domElement = {
    toDataURL: vi.fn().mockReturnValue('data:image/png;base64,abc'),
    clientWidth: 400,
    clientHeight: 300
  }
  return {
    domElement,
    outputColorSpace: THREE.SRGBColorSpace,
    toneMapping: THREE.ACESFilmicToneMapping,
    toneMappingExposure: 1,
    getSize: vi.fn((v: THREE.Vector2) => {
      v.set(400, 300)
      return v
    }),
    getPixelRatio: vi.fn().mockReturnValue(pixelRatio),
    getClearColor: vi.fn((c: THREE.Color) => c),
    getClearAlpha: vi.fn().mockReturnValue(0),
    setPixelRatio: vi.fn(),
    setSize: vi.fn(),
    setClearColor: vi.fn(),
    clear: vi.fn(),
    render: vi.fn()
  } as unknown as THREE.WebGLRenderer
}

function makeMockEventManager() {
  return {
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    emitEvent: vi.fn()
  }
}

function makeSceneManager(pixelRatio = 1) {
  const renderer = makeMockRenderer(pixelRatio)
  const camera = new THREE.PerspectiveCamera()
  const eventManager = makeMockEventManager()
  const manager = new SceneManager(
    renderer,
    () => camera,
    vi.fn() as unknown as () => InstanceType<
      typeof import('three/examples/jsm/controls/OrbitControls').OrbitControls
    >,
    eventManager
  )
  return { manager, renderer, camera, eventManager }
}

describe('SceneManager.captureScene', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('resolves with scene, mask, and normal data URLs', async () => {
    const { manager } = makeSceneManager()
    const result = await manager.captureScene(800, 600)
    expect(result.scene).toContain('data:image/png')
    expect(result.mask).toContain('data:image/png')
    expect(result.normal).toContain('data:image/png')
  })

  it('forces pixel ratio to 1 before rendering regardless of original value', async () => {
    const { manager, renderer } = makeSceneManager(2)
    await manager.captureScene(800, 600)
    expect(vi.mocked(renderer.setPixelRatio).mock.calls[0]).toEqual([1])
  })

  it('restores original pixel ratio after capture completes', async () => {
    const originalPixelRatio = 3
    const { manager, renderer } = makeSceneManager(originalPixelRatio)
    await manager.captureScene(800, 600)
    const calls = vi.mocked(renderer.setPixelRatio).mock.calls
    expect(calls.at(-1)).toEqual([originalPixelRatio])
  })

  it('renders at requested capture dimensions', async () => {
    const { manager, renderer } = makeSceneManager()
    await manager.captureScene(1920, 1080)
    expect(vi.mocked(renderer.setSize).mock.calls[0]).toEqual([1920, 1080])
  })

  it('restores original renderer size after capture', async () => {
    const { manager, renderer } = makeSceneManager()
    await manager.captureScene(1920, 1080)
    const calls = vi.mocked(renderer.setSize).mock.calls
    expect(calls.at(-1)).toEqual([400, 300])
  })
})
