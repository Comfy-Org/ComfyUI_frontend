import { ref, toRaw, watch } from 'vue'

import Load3d from '@/extensions/core/load3d/Load3d'
import Load3dUtils from '@/extensions/core/load3d/Load3dUtils'
import {
  CameraType,
  MaterialMode,
  UpDirection
} from '@/extensions/core/load3d/interfaces'
import { t } from '@/i18n'
import { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import { useLoad3dService } from '@/services/load3dService'
import { useToastStore } from '@/stores/toastStore'

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
  edgeThreshold: number
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
  const edgeThreshold = ref(85)
  const needApplyChanges = ref(true)

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
    materialMode: 'original',
    edgeThreshold: 85
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

  watch(edgeThreshold, (newValue) => {
    if (!load3d) return
    try {
      load3d.setEdgeThreshold(Number(newValue))
    } catch (error) {
      console.error('Error updating edge threshold:', error)
      useToastStore().addAlert(
        t('toastMessages.failedToUpdateEdgeThreshold', { threshold: newValue })
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

      const sourceCameraType = source.getCurrentCameraType()
      const sourceCameraState = source.getCameraState()

      cameraType.value = sourceCameraType
      backgroundColor.value = source.sceneManager.currentBackgroundColor
      showGrid.value = source.sceneManager.gridHelper.visible
      lightIntensity.value = (node.properties['Light Intensity'] as number) || 1

      const backgroundInfo = source.sceneManager.getCurrentBackgroundInfo()
      if (
        backgroundInfo.type === 'image' &&
        node.properties['Background Image']
      ) {
        backgroundImage.value = node.properties['Background Image'] as string
        hasBackgroundImage.value = true
      } else {
        backgroundImage.value = ''
        hasBackgroundImage.value = false
      }

      if (sourceCameraType === 'perspective') {
        fov.value = source.cameraManager.perspectiveCamera.fov
      }

      upDirection.value = source.modelManager.currentUpDirection
      materialMode.value = source.modelManager.materialMode
      edgeThreshold.value = (node.properties['Edge Threshold'] as number) || 85

      initialState.value = {
        backgroundColor: backgroundColor.value,
        showGrid: showGrid.value,
        cameraType: cameraType.value,
        fov: fov.value,
        lightIntensity: lightIntensity.value,
        cameraState: sourceCameraState,
        backgroundImage: backgroundImage.value,
        upDirection: upDirection.value,
        materialMode: materialMode.value,
        edgeThreshold: edgeThreshold.value
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
      nodeValue.properties['Background Color'] =
        initialState.value.backgroundColor
      nodeValue.properties['Show Grid'] = initialState.value.showGrid
      nodeValue.properties['Camera Type'] = initialState.value.cameraType
      nodeValue.properties['FOV'] = initialState.value.fov
      nodeValue.properties['Light Intensity'] =
        initialState.value.lightIntensity
      nodeValue.properties['Camera Info'] = initialState.value.cameraState
      nodeValue.properties['Background Image'] =
        initialState.value.backgroundImage
    }
  }

  const applyChanges = async () => {
    if (!sourceLoad3d || !load3d) return false

    const viewerCameraState = load3d.getCameraState()
    const nodeValue = node

    if (nodeValue.properties) {
      nodeValue.properties['Background Color'] = backgroundColor.value
      nodeValue.properties['Show Grid'] = showGrid.value
      nodeValue.properties['Camera Type'] = cameraType.value
      nodeValue.properties['FOV'] = fov.value
      nodeValue.properties['Light Intensity'] = lightIntensity.value
      nodeValue.properties['Camera Info'] = viewerCameraState
      nodeValue.properties['Background Image'] = backgroundImage.value
    }

    await useLoad3dService().copyLoad3dState(load3d, sourceLoad3d)

    if (backgroundImage.value) {
      await sourceLoad3d.setBackgroundImage(backgroundImage.value)
    }

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
    edgeThreshold,
    needApplyChanges,

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
    cleanup
  }
}
