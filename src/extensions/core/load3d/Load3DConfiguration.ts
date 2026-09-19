import { effectScope, watch } from 'vue'

import { LOAD3D_NONE_MODEL } from '@/extensions/core/load3d/constants'
import type Load3d from '@/extensions/core/load3d/Load3d'
import Load3dUtils from '@/extensions/core/load3d/Load3dUtils'
import type {
  CameraConfig,
  CameraState,
  HDRIConfig,
  LightConfig,
  GizmoConfig,
  ModelConfig,
  SceneConfig,
  StoredModelConfig
} from '@/extensions/core/load3d/interfaces'
import type { Dictionary } from '@/lib/litegraph/src/interfaces'
import type { NodeProperty } from '@/lib/litegraph/src/LGraphNode'
import type {
  IBaseWidget,
  INumericWidget
} from '@/lib/litegraph/src/types/widgets'
import { useSettingStore } from '@/platform/settings/settingStore'
import { api } from '@/scripts/api'

type Load3DConfigurationSettings = {
  loadFolder: string
  modelWidget: IBaseWidget
  cameraState?: CameraState
  width?: INumericWidget
  height?: INumericWidget
  bgImagePath?: string
  silentOnNotFound?: boolean
  /**
   * Called when any change to one of the wired widgets (model_file, width,
   * height), local or remote, makes the previously captured scene stale.
   * Backend caching covers these inputs by themselves; this hook lets the
   * caller invalidate any frontend-side capture cache so the next serialize
   * re-renders at the new state.
   */
  onSceneInvalidated?: () => void
}

const ANNOTATED_FILENAME_PATTERN = / \[(input|output|temp)\]$/

export function parseAnnotatedFilename(
  rawValue: string,
  fallbackFolder: string
): { filename: string; folder: string } {
  const match = ANNOTATED_FILENAME_PATTERN.exec(rawValue)
  if (!match) return { filename: rawValue, folder: fallbackFolder }
  return {
    filename: rawValue.slice(0, match.index),
    folder: match[1]
  }
}

const DEFAULT_GIZMO: GizmoConfig = {
  enabled: false,
  mode: 'translate',
  position: { x: 0, y: 0, z: 0 },
  rotation: { x: 0, y: 0, z: 0 },
  scale: { x: 1, y: 1, z: 1 }
}

class Load3DConfiguration {
  constructor(
    private load3d: Load3d,
    private properties?: Dictionary<NodeProperty | undefined>
  ) {}

  configureForSaveMesh(
    loadFolder: 'input' | 'output' | 'temp',
    filePath: string,
    options?: { silentOnNotFound?: boolean }
  ) {
    this.setupModelHandlingForSaveMesh(
      filePath,
      loadFolder,
      options?.silentOnNotFound ?? false
    )
    this.setupDefaultProperties()
  }

  configure(setting: Load3DConfigurationSettings) {
    const onModelWidgetUpdate = this.setupModelHandling(
      setting.modelWidget,
      setting.loadFolder,
      setting.cameraState,
      setting.silentOnNotFound ?? false
    )
    this.setupTargetSize(setting.width, setting.height)
    this.setupReactiveHandling(setting, onModelWidgetUpdate)
    this.setupDefaultProperties(setting.bgImagePath)
  }

  private setupReactiveHandling(
    setting: Load3DConfigurationSettings,
    onModelWidgetUpdate: (value: IBaseWidget['value']) => Promise<void>
  ): void {
    const scope = effectScope()
    scope.run(() => {
      watch(
        () => setting.modelWidget.value,
        (value) => {
          void onModelWidgetUpdate(value)
          setting.onSceneInvalidated?.()
        },
        { flush: 'sync' }
      )

      const { width, height } = setting
      if (width && height) {
        watch(
          [() => width.value, () => height.value],
          ([nextWidth, nextHeight]) => {
            this.load3d.setTargetSize(nextWidth, nextHeight)
            setting.onSceneInvalidated?.()
          },
          { flush: 'sync' }
        )
      }
    })
    this.load3d.setConfigurationCleanup(() => scope.stop())
  }

  private setupTargetSize(width?: INumericWidget, height?: INumericWidget) {
    if (width && height) {
      this.load3d.setTargetSize(width.value, height.value)
    }
  }

  private setupModelHandlingForSaveMesh(
    filePath: string,
    loadFolder: string,
    silentOnNotFound: boolean
  ) {
    const onModelWidgetUpdate = this.createModelUpdateHandler(
      loadFolder,
      undefined,
      silentOnNotFound
    )

    if (filePath) {
      void onModelWidgetUpdate(filePath)
    }
  }

  private setupModelHandling(
    modelWidget: IBaseWidget,
    loadFolder: string,
    cameraState?: CameraState,
    silentOnNotFound: boolean = false
  ) {
    const onModelWidgetUpdate = this.createModelUpdateHandler(
      loadFolder,
      cameraState,
      silentOnNotFound
    )
    if (modelWidget.value && modelWidget.value !== LOAD3D_NONE_MODEL) {
      void onModelWidgetUpdate(modelWidget.value)
    }

    return onModelWidgetUpdate
  }

  private setupDefaultProperties(bgImagePath?: string) {
    const sceneConfig = this.loadSceneConfig()
    this.applySceneConfig(sceneConfig, bgImagePath)

    const cameraConfig = this.loadCameraConfig()
    this.applyCameraConfig(cameraConfig)

    const lightConfig = this.loadLightConfig()
    this.applyLightConfig(lightConfig)
    if (lightConfig.hdri) this.applyHDRISettings(lightConfig.hdri)
  }

  private loadSceneConfig(): SceneConfig {
    if (this.properties && 'Scene Config' in this.properties) {
      return this.properties['Scene Config'] as SceneConfig
    }

    return {
      showGrid: useSettingStore().get('Comfy.Load3D.ShowGrid'),
      backgroundColor:
        '#' + useSettingStore().get('Comfy.Load3D.BackgroundColor'),
      backgroundImage: ''
    }
  }

  private loadCameraConfig(): CameraConfig {
    if (this.properties && 'Camera Config' in this.properties) {
      return this.properties['Camera Config'] as CameraConfig
    }

    return {
      cameraType: useSettingStore().get('Comfy.Load3D.CameraType'),
      fov: 35
    }
  }

  private loadLightConfig(): LightConfig {
    const hdriDefaults: HDRIConfig = {
      enabled: false,
      hdriPath: '',
      showAsBackground: false,
      intensity: 1
    }

    if (this.properties && 'Light Config' in this.properties) {
      const saved = this.properties['Light Config'] as Partial<LightConfig>
      return {
        intensity:
          saved.intensity ??
          useSettingStore().get('Comfy.Load3D.LightIntensity'),
        hdri: { ...hdriDefaults, ...(saved.hdri ?? {}) }
      }
    }

    return {
      intensity: useSettingStore().get('Comfy.Load3D.LightIntensity'),
      hdri: hdriDefaults
    }
  }

  private loadModelConfig(): ModelConfig {
    const stored = this.properties?.['Model Config'] as
      | StoredModelConfig
      | undefined
    const config: ModelConfig = {
      upDirection: 'original',
      materialMode: 'original',
      showSkeleton: false,
      ...stored,
      gizmo: { ...DEFAULT_GIZMO, ...stored?.gizmo }
    }
    if (stored) stored.gizmo = config.gizmo
    return config
  }

  private applySceneConfig(config: SceneConfig, bgImagePath?: string) {
    this.load3d.toggleGrid(config.showGrid)
    this.load3d.setBackgroundColor(config.backgroundColor)
    if (config.backgroundImage) {
      if (bgImagePath && bgImagePath != config.backgroundImage) {
        return
      }

      void this.load3d.setBackgroundImage(config.backgroundImage)

      if (config.backgroundRenderMode) {
        this.load3d.setBackgroundRenderMode(config.backgroundRenderMode)
      }
    }
  }

  private applyCameraConfig(config: CameraConfig) {
    this.load3d.toggleCamera(config.cameraType)
    this.load3d.setFOV(config.fov)

    if (config.state) {
      this.load3d.setCameraState(config.state)
    }
  }

  private applyLightConfig(config: LightConfig) {
    this.load3d.setLightIntensity(config.intensity)
  }

  private applyHDRISettings(config: HDRIConfig) {
    if (!config.hdriPath) return
    this.load3d.setHDRIIntensity(config.intensity)
    this.load3d.setHDRIAsBackground(config.showAsBackground)
    if (config.enabled) {
      this.load3d.setHDRIEnabled(true)
    }
  }

  private applyModelConfig(config: ModelConfig) {
    this.load3d.setUpDirection(config.upDirection)
    this.load3d.setMaterialMode(config.materialMode)
  }

  private createModelUpdateHandler(
    loadFolder: string,
    cameraState?: CameraState,
    silentOnNotFound: boolean = false
  ) {
    let isFirstLoad = true
    return async (value: IBaseWidget['value']) => {
      if (!value || value === LOAD3D_NONE_MODEL) {
        this.load3d.clearModel()
        return
      }

      const { filename, folder } = parseAnnotatedFilename(
        value as string,
        loadFolder
      )

      this.setResourceFolder(filename)

      const modelUrl = api.apiURL(
        Load3dUtils.getResourceURL(
          ...Load3dUtils.splitFilePath(filename),
          folder
        )
      )

      const accepted = await this.load3d.loadModel(modelUrl, filename, {
        silentOnNotFound
      })
      if (!accepted) return

      const modelConfig = this.loadModelConfig()
      this.applyModelConfig(modelConfig)

      if (isFirstLoad && cameraState) {
        try {
          this.load3d.setCameraState(cameraState)
        } catch (error) {
          console.warn('Failed to restore camera state:', error)
        }
        isFirstLoad = false
      }

      this.load3d.emitModelReady()
    }
  }

  private setResourceFolder(filename: string): void {
    const pathParts = filename.split('/').filter((part) => part.trim())

    if (pathParts.length <= 2) {
      return
    }

    const subfolderParts = pathParts.slice(1, -1)
    const subfolder = subfolderParts.join('/')

    if (subfolder && this.properties) {
      this.properties['Resource Folder'] = subfolder
    }
  }
}

export default Load3DConfiguration
