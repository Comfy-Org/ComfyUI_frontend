import type { IWidget } from '@comfyorg/litegraph'

import Load3d from '@/extensions/core/load3d/Load3d'
import Load3dUtils from '@/extensions/core/load3d/Load3dUtils'
import { api } from '@/scripts/api'

class Load3DConfiguration {
  constructor(private load3d: Load3d) {}

  configure(
    loadFolder: 'input' | 'output',
    modelWidget: IWidget,
    material: IWidget,
    upDirection: IWidget,
    cameraState?: any,
    width: IWidget | null = null,
    height: IWidget | null = null,
    postModelUpdateFunc?: (load3d: Load3d) => void
  ) {
    this.setupModelHandling(
      modelWidget,
      loadFolder,
      cameraState,
      postModelUpdateFunc
    )
    this.setupMaterial(material)
    this.setupDirection(upDirection)
    this.setupTargetSize(width, height)
    this.setupDefaultProperties()
  }

  private setupTargetSize(width: IWidget | null, height: IWidget | null) {
    if (width && height) {
      this.load3d.setTargetSize(width.value as number, height.value as number)

      width.callback = (value: number) => {
        this.load3d.setTargetSize(value, height.value as number)
      }

      height.callback = (value: number) => {
        this.load3d.setTargetSize(width.value as number, value)
      }
    }
  }

  private setupModelHandling(
    modelWidget: IWidget,
    loadFolder: 'input' | 'output',
    cameraState?: any,
    postModelUpdateFunc?: (load3d: Load3d) => void
  ) {
    const onModelWidgetUpdate = this.createModelUpdateHandler(
      loadFolder,
      cameraState,
      postModelUpdateFunc
    )
    if (modelWidget.value) {
      onModelWidgetUpdate(modelWidget.value)
    }
    modelWidget.callback = onModelWidgetUpdate
  }

  private setupMaterial(material: IWidget) {
    material.callback = (value: 'original' | 'normal' | 'wireframe') => {
      this.load3d.setMaterialMode(value)
    }
    this.load3d.setMaterialMode(
      material.value as 'original' | 'normal' | 'wireframe'
    )
  }

  private setupDirection(upDirection: IWidget) {
    upDirection.callback = (
      value: 'original' | '-x' | '+x' | '-y' | '+y' | '-z' | '+z'
    ) => {
      this.load3d.setUpDirection(value)
    }
    this.load3d.setUpDirection(
      upDirection.value as 'original' | '-x' | '+x' | '-y' | '+y' | '-z' | '+z'
    )
  }

  private setupDefaultProperties() {
    const cameraType = this.load3d.loadNodeProperty(
      'Camera Type',
      'perspective'
    )
    this.load3d.toggleCamera(cameraType)

    const showGrid = this.load3d.loadNodeProperty('Show Grid', true)
    this.load3d.toggleGrid(showGrid)

    const bgColor = this.load3d.loadNodeProperty('Background Color', '#282828')

    this.load3d.setBackgroundColor(bgColor)

    const lightIntensity = this.load3d.loadNodeProperty('Light Intensity', '5')

    this.load3d.setLightIntensity(lightIntensity)

    const fov = this.load3d.loadNodeProperty('FOV', '75')

    this.load3d.setFOV(fov)
  }

  private createModelUpdateHandler(
    loadFolder: 'input' | 'output',
    cameraState?: any,
    postModelUpdateFunc?: (load3d: Load3d) => void
  ) {
    let isFirstLoad = true
    return async (value: string | number | boolean | object) => {
      if (!value) return

      const filename = value as string
      const modelUrl = api.apiURL(
        Load3dUtils.getResourceURL(
          ...Load3dUtils.splitFilePath(filename),
          loadFolder
        )
      )

      await this.load3d.loadModel(modelUrl, filename)

      if (postModelUpdateFunc) {
        postModelUpdateFunc(this.load3d)
      }

      if (isFirstLoad && cameraState && typeof cameraState === 'object') {
        try {
          this.load3d.setCameraState(cameraState)
        } catch (error) {
          console.warn('Failed to restore camera state:', error)
        }
        isFirstLoad = false
      }
    }
  }
}

export default Load3DConfiguration
