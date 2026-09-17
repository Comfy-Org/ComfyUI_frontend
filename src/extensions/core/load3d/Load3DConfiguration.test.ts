import { fromAny, fromPartial } from '@total-typescript/shoehorn'
import fc from 'fast-check'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { reactive } from 'vue'

import type Load3d from '@/extensions/core/load3d/Load3d'
import Load3DConfiguration, {
  parseAnnotatedFilename
} from '@/extensions/core/load3d/Load3DConfiguration'
import Load3dUtils from '@/extensions/core/load3d/Load3dUtils'
import type { ComfyApi } from '@/scripts/api'
import type { ComfyApp } from '@/scripts/app'
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
import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { useSettingStore } from '@/platform/settings/settingStore'
import type { Settings } from '@/platform/settings/types'

vi.mock(import('@/scripts/api'), () => ({
  api: fromPartial<ComfyApi>({
    apiURL: (p: string) => p,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchCustomEvent: vi.fn(),
    fetchApi: vi.fn(),
    getSystemStats: vi.fn()
  })
}))

vi.mock(import('@/scripts/app'), () => ({
  app: fromPartial<ComfyApp>({ rootGraph: { extra: {} } })
}))

vi.mock(import('@/extensions/core/load3d/Load3d'), () => ({
  default: fromAny(class {})
}))

vi.mock(import('@/extensions/core/load3d/Load3dUtils'), () => ({
  default: fromAny({
    splitFilePath: vi.fn(),
    getResourceURL: vi.fn()
  })
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

function stubSettings(values: Partial<Settings>) {
  vi.mocked(useSettingStore().get).mockImplementation((key) => values[key])
}

function reactiveWidget(
  value: IBaseWidget['value'],
  widgetId?: string
): IBaseWidget {
  return reactive(fromPartial<IBaseWidget>({ value, widgetId }))
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
      emitModelReady: vi.fn(),
      setConfigurationCleanup: vi.fn()
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

  it('configureForSaveMesh also emits modelReady once the load resolves', async () => {
    const load3d = makeLoad3dMock()
    const config = new Load3DConfiguration(load3d)
    config.configureForSaveMesh('output', 'model.glb')
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

describe('Load3DConfiguration.loadSceneConfig', () => {
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
    expect(useSettingStore().get).not.toHaveBeenCalled()
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
    expect(useSettingStore().get).not.toHaveBeenCalled()
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
    return fromPartial<Load3d>({
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
      setHDRIEnabled: vi.fn(),
      emitModelReady: vi.fn(),
      setConfigurationCleanup: vi.fn()
    })
  }

  async function flush() {
    await new Promise<void>((resolve) => setTimeout(resolve, 0))
  }

  beforeEach(() => {
    load3d = makeLoad3dMock()
    vi.mocked(Load3dUtils.splitFilePath).mockReturnValue(['', 'model.glb'])
    vi.mocked(Load3dUtils.getResourceURL).mockReturnValue('/view')
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

describe('Load3DConfiguration "none" model handling', () => {
  let load3d: Load3d
  let loadModelSpy: ReturnType<typeof vi.fn>
  let clearModelSpy: ReturnType<typeof vi.fn>

  function makeLoad3dMock(): Load3d {
    loadModelSpy = vi.fn().mockResolvedValue(undefined)
    clearModelSpy = vi.fn()
    return {
      loadModel: loadModelSpy,
      clearModel: clearModelSpy,
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
      emitModelReady: vi.fn(),
      setConfigurationCleanup: vi.fn()
    } as unknown as Load3d
  }

  async function flush() {
    await new Promise<void>((resolve) => setTimeout(resolve, 0))
  }

  beforeEach(() => {
    load3d = makeLoad3dMock()
    vi.mocked(Load3dUtils.splitFilePath).mockReturnValue(['', 'model.glb'])
    vi.mocked(Load3dUtils.getResourceURL).mockReturnValue('/view')
  })

  it('does not load or clear a model when the initial widget value is "none"', async () => {
    const config = new Load3DConfiguration(load3d)
    config.configure({
      modelWidget: { value: 'none' } as unknown as IBaseWidget,
      loadFolder: 'input'
    })
    await flush()

    expect(loadModelSpy).not.toHaveBeenCalled()
    expect(clearModelSpy).not.toHaveBeenCalled()
  })

  it('clears the model (and skips loadModel) when the widget value changes to "none"', async () => {
    const config = new Load3DConfiguration(load3d)
    const widget = reactiveWidget('model.glb')
    config.configure({ modelWidget: widget, loadFolder: 'input' })
    await flush()

    loadModelSpy.mockClear()
    clearModelSpy.mockClear()

    widget.value = 'none'
    await flush()

    expect(clearModelSpy).toHaveBeenCalledTimes(1)
    expect(loadModelSpy).not.toHaveBeenCalled()
  })

  it('loads a model when the widget value transitions from "none" to a real path', async () => {
    const config = new Load3DConfiguration(load3d)
    const widget = reactiveWidget('none')
    config.configure({ modelWidget: widget, loadFolder: 'input' })
    await flush()

    expect(loadModelSpy).not.toHaveBeenCalled()

    widget.value = 'model.glb'
    await flush()

    expect(loadModelSpy).toHaveBeenCalledWith(expect.any(String), 'model.glb', {
      silentOnNotFound: false
    })
  })
})

describe('Load3DConfiguration.onSceneInvalidated', () => {
  function makeLoad3dMock(): Load3d {
    return {
      loadModel: vi.fn().mockResolvedValue(undefined),
      clearModel: vi.fn(),
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
      emitModelReady: vi.fn(),
      setConfigurationCleanup: vi.fn()
    } as unknown as Load3d
  }

  async function flush() {
    await new Promise<void>((resolve) => setTimeout(resolve, 0))
  }

  beforeEach(() => {
    vi.mocked(Load3dUtils.splitFilePath).mockReturnValue(['', 'model.glb'])
    vi.mocked(Load3dUtils.getResourceURL).mockReturnValue('/view')
  })

  it('width.callback invokes onSceneInvalidated', async () => {
    const onSceneInvalidated = vi.fn()
    const width = reactiveWidget(1024)
    const height = reactiveWidget(1024)
    const config = new Load3DConfiguration(makeLoad3dMock())

    config.configure({
      modelWidget: { value: 'none' } as unknown as IBaseWidget,
      loadFolder: 'input',
      width,
      height,
      onSceneInvalidated
    })
    await flush()

    width.value = 2048

    expect(onSceneInvalidated).toHaveBeenCalledTimes(1)
  })

  it('height.callback invokes onSceneInvalidated', async () => {
    const onSceneInvalidated = vi.fn()
    const width = reactiveWidget(1024)
    const height = reactiveWidget(1024)
    const config = new Load3DConfiguration(makeLoad3dMock())

    config.configure({
      modelWidget: { value: 'none' } as unknown as IBaseWidget,
      loadFolder: 'input',
      width,
      height,
      onSceneInvalidated
    })
    await flush()

    height.value = 2048

    expect(onSceneInvalidated).toHaveBeenCalledTimes(1)
  })

  it('model_file widget callback invokes onSceneInvalidated after the model loads', async () => {
    const onSceneInvalidated = vi.fn()
    const modelWidget = reactiveWidget('none')
    const config = new Load3DConfiguration(makeLoad3dMock())

    config.configure({
      modelWidget,
      loadFolder: 'input',
      onSceneInvalidated
    })
    await flush()

    modelWidget.value = 'model.glb'
    await flush()

    expect(onSceneInvalidated).toHaveBeenCalled()
  })

  it('preserves any pre-existing model widget callback alongside the invalidation hook', async () => {
    const onSceneInvalidated = vi.fn()
    const original = vi.fn()
    const modelWidget = reactiveWidget('none')
    Object.assign(modelWidget, {
      value: 'none',
      callback: original
    })
    const config = new Load3DConfiguration(makeLoad3dMock())

    config.configure({
      modelWidget,
      loadFolder: 'input',
      onSceneInvalidated
    })
    await flush()

    modelWidget.value = 'model.glb'
    modelWidget.callback?.('model.glb')
    await flush()

    expect(original).toHaveBeenCalledWith('model.glb')
    expect(onSceneInvalidated).toHaveBeenCalled()
  })

  it('callbacks remain safe when onSceneInvalidated is omitted', async () => {
    const width = reactiveWidget(1024)
    const height = reactiveWidget(1024)
    const modelWidget = reactiveWidget('none')
    const config = new Load3DConfiguration(makeLoad3dMock())

    config.configure({
      modelWidget,
      loadFolder: 'input',
      width,
      height
    })
    await flush()

    expect(() => {
      width.value = 2048
    }).not.toThrow()
    expect(() => {
      height.value = 2048
    }).not.toThrow()
    expect(() => {
      modelWidget.value = 'model.glb'
    }).not.toThrow()
  })
})

// PM-1011: after the agent interacts with the graph, Load3D preview capture
// stopped working. Root cause: the agent/CRDT follower writes widget values
// straight into widgetValueStore (graphMutations.ts `setWidget`), bypassing
// this file's `Object.defineProperty` override on `modelWidget.value`. That
// override is the only thing that reloads the Three.js scene and marks the
// capture cache dirty, so a remote-origin model_file change left the scene
// (and the next capture) stale. These tests pin the bridge that fixes it.
describe('Load3DConfiguration remote (agent) model updates', () => {
  function makeLoad3dMock(): Load3d {
    let cleanup: (() => void) | undefined
    return fromPartial<Load3d>({
      loadModel: vi.fn().mockResolvedValue(undefined),
      clearModel: vi.fn(),
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
      emitModelReady: vi.fn(),
      setConfigurationCleanup: vi.fn((nextCleanup: () => void) => {
        cleanup?.()
        cleanup = nextCleanup
      })
    })
  }

  async function flush() {
    await new Promise<void>((resolve) => setTimeout(resolve, 0))
  }

  beforeEach(() => {
    vi.mocked(Load3dUtils.splitFilePath).mockReturnValue(['', 'model.glb'])
    vi.mocked(Load3dUtils.getResourceURL).mockReturnValue('/view')
  })

  it('reloads the model when the agent changes model_file via widgetValueStore', async () => {
    const load3d = makeLoad3dMock()
    const onSceneInvalidated = vi.fn()
    const modelWidget = reactiveWidget('none', 'widget-1')

    const config = new Load3DConfiguration(load3d)
    config.configure({
      modelWidget,
      loadFolder: 'input',
      onSceneInvalidated
    })
    await flush()
    vi.mocked(load3d.loadModel).mockClear()
    onSceneInvalidated.mockClear()

    // Simulate the agent/CRDT follower's setWidget write: the store value
    // changes but nothing ever assigns `modelWidget.value` directly.
    modelWidget.value = 'agent-model.glb'
    await flush()

    expect(load3d.loadModel).toHaveBeenCalledWith(
      expect.any(String),
      'agent-model.glb',
      { silentOnNotFound: false }
    )
    expect(onSceneInvalidated).toHaveBeenCalled()
    expect(modelWidget.value).toBe('agent-model.glb')
  })

  it('clears the model when the agent clears model_file via widgetValueStore', async () => {
    const load3d = makeLoad3dMock()
    const onSceneInvalidated = vi.fn()
    const modelWidget = reactiveWidget('model.glb', 'widget-clear')

    const config = new Load3DConfiguration(load3d)
    config.configure({ modelWidget, loadFolder: 'input', onSceneInvalidated })
    await flush()
    vi.mocked(load3d.clearModel).mockClear()
    onSceneInvalidated.mockClear()

    modelWidget.value = ''
    await flush()

    expect(load3d.clearModel).toHaveBeenCalledTimes(1)
    expect(onSceneInvalidated).toHaveBeenCalledTimes(1)
    expect(modelWidget.value).toBe('')
  })

  it('reacts once to local model changes through the shared state path', async () => {
    const load3d = makeLoad3dMock()
    const onSceneInvalidated = vi.fn()
    const modelWidget = reactiveWidget('none', 'widget-2')

    const config = new Load3DConfiguration(load3d)
    config.configure({ modelWidget, loadFolder: 'input', onSceneInvalidated })
    await flush()
    vi.mocked(load3d.loadModel).mockClear()
    vi.mocked(load3d.clearModel).mockClear()
    onSceneInvalidated.mockClear()

    modelWidget.value = 'local-change.glb'
    await flush()

    expect(load3d.loadModel).toHaveBeenCalledTimes(1)
    expect(load3d.clearModel).not.toHaveBeenCalled()
    expect(onSceneInvalidated).toHaveBeenCalledTimes(1)
    expect(modelWidget.value).toBe('local-change.glb')
  })

  it('invalidates synchronously before queueing can observe stale capture state', () => {
    const load3d = makeLoad3dMock()
    const onSceneInvalidated = vi.fn()
    const modelWidget = reactiveWidget('none', 'sync-widget')
    new Load3DConfiguration(load3d).configure({
      modelWidget,
      loadFolder: 'input',
      onSceneInvalidated
    })

    modelWidget.value = 'replacement.glb'

    expect(onSceneInvalidated).toHaveBeenCalledTimes(1)
    expect(load3d.loadModel).toHaveBeenCalledTimes(1)
  })

  it('preserves exactly-once model effects across generated value sequences', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.constantFrom('', 'none', 'a.glb', 'b.obj'), {
          minLength: 1,
          maxLength: 20
        }),
        async (values) => {
          const load3d = makeLoad3dMock()
          const modelWidget = reactiveWidget('none', 'generated-widget')
          new Load3DConfiguration(load3d).configure({
            modelWidget,
            loadFolder: 'input'
          })
          vi.mocked(load3d.loadModel).mockClear()
          vi.mocked(load3d.clearModel).mockClear()

          let previous = 'none'
          let loads = 0
          let clears = 0
          for (const value of values) {
            if (value !== previous) {
              if (!value || value === 'none') clears++
              else loads++
              previous = value
            }
            modelWidget.value = value
          }
          await flush()

          expect(load3d.loadModel).toHaveBeenCalledTimes(loads)
          expect(load3d.clearModel).toHaveBeenCalledTimes(clears)
        }
      ),
      { numRuns: 100 }
    )
  })

  it('ignores value changes for a different widget id', async () => {
    const load3d = makeLoad3dMock()
    const onSceneInvalidated = vi.fn()
    const modelWidget = reactiveWidget('none', 'widget-3')
    const otherWidget = reactiveWidget('none', 'some-other-widget')

    const config = new Load3DConfiguration(load3d)
    config.configure({ modelWidget, loadFolder: 'input', onSceneInvalidated })
    await flush()
    vi.mocked(load3d.loadModel).mockClear()
    vi.mocked(load3d.clearModel).mockClear()
    onSceneInvalidated.mockClear()

    otherWidget.value = 'agent-model.glb'
    await flush()

    expect(load3d.loadModel).not.toHaveBeenCalled()
    expect(load3d.clearModel).not.toHaveBeenCalled()
    expect(onSceneInvalidated).not.toHaveBeenCalled()
    expect(modelWidget.value).toBe('none')
  })

  it('does not register a second listener when configure runs again for the same widget', async () => {
    const load3d = makeLoad3dMock()
    const onSceneInvalidated = vi.fn()
    const modelWidget = reactiveWidget('none', 'widget-4')

    const config = new Load3DConfiguration(load3d)
    config.configure({ modelWidget, loadFolder: 'input', onSceneInvalidated })
    config.configure({ modelWidget, loadFolder: 'input', onSceneInvalidated })
    await flush()

    expect(load3d.setConfigurationCleanup).toHaveBeenCalledTimes(2)

    vi.mocked(load3d.loadModel).mockClear()
    onSceneInvalidated.mockClear()
    modelWidget.value = 'agent-model.glb'
    await flush()

    expect(load3d.loadModel).toHaveBeenCalledTimes(1)
    expect(onSceneInvalidated).toHaveBeenCalledTimes(1)
  })

  it('stops reacting as soon as the viewer lifecycle is removed', async () => {
    const load3d = makeLoad3dMock()
    const graph = new LGraph()
    const node = new LGraphNode('Load3D')
    graph.add(node)
    const modelWidget = node.addWidget(
      'string',
      'model_file',
      'none',
      () => undefined
    )
    const config = new Load3DConfiguration(load3d)
    config.configure({ modelWidget, loadFolder: 'input' })
    await flush()
    const cleanup = vi
      .mocked(load3d.setConfigurationCleanup)
      .mock.calls.at(-1)?.[0]
    if (!cleanup) throw new Error('Expected reactive configuration cleanup')
    graph.remove(node)
    expect(modelWidget.widgetId).toBeUndefined()
    cleanup()
    vi.mocked(load3d.loadModel).mockClear()
    modelWidget.value = 'ignored.glb'
    await flush()
    expect(load3d.loadModel).not.toHaveBeenCalled()
  })

  it('isolates a replacement widget that reuses the same id', async () => {
    const load3d = makeLoad3dMock()
    const oldWidget = reactiveWidget('none', 'widget-6')
    const replacementWidget = reactiveWidget('none', 'widget-6')

    const config = new Load3DConfiguration(load3d)
    config.configure({ modelWidget: oldWidget, loadFolder: 'input' })
    config.configure({ modelWidget: replacementWidget, loadFolder: 'input' })
    await flush()
    vi.mocked(load3d.loadModel).mockClear()

    oldWidget.value = 'stale.glb'
    replacementWidget.value = 'restored.glb'
    await flush()

    expect(load3d.loadModel).toHaveBeenCalledTimes(1)
    expect(load3d.loadModel).toHaveBeenCalledWith(
      expect.any(String),
      'restored.glb',
      { silentOnNotFound: false }
    )
  })
})
