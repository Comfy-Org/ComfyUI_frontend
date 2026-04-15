import { ref, toRaw, watch } from 'vue'
import QuickLRU from '@alloc/quick-lru'

import Load3d from '@/extensions/core/load3d/Load3d'
import Load3dUtils from '@/extensions/core/load3d/Load3dUtils'
import type {
  AnimationItem,
  BackgroundRenderModeType,
  CameraConfig,
  CameraState,
  CameraType,
  GizmoMode,
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

interface Load3dViewerState {
  backgroundColor: string
  showGrid: boolean
  cameraType: CameraType
  fov: number
  lightIntensity: number
  cameraState: CameraState | null
  backgroundImage: string
  backgroundRenderMode: BackgroundRenderModeType
  upDirection: UpDirection
  materialMode: MaterialMode
  gizmoEnabled: boolean
  gizmoMode: GizmoMode
}

const DEFAULT_STANDALONE_CONFIG: Load3dViewerState = {
  backgroundColor: '#282828',
  showGrid: true,
  cameraType: 'perspective',
  fov: 75,
  lightIntensity: 1,
  cameraState: null,
  backgroundImage: '',
  backgroundRenderMode: 'tiled',
  upDirection: 'original',
  materialMode: 'original',
  gizmoEnabled: false,
  gizmoMode: 'translate'
}

const standaloneConfigCache = new QuickLRU<string, Load3dViewerState>({
  maxSize: 50
})

/**
 * Composable for managing a 3D viewer instance.
 * Supports both node-based mode (applied to a LiteGraph node)
 * and standalone mode (for asset previews).
 *
 * @param node Optional LiteGraph node to sync state with
 */
export const useLoad3dViewer = (node?: LGraphNode) => {
  const backgroundColor = ref('')
  const showGrid = ref(true)
  const cameraType = ref<CameraType>('perspective')
  const fov = ref(75)
  const lightIntensity = ref(1)
  const backgroundImage = ref('')
  const hasBackgroundImage = ref(false)
  const backgroundRenderMode = ref<BackgroundRenderModeType>('tiled')
  const upDirection = ref<UpDirection>('original')
  const materialMode = ref<MaterialMode>('original')
  const gizmoEnabled = ref(false)
  const gizmoMode = ref<GizmoMode>('translate')
  const needApplyChanges = ref(true)
  const isPreview = ref(false)
  const isStandaloneMode = ref(false)
  const isSplatModel = ref(false)
  const isPlyModel = ref(false)

  // Animation state
  const animations = ref<AnimationItem[]>([])
  const playing = ref(false)
  const selectedSpeed = ref(1)
  const selectedAnimation = ref(0)
  const animationProgress = ref(0)
  const animationDuration = ref(0)

  let load3d: Load3d | null = null
  let sourceLoad3d: Load3d | null = null
  let currentModelUrl: string | null = null
  let mouseOnViewer = false

  const initialState = ref<Load3dViewerState>({
    backgroundColor: '#282828',
    showGrid: true,
    cameraType: 'perspective',
    fov: 75,
    lightIntensity: 1,
    cameraState: null,
    backgroundImage: '',
    backgroundRenderMode: 'tiled',
    upDirection: 'original',
    materialMode: 'original',
    gizmoEnabled: false,
    gizmoMode: 'translate'
  })

  watch(backgroundColor, (newColor) => {
    if (!load3d) return
    try {
      load3d.setBackgroundColor(newColor)
    } catch (error) {
      console.error('Error updating background color:', error)
      useToastStore().addAlert(
        t('toastMessages.failedToUpdateBackgroundColor', { color: newColor })
      )
    }
  })

  watch(showGrid, (newValue) => {
    if (!load3d) return
    try {
      load3d.toggleGrid(newValue)
    } catch (error) {
      console.error('Error toggling grid:', error)
      useToastStore().addAlert(
        t('toastMessages.failedToToggleGrid', { show: newValue ? 'on' : 'off' })
      )
    }
  })

  watch(cameraType, (newCameraType) => {
    if (!load3d) return
    try {
      load3d.toggleCamera(newCameraType)
    } catch (error) {
      console.error('Error toggling camera:', error)
      useToastStore().addAlert(
        t('toastMessages.failedToToggleCamera', { camera: newCameraType })
      )
    }
  })

  watch(fov, (newFov) => {
    if (!load3d) return
    try {
      load3d.setFOV(Number(newFov))
    } catch (error) {
      console.error('Error updating FOV:', error)
      useToastStore().addAlert(
        t('toastMessages.failedToUpdateFOV', { fov: newFov })
      )
    }
  })

  watch(lightIntensity, (newValue) => {
    if (!load3d) return
    try {
      load3d.setLightIntensity(Number(newValue))
    } catch (error) {
      console.error('Error updating light intensity:', error)
      useToastStore().addAlert(
        t('toastMessages.failedToUpdateLightIntensity', { intensity: newValue })
      )
    }
  })

  watch(backgroundImage, async (newValue) => {
    if (!load3d) return
    try {
      await load3d.setBackgroundImage(newValue)
      hasBackgroundImage.value = !!newValue
    } catch (error) {
      console.error('Error updating background image:', error)
      useToastStore().addAlert(t('toastMessages.failedToUpdateBackgroundImage'))
    }
  })

  watch(backgroundRenderMode, (newValue) => {
    if (!load3d) return
    try {
      load3d.setBackgroundRenderMode(newValue)
    } catch (error) {
      console.error('Error updating background render mode:', error)
      useToastStore().addAlert(
        t('toastMessages.failedToUpdateBackgroundRenderMode', {
          mode: newValue
        })
      )
    }
  })

  watch(upDirection, (newValue) => {
    if (!load3d) return
    try {
      load3d.setUpDirection(newValue)
    } catch (error) {
      console.error('Error updating up direction:', error)
      useToastStore().addAlert(
        t('toastMessages.failedToUpdateUpDirection', { direction: newValue })
      )
    }
  })

  watch(materialMode, (newValue) => {
    if (!load3d) return
    try {
      load3d.setMaterialMode(newValue)
    } catch (error) {
      console.error('Error updating material mode:', error)
      useToastStore().addAlert(
        t('toastMessages.failedToUpdateMaterialMode', { mode: newValue })
      )
    }
  })

  // Animation watches
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

  /**
   * Seeks to a specific progress point in the current animation.
   *
   * @param progress Progress percentage (0-100)
   */
  const handleSeek = (progress: number) => {
    if (load3d && animationDuration.value > 0) {
      const time = (progress / 100) * animationDuration.value
      load3d.setAnimationTime(time)
    }
  }

  /**
   * Sets up event listeners for animation-related events from the Load3d instance.
   */
  const setupAnimationEvents = () => {
    if (!load3d) return

    load3d.addEventListener(
      'animationListChange',
      (newValue: AnimationItem[]) => {
        animations.value = newValue
      }
    )

    load3d.addEventListener(
      'animationProgressChange',
      (data: { progress: number; currentTime: number; duration: number }) => {
        animationProgress.value = data.progress
        animationDuration.value = data.duration
      }
    )

    // Initialize animation list if animations already exist
    if (load3d.hasAnimations()) {
      const clips = load3d.animationManager.animationClips
      animations.value = clips.map((clip, index) => ({
        name: clip.name || `Animation ${index + 1}`,
        index
      }))
      animationDuration.value = load3d.getAnimationDuration()
    }
  }

  watch(gizmoEnabled, (newValue) => {
    if (load3d) {
      load3d.setGizmoEnabled(newValue)
    }
  })

  watch(gizmoMode, (newValue) => {
    if (load3d) {
      load3d.setGizmoMode(newValue)
    }
  })

  /**
   * Initializes the viewer in node mode using a source Load3d instance.
   *
   * @param containerRef The HTML element to mount the viewer in
   * @param source The source Load3d instance to copy state from
   */
  const initializeViewer = async (
    containerRef: HTMLElement,
    source: Load3d
  ) => {
    if (!containerRef || !node) return

    sourceLoad3d = source

    try {
      const width = node.widgets?.find((w) => w.name === 'width')
      const height = node.widgets?.find((w) => w.name === 'height')

      const hasTargetDimensions = !!(width && height)

      load3d = new Load3d(containerRef, {
        width: width ? (toRaw(width).value as number) : undefined,
        height: height ? (toRaw(height).value as number) : undefined,
        getDimensions: hasTargetDimensions
          ? () => ({
              width: width.value as number,
              height: height.value as number
            })
          : undefined,
        isViewerMode: hasTargetDimensions
      })

      if (mouseOnViewer) {
        load3d.updateStatusMouseOnViewer(true)
      }

      await useLoad3dService().copyLoad3dState(source, load3d)

      const sourceCameraState = source.getCameraState()

      const sceneConfig = node.properties['Scene Config'] as
        | SceneConfig
        | undefined
      const modelConfig = node.properties['Model Config'] as
        | ModelConfig
        | undefined
      const cameraConfig = node.properties['Camera Config'] as
        | CameraConfig
        | undefined
      const lightConfig = node.properties['Light Config'] as
        | LightConfig
        | undefined

      isPreview.value = node.type === 'Preview3D'

      if (sceneConfig) {
        backgroundColor.value =
          sceneConfig.backgroundColor ||
          source.sceneManager.currentBackgroundColor
        showGrid.value =
          sceneConfig.showGrid ?? source.sceneManager.gridHelper.visible
        backgroundRenderMode.value =
          sceneConfig.backgroundRenderMode ||
          source.sceneManager.backgroundRenderMode ||
          'tiled'

        const backgroundInfo = source.sceneManager.getCurrentBackgroundInfo()
        if (backgroundInfo.type === 'image' && sceneConfig.backgroundImage) {
          backgroundImage.value = sceneConfig.backgroundImage
          hasBackgroundImage.value = true
        } else {
          backgroundImage.value = ''
          hasBackgroundImage.value = false
        }
      }

      if (cameraConfig) {
        cameraType.value =
          cameraConfig.cameraType || source.getCurrentCameraType()
        fov.value =
          cameraConfig.fov || source.cameraManager.perspectiveCamera.fov
      }

      if (lightConfig) {
        lightIntensity.value = lightConfig.intensity || 1
      } else {
        lightIntensity.value = 1
      }

      if (modelConfig) {
        upDirection.value =
          modelConfig.upDirection || source.modelManager.currentUpDirection
        materialMode.value =
          modelConfig.materialMode || source.modelManager.materialMode
        if (modelConfig.gizmo) {
          gizmoEnabled.value = modelConfig.gizmo.enabled
          gizmoMode.value = modelConfig.gizmo.mode
        }
      }

      isSplatModel.value = source.isSplatModel()
      isPlyModel.value = source.isPlyModel()

      initialState.value = {
        backgroundColor: backgroundColor.value,
        showGrid: showGrid.value,
        cameraType: cameraType.value,
        fov: fov.value,
        lightIntensity: lightIntensity.value,
        cameraState: sourceCameraState,
        backgroundImage: backgroundImage.value,
        backgroundRenderMode: backgroundRenderMode.value,
        upDirection: upDirection.value,
        materialMode: materialMode.value,
        gizmoEnabled: gizmoEnabled.value,
        gizmoMode: gizmoMode.value
      }

      setupAnimationEvents()
    } catch (error) {
      console.error('Error initializing Load3d viewer:', error)
      useToastStore().addAlert(
        t('toastMessages.failedToInitializeLoad3dViewer')
      )
    }
  }

  /**
   * Initializes the viewer in standalone mode for asset preview.
   * Creates the Load3d instance once; subsequent calls reuse it.
   *
   * @param containerRef The HTML element to mount the viewer in
   * @param modelUrl URL of the model to load
   */
  const initializeStandaloneViewer = async (
    containerRef: HTMLElement,
    modelUrl: string
  ) => {
    if (!containerRef) return

    try {
      if (load3d) {
        await loadStandaloneModel(modelUrl)
        return
      }

      isStandaloneMode.value = true

      load3d = new Load3d(containerRef, {
        width: 800,
        height: 600,
        isViewerMode: true
      })

      if (mouseOnViewer) {
        load3d.updateStatusMouseOnViewer(true)
      }

      await load3d.loadModel(modelUrl)
      currentModelUrl = modelUrl
      restoreStandaloneConfig(modelUrl)
      isSplatModel.value = load3d.isSplatModel()
      isPlyModel.value = load3d.isPlyModel()

      isPreview.value = true

      setupAnimationEvents()
    } catch (error) {
      console.error('Error initializing standalone 3D viewer:', error)
      useToastStore().addAlert(t('toastMessages.failedToLoadModel'))
    }
  }

  /**
   * Load a new model into an existing standalone viewer,
   * reusing the same WebGLRenderer.
   */
  const loadStandaloneModel = async (modelUrl: string) => {
    if (!load3d) return

    try {
      saveStandaloneConfig()
      await load3d.loadModel(modelUrl)
      currentModelUrl = modelUrl
      restoreStandaloneConfig(modelUrl)
      isSplatModel.value = load3d.isSplatModel()
      isPlyModel.value = load3d.isPlyModel()
    } catch (error) {
      console.error('Error loading model in standalone viewer:', error)
      useToastStore().addAlert('Failed to load 3D model')
    }
  }

  /**
   * Saves the current viewer configuration to the standalone cache.
   */
  function saveStandaloneConfig() {
    if (!currentModelUrl) return
    standaloneConfigCache.set(currentModelUrl, {
      backgroundColor: backgroundColor.value,
      showGrid: showGrid.value,
      cameraType: cameraType.value,
      fov: fov.value,
      lightIntensity: lightIntensity.value,
      cameraState: load3d?.getCameraState() ?? null,
      backgroundImage: backgroundImage.value,
      backgroundRenderMode: backgroundRenderMode.value,
      upDirection: upDirection.value,
      materialMode: materialMode.value,
      gizmoEnabled: gizmoEnabled.value,
      gizmoMode: gizmoMode.value
    })
  }

  /**
   * Restores the viewer configuration from the standalone cache for the given model URL.
   *
   * @param modelUrl URL of the model to restore config for
   */
  function restoreStandaloneConfig(modelUrl: string) {
    const cached = standaloneConfigCache.get(modelUrl)
    const config = cached ?? DEFAULT_STANDALONE_CONFIG
    backgroundColor.value = config.backgroundColor
    showGrid.value = config.showGrid
    cameraType.value = config.cameraType
    fov.value = config.fov
    lightIntensity.value = config.lightIntensity
    backgroundImage.value = config.backgroundImage
    hasBackgroundImage.value = !!config.backgroundImage
    backgroundRenderMode.value = config.backgroundRenderMode
    upDirection.value = config.upDirection
    materialMode.value = config.materialMode
    gizmoEnabled.value = config.gizmoEnabled
    gizmoMode.value = config.gizmoMode
    if (cached?.cameraState && load3d) {
      load3d.setCameraState(cached.cameraState)
    }
  }

  /**
   * Exports the current model in the specified format.
   *
   * @param format The export format (e.g., 'glb', 'obj')
   */
  const exportModel = async (format: string) => {
    if (!load3d) return

    try {
      await load3d.exportModel(format)
    } catch (error) {
      console.error('Error exporting model:', error)
      useToastStore().addAlert(
        t('toastMessages.failedToExportModel', { format: format.toUpperCase() })
      )
    }
  }

  /**
   * Handles resizing the 3D viewer.
   */
  const handleResize = () => {
    load3d?.handleResize()
  }

  /**
   * Notifies the viewer that the mouse has entered the viewer area.
   */
  const handleMouseEnter = () => {
    mouseOnViewer = true
    load3d?.updateStatusMouseOnViewer(true)
  }

  /**
   * Notifies the viewer that the mouse has left the viewer area.
   */
  const handleMouseLeave = () => {
    mouseOnViewer = false
    load3d?.updateStatusMouseOnViewer(false)
  }

  /**
   * Restores the viewer state to its initial values when the viewer was opened.
   */
  const restoreInitialState = () => {
    if (!node) return

    const nodeValue = node

    needApplyChanges.value = false

    if (nodeValue.properties) {
      nodeValue.properties['Scene Config'] = {
        showGrid: initialState.value.showGrid,
        backgroundColor: initialState.value.backgroundColor,
        backgroundImage: initialState.value.backgroundImage,
        backgroundRenderMode: initialState.value.backgroundRenderMode
      }

      nodeValue.properties['Camera Config'] = {
        cameraType: initialState.value.cameraType,
        fov: initialState.value.fov
      }

      nodeValue.properties['Light Config'] = {
        intensity: initialState.value.lightIntensity
      }

      nodeValue.properties['Model Config'] = {
        upDirection: initialState.value.upDirection,
        materialMode: initialState.value.materialMode,
        gizmo: {
          enabled: initialState.value.gizmoEnabled,
          mode: initialState.value.gizmoMode,
          position: { x: 0, y: 0, z: 0 },
          rotation: { x: 0, y: 0, z: 0 }
        }
      }

      const currentCameraConfig = nodeValue.properties['Camera Config'] as
        | CameraConfig
        | undefined
      nodeValue.properties['Camera Config'] = {
        ...currentCameraConfig,
        state: initialState.value.cameraState
      }
    }
  }

  /**
   * Applies the current viewer changes back to the source node and its properties.
   *
   * @returns Promise resolving to true if changes were applied successfully
   */
  const applyChanges = async () => {
    if (!node || !sourceLoad3d || !load3d) return false

    const viewerCameraState = load3d.getCameraState()
    const nodeValue = node

    if (nodeValue.properties) {
      nodeValue.properties['Scene Config'] = {
        showGrid: showGrid.value,
        backgroundColor: backgroundColor.value,
        backgroundImage: backgroundImage.value,
        backgroundRenderMode: backgroundRenderMode.value
      }

      nodeValue.properties['Camera Config'] = {
        cameraType: cameraType.value,
        fov: fov.value,
        state: viewerCameraState
      }

      nodeValue.properties['Light Config'] = {
        intensity: lightIntensity.value
      }

      const gizmoTransform = load3d.getGizmoTransform()
      nodeValue.properties['Model Config'] = {
        upDirection: upDirection.value,
        materialMode: materialMode.value,
        showSkeleton: false,
        gizmo: {
          enabled: gizmoEnabled.value,
          mode: gizmoMode.value,
          position: gizmoTransform.position,
          rotation: gizmoTransform.rotation,
          scale: gizmoTransform.scale
        }
      }
    }

    await useLoad3dService().copyLoad3dState(load3d, sourceLoad3d)

    await sourceLoad3d.setBackgroundImage(backgroundImage.value)
    sourceLoad3d.setBackgroundRenderMode(backgroundRenderMode.value)

    sourceLoad3d.forceRender()

    if (nodeValue.graph) {
      nodeValue.graph.setDirtyCanvas(true, true)
    }

    return true
  }

  /**
   * Refreshes the viewport of the current Load3d instance.
   */
  const refreshViewport = () => {
    useLoad3dService().handleViewportRefresh(load3d)
  }

  /**
   * Returns the subfolder path for file uploads based on the node properties.
   *
   * @returns The subfolder string
   */
  const getUploadSubfolder = () => {
    const resourceFolder = String(
      node?.properties?.['Resource Folder'] ?? ''
    ).trim()
    return resourceFolder ? `3d/${resourceFolder}` : '3d'
  }

  /**
   * Handles updating the background image either by clearing it or uploading a new file.
   *
   * @param file The image file to upload, or null to clear the background
   */
  const handleBackgroundImageUpdate = async (file: File | null) => {
    if (!file) {
      backgroundImage.value = ''
      hasBackgroundImage.value = false
      return
    }

    if (!load3d) {
      useToastStore().addAlert(t('toastMessages.no3dScene'))
      return
    }

    try {
      const uploadPath = await Load3dUtils.uploadFile(
        file,
        getUploadSubfolder()
      )

      if (uploadPath) {
        backgroundImage.value = uploadPath
        hasBackgroundImage.value = true
      }
    } catch (error) {
      console.error('Error uploading background image:', error)
      useToastStore().addAlert(t('toastMessages.failedToUploadBackgroundImage'))
    }
  }

  /**
   * Handles dropping a new model file into the viewer.
   *
   * @param file The 3D model file to load
   */
  const handleModelDrop = async (file: File) => {
    if (!load3d) {
      useToastStore().addAlert(t('toastMessages.no3dScene'))
      return
    }

    try {
      const uploadedPath = await Load3dUtils.uploadFile(
        file,
        getUploadSubfolder()
      )

      if (!uploadedPath) {
        useToastStore().addAlert(t('toastMessages.fileUploadFailed'))
        return
      }

      const modelUrl = api.apiURL(
        Load3dUtils.getResourceURL(
          ...Load3dUtils.splitFilePath(uploadedPath),
          'input'
        )
      )

      await load3d.loadModel(modelUrl)

      const modelWidget = node?.widgets?.find((w) => w.name === 'model_file')
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
    }
  }

  /**
   * Cleans up the viewer resources and saves the current standalone config if applicable.
   */
  const cleanup = () => {
    if (isStandaloneMode.value) {
      saveStandaloneConfig()
    }
    mouseOnViewer = false
    load3d?.remove()
    load3d = null
    sourceLoad3d = null
    currentModelUrl = null
  }

  return {
    // State
    backgroundColor,
    showGrid,
    cameraType,
    fov,
    lightIntensity,
    backgroundImage,
    hasBackgroundImage,
    backgroundRenderMode,
    upDirection,
    materialMode,
    gizmoEnabled,
    gizmoMode,
    needApplyChanges,
    isPreview,
    isStandaloneMode,
    isSplatModel,
    isPlyModel,

    // Animation state
    animations,
    playing,
    selectedSpeed,
    selectedAnimation,
    animationProgress,
    animationDuration,

    // Methods
    initializeViewer,
    initializeStandaloneViewer,
    exportModel,
    handleResize,
    handleMouseEnter,
    handleMouseLeave,
    restoreInitialState,
    applyChanges,
    refreshViewport,
    handleBackgroundImageUpdate,
    handleModelDrop,
    handleSeek,
    resetGizmoTransform: () => {
      load3d?.resetGizmoTransform()
    },
    cleanup,

    hasSkeleton: false,
    intensity: lightIntensity,
    showSkeleton: false
  }
}
