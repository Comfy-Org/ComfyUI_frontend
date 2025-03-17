import type { IWidget } from '@comfyorg/litegraph'

import Load3d from '@/extensions/core/load3d/Load3d'
import Load3dUtils from '@/extensions/core/load3d/Load3dUtils'
import { api } from '@/scripts/api'

class Load3DConfiguration {
  constructor(private load3d: Load3d) {}

  configure(
    loadFolder: 'input' | 'output',
    modelWidget: IWidget,
    cameraState?: any,
    width: IWidget | null = null,
    height: IWidget | null = null
  ) {
    this.setupModelHandling(modelWidget, loadFolder, cameraState)
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
    cameraState?: any
  ) {
    const onModelWidgetUpdate = this.createModelUpdateHandler(
      loadFolder,
      cameraState
    )
    if (modelWidget.value) {
      onModelWidgetUpdate(modelWidget.value)
    }
    modelWidget.callback = onModelWidgetUpdate
  }

  private setupDefaultProperties() {
    const cameraType = this.load3d.loadNodeProperty(
      'Camera Type',
      'perspective'
    )
    this.load3d.toggleCamera(cameraType)

    const showGrid = this.load3d.loadNodeProperty('Show Grid', true)

    this.load3d.toggleGrid(showGrid)

    const showPreview = this.load3d.loadNodeProperty('Show Preview', true)

    this.load3d.togglePreview(showPreview)

    const bgColor = this.load3d.loadNodeProperty('Background Color', '#282828')

    this.load3d.setBackgroundColor(bgColor)

    const lightIntensity: number = Number(
      this.load3d.loadNodeProperty('Light Intensity', 5)
    )

    this.load3d.setLightIntensity(lightIntensity)

    const fov: number = Number(this.load3d.loadNodeProperty('FOV', 35))

    this.load3d.setFOV(fov)

    const backgroundImage = this.load3d.loadNodeProperty('Background Image', '')

    this.load3d.setBackgroundImage(backgroundImage)
  }

  private createModelUpdateHandler(
    loadFolder: 'input' | 'output',
    cameraState?: any
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

      const upDirection = this.load3d.loadNodeProperty(
        'Up Direction',
        'original'
      )

      this.load3d.setUpDirection(upDirection)

      const materialMode = this.load3d.loadNodeProperty(
        'Material Mode',
        'original'
      )

      this.load3d.setMaterialMode(materialMode)

      const edgeThreshold: number = Number(
        this.load3d.loadNodeProperty('Edge Threshold', 85)
      )

      this.load3d.setEdgeThreshold(edgeThreshold)

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
