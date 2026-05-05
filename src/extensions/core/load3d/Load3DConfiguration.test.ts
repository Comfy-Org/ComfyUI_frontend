import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type Load3d from '@/extensions/core/load3d/Load3d'
import Load3DConfiguration, {
  parseAnnotatedFilename
} from '@/extensions/core/load3d/Load3DConfiguration'
import Load3dUtils from '@/extensions/core/load3d/Load3dUtils'
import type {
  GizmoConfig,
  ModelConfig
} from '@/extensions/core/load3d/interfaces'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import type { Dictionary } from '@/lib/litegraph/src/interfaces'
import type { NodeProperty } from '@/lib/litegraph/src/LGraphNode'

vi.mock('@/platform/settings/settingStore', () => ({
  useSettingStore: () => ({
    get: vi.fn()
  })
}))

vi.mock('@/scripts/api', () => ({
  api: {
    apiURL: (p: string) => p,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchCustomEvent: vi.fn(),
    fetchApi: vi.fn(),
    getSystemStats: vi.fn()
  }
}))

vi.mock('@/scripts/app', () => ({
  app: { rootGraph: { extra: {} } }
}))

vi.mock('@/extensions/core/load3d/Load3d', () => ({ default: class {} }))

vi.mock('@/extensions/core/load3d/Load3dUtils', () => ({
  default: {
    splitFilePath: vi.fn(),
    getResourceURL: vi.fn()
  }
}))

type WithPrivate = { loadModelConfig(): ModelConfig }

function createConfig(properties?: Dictionary<NodeProperty | undefined>) {
  const load3d = {} as Load3d
  return new Load3DConfiguration(load3d, properties) as unknown as WithPrivate
}

const defaultGizmo: GizmoConfig = {
  enabled: false,
  mode: 'translate',
  position: { x: 0, y: 0, z: 0 },
  rotation: { x: 0, y: 0, z: 0 },
  scale: { x: 1, y: 1, z: 1 }
}

describe('Load3DConfiguration.loadModelConfig', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns full defaults including gizmo when no properties are provided', () => {
    const result = createConfig().loadModelConfig()

    expect(result).toEqual({
      upDirection: 'original',
      materialMode: 'original',
      showSkeleton: false,
      gizmo: defaultGizmo
    })
  })

  it('returns full defaults when properties do not contain Model Config', () => {
    const result = createConfig({ 'Other Key': 'x' }).loadModelConfig()

    expect(result.gizmo).toEqual(defaultGizmo)
  })

  it('adds default gizmo when Model Config exists but has no gizmo field', () => {
    const stored: ModelConfig = {
      upDirection: '+y',
      materialMode: 'wireframe',
      showSkeleton: true
    }
    const properties = { 'Model Config': stored } as Dictionary<
      NodeProperty | undefined
    >

    const result = createConfig(properties).loadModelConfig()

    expect(result.upDirection).toBe('+y')
    expect(result.materialMode).toBe('wireframe')
    expect(result.showSkeleton).toBe(true)
    expect(result.gizmo).toEqual(defaultGizmo)
  })

  it('mutates the original Model Config property to persist gizmo defaults', () => {
    const stored: ModelConfig = {
      upDirection: 'original',
      materialMode: 'original',
      showSkeleton: false
    }
    const properties = { 'Model Config': stored } as Dictionary<
      NodeProperty | undefined
    >

    createConfig(properties).loadModelConfig()

    expect((properties['Model Config'] as ModelConfig).gizmo).toEqual(
      defaultGizmo
    )
  })

  it('backfills scale on legacy gizmo config missing the scale field', () => {
    const legacyGizmo = {
      enabled: true,
      mode: 'rotate',
      position: { x: 1, y: 2, z: 3 },
      rotation: { x: 0.1, y: 0.2, z: 0.3 }
    } as unknown as GizmoConfig
    const stored: ModelConfig = {
      upDirection: 'original',
      materialMode: 'original',
      showSkeleton: false,
      gizmo: legacyGizmo
    }
    const properties = { 'Model Config': stored } as Dictionary<
      NodeProperty | undefined
    >

    const result = createConfig(properties).loadModelConfig()

    expect(result.gizmo).toEqual({
      enabled: true,
      mode: 'rotate',
      position: { x: 1, y: 2, z: 3 },
      rotation: { x: 0.1, y: 0.2, z: 0.3 },
      scale: { x: 1, y: 1, z: 1 }
    })
  })

  it('preserves a fully populated gizmo config unchanged', () => {
    const fullGizmo: GizmoConfig = {
      enabled: true,
      mode: 'scale',
      position: { x: 5, y: 6, z: 7 },
      rotation: { x: 1, y: 2, z: 3 },
      scale: { x: 2, y: 2, z: 2 }
    }
    const stored: ModelConfig = {
      upDirection: '-z',
      materialMode: 'normal',
      showSkeleton: false,
      gizmo: fullGizmo
    }
    const properties = { 'Model Config': stored } as Dictionary<
      NodeProperty | undefined
    >

    const result = createConfig(properties).loadModelConfig()

    expect(result.gizmo).toEqual(fullGizmo)
  })
})

describe('Load3DConfiguration.silentOnNotFound propagation', () => {
  let loadModelSpy: ReturnType<typeof vi.fn>

  function makeLoad3dMock(): Load3d {
    loadModelSpy = vi.fn().mockResolvedValue(undefined)
    return {
      loadModel: loadModelSpy,
      setUpDirection: vi.fn(),
      setMaterialMode: vi.fn(),
      setTargetSize: vi.fn(),
      setCameraState: vi.fn(),
      toggleGrid: vi.fn(),
      setBackgroundColor: vi.fn(),
      setBackgroundImage: vi.fn().mockResolvedValue(undefined),
      setBackgroundRenderMode: vi.fn(),
      toggleCamera: vi.fn(),
      setFOV: vi.fn(),
      setLightIntensity: vi.fn(),
      setHDRIIntensity: vi.fn(),
      setHDRIAsBackground: vi.fn(),
      setHDRIEnabled: vi.fn(),
      emitModelReady: vi.fn()
    } as unknown as Load3d
  }

  async function flush() {
    await new Promise<void>((resolve) => setTimeout(resolve, 0))
  }

  beforeEach(() => {
    vi.mocked(Load3dUtils.splitFilePath).mockReturnValue(['', 'model.glb'])
    vi.mocked(Load3dUtils.getResourceURL).mockReturnValue(
      '/view?filename=model.glb'
    )
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('configureForSaveMesh forwards silentOnNotFound: true to loadModel', async () => {
    const config = new Load3DConfiguration(makeLoad3dMock())
    config.configureForSaveMesh('output', 'model.glb', {
      silentOnNotFound: true
    })
    await flush()
    expect(loadModelSpy).toHaveBeenCalledWith(expect.any(String), 'model.glb', {
      silentOnNotFound: true
    })
  })

  it('configureForSaveMesh uses silentOnNotFound: false when option is omitted', async () => {
    const config = new Load3DConfiguration(makeLoad3dMock())
    config.configureForSaveMesh('output', 'model.glb')
    await flush()
    expect(loadModelSpy).toHaveBeenCalledWith(expect.any(String), 'model.glb', {
      silentOnNotFound: false
    })
  })

  it('configure forwards silentOnNotFound: true from settings to loadModel', async () => {
    const config = new Load3DConfiguration(makeLoad3dMock())
    config.configure({
      modelWidget: { value: 'model.glb' } as unknown as IBaseWidget,
      loadFolder: 'output',
      silentOnNotFound: true
    })
    await flush()
    expect(loadModelSpy).toHaveBeenCalledWith(expect.any(String), 'model.glb', {
      silentOnNotFound: true
    })
  })

  it('configure uses silentOnNotFound: false when setting is omitted', async () => {
    const config = new Load3DConfiguration(makeLoad3dMock())
    config.configure({
      modelWidget: { value: 'model.glb' } as unknown as IBaseWidget,
      loadFolder: 'output'
    })
    await flush()
    expect(loadModelSpy).toHaveBeenCalledWith(expect.any(String), 'model.glb', {
      silentOnNotFound: false
    })
  })

  it('emits modelReady AFTER setCameraState so thumbnail capture sees the restored view', async () => {
    const load3d = makeLoad3dMock()
    const config = new Load3DConfiguration(load3d)
    const cameraState = {
      position: { x: 1, y: 2, z: 3 },
      target: { x: 0, y: 0, z: 0 },
      zoom: 1,
      cameraType: 'perspective' as const
    }
    config.configure({
      modelWidget: { value: 'model.glb' } as unknown as IBaseWidget,
      loadFolder: 'output',
      cameraState: cameraState as unknown as Parameters<
        Load3DConfiguration['configure']
      >[0]['cameraState']
    })
    await flush()

    const setCameraStateMock = vi.mocked(load3d.setCameraState)
    const emitModelReadyMock = vi.mocked(load3d.emitModelReady)
    expect(setCameraStateMock).toHaveBeenCalledWith(cameraState)
    expect(emitModelReadyMock).toHaveBeenCalledTimes(1)
    expect(setCameraStateMock.mock.invocationCallOrder[0]).toBeLessThan(
      emitModelReadyMock.mock.invocationCallOrder[0]
    )
  })

  it('emits modelReady even when no saved cameraState is provided', async () => {
    const load3d = makeLoad3dMock()
    const config = new Load3DConfiguration(load3d)
    config.configure({
      modelWidget: { value: 'model.glb' } as unknown as IBaseWidget,
      loadFolder: 'output'
    })
    await flush()
    expect(vi.mocked(load3d.emitModelReady)).toHaveBeenCalledTimes(1)
  })
})

describe('parseAnnotatedFilename', () => {
  it('strips a [output] suffix and switches to the output folder', () => {
    expect(parseAnnotatedFilename('foo.glb [output]', 'input')).toEqual({
      filename: 'foo.glb',
      folder: 'output'
    })
  })

  it('strips a [input] suffix and switches to the input folder', () => {
    expect(parseAnnotatedFilename('sub/foo.glb [input]', 'output')).toEqual({
      filename: 'sub/foo.glb',
      folder: 'input'
    })
  })

  it('strips a [temp] suffix and switches to the temp folder', () => {
    expect(parseAnnotatedFilename('foo.glb [temp]', 'input')).toEqual({
      filename: 'foo.glb',
      folder: 'temp'
    })
  })

  it('returns the value unchanged with the fallback folder when unannotated', () => {
    expect(parseAnnotatedFilename('foo.glb', 'input')).toEqual({
      filename: 'foo.glb',
      folder: 'input'
    })
  })

  it('does not strip a non-folder annotation', () => {
    expect(parseAnnotatedFilename('foo.glb [draft]', 'input')).toEqual({
      filename: 'foo.glb [draft]',
      folder: 'input'
    })
  })

  it('only matches a trailing annotation, not one in the middle', () => {
    expect(parseAnnotatedFilename('foo [output] bar.glb', 'input')).toEqual({
      filename: 'foo [output] bar.glb',
      folder: 'input'
    })
  })
})
