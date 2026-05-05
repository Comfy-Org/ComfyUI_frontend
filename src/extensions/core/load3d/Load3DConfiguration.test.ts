import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type Load3d from '@/extensions/core/load3d/Load3d'
import Load3DConfiguration, {
  parseAnnotatedFilename
} from '@/extensions/core/load3d/Load3DConfiguration'
import Load3dUtils from '@/extensions/core/load3d/Load3dUtils'
import type {
  CameraConfig,
  GizmoConfig,
  LightConfig,
  ModelConfig,
  SceneConfig
} from '@/extensions/core/load3d/interfaces'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import type { Dictionary } from '@/lib/litegraph/src/interfaces'
import type { NodeProperty } from '@/lib/litegraph/src/LGraphNode'

const { settingsGetMock } = vi.hoisted(() => ({
  settingsGetMock: vi.fn()
}))

vi.mock('@/platform/settings/settingStore', () => ({
  useSettingStore: () => ({ get: settingsGetMock })
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

type WithPrivate = {
  loadModelConfig(): ModelConfig
  loadSceneConfig(): SceneConfig
  loadCameraConfig(): CameraConfig
  loadLightConfig(): LightConfig
}

function createConfig(properties?: Dictionary<NodeProperty | undefined>) {
  const load3d = {} as Load3d
  return new Load3DConfiguration(load3d, properties) as unknown as WithPrivate
}

function stubSettings(values: Record<string, unknown>) {
  settingsGetMock.mockImplementation((key: string) => values[key])
}

const defaultGizmo: GizmoConfig = {
  enabled: false,
  mode: 'translate',
  position: { x: 0, y: 0, z: 0 },
  rotation: { x: 0, y: 0, z: 0 },
  scale: { x: 1, y: 1, z: 1 }
}

const hdriDefaults = {
  enabled: false,
  hdriPath: '',
  showAsBackground: false,
  intensity: 1
} as const

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
      setHDRIEnabled: vi.fn()
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

describe('Load3DConfiguration.loadSceneConfig', () => {
  beforeEach(() => {
    settingsGetMock.mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns the persisted Scene Config when present, ignoring settings', () => {
    const stored: SceneConfig = {
      showGrid: false,
      backgroundColor: '#123456',
      backgroundImage: 'bg.png'
    }
    const properties = { 'Scene Config': stored } as Dictionary<
      NodeProperty | undefined
    >
    stubSettings({
      'Comfy.Load3D.ShowGrid': true,
      'Comfy.Load3D.BackgroundColor': 'aaaaaa'
    })

    expect(createConfig(properties).loadSceneConfig()).toEqual(stored)
    expect(settingsGetMock).not.toHaveBeenCalled()
  })

  it('falls back to settings and prepends # to the background color', () => {
    stubSettings({
      'Comfy.Load3D.ShowGrid': false,
      'Comfy.Load3D.BackgroundColor': 'abcdef'
    })

    expect(createConfig().loadSceneConfig()).toEqual({
      showGrid: false,
      backgroundColor: '#abcdef',
      backgroundImage: ''
    })
  })
})

describe('Load3DConfiguration.loadCameraConfig', () => {
  beforeEach(() => {
    settingsGetMock.mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns the persisted Camera Config when present', () => {
    const stored: CameraConfig = {
      cameraType: 'orthographic',
      fov: 50
    }
    const properties = { 'Camera Config': stored } as Dictionary<
      NodeProperty | undefined
    >
    stubSettings({ 'Comfy.Load3D.CameraType': 'perspective' })

    expect(createConfig(properties).loadCameraConfig()).toEqual(stored)
    expect(settingsGetMock).not.toHaveBeenCalled()
  })

  it('falls back to settings and a default fov of 35', () => {
    stubSettings({ 'Comfy.Load3D.CameraType': 'perspective' })

    expect(createConfig().loadCameraConfig()).toEqual({
      cameraType: 'perspective',
      fov: 35
    })
  })
})

describe('Load3DConfiguration.loadLightConfig', () => {
  beforeEach(() => {
    settingsGetMock.mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('falls back to settings with default hdri when nothing is persisted', () => {
    stubSettings({ 'Comfy.Load3D.LightIntensity': 4 })

    expect(createConfig().loadLightConfig()).toEqual({
      intensity: 4,
      hdri: hdriDefaults
    })
  })

  it('uses the persisted intensity over the setting when present', () => {
    const stored: Partial<LightConfig> = { intensity: 7 }
    const properties = { 'Light Config': stored } as Dictionary<
      NodeProperty | undefined
    >
    stubSettings({ 'Comfy.Load3D.LightIntensity': 4 })

    expect(createConfig(properties).loadLightConfig()).toEqual({
      intensity: 7,
      hdri: hdriDefaults
    })
  })

  it('falls back to the setting intensity when persisted intensity is missing', () => {
    const properties = { 'Light Config': {} } as Dictionary<
      NodeProperty | undefined
    >
    stubSettings({ 'Comfy.Load3D.LightIntensity': 4 })

    expect(createConfig(properties).loadLightConfig()).toEqual({
      intensity: 4,
      hdri: hdriDefaults
    })
  })

  it('merges persisted hdri partial over hdri defaults', () => {
    const stored: Partial<LightConfig> = {
      intensity: 2,
      hdri: { hdriPath: 'env.hdr', enabled: true } as LightConfig['hdri']
    }
    const properties = { 'Light Config': stored } as Dictionary<
      NodeProperty | undefined
    >

    expect(createConfig(properties).loadLightConfig()).toEqual({
      intensity: 2,
      hdri: {
        enabled: true,
        hdriPath: 'env.hdr',
        showAsBackground: false,
        intensity: 1
      }
    })
  })
})

describe('Load3DConfiguration.configure forwards persisted + settings to load3d', () => {
  let load3d: Load3d

  function makeLoad3dMock(): Load3d {
    return {
      loadModel: vi.fn().mockResolvedValue(undefined),
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
      setHDRIEnabled: vi.fn()
    } as unknown as Load3d
  }

  async function flush() {
    await new Promise<void>((resolve) => setTimeout(resolve, 0))
  }

  beforeEach(() => {
    settingsGetMock.mockReset()
    load3d = makeLoad3dMock()
    vi.mocked(Load3dUtils.splitFilePath).mockReturnValue(['', 'model.glb'])
    vi.mocked(Load3dUtils.getResourceURL).mockReturnValue('/view')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('uses settings defaults when no Scene/Camera/Light Config is persisted', async () => {
    stubSettings({
      'Comfy.Load3D.ShowGrid': true,
      'Comfy.Load3D.BackgroundColor': '282828',
      'Comfy.Load3D.CameraType': 'orthographic',
      'Comfy.Load3D.LightIntensity': 6
    })

    const config = new Load3DConfiguration(load3d)
    config.configure({
      modelWidget: { value: 'model.glb' } as unknown as IBaseWidget,
      loadFolder: 'output'
    })
    await flush()

    expect(load3d.toggleGrid).toHaveBeenCalledWith(true)
    expect(load3d.setBackgroundColor).toHaveBeenCalledWith('#282828')
    expect(load3d.toggleCamera).toHaveBeenCalledWith('orthographic')
    expect(load3d.setFOV).toHaveBeenCalledWith(35)
    expect(load3d.setLightIntensity).toHaveBeenCalledWith(6)
  })

  it('prefers persisted Scene/Camera/Light Config over settings', async () => {
    const properties = {
      'Scene Config': {
        showGrid: false,
        backgroundColor: '#101010',
        backgroundImage: ''
      },
      'Camera Config': { cameraType: 'perspective', fov: 60 },
      'Light Config': { intensity: 9 }
    } as unknown as Dictionary<NodeProperty | undefined>
    stubSettings({
      'Comfy.Load3D.ShowGrid': true,
      'Comfy.Load3D.BackgroundColor': '282828',
      'Comfy.Load3D.CameraType': 'orthographic',
      'Comfy.Load3D.LightIntensity': 1
    })

    const config = new Load3DConfiguration(load3d, properties)
    config.configure({
      modelWidget: { value: 'model.glb' } as unknown as IBaseWidget,
      loadFolder: 'output'
    })
    await flush()

    expect(load3d.toggleGrid).toHaveBeenCalledWith(false)
    expect(load3d.setBackgroundColor).toHaveBeenCalledWith('#101010')
    expect(load3d.toggleCamera).toHaveBeenCalledWith('perspective')
    expect(load3d.setFOV).toHaveBeenCalledWith(60)
    expect(load3d.setLightIntensity).toHaveBeenCalledWith(9)
  })
})
