import type { IBaseWidget } from '@comfyorg/litegraph/dist/types/widgets'

import Load3d from '@/extensions/core/load3d/Load3d'
import Load3dUtils from '@/extensions/core/load3d/Load3dUtils'
import { api } from '@/scripts/api'
import { useSettingStore } from '@/stores/settingStore'

class Load3DConfiguration {
  constructor(private load3d: Load3d) {}

  configureForSaveMesh(loadFolder: 'input' | 'output', filePath: string) {
    this.setupModelHandlingForSaveMesh(filePath, loadFolder)
    this.setupDefaultProperties()
  }

  configure(
    loadFolder: 'input' | 'output',
    modelWidget: IBaseWidget,
    cameraState?: any,
    width: IBaseWidget | null = null,
    height: IBaseWidget | null = null
  ) {
    this.setupModelHandling(modelWidget, loadFolder, cameraState)
    this.setupTargetSize(width, height)
    this.setupDefaultProperties()
  }

  private setupTargetSize(
    width: IBaseWidget | null,
    height: IBaseWidget | null
  ) {
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

  private setupModelHandlingForSaveMesh(
    filePath: string,
    loadFolder: 'input' | 'output'
  ) {
    const onModelWidgetUpdate = this.createModelUpdateHandler(loadFolder)

    if (filePath) {
      onModelWidgetUpdate(filePath)
    }
  }

  private setupModelHandling(
    modelWidget: IBaseWidget,
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

    modelWidget.callback = (value: string | number | boolean | object) => {
      this.load3d.node.properties['Texture'] = undefined

      onModelWidgetUpdate(value)
    }
  }

  private setupDefaultProperties() {
    const cameraType = this.load3d.loadNodeProperty(
      'Camera Type',
      useSettingStore().get('Comfy.Load3D.CameraType')
    )
    this.load3d.toggleCamera(cameraType)

    const showGrid = this.load3d.loadNodeProperty(
      'Show Grid',
      useSettingStore().get('Comfy.Load3D.ShowGrid')
    )

    this.load3d.toggleGrid(showGrid)

    const showPreview = this.load3d.loadNodeProperty(
      'Show Preview',
      useSettingStore().get('Comfy.Load3D.ShowPreview')
    )

    this.load3d.togglePreview(showPreview)

    const bgColor = this.load3d.loadNodeProperty(
      'Background Color',
      '#' + useSettingStore().get('Comfy.Load3D.BackgroundColor')
    )

    this.load3d.setBackgroundColor(bgColor)

    const lightIntensity: number = Number(
      this.load3d.loadNodeProperty(
        'Light Intensity',
        useSettingStore().get('Comfy.Load3D.LightIntensity')
      )
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

      const texturePath = this.load3d.loadNodeProperty('Texture', null)

      if (texturePath) {
        await this.load3d.applyTexture(texturePath)
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
