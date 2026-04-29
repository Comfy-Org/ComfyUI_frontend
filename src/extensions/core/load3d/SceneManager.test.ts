import * as THREE from 'three'
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { EventManagerInterface } from './interfaces'
import Load3dUtils from './Load3dUtils'
import { SceneManager } from './SceneManager'

const { mockTextureLoad } = vi.hoisted(() => ({
  mockTextureLoad: vi.fn()
}))

vi.mock('./Load3dUtils', () => ({
  default: {
    splitFilePath: vi.fn(),
    getResourceURL: vi.fn()
  }
}))

vi.mock('three', async (importOriginal) => {
  const actual = await importOriginal<typeof THREE>()
  class StubTextureLoader {
    load = mockTextureLoad
  }
  return { ...actual, TextureLoader: StubTextureLoader }
})

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
  } satisfies EventManagerInterface
}

function makeRenderer() {
  const canvas = document.createElement('canvas')
  Object.defineProperty(canvas, 'clientWidth', {
    configurable: true,
    value: 800
  })
  Object.defineProperty(canvas, 'clientHeight', {
    configurable: true,
    value: 600
  })
  canvas.width = 800
  canvas.height = 600
  vi.spyOn(canvas, 'toDataURL').mockReturnValue('data:image/png;base64,FAKE')
  return {
    domElement: canvas,
    setClearColor: vi.fn(),
    setSize: vi.fn(),
    render: vi.fn(),
    clear: vi.fn(),
    getClearColor: vi.fn().mockReturnValue(new THREE.Color(0xffffff)),
    getClearAlpha: vi.fn().mockReturnValue(1),
    toneMapping: THREE.NoToneMapping,
    toneMappingExposure: 1,
    outputColorSpace: THREE.SRGBColorSpace
  } as unknown as THREE.WebGLRenderer
}

function makeImageTexture(width = 200, height = 100): THREE.Texture {
  const texture = new THREE.Texture()
  ;(texture as unknown as { image: { width: number; height: number } }).image =
    {
      width,
      height
    }
  return texture
}

describe('SceneManager', () => {
  let renderer: THREE.WebGLRenderer
  let camera: THREE.PerspectiveCamera
  let events: ReturnType<typeof makeMockEventManager>
  let manager: SceneManager

  beforeEach(() => {
    vi.clearAllMocks()
    renderer = makeRenderer()
    camera = new THREE.PerspectiveCamera()
    events = makeMockEventManager()
    manager = new SceneManager(
      renderer,
      () => camera,
      () => ({}) as unknown as OrbitControls,
      events
    )
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('construction', () => {
    it('builds the main scene with a grid helper at the origin', () => {
      expect(manager.scene).toBeInstanceOf(THREE.Scene)
      expect(manager.gridHelper).toBeInstanceOf(THREE.GridHelper)
      expect(manager.scene.children).toContain(manager.gridHelper)
    })

    it('builds a separate background scene with a tiled mesh', () => {
      expect(manager.backgroundScene).toBeInstanceOf(THREE.Scene)
      expect(manager.backgroundMesh).toBeInstanceOf(THREE.Mesh)
      expect(manager.backgroundScene.children).toContain(manager.backgroundMesh)
      expect(manager.backgroundColorMaterial).toBeInstanceOf(
        THREE.MeshBasicMaterial
      )
    })

    it('initializes the background to color mode at the default color', () => {
      expect(manager.currentBackgroundType).toBe('color')
      expect(manager.currentBackgroundColor).toBe('#282828')
      expect(manager.backgroundRenderMode).toBe('tiled')
    })
  })

  describe('toggleGrid', () => {
    it('hides and shows the grid and emits showGridChange', () => {
      manager.toggleGrid(false)
      expect(manager.gridHelper.visible).toBe(false)
      expect(events.emitEvent).toHaveBeenCalledWith('showGridChange', false)

      manager.toggleGrid(true)
      expect(manager.gridHelper.visible).toBe(true)
      expect(events.emitEvent).toHaveBeenCalledWith('showGridChange', true)
    })
  })

  describe('setBackgroundColor', () => {
    it('updates the material color and emits backgroundColorChange', () => {
      manager.setBackgroundColor('#ff0000')

      expect(manager.currentBackgroundColor).toBe('#ff0000')
      expect(manager.currentBackgroundType).toBe('color')
      expect(events.emitEvent).toHaveBeenCalledWith(
        'backgroundColorChange',
        '#ff0000'
      )
    })

    it('clears any prior texture-based scene background', () => {
      manager.scene.background = makeImageTexture()

      manager.setBackgroundColor('#abcdef')

      expect(manager.scene.background).toBeNull()
    })

    it('demotes panorama mode back to tiled and emits the change', () => {
      manager.backgroundRenderMode = 'panorama'

      manager.setBackgroundColor('#abcdef')

      expect(manager.backgroundRenderMode).toBe('tiled')
      expect(events.emitEvent).toHaveBeenCalledWith(
        'backgroundRenderModeChange',
        'tiled'
      )
    })

    it('disposes any prior background texture', () => {
      const texture = makeImageTexture()
      const dispose = vi.spyOn(texture, 'dispose')
      manager.backgroundTexture = texture

      manager.setBackgroundColor('#000000')

      expect(dispose).toHaveBeenCalled()
      expect(manager.backgroundTexture).toBeNull()
    })
  })

  describe('setBackgroundImage', () => {
    it('falls back to setBackgroundColor when given an empty path', async () => {
      const setBackgroundColor = vi.spyOn(manager, 'setBackgroundColor')

      await manager.setBackgroundImage('')

      expect(setBackgroundColor).toHaveBeenCalledWith(
        manager.currentBackgroundColor
      )
    })

    it('emits a loading-start event before fetching', async () => {
      vi.mocked(Load3dUtils.splitFilePath).mockReturnValue(['', 'bg.png'])
      vi.mocked(Load3dUtils.getResourceURL).mockReturnValue('/api/view?bg.png')
      mockTextureLoad.mockImplementation(
        (_url: string, resolve: (t: THREE.Texture) => void) =>
          resolve(makeImageTexture())
      )

      const promise = manager.setBackgroundImage('bg.png')
      expect(events.emitEvent).toHaveBeenCalledWith(
        'backgroundImageLoadingStart',
        null
      )
      await promise
    })

    it('rewrites temp/output subfolders to a flat path with the right type', async () => {
      vi.mocked(Load3dUtils.splitFilePath).mockReturnValue(['temp', 'out.png'])
      vi.mocked(Load3dUtils.getResourceURL).mockReturnValue('/view?out.png')
      mockTextureLoad.mockImplementation(
        (_url: string, resolve: (t: THREE.Texture) => void) =>
          resolve(makeImageTexture())
      )

      await manager.setBackgroundImage('temp/out.png')

      expect(Load3dUtils.getResourceURL).toHaveBeenCalledWith(
        '',
        'out.png',
        'temp'
      )
    })

    it('prefixes /api when getResourceURL returns a non-/api URL', async () => {
      vi.mocked(Load3dUtils.splitFilePath).mockReturnValue(['', 'bg.png'])
      vi.mocked(Load3dUtils.getResourceURL).mockReturnValue('/view?bg.png')
      const captured: string[] = []
      mockTextureLoad.mockImplementation(
        (url: string, resolve: (t: THREE.Texture) => void) => {
          captured.push(url)
          resolve(makeImageTexture())
        }
      )

      await manager.setBackgroundImage('bg.png')

      expect(captured[0]).toBe('/api/view?bg.png')
    })

    it('in tiled mode, swaps the background mesh material to use the new texture', async () => {
      vi.mocked(Load3dUtils.splitFilePath).mockReturnValue(['', 'bg.png'])
      vi.mocked(Load3dUtils.getResourceURL).mockReturnValue('/api/bg')
      const texture = makeImageTexture()
      mockTextureLoad.mockImplementation(
        (_url: string, resolve: (t: THREE.Texture) => void) => resolve(texture)
      )

      await manager.setBackgroundImage('bg.png')

      expect(manager.currentBackgroundType).toBe('image')
      expect(manager.backgroundTexture).toBe(texture)
      expect(manager.backgroundMesh!.material).not.toBe(
        manager.backgroundColorMaterial
      )
      expect(events.emitEvent).toHaveBeenCalledWith(
        'backgroundImageChange',
        'bg.png'
      )
      expect(events.emitEvent).toHaveBeenCalledWith(
        'backgroundImageLoadingEnd',
        null
      )
    })

    it('in panorama mode, assigns the texture as the scene background with equirectangular mapping', async () => {
      manager.backgroundRenderMode = 'panorama'
      vi.mocked(Load3dUtils.splitFilePath).mockReturnValue(['', 'bg.png'])
      vi.mocked(Load3dUtils.getResourceURL).mockReturnValue('/api/bg')
      const texture = makeImageTexture()
      mockTextureLoad.mockImplementation(
        (_url: string, resolve: (t: THREE.Texture) => void) => resolve(texture)
      )

      await manager.setBackgroundImage('bg.png')

      expect(manager.scene.background).toBe(texture)
      expect(texture.mapping).toBe(THREE.EquirectangularReflectionMapping)
    })

    it('disposes a previously loaded background texture before assigning the new one', async () => {
      const previous = makeImageTexture()
      const disposePrev = vi.spyOn(previous, 'dispose')
      manager.backgroundTexture = previous

      vi.mocked(Load3dUtils.splitFilePath).mockReturnValue(['', 'bg.png'])
      vi.mocked(Load3dUtils.getResourceURL).mockReturnValue('/api/bg')
      mockTextureLoad.mockImplementation(
        (_url: string, resolve: (t: THREE.Texture) => void) =>
          resolve(makeImageTexture())
      )

      await manager.setBackgroundImage('bg.png')

      expect(disposePrev).toHaveBeenCalled()
    })

    it('on load failure, emits loading-end and falls back to a color background', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {})
      vi.mocked(Load3dUtils.splitFilePath).mockReturnValue(['', 'bg.png'])
      vi.mocked(Load3dUtils.getResourceURL).mockReturnValue('/api/bg')
      mockTextureLoad.mockImplementation(
        (
          _url: string,
          _resolve: unknown,
          _onProgress: unknown,
          reject: (e: Error) => void
        ) => reject(new Error('load failed'))
      )
      const setBackgroundColor = vi.spyOn(manager, 'setBackgroundColor')

      await manager.setBackgroundImage('bg.png')

      expect(events.emitEvent).toHaveBeenCalledWith(
        'backgroundImageLoadingEnd',
        null
      )
      expect(setBackgroundColor).toHaveBeenCalledWith(
        manager.currentBackgroundColor
      )
    })
  })

  describe('removeBackgroundImage', () => {
    it('reverts to the current color and emits loading-end', () => {
      const setBackgroundColor = vi.spyOn(manager, 'setBackgroundColor')

      manager.removeBackgroundImage()

      expect(setBackgroundColor).toHaveBeenCalledWith(
        manager.currentBackgroundColor
      )
      expect(events.emitEvent).toHaveBeenCalledWith(
        'backgroundImageLoadingEnd',
        null
      )
    })
  })

  describe('setBackgroundRenderMode', () => {
    it('is a no-op when the requested mode equals the current mode', () => {
      events.emitEvent.mockClear()

      manager.setBackgroundRenderMode('tiled')

      expect(events.emitEvent).not.toHaveBeenCalled()
    })

    it('switches to panorama on a color background and just emits the change', () => {
      manager.setBackgroundRenderMode('panorama')

      expect(manager.backgroundRenderMode).toBe('panorama')
      expect(events.emitEvent).toHaveBeenCalledWith(
        'backgroundRenderModeChange',
        'panorama'
      )
    })

    it('promotes an image background to scene.background when switching to panorama', () => {
      manager.currentBackgroundType = 'image'
      const texture = makeImageTexture()
      manager.backgroundTexture = texture

      manager.setBackgroundRenderMode('panorama')

      expect(manager.scene.background).toBe(texture)
      expect(texture.mapping).toBe(THREE.EquirectangularReflectionMapping)
    })

    it('demotes back to tiled by clearing scene.background and updating the mesh map', () => {
      manager.currentBackgroundType = 'image'
      const texture = makeImageTexture()
      manager.backgroundTexture = texture
      manager.scene.background = texture
      manager.backgroundRenderMode = 'panorama'

      manager.setBackgroundRenderMode('tiled')

      expect(manager.scene.background).toBeNull()
      const mat = manager.backgroundMesh!.material as THREE.MeshBasicMaterial
      expect(mat.map).toBe(texture)
      // THREE's `needsUpdate` is a write-only setter — reading is undefined.
      // Asserting the map swap is sufficient to validate the demote path.
    })
  })

  describe('updateBackgroundSize', () => {
    it('does nothing without a texture or mesh', () => {
      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(1, 1),
        new THREE.MeshBasicMaterial()
      )
      const before = mesh.scale.toArray()

      manager.updateBackgroundSize(null, mesh, 100, 100)

      expect(mesh.scale.toArray()).toEqual(before)
    })

    it('does nothing without a mesh', () => {
      expect(() =>
        manager.updateBackgroundSize(makeImageTexture(), null, 100, 100)
      ).not.toThrow()
    })

    it('does nothing when the mesh material has no map', () => {
      const texture = makeImageTexture(400, 100)
      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(1, 1),
        new THREE.MeshBasicMaterial() // no map
      )
      const before = mesh.scale.toArray()

      manager.updateBackgroundSize(texture, mesh, 200, 100)

      expect(mesh.scale.toArray()).toEqual(before)
    })

    it('scales horizontally when the image is wider than the target', () => {
      const texture = makeImageTexture(400, 100) // imageAspect = 4
      const mat = new THREE.MeshBasicMaterial({ map: texture })
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat)

      manager.updateBackgroundSize(texture, mesh, 200, 100) // targetAspect = 2

      expect(mesh.scale.x).toBeCloseTo(2)
      expect(mesh.scale.y).toBe(1)
    })

    it('scales vertically when the image is taller than the target', () => {
      const texture = makeImageTexture(100, 400) // imageAspect = 0.25
      const mat = new THREE.MeshBasicMaterial({ map: texture })
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat)

      manager.updateBackgroundSize(texture, mesh, 200, 100) // targetAspect = 2

      expect(mesh.scale.x).toBe(1)
      expect(mesh.scale.y).toBeCloseTo(8)
    })
  })

  describe('handleResize', () => {
    it('updates background size when an image background is active', () => {
      const texture = makeImageTexture(400, 100)
      manager.backgroundTexture = texture
      manager.currentBackgroundType = 'image'
      ;(manager.backgroundMesh!.material as THREE.MeshBasicMaterial).map =
        texture
      const update = vi.spyOn(manager, 'updateBackgroundSize')

      manager.handleResize(800, 600)

      expect(update).toHaveBeenCalledWith(
        texture,
        manager.backgroundMesh,
        800,
        600
      )
    })

    it('does nothing when only a color background is active', () => {
      const update = vi.spyOn(manager, 'updateBackgroundSize')

      manager.handleResize(800, 600)

      expect(update).not.toHaveBeenCalled()
    })
  })

  describe('getCurrentBackgroundInfo', () => {
    it('returns the color when in color mode', () => {
      manager.setBackgroundColor('#abc123')

      expect(manager.getCurrentBackgroundInfo()).toEqual({
        type: 'color',
        value: '#abc123'
      })
    })

    it('returns an empty value when in image mode', () => {
      manager.currentBackgroundType = 'image'

      expect(manager.getCurrentBackgroundInfo()).toEqual({
        type: 'image',
        value: ''
      })
    })
  })

  describe('captureScene', () => {
    it('returns three data URLs and restores the renderer to its original state', async () => {
      const result = await manager.captureScene(400, 300)

      expect(result.scene).toBe('data:image/png;base64,FAKE')
      expect(result.mask).toBe('data:image/png;base64,FAKE')
      expect(result.normal).toBe('data:image/png;base64,FAKE')
      // Renderer.setSize is called once with the capture size and once to restore.
      expect(renderer.setSize).toHaveBeenCalledWith(400, 300)
      expect(renderer.setSize).toHaveBeenLastCalledWith(800, 600)
    })

    it('restores grid visibility after rendering the normal pass', async () => {
      manager.gridHelper.visible = true

      await manager.captureScene(100, 100)

      expect(manager.gridHelper.visible).toBe(true)
    })

    it('rejects when the renderer throws during capture', async () => {
      vi.mocked(renderer.render).mockImplementationOnce(() => {
        throw new Error('renderer fail')
      })

      await expect(manager.captureScene(100, 100)).rejects.toThrow(
        'renderer fail'
      )
    })
  })

  describe('dispose', () => {
    it('disposes the texture, color material, and mesh resources, then clears scenes', () => {
      const texture = makeImageTexture()
      const disposeTexture = vi.spyOn(texture, 'dispose')
      manager.backgroundTexture = texture
      const disposeColorMat = vi.spyOn(
        manager.backgroundColorMaterial!,
        'dispose'
      )
      const disposeGeometry = vi.spyOn(
        manager.backgroundMesh!.geometry,
        'dispose'
      )

      manager.dispose()

      expect(disposeTexture).toHaveBeenCalled()
      expect(disposeColorMat).toHaveBeenCalled()
      expect(disposeGeometry).toHaveBeenCalled()
      expect(manager.scene.children).toHaveLength(0)
      expect(manager.backgroundScene.children).toHaveLength(0)
    })

    it('clears the scene background when one was set', () => {
      manager.scene.background = makeImageTexture()

      manager.dispose()

      expect(manager.scene.background).toBeNull()
    })
  })
})

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
