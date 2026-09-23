import { fromAny, fromPartial } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, reactive } from 'vue'

import type Load3d from '@/extensions/core/load3d/Load3d'
import Load3DConfiguration from '@/extensions/core/load3d/Load3DConfiguration'
import Load3dUtils from '@/extensions/core/load3d/Load3dUtils'
import type { ComfyApi } from '@/scripts/api'
import type { ComfyApp } from '@/scripts/app'
import { parseAnnotatedPath } from '@/utils/createAnnotatedPath'
import type {
  CameraConfig,
  GizmoConfig,
  LightConfig,
  ModelConfig,
  SceneConfig,
  StoredModelConfig
} from '@/extensions/core/load3d/interfaces'
import type {
  IBaseWidget,
  INumericWidget
} from '@/lib/litegraph/src/types/widgets'
import type { Dictionary } from '@/lib/litegraph/src/interfaces'
import type { NodeProperty } from '@/lib/litegraph/src/LGraphNode'
import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
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

function reactiveWidget(value: IBaseWidget['value']): IBaseWidget {
  return reactive(fromPartial<IBaseWidget>({ value }))
}

function reactiveNumericWidget(value: number): INumericWidget {
  return reactive(fromPartial<INumericWidget>({ type: 'number', value }))
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
    const legacyGizmo: Partial<GizmoConfig> = {
      enabled: true,
      mode: 'rotate',
      position: { x: 1, y: 2, z: 3 },
      rotation: { x: 0.1, y: 0.2, z: 0.3 }
    }
    const stored: StoredModelConfig = {
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
  let loadModelSpy: ReturnType<typeof vi.fn<Load3d['loadModel']>>

  function makeLoad3dMock(): Load3d {
    loadModelSpy = vi.fn<Load3d['loadModel']>().mockResolvedValue(true)
    return {
      loadModel: loadModelSpy,
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
    await nextTick()
    await Promise.resolve()
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

  it('does not publish effects for a load superseded by clear', async () => {
    let resolveLoad!: (accepted: boolean) => void
    const load3d = makeLoad3dMock()
    vi.mocked(load3d.loadModel).mockImplementation(
      () =>
        new Promise<boolean>((resolve) => {
          resolveLoad = resolve
        })
    )
    const modelWidget = reactiveWidget('a.glb')
    const config = new Load3DConfiguration(load3d)

    config.configure({ modelWidget, loadFolder: 'output' })
    modelWidget.value = ''
    resolveLoad(false)
    await flush()

    expect(load3d.setUpDirection).not.toHaveBeenCalled()
    expect(load3d.setMaterialMode).not.toHaveBeenCalled()
    expect(load3d.emitModelReady).not.toHaveBeenCalled()
  })

  it('publishes effects only for the replacement after clear', async () => {
    let resolveFirst!: (accepted: boolean) => void
    let resolveSecond!: (accepted: boolean) => void
    const load3d = makeLoad3dMock()
    vi.mocked(load3d.loadModel)
      .mockImplementationOnce(
        () =>
          new Promise<boolean>((resolve) => {
            resolveFirst = resolve
          })
      )
      .mockImplementationOnce(
        () =>
          new Promise<boolean>((resolve) => {
            resolveSecond = resolve
          })
      )
    const modelWidget = reactiveWidget('a.glb')
    const config = new Load3DConfiguration(load3d)

    config.configure({ modelWidget, loadFolder: 'output' })
    modelWidget.value = ''
    modelWidget.value = 'b.glb'
    resolveFirst(false)
    resolveSecond(true)
    await flush()

    expect(load3d.setUpDirection).toHaveBeenCalledTimes(1)
    expect(load3d.setMaterialMode).toHaveBeenCalledTimes(1)
    expect(load3d.emitModelReady).toHaveBeenCalledTimes(1)
  })
})

describe('parseAnnotatedPath', () => {
  it('strips a [output] suffix and switches to the output folder', () => {
    expect(parseAnnotatedPath('foo.glb [output]', 'input')).toEqual({
      filepath: 'foo.glb',
      rootFolder: 'output'
    })
  })

  it('strips a [input] suffix and switches to the input folder', () => {
    expect(parseAnnotatedPath('sub/foo.glb [input]', 'output')).toEqual({
      filepath: 'sub/foo.glb',
      rootFolder: 'input'
    })
  })

  it('strips a [temp] suffix and switches to the temp folder', () => {
    expect(parseAnnotatedPath('foo.glb [temp]', 'input')).toEqual({
      filepath: 'foo.glb',
      rootFolder: 'temp'
    })
  })

  it('returns the value unchanged with the fallback folder when unannotated', () => {
    expect(parseAnnotatedPath('foo.glb', 'input')).toEqual({
      filepath: 'foo.glb',
      rootFolder: 'input'
    })
  })

  it('does not strip a non-folder annotation', () => {
    expect(parseAnnotatedPath('foo.glb [draft]', 'input')).toEqual({
      filepath: 'foo.glb [draft]',
      rootFolder: 'input'
    })
  })

  it('only matches a trailing annotation, not one in the middle', () => {
    expect(parseAnnotatedPath('foo [output] bar.glb', 'input')).toEqual({
      filepath: 'foo [output] bar.glb',
      rootFolder: 'input'
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
      loadModel: vi.fn<Load3d['loadModel']>().mockResolvedValue(true),
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
    await nextTick()
    await Promise.resolve()
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
  let loadModelSpy: ReturnType<typeof vi.fn<Load3d['loadModel']>>
  let clearModelSpy: ReturnType<typeof vi.fn>

  function makeLoad3dMock(): Load3d {
    let cleanup: (() => void) | undefined
    loadModelSpy = vi.fn<Load3d['loadModel']>().mockResolvedValue(true)
    clearModelSpy = vi.fn()
    return fromPartial<Load3d>({
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
      setConfigurationCleanup: vi.fn((nextCleanup: () => void) => {
        cleanup?.()
        cleanup = nextCleanup
      })
    })
  }

  async function flush() {
    await nextTick()
    await Promise.resolve()
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

  it('stops reacting as soon as the viewer lifecycle is removed', async () => {
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
    loadModelSpy.mockClear()

    modelWidget.value = 'ignored.glb'
    await flush()

    expect(loadModelSpy).not.toHaveBeenCalled()
  })

  it('reloads the model when the CRDT follower writes model_file through widgetValueStore', async () => {
    const onSceneInvalidated = vi.fn()
    const graph = new LGraph()
    const node = new LGraphNode('Load3D')
    graph.add(node)
    const modelWidget = node.addWidget(
      'string',
      'model_file',
      'none',
      () => undefined
    )
    const widgetId = modelWidget.widgetId
    if (!widgetId) throw new Error('Expected a store-backed widget id')

    new Load3DConfiguration(load3d).configure({
      modelWidget,
      loadFolder: 'input',
      onSceneInvalidated
    })
    await flush()
    loadModelSpy.mockClear()
    onSceneInvalidated.mockClear()

    const applied = useWidgetValueStore().setValue(widgetId, 'agent.glb', {
      source: 'agent-remote',
      actor: 'agent:e2e',
      opId: 'op-1'
    })

    expect(applied).toBe(true)
    expect(onSceneInvalidated).toHaveBeenCalledTimes(1)
    expect(loadModelSpy).toHaveBeenCalledWith(expect.any(String), 'agent.glb', {
      silentOnNotFound: false
    })
    expect(modelWidget.value).toBe('agent.glb')
  })

  it('stops reacting to the previous widget once configure runs with a replacement', async () => {
    const oldWidget = reactiveWidget('none')
    const replacementWidget = reactiveWidget('none')
    const config = new Load3DConfiguration(load3d)
    config.configure({ modelWidget: oldWidget, loadFolder: 'input' })
    config.configure({ modelWidget: replacementWidget, loadFolder: 'input' })
    await flush()
    loadModelSpy.mockClear()

    oldWidget.value = 'stale.glb'
    replacementWidget.value = 'restored.glb'
    await flush()

    expect(loadModelSpy).toHaveBeenCalledTimes(1)
    expect(loadModelSpy).toHaveBeenCalledWith(
      expect.any(String),
      'restored.glb',
      { silentOnNotFound: false }
    )
  })
})

describe('Load3DConfiguration.onSceneInvalidated', () => {
  function makeLoad3dMock(): Load3d {
    return {
      loadModel: vi.fn<Load3d['loadModel']>().mockResolvedValue(true),
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
    await nextTick()
    await Promise.resolve()
  }

  beforeEach(() => {
    vi.mocked(Load3dUtils.splitFilePath).mockReturnValue(['', 'model.glb'])
    vi.mocked(Load3dUtils.getResourceURL).mockReturnValue('/view')
  })

  it('width.callback invokes onSceneInvalidated', async () => {
    const onSceneInvalidated = vi.fn()
    const width = reactiveNumericWidget(1024)
    const height = reactiveNumericWidget(1024)
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
    const width = reactiveNumericWidget(1024)
    const height = reactiveNumericWidget(1024)
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
    const width = reactiveNumericWidget(1024)
    const height = reactiveNumericWidget(1024)
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
