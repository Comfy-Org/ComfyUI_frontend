import { toRef } from '@vueuse/core'
import type { MaybeRef } from '@vueuse/core'
import { nextTick, ref, toRaw, watch } from 'vue'

import Load3d from '@/extensions/core/load3d/Load3d'
import Load3dUtils from '@/extensions/core/load3d/Load3dUtils'
import type {
  AnimationItem,
  CameraConfig,
  CameraType,
  LightConfig,
  MaterialMode,
  ModelConfig,
  SceneConfig,
  UpDirection
} from '@/extensions/core/load3d/interfaces'
import { t } from '@/i18n'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import { useToastStore } from '@/platform/updates/common/toastStore'
import { api } from '@/scripts/api'
import { useLoad3dService } from '@/services/load3dService'

type Load3dReadyCallback = (load3d: Load3d) => void
export const nodeToLoad3dMap = new Map<LGraphNode, Load3d>()
const pendingCallbacks = new Map<LGraphNode, Load3dReadyCallback[]>()

export const useLoad3d = (nodeOrRef: MaybeRef<LGraphNode | null>) => {
  const nodeRef = toRef(nodeOrRef)
  let load3d: Load3d | null = null

  const sceneConfig = ref<SceneConfig>({
    showGrid: true,
    backgroundColor: '#000000',
    backgroundImage: ''
  })

  const modelConfig = ref<ModelConfig>({
    upDirection: 'original',
    materialMode: 'original'
  })

  const cameraConfig = ref<CameraConfig>({
    cameraType: 'perspective',
    fov: 75
  })

  const lightConfig = ref<LightConfig>({
    intensity: 5
  })

  const isRecording = ref(false)
  const hasRecording = ref(false)
  const recordingDuration = ref(0)

  const animations = ref<AnimationItem[]>([])
  const playing = ref(false)
  const selectedSpeed = ref(1)
  const selectedAnimation = ref(0)
  const loading = ref(false)
  const loadingMessage = ref('')
  const isPreview = ref(false)

  const initializeLoad3d = async (containerRef: HTMLElement) => {
    const rawNode = toRaw(nodeRef.value)
    if (!containerRef || !rawNode) return

    const node = rawNode as LGraphNode

    try {
      load3d = new Load3d(containerRef, {
        node
      })

      const widthWidget = node.widgets?.find((w) => w.name === 'width')
      const heightWidget = node.widgets?.find((w) => w.name === 'height')

      if (!(widthWidget && heightWidget)) {
        isPreview.value = true
      }

      await restoreConfigurationsFromNode(node)

      node.onMouseEnter = function () {
        load3d?.refreshViewport()

        load3d?.updateStatusMouseOnNode(true)
      }

      node.onMouseLeave = function () {
        load3d?.updateStatusMouseOnNode(false)
      }

      node.onResize = function () {
        load3d?.handleResize()
      }

      node.onDrawBackground = function () {
        if (load3d) {
          load3d.renderer.domElement.hidden = this.flags.collapsed ?? false
        }
      }

      node.onRemoved = function () {
        useLoad3dService().removeLoad3d(node)
        pendingCallbacks.delete(node)
      }

      nodeToLoad3dMap.set(node, load3d)

      const callbacks = pendingCallbacks.get(node)

      if (callbacks && load3d) {
        callbacks.forEach((callback) => {
          if (load3d) {
            callback(load3d)
          }
        })
        pendingCallbacks.delete(node)
      }

      handleEvents('add')
    } catch (error) {
      console.error('Error initializing Load3d:', error)
      useToastStore().addAlert(t('toastMessages.failedToInitializeLoad3d'))
    }
  }

  const restoreConfigurationsFromNode = async (node: LGraphNode) => {
    if (!load3d) return

    // Restore configs - watchers will handle applying them to the Three.js scene
    const savedSceneConfig = node.properties['Scene Config'] as SceneConfig
    if (savedSceneConfig) {
      sceneConfig.value = savedSceneConfig
    }

    const savedModelConfig = node.properties['Model Config'] as ModelConfig
    if (savedModelConfig) {
      modelConfig.value = savedModelConfig
    }

    const savedCameraConfig = node.properties['Camera Config'] as CameraConfig
    const cameraStateToRestore = savedCameraConfig?.state

    if (savedCameraConfig) {
      cameraConfig.value = savedCameraConfig
    }

    const savedLightConfig = node.properties['Light Config'] as LightConfig
    if (savedLightConfig) {
      lightConfig.value = savedLightConfig
    }

    const modelWidget = node.widgets?.find((w) => w.name === 'model_file')
    if (modelWidget?.value) {
      const modelUrl = getModelUrl(modelWidget.value as string)
      if (modelUrl) {
        loading.value = true
        loadingMessage.value = t('load3d.reloadingModel')
        try {
          await load3d.loadModel(modelUrl)

          if (cameraStateToRestore) {
            await nextTick()
            load3d.setCameraState(cameraStateToRestore)
          }
        } catch (error) {
          console.error('Failed to reload model:', error)
          useToastStore().addAlert(t('toastMessages.failedToLoadModel'))
        } finally {
          loading.value = false
          loadingMessage.value = ''
        }
      }
    } else if (cameraStateToRestore) {
      load3d.setCameraState(cameraStateToRestore)
    }
  }

  const getModelUrl = (modelPath: string): string | null => {
    if (!modelPath) return null

    try {
      if (modelPath.startsWith('http')) {
        return modelPath
      }

      const [subfolder, filename] = Load3dUtils.splitFilePath(modelPath)
      return api.apiURL(
        Load3dUtils.getResourceURL(
          subfolder,
          filename,
          isPreview.value ? 'output' : 'input'
        )
      )
    } catch (error) {
      console.error('Failed to construct model URL:', error)
      return null
    }
  }

  const waitForLoad3d = (callback: Load3dReadyCallback) => {
    const rawNode = toRaw(nodeRef.value)
    if (!rawNode) return

    const node = rawNode as LGraphNode
    const existingInstance = nodeToLoad3dMap.get(node)

    if (existingInstance) {
      callback(existingInstance)

      return
    }

    if (!pendingCallbacks.has(node)) {
      pendingCallbacks.set(node, [])
    }

    pendingCallbacks.get(node)!.push(callback)
  }

  watch(
    sceneConfig,
    (newValue) => {
      if (load3d && nodeRef.value) {
        nodeRef.value.properties['Scene Config'] = newValue
        load3d.toggleGrid(newValue.showGrid)
        load3d.setBackgroundColor(newValue.backgroundColor)
        void load3d.setBackgroundImage(newValue.backgroundImage || '')
      }
    },
    { deep: true }
  )

  watch(
    modelConfig,
    (newValue) => {
      if (load3d && nodeRef.value) {
        nodeRef.value.properties['Model Config'] = newValue
        load3d.setUpDirection(newValue.upDirection)
        load3d.setMaterialMode(newValue.materialMode)
      }
    },
    { deep: true }
  )

  watch(
    cameraConfig,
    (newValue) => {
      if (load3d && nodeRef.value) {
        nodeRef.value.properties['Camera Config'] = newValue
        load3d.toggleCamera(newValue.cameraType)
        load3d.setFOV(newValue.fov)
      }
    },
    { deep: true }
  )

  watch(
    lightConfig,
    (newValue) => {
      if (load3d && nodeRef.value) {
        nodeRef.value.properties['Light Config'] = newValue
        load3d.setLightIntensity(newValue.intensity)
      }
    },
    { deep: true }
  )

  watch(playing, (newValue) => {
    if (load3d) {
      load3d.toggleAnimation(newValue)
    }
  })

  watch(selectedSpeed, (newValue) => {
    if (load3d && newValue) {
      load3d.setAnimationSpeed(newValue)
    }
  })

  watch(selectedAnimation, (newValue) => {
    if (load3d && newValue !== undefined) {
      load3d.updateSelectedAnimation(newValue)
    }
  })

  const handleMouseEnter = () => {
    load3d?.updateStatusMouseOnScene(true)
  }

  const handleMouseLeave = () => {
    load3d?.updateStatusMouseOnScene(false)
  }

  const handleStartRecording = async () => {
    if (load3d) {
      await load3d.startRecording()
      isRecording.value = true
    }
  }

  const handleStopRecording = () => {
    if (load3d) {
      load3d.stopRecording()
      isRecording.value = false
      recordingDuration.value = load3d.getRecordingDuration()
      hasRecording.value = recordingDuration.value > 0
    }
  }

  const handleExportRecording = () => {
    if (load3d) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const filename = `${timestamp}-scene-recording.mp4`
      load3d.exportRecording(filename)
    }
  }

  const handleClearRecording = () => {
    if (load3d) {
      load3d.clearRecording()
      hasRecording.value = false
      recordingDuration.value = 0
    }
  }

  const handleBackgroundImageUpdate = async (file: File | null) => {
    if (!file) {
      sceneConfig.value.backgroundImage = ''
      await load3d?.setBackgroundImage('')
      return
    }

    const resourceFolder =
      (nodeRef.value?.properties['Resource Folder'] as string) || ''

    const subfolder = resourceFolder.trim()
      ? `3d/${resourceFolder.trim()}`
      : '3d'

    const uploadedPath = await Load3dUtils.uploadFile(file, subfolder)
    sceneConfig.value.backgroundImage = uploadedPath
    await load3d?.setBackgroundImage(uploadedPath)
  }

  const handleExportModel = async (format: string) => {
    if (!load3d) {
      useToastStore().addAlert(t('toastMessages.no3dSceneToExport'))
      return
    }

    try {
      await load3d.exportModel(format)
    } catch (error) {
      console.error('Error exporting model:', error)
      useToastStore().addAlert(
        t('toastMessages.failedToExportModel', {
          format: format.toUpperCase()
        })
      )
    }
  }

  const handleModelDrop = async (file: File) => {
    if (!load3d) {
      useToastStore().addAlert(t('toastMessages.no3dScene'))
      return
    }

    const node = toRaw(nodeRef.value)
    if (!node) return

    try {
      const resourceFolder =
        (node.properties['Resource Folder'] as string) || ''

      const subfolder = resourceFolder.trim()
        ? `3d/${resourceFolder.trim()}`
        : '3d'

      loading.value = true
      loadingMessage.value = t('load3d.uploadingModel')

      const uploadedPath = await Load3dUtils.uploadFile(file, subfolder)

      if (!uploadedPath) {
        useToastStore().addAlert(t('toastMessages.fileUploadFailed'))
        return
      }

      const modelUrl = api.apiURL(
        Load3dUtils.getResourceURL(
          ...Load3dUtils.splitFilePath(uploadedPath),
          isPreview.value ? 'output' : 'input'
        )
      )

      loadingMessage.value = t('load3d.loadingModel')
      await load3d.loadModel(modelUrl)

      const modelWidget = node.widgets?.find((w) => w.name === 'model_file')

      if (modelWidget) {
        const options = modelWidget.options as { values?: string[] } | undefined
        if (options?.values && !options.values.includes(uploadedPath)) {
          options.values.push(uploadedPath)
        }
        modelWidget.value = uploadedPath
      }
    } catch (error) {
      console.error('Model drop failed:', error)
      useToastStore().addAlert(t('toastMessages.failedToLoadModel'))
    } finally {
      loading.value = false
      loadingMessage.value = ''
    }
  }

  const eventConfig = {
    materialModeChange: (value: string) => {
      modelConfig.value.materialMode = value as MaterialMode
    },
    backgroundColorChange: (value: string) => {
      sceneConfig.value.backgroundColor = value
    },
    lightIntensityChange: (value: number) => {
      lightConfig.value.intensity = value
    },
    fovChange: (value: number) => {
      cameraConfig.value.fov = value
    },
    cameraTypeChange: (value: string) => {
      cameraConfig.value.cameraType = value as CameraType
    },
    showGridChange: (value: boolean) => {
      sceneConfig.value.showGrid = value
    },
    upDirectionChange: (value: string) => {
      modelConfig.value.upDirection = value as UpDirection
    },
    backgroundImageChange: (value: string) => {
      sceneConfig.value.backgroundImage = value
    },
    backgroundImageLoadingStart: () => {
      loadingMessage.value = t('load3d.loadingBackgroundImage')
      loading.value = true
    },
    backgroundImageLoadingEnd: () => {
      loadingMessage.value = ''
      loading.value = false
    },
    modelLoadingStart: () => {
      loadingMessage.value = t('load3d.loadingModel')
      loading.value = true
    },
    modelLoadingEnd: () => {
      loadingMessage.value = ''
      loading.value = false
    },
    exportLoadingStart: (message: string) => {
      loadingMessage.value = message || t('load3d.exportingModel')
      loading.value = true
    },
    exportLoadingEnd: () => {
      loadingMessage.value = ''
      loading.value = false
    },
    recordingStatusChange: (value: boolean) => {
      isRecording.value = value

      if (!value && load3d) {
        recordingDuration.value = load3d.getRecordingDuration()
        hasRecording.value = recordingDuration.value > 0
      }
    },
    animationListChange: (newValue: any) => {
      animations.value = newValue
    }
  } as const

  const handleEvents = (action: 'add' | 'remove') => {
    Object.entries(eventConfig).forEach(([event, handler]) => {
      const method = `${action}EventListener` as const
      load3d?.[method](event, handler)
    })
  }

  const cleanup = () => {
    handleEvents('remove')

    const rawNode = toRaw(nodeRef.value)
    if (!rawNode) return

    const node = rawNode as LGraphNode
    if (nodeToLoad3dMap.get(node) === load3d) {
      nodeToLoad3dMap.delete(node)
    }

    load3d?.remove()
    load3d = null
  }

  return {
    // state
    load3d,
    sceneConfig,
    modelConfig,
    cameraConfig,
    lightConfig,
    isRecording,
    isPreview,
    hasRecording,
    recordingDuration,
    animations,
    playing,
    selectedSpeed,
    selectedAnimation,
    loading,
    loadingMessage,

    // Methods
    initializeLoad3d,
    waitForLoad3d,
    handleMouseEnter,
    handleMouseLeave,
    handleStartRecording,
    handleStopRecording,
    handleExportRecording,
    handleClearRecording,
    handleBackgroundImageUpdate,
    handleExportModel,
    handleModelDrop,
    cleanup
  }
}
