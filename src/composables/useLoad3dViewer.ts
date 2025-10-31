import { ref, toRaw, watch } from 'vue'

import Load3d from '@/extensions/core/load3d/Load3d'
import Load3dUtils from '@/extensions/core/load3d/Load3dUtils'
import type {
  CameraType,
  MaterialMode,
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
  cameraState: any
  backgroundImage: string
  upDirection: UpDirection
  materialMode: MaterialMode
}

export const useLoad3dViewer = (node: LGraphNode) => {
  const backgroundColor = ref('')
  const showGrid = ref(true)
  const cameraType = ref<CameraType>('perspective')
  const fov = ref(75)
  const lightIntensity = ref(1)
  const backgroundImage = ref('')
  const hasBackgroundImage = ref(false)
  const upDirection = ref<UpDirection>('original')
  const materialMode = ref<MaterialMode>('original')
  const needApplyChanges = ref(true)
  const isPreview = ref(false)

  let load3d: Load3d | null = null
  let sourceLoad3d: Load3d | null = null

  const initialState = ref<Load3dViewerState>({
    backgroundColor: '#282828',
    showGrid: true,
    cameraType: 'perspective',
    fov: 75,
    lightIntensity: 1,
    cameraState: null,
    backgroundImage: '',
    upDirection: 'original',
    materialMode: 'original'
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

  const initializeViewer = async (
    containerRef: HTMLElement,
    source: Load3d
  ) => {
    if (!containerRef) return

    sourceLoad3d = source

    try {
      load3d = new Load3d(containerRef, {
        node: node,
        disablePreview: true,
        isViewerMode: true
      })

      await useLoad3dService().copyLoad3dState(source, load3d)

      const sourceCameraState = source.getCameraState()

      const sceneConfig = node.properties['Scene Config'] as any
      const modelConfig = node.properties['Model Config'] as any
      const cameraConfig = node.properties['Camera Config'] as any
      const lightConfig = node.properties['Light Config'] as any

      isPreview.value = node.type === 'Preview3D'

      if (sceneConfig) {
        backgroundColor.value =
          sceneConfig.backgroundColor ||
          source.sceneManager.currentBackgroundColor
        showGrid.value =
          sceneConfig.showGrid ?? source.sceneManager.gridHelper.visible

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
      }

      initialState.value = {
        backgroundColor: backgroundColor.value,
        showGrid: showGrid.value,
        cameraType: cameraType.value,
        fov: fov.value,
        lightIntensity: lightIntensity.value,
        cameraState: sourceCameraState,
        backgroundImage: backgroundImage.value,
        upDirection: upDirection.value,
        materialMode: materialMode.value
      }

      const width = node.widgets?.find((w) => w.name === 'width')
      const height = node.widgets?.find((w) => w.name === 'height')

      if (width && height) {
        load3d.setTargetSize(
          toRaw(width).value as number,
          toRaw(height).value as number
        )
      }
    } catch (error) {
      console.error('Error initializing Load3d viewer:', error)
      useToastStore().addAlert(
        t('toastMessages.failedToInitializeLoad3dViewer')
      )
    }
  }

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

  const handleResize = () => {
    load3d?.handleResize()
  }

  const handleMouseEnter = () => {
    load3d?.updateStatusMouseOnViewer(true)
  }

  const handleMouseLeave = () => {
    load3d?.updateStatusMouseOnViewer(false)
  }

  const restoreInitialState = () => {
    const nodeValue = node

    needApplyChanges.value = false

    if (nodeValue.properties) {
      nodeValue.properties['Scene Config'] = {
        showGrid: initialState.value.showGrid,
        backgroundColor: initialState.value.backgroundColor,
        backgroundImage: initialState.value.backgroundImage
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
        materialMode: initialState.value.materialMode
      }

      const currentCameraConfig = nodeValue.properties['Camera Config'] as any
      nodeValue.properties['Camera Config'] = {
        ...currentCameraConfig,
        state: initialState.value.cameraState
      }
    }
  }

  const applyChanges = async () => {
    if (!sourceLoad3d || !load3d) return false

    const viewerCameraState = load3d.getCameraState()
    const nodeValue = node

    if (nodeValue.properties) {
      nodeValue.properties['Scene Config'] = {
        showGrid: showGrid.value,
        backgroundColor: backgroundColor.value,
        backgroundImage: backgroundImage.value
      }

      nodeValue.properties['Camera Config'] = {
        cameraType: cameraType.value,
        fov: fov.value,
        state: viewerCameraState
      }

      nodeValue.properties['Light Config'] = {
        intensity: lightIntensity.value
      }

      nodeValue.properties['Model Config'] = {
        upDirection: upDirection.value,
        materialMode: materialMode.value
      }
    }

    await useLoad3dService().copyLoad3dState(load3d, sourceLoad3d)

    await sourceLoad3d.setBackgroundImage(backgroundImage.value)

    sourceLoad3d.forceRender()

    if (nodeValue.graph) {
      nodeValue.graph.setDirtyCanvas(true, true)
    }

    return true
  }

  const refreshViewport = () => {
    useLoad3dService().handleViewportRefresh(load3d)
  }

  const handleBackgroundImageUpdate = async (file: File | null) => {
    if (!file) {
      backgroundImage.value = ''
      hasBackgroundImage.value = false
      return
    }

    try {
      const resourceFolder =
        (node.properties['Resource Folder'] as string) || ''
      const subfolder = resourceFolder.trim()
        ? `3d/${resourceFolder.trim()}`
        : '3d'

      const uploadPath = await Load3dUtils.uploadFile(file, subfolder)

      if (uploadPath) {
        backgroundImage.value = uploadPath
        hasBackgroundImage.value = true
      }
    } catch (error) {
      console.error('Error uploading background image:', error)
      useToastStore().addAlert(t('toastMessages.failedToUploadBackgroundImage'))
    }
  }

  const handleModelDrop = async (file: File) => {
    if (!load3d) {
      useToastStore().addAlert(t('toastMessages.no3dScene'))
      return
    }

    try {
      const resourceFolder =
        (node.properties['Resource Folder'] as string) || ''
      const subfolder = resourceFolder.trim()
        ? `3d/${resourceFolder.trim()}`
        : '3d'

      const uploadedPath = await Load3dUtils.uploadFile(file, subfolder)

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
    }
  }

  const cleanup = () => {
    load3d?.remove()
    load3d = null
    sourceLoad3d = null
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
    upDirection,
    materialMode,
    needApplyChanges,
    isPreview,

    // Methods
    initializeViewer,
    exportModel,
    handleResize,
    handleMouseEnter,
    handleMouseLeave,
    restoreInitialState,
    applyChanges,
    refreshViewport,
    handleBackgroundImageUpdate,
    handleModelDrop,
    cleanup
  }
}
